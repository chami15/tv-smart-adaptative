// Executor de planos: backup → revalidação → passo a passo com conferência → checagem de saúde.
// Qualquer falha → desfaz em ordem inversa. Queda de conexão → diário fica "interrompido" para desfazer depois.
import { AdbError } from '../adb/errors.ts';
import type { AdbExecutor, DeviceShell } from '../adb/executor.ts';
import { type Catalog, classifyPackage, isCoreProtected } from '../catalog/index.ts';
import { AndroidFamilyDriver } from '../drivers/android.ts';
import type { DeviceInventory } from '../inventory/collect.ts';
import { parsePackageList, parseProcMeminfo, parseResolveHome } from '../inventory/parsers.ts';
import { writeSnapshot } from '../snapshot/index.ts';
import { WriteGrant } from './grant.ts';
import { type Journal, JournalStore, NEEDS_ATTENTION, type JournalStep } from './journal.ts';
import { type ChangePlan, deviceContext, hashPlan, type Rejection, revalidatePlan } from './plan.ts';

export interface ExecuteDeps {
  adb: AdbExecutor;
  catalog: Catalog;
  dataDir: string;
  /** Pausa entre passos (ms) — dá tempo da TV respirar. 0 nos testes. */
  stepDelayMs?: number;
}

export type ExecutionStatus = 'completed' | 'rolled-back' | 'rollback-failed' | 'interrupted' | 'refused';

export interface ExecutionResult {
  planId: string;
  status: ExecutionStatus;
  message: string;
  steps: JournalStep[];
  snapshotDir?: string;
  memoryBeforeKb?: number | null;
  memoryAfterKb?: number | null;
  problems?: Rejection[];
}

const CONNECTION_LOST: ReadonlySet<string> = new Set(['DEVICE_OFFLINE', 'DEVICE_NOT_FOUND', 'DEVICE_UNAUTHORIZED', 'TIMEOUT', 'ADB_NOT_FOUND']);

function isConnectionLost(err: unknown): boolean {
  return err instanceof AdbError && CONNECTION_LOST.has(err.code);
}

async function disabledSet(shell: DeviceShell): Promise<Set<string>> {
  return new Set(parsePackageList(await shell.listPackages('-d')));
}

const sleep = (ms: number) => (ms ? new Promise((r) => setTimeout(r, ms)) : Promise.resolve());

export async function executePlan(plan: ChangePlan, deps: ExecuteDeps): Promise<ExecutionResult> {
  const store = new JournalStore(deps.dataDir);
  const shell = deps.adb.forDevice(plan.serial);
  const base = { planId: plan.id, steps: [] as JournalStep[] };

  // 0. Mudança anterior pela metade nesta TV? Resolver primeiro.
  if ((await store.needingAttention(plan.deviceId)).length) {
    return { ...base, status: 'refused', message: 'Existe uma mudança anterior que não terminou nesta TV. Desfaça-a antes de continuar.' };
  }
  if (hashPlan(plan) !== plan.hash) return { ...base, status: 'refused', message: 'O plano foi alterado depois de revisado.' };

  // 1. Leitura fresca + revalidação + backup obrigatório.
  let fresh: DeviceInventory;
  try {
    fresh = await new AndroidFamilyDriver(shell).readInventory();
  } catch (err) {
    return { ...base, status: 'refused', message: `Não consegui ler a TV antes de mudar nada: ${err instanceof Error ? err.message : err}` };
  }
  const problems = revalidatePlan(plan, fresh, deps.catalog);
  if (problems.length) return { ...base, status: 'refused', message: 'A TV mudou desde que o plano foi feito. Revise de novo.', problems };
  let snapshotDir: string;
  try {
    snapshotDir = (await writeSnapshot(fresh, deps.dataDir, { reason: `antes do plano ${plan.id}` })).dir;
  } catch (err) {
    return { ...base, status: 'refused', message: `Sem backup, nada é alterado: ${err instanceof Error ? err.message : err}` };
  }

  const journal: Journal = {
    schemaVersion: 1,
    planId: plan.id,
    plan,
    deviceId: plan.deviceId,
    status: 'running',
    snapshotDir,
    steps: plan.actions.map((a) => ({ kind: a.kind, pkg: a.pkg, label: a.label, status: 'pending' })),
    startedAt: new Date().toISOString(),
    updatedAt: '',
  };
  await store.save(journal);
  const grant = WriteGrant.forPlan(plan);
  const memoryBeforeKb = fresh.memory.availableKb;

  // 2. Passo a passo, conferindo cada um.
  let failure: unknown = null;
  for (const step of journal.steps) {
    step.status = 'started';
    await store.save(journal);
    try {
      // defesa em profundidade: reconfere a classificação na hora
      if (step.kind === 'disable' && classifyPackage(step.pkg, deviceContext(fresh), deps.catalog).level === 'protected') {
        throw new AdbError('COMMAND_REFUSED', `App intocável: ${step.label}`);
      }
      await shell.setEnabled(step.pkg, step.kind === 'enable', grant);
      const disabled = await disabledSet(shell);
      if (disabled.has(step.pkg) !== (step.kind === 'disable')) throw new AdbError('UNEXPECTED_OUTPUT', 'A TV disse que mudou, mas a conferência mostrou que não.');
      step.status = 'done';
      await store.save(journal);
      await sleep(deps.stepDelayMs ?? 0);
    } catch (err) {
      step.status = 'failed';
      step.error = err instanceof Error ? err.message : String(err);
      failure = err;
      await store.save(journal);
      break;
    }
  }

  // 3. Checagem de saúde. Efeitos colaterais entram no diário para também serem desfeitos.
  if (!failure) {
    try {
      const health = await healthCheck(shell, fresh, plan, deps.catalog);
      if (health.problem) failure = new Error(health.problem);
      for (const pkg of health.unexpectedDisabled) {
        journal.steps.push({ kind: 'disable', pkg, label: `Efeito colateral: ${pkg}`, status: 'done' });
      }
      if (health.unexpectedDisabled.length) await store.save(journal);
    } catch (err) {
      failure = err;
    }
  }

  if (!failure) {
    journal.status = 'completed';
    journal.message = 'Mudanças aplicadas e conferidas.';
    await store.save(journal);
    let memoryAfterKb: number | null = null;
    try {
      memoryAfterKb = parseProcMeminfo(await shell.procMeminfo()).availableKb;
    } catch {
      /* só informativo */
    }
    return { planId: plan.id, status: 'completed', message: journal.message, steps: journal.steps, snapshotDir, memoryBeforeKb, memoryAfterKb };
  }

  // 4. Algo deu errado: desfazer.
  const reason = failure instanceof Error ? failure.message : String(failure);
  if (isConnectionLost(failure)) {
    journal.status = 'interrupted';
    journal.message = `A conexão com a TV caiu no meio (${reason}). Quando ela voltar, o Studio vai oferecer desfazer.`;
    await store.save(journal);
    return { planId: plan.id, status: 'interrupted', message: journal.message, steps: journal.steps, snapshotDir };
  }
  const rolled = await rollbackJournal(journal, shell, grantForSteps(plan, journal), store);
  rolled.message = `${reason} — ${rolled.status === 'rolled-back' ? 'tudo o que tinha sido feito foi desfeito.' : rolled.message}`;
  journal.message = rolled.message;
  await store.save(journal);
  return { ...rolled, snapshotDir };
}

/** Autorização para desfazer: cobre os passos do diário (inclusive efeitos colaterais registrados). */
function grantForSteps(plan: ChangePlan, journal: Journal): WriteGrant {
  const actions = journal.steps.map((s) => ({ kind: s.kind, pkg: s.pkg, label: s.label, level: 'caution' as const, estimatedKb: null }));
  const p = { ...plan, actions };
  return WriteGrant.forPlan({ ...p, hash: hashPlan(p) });
}

/** Confere a TV depois do plano: responde, tem tela inicial e só mudou o que estava planejado. */
interface Health {
  problem: string | null;
  /** Apps que estavam ativos antes e ficaram desativados sem estar no plano (efeito colateral). */
  unexpectedDisabled: string[];
}

async function healthCheck(shell: DeviceShell, before: DeviceInventory, plan: ChangePlan, catalog: Catalog): Promise<Health> {
  const unexpectedDisabled: string[] = [];
  if ((await shell.state()) !== 'device') return { problem: 'A TV não respondeu depois das mudanças.', unexpectedDisabled };
  const homeBefore = before.currentHome?.package ?? null;
  const homeAfter = parseResolveHome(await shell.resolveHome())?.package ?? null;
  let problem: string | null = homeBefore && homeAfter !== homeBefore ? 'A tela inicial mudou inesperadamente.' : null;
  const beforeDisabled = new Set(before.packages.filter((p) => !p.enabled).map((p) => p.name));
  const afterDisabled = await disabledSet(shell);
  const expected = new Set(beforeDisabled);
  for (const a of plan.actions) a.kind === 'disable' ? expected.add(a.pkg) : expected.delete(a.pkg);
  for (const pkg of afterDisabled) {
    if (expected.has(pkg)) continue;
    unexpectedDisabled.push(pkg);
    const isProtected = classifyPackage(pkg, deviceContext(before), catalog).level === 'protected';
    problem ??= isProtected ? `Um app intocável ficou desativado: ${pkg}.` : `Um app fora do plano ficou desativado: ${pkg}.`;
  }
  return { problem, unexpectedDisabled };
}

/** Desfaz, em ordem inversa, os passos feitos (ou possivelmente feitos). */
async function rollbackJournal(journal: Journal, shell: DeviceShell, grant: WriteGrant, store: JournalStore): Promise<ExecutionResult> {
  let ok = true;
  let lost = false;
  let disabled: Set<string> | null = null;
  for (const step of [...journal.steps].reverse()) {
    if (step.status !== 'done' && step.status !== 'started' && step.status !== 'failed') continue;
    const restoreEnabled = step.kind === 'disable'; // desfazer "desativar" = reativar
    try {
      disabled ??= await disabledSet(shell);
      if (disabled.has(step.pkg) !== restoreEnabled) {
        step.status = 'undone'; // já está como era antes: nada a escrever
      } else if (!restoreEnabled && isCoreProtected(step.pkg)) {
        step.status = 'undo-skipped'; // nunca desativa um intocável, nem para desfazer
      } else {
        await shell.setEnabled(step.pkg, restoreEnabled, grant);
        disabled = await disabledSet(shell);
        if (disabled.has(step.pkg) === restoreEnabled) throw new Error('conferência falhou');
        step.status = 'undone';
      }
    } catch (err) {
      step.status = 'undo-failed';
      step.error = err instanceof Error ? err.message : String(err);
      ok = false;
      disabled = null;
      if (isConnectionLost(err)) {
        lost = true;
        break;
      }
    }
    await store.save(journal);
  }
  journal.status = ok ? 'rolled-back' : lost ? 'interrupted' : 'rollback-failed';
  journal.message = ok
    ? 'Tudo foi desfeito.'
    : lost
      ? 'A conexão caiu enquanto desfazia. Quando a TV voltar, o Studio termina de desfazer.'
      : 'Não foi possível desfazer tudo automaticamente. Use "Restaurar TV" com o backup feito antes da mudança.';
  await store.save(journal);
  return { planId: journal.planId, status: journal.status as ExecutionStatus, message: journal.message, steps: journal.steps };
}

/**
 * Desfaz uma mudança que ficou pela metade (Studio/PC/TV caiu). Confere que é a MESMA TV.
 * O serial pode ter mudado (IP novo): o plano é reendereçado para o serial atual.
 */
export async function rollbackIncomplete(planId: string, currentSerial: string, deps: ExecuteDeps): Promise<ExecutionResult> {
  const store = new JournalStore(deps.dataDir);
  const journal = await store.load(planId);
  if (!journal || !NEEDS_ATTENTION.has(journal.status)) {
    return { planId, status: 'refused', message: 'Não há mudança pendente com esse identificador.', steps: [] };
  }
  const shell = deps.adb.forDevice(currentSerial);
  let inv: DeviceInventory;
  try {
    inv = await new AndroidFamilyDriver(shell).readInventory();
  } catch (err) {
    return { planId, status: 'refused', message: `Não consegui ler a TV: ${err instanceof Error ? err.message : err}`, steps: journal.steps };
  }
  if (inv.deviceId !== journal.deviceId) return { planId, status: 'refused', message: 'A TV conectada não é a mesma da mudança pendente.', steps: journal.steps };
  const result = await rollbackJournal(journal, shell, grantForSteps({ ...journal.plan, serial: currentSerial }, journal), store);
  return { ...result, snapshotDir: journal.snapshotDir };
}
