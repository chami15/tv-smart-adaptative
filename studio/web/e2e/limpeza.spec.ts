// Fase 3 — limpeza de memória, como um usuário faria (TVs simuladas).
import { expect, type Page, test } from '@playwright/test';
import { E2E_REAL_PORT, E2E_TOKEN } from '../../../playwright.config.ts';

async function openTv(page: Page, name: string, base = '') {
  await page.goto(`${base}/#token=${E2E_TOKEN}`);
  const connected = page.getByRole('button', { name: `Abrir ${name}` });
  const connect = page.getByRole('button', { name: `Conectar a ${name}` });
  await expect(connected.or(connect)).toBeVisible({ timeout: 15_000 });
  await (await connected.isVisible() ? connected : connect).click();
  await expect(page.getByTestId('tv-title')).toBeVisible({ timeout: 20_000 });
}

async function cleanupAllRecommended(page: Page) {
  await page.getByRole('button', { name: 'Limpar memória' }).click();
  await page.getByRole('button', { name: 'Selecionar todos' }).click();
  await page.getByRole('button', { name: 'Revisar plano' }).click();
  await expect(page.getByRole('heading', { name: 'Revise antes de aplicar' })).toBeVisible();
}

test('limpar → ver memória liberada → desfazer tudo → TV volta como estava', async ({ page }) => {
  await openTv(page, 'Mi Box da Cozinha');
  await page.getByRole('button', { name: 'Limpar memória' }).click();
  await expect(page.getByText('🔴 Intocáveis')).toBeVisible();
  await page.getByRole('button', { name: 'Selecionar todos' }).click();
  await expect(page.getByRole('region', { name: 'Seleção' })).toContainText('selecionados');
  await page.getByRole('button', { name: 'Revisar plano' }).click();
  await expect(page.getByText('Como o Studio protege a sua TV')).toBeVisible();
  await page.getByRole('button', { name: 'Aplicar' }).click();
  await expect(page.getByRole('heading', { name: 'Pronto!' })).toBeVisible({ timeout: 30_000 });
  await expect(page.getByText('Memória livre agora')).toBeVisible();
  await page.getByRole('button', { name: 'Desfazer tudo' }).click();
  await expect(page.getByText('Desfazer: voltar como estava antes')).toBeVisible();
  await page.getByRole('button', { name: 'Aplicar' }).click();
  await expect(page.getByRole('heading', { name: 'Pronto!' })).toBeVisible({ timeout: 30_000 });
  await page.getByRole('button', { name: 'Concluir' }).click();
  await expect(page.getByText('Já desativados')).toHaveCount(0); // Mi Box não tinha nada desativado
  await page.getByRole('button', { name: 'Backups' }).click();
  await expect(page.locator('.backup-list li')).toHaveCount(2); // um backup automático antes de cada mudança
});

test('intocáveis não podem ser marcados (não aparecem como opção)', async ({ page }) => {
  await openTv(page, 'TV da Sala');
  await page.getByRole('button', { name: 'Limpar memória' }).click();
  await expect(page.getByRole('checkbox', { name: /Entradas HDMI e antena/ })).toHaveCount(0);
  await expect(page.getByRole('checkbox', { name: /Google Play Services/ })).toHaveCount(0);
  await page.getByText('🔴 Intocáveis').click();
  await expect(page.locator('.locked-list')).toContainText('Entradas HDMI e antena (TCL)');
});

test('falha no meio: o Studio desfaz sozinho e avisa que nada ficou alterado', async ({ page }) => {
  await openTv(page, 'TV que falha na limpeza');
  await cleanupAllRecommended(page);
  await page.getByRole('button', { name: 'Aplicar' }).click();
  await expect(page.getByText('Não deu certo — e nada ficou alterado')).toBeVisible({ timeout: 30_000 });
});

// Bug 2026-11-26 (teste exploratório): a mensagem de sucesso sumia junto com o aviso de pendência.
test('rede cai durante a limpeza → aviso de pendência → desfazer → confirmação continua visível', async ({ page }) => {
  await openTv(page, 'TV com Wi-Fi ruim');
  await cleanupAllRecommended(page);
  await page.getByRole('button', { name: 'Aplicar' }).click();
  await expect(page.getByText('A conexão caiu no meio').first()).toBeVisible({ timeout: 30_000 });
  await expect(page.getByText('Uma mudança ficou pela metade')).toBeVisible();
  await page.getByRole('button', { name: 'Concluir' }).click();
  await page.getByRole('button', { name: 'Desconectar' }).click();
  await openTv(page, 'TV com Wi-Fi ruim');
  await page.getByRole('button', { name: 'Desfazer agora' }).click();
  await expect(page.getByText('a mudança pela metade foi desfeita')).toBeVisible({ timeout: 30_000 });
  await expect(page.getByText('Uma mudança ficou pela metade')).toHaveCount(0);
});

// Bug 2026-11-26: "Limpar memória — em breve (fase 3)" continuava aparecendo depois da Fase 3.
test('visão geral mostra a limpeza como disponível', async ({ page }) => {
  await openTv(page, 'Bravia do Escritório');
  const cap = page.locator('.caps li', { hasText: 'Limpar memória' });
  await expect(cap).toContainText('disponível');
  await expect(page.getByText(/chega na Fase 3/)).toHaveCount(0);
});

// Bug 2026-11-26: botões secundários ficavam azuis com texto cinza (ilegível) ao passar o mouse.
test('botões secundários continuam legíveis ao passar o mouse', async ({ page }) => {
  await openTv(page, 'TV da Sala');
  const btn = page.getByRole('button', { name: 'Desconectar' });
  await btn.hover();
  const bg = await btn.evaluate((el) => getComputedStyle(el).backgroundColor);
  expect(bg).not.toBe('rgb(61, 111, 232)');
});

test.describe('TV real (trava)', () => {
  test('mostra a prévia do plano mas o botão Aplicar fica bloqueado com explicação', async ({ page }) => {
    await openTv(page, 'TV da Sala', `http://127.0.0.1:${E2E_REAL_PORT}`);
    await page.getByRole('button', { name: 'Limpar memória' }).click();
    await expect(page.getByText('Modo prévia')).toBeVisible();
    await page.getByRole('button', { name: 'Selecionar todos' }).click();
    await page.getByRole('button', { name: 'Revisar plano' }).click();
    await expect(page.getByText('Aplicar está bloqueado nesta TV')).toBeVisible();
    await expect(page.getByRole('button', { name: 'Aplicar' })).toBeDisabled();
  });
});
