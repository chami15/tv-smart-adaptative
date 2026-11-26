// Autorização de escrita: só existe a partir de um plano validado e só libera exatamente
// os comandos daquele plano (e os de desfazer). Código com bug não consegue "inventar" escritas.
import { writeArgs } from '../adb/write-allowlist.ts';
import type { ChangePlan } from './plan.ts';

const GRANT = Symbol('tvsa-write-grant');

export class WriteGrant {
  readonly [GRANT] = true;
  readonly planId: string;
  private readonly allowed: ReadonlySet<string>;

  private constructor(planId: string, allowed: Set<string>) {
    this.planId = planId;
    this.allowed = allowed;
  }

  /** Só o executor chama isto, depois de validar o plano e salvar o backup. */
  static forPlan(plan: ChangePlan): WriteGrant {
    const allowed = new Set<string>();
    for (const a of plan.actions) {
      allowed.add(writeArgs(plan.serial, a.kind, a.pkg).join(' '));
      allowed.add(writeArgs(plan.serial, a.kind === 'disable' ? 'enable' : 'disable', a.pkg).join(' '));
    }
    return new WriteGrant(plan.id, allowed);
  }

  allows(args: readonly string[]): boolean {
    return this.allowed.has(args.join(' '));
  }
}

export function isWriteGrant(x: unknown): x is WriteGrant {
  return typeof x === 'object' && x !== null && (x as Record<symbol, unknown>)[GRANT] === true;
}
