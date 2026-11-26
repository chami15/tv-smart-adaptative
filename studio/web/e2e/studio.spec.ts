// Testes como um usuário real, no navegador, contra a rede de TVs simulada.
import { expect, type Page, test } from '@playwright/test';
import { E2E_TOKEN } from '../../../playwright.config.ts';

async function open(page: Page) {
  await page.goto(`/#token=${E2E_TOKEN}`);
  await expect(page.getByRole('heading', { name: 'Conectar à TV' })).toBeVisible();
}

async function connect(page: Page, address: string) {
  await page.getByLabel('Endereço IP da TV').fill(address);
  await page.getByRole('button', { name: 'Conectar', exact: true }).click();
}

async function disconnectIfOnTv(page: Page) {
  const btn = page.getByRole('button', { name: 'Desconectar' });
  if (await btn.isVisible()) await btn.click();
}

test.describe('conectar a qualquer TV Android (simulada)', () => {
  for (const [ip, title, platform] of [
    ['192.168.0.50', 'TCL Smart TV Pro', 'Google TV'],
    ['192.168.0.51', 'Philips 43PFG6825', 'Android TV'],
    ['192.168.0.52', 'Xiaomi MIBOX4', 'Android TV'],
    ['192.168.0.53', 'Sony XR-55X90K', 'Google TV'],
    ['192.168.0.54', 'Android X96 Mini', 'Android TV'],
  ]) {
    test(`${title} → Minha TV mostra ${platform}`, async ({ page }) => {
      await open(page);
      await connect(page, ip!);
      await expect(page.getByTestId('tv-title')).toHaveText(title!, { timeout: 20_000 });
      await expect(page.locator('.tv-card .pill')).toHaveText(platform!);
      await expect(page.getByText('Limpar memória (desativar apps)')).toBeVisible();
      await disconnectIfOnTv(page);
    });
  }
});

test('o token some da barra de endereço e a sessão sobrevive a recarregar a página', async ({ page }) => {
  await open(page);
  expect(page.url()).not.toContain('token');
  await page.reload();
  await expect(page.getByRole('heading', { name: 'Conectar à TV' })).toBeVisible();
});

test('sem token: explica como abrir o Studio', async ({ page }) => {
  await page.goto('/');
  await expect(page.getByText('Sessão do Studio não encontrada')).toBeVisible();
});

test('TCL pede autorização: tela "Aceite a conexão na TV" e depois abre a TV', async ({ page }) => {
  await open(page);
  // teclado numérico BR digita vírgulas
  await connect(page, '192,168,0,50');
  await expect(page.getByTestId('tv-title')).toHaveText('TCL Smart TV Pro', { timeout: 20_000 });
});

test('salvar backup mostra onde ficou no computador', async ({ page }) => {
  await open(page);
  await connect(page, '192.168.0.51');
  await expect(page.getByTestId('tv-title')).toBeVisible({ timeout: 20_000 });
  await page.getByRole('button', { name: 'Salvar backup agora' }).click();
  await expect(page.getByText('Backup salvo no seu computador')).toBeVisible();
  await expect(page.locator('code.path')).toContainText('backups');
  await disconnectIfOnTv(page);
});

test('filtros e busca de apps', async ({ page }) => {
  await open(page);
  await connect(page, '192.168.0.50');
  await expect(page.getByTestId('tv-title')).toBeVisible({ timeout: 20_000 });
  await page.getByRole('button', { name: /Desativados \(1\)/ }).click();
  await expect(page.locator('table.apps tbody tr')).toHaveCount(1);
  await page.getByRole('button', { name: /Todos/ }).click();
  await page.getByLabel('Buscar app').fill('netflix');
  await expect(page.locator('table.apps tbody tr')).toHaveCount(1);
  await disconnectIfOnTv(page);
});

test.describe('erros que um usuário comum encontra', () => {
  for (const [input, message] of [
    ['192.168.0', 'não parece completo'],
    ['tv da sala', 'Endereço inválido'],
    ['192.168.0.99', 'não foi encontrada nesse endereço'],
    ['192.168.0.61', 'recusou a conexão'],
    ['192.168.0.62', 'demorou demais'],
  ]) {
    test(`"${input}" → ${message}`, async ({ page }) => {
      await open(page);
      await connect(page, input!);
      await expect(page.getByRole('alert')).toContainText(message!, { timeout: 15_000 });
    });
  }

  test('usuário não aceita na TV e cancela a espera', async ({ page }) => {
    await open(page);
    await connect(page, '192.168.0.60');
    await expect(page.getByRole('heading', { name: 'Aceite a conexão na TV' })).toBeVisible();
    await page.getByRole('button', { name: 'Cancelar' }).click();
    await expect(page.getByRole('heading', { name: 'Conectar à TV' })).toBeVisible();
  });

  test('rede cai no meio da leitura → aviso de TV offline', async ({ page }) => {
    await open(page);
    await connect(page, '192.168.0.63');
    await expect(page.getByText(/ficou offline/)).toBeVisible({ timeout: 20_000 });
  });

  test('dois cliques rápidos em Conectar não quebram nada', async ({ page }) => {
    await open(page);
    await page.getByLabel('Endereço IP da TV').fill('192.168.0.52');
    const btn = page.getByRole('button', { name: 'Conectar', exact: true });
    await btn.dblclick();
    await expect(page.getByTestId('tv-title')).toHaveText('Xiaomi MIBOX4', { timeout: 20_000 });
    await disconnectIfOnTv(page);
  });
});

test.describe('TVs que ainda não podem ser personalizadas', () => {
  test('Fire TV: mostra informações mas avisa que não é suportada', async ({ page }) => {
    await open(page);
    await connect(page, '192.168.0.55');
    await expect(page.getByText('Esta TV ainda não é suportada para personalização')).toBeVisible({ timeout: 20_000 });
    await disconnectIfOnTv(page);
  });

  test('celular: avisa que não é uma TV', async ({ page }) => {
    await open(page);
    await connect(page, '192.168.0.56');
    await expect(page.getByRole('status').filter({ hasText: 'não é suportada' })).toContainText('não parece ser uma TV', { timeout: 20_000 });
    await disconnectIfOnTv(page);
  });

  // Regressão do bug 2026-11-26: leitura corrompida não pode gerar backup.
  test('respostas corrompidas: "TV não identificada" e sem botão de backup', async ({ page }) => {
    await open(page);
    await connect(page, '192.168.0.64');
    await expect(page.getByTestId('tv-title')).toHaveText('TV não identificada', { timeout: 20_000 });
    await expect(page.getByRole('button', { name: 'Salvar backup agora' })).toHaveCount(0);
    await expect(page.getByRole('button', { name: 'Ler de novo' })).toBeVisible();
  });
});

test.describe('Fase 1.1 — TVs encontradas na rede', () => {
  test('lista aparece sozinha e conecta com 1 clique, sem digitar IP', async ({ page }) => {
    await open(page);
    const list = page.getByRole('list', { name: 'TVs encontradas' });
    await expect(list).toBeVisible({ timeout: 10_000 });
    await expect(list.getByText('TV da Sala')).toBeVisible();
    await page.getByRole('button', { name: 'Conectar a TV do Quarto' }).click();
    await expect(page.getByTestId('tv-title')).toHaveText('Philips 43PFG6825', { timeout: 20_000 });
    await disconnectIfOnTv(page);
  });

  test('TV com depuração desligada não tem botão de conectar e aponta para o passo a passo', async ({ page }) => {
    await open(page);
    const item = page.locator('.tv-item', { hasText: 'TV da Varanda' });
    await expect(item).toBeVisible({ timeout: 10_000 });
    await expect(item.getByText('Depuração desligada')).toBeVisible();
    await expect(item.getByRole('button')).toHaveCount(0);
    await item.getByRole('link', { name: 'Como ligar' }).click();
    await expect(page).toHaveURL(/#preparar-tv$/);
  });

  test('"Procurar de novo" funciona e não some com a lista', async ({ page }) => {
    await open(page);
    await expect(page.getByRole('list', { name: 'TVs encontradas' })).toBeVisible({ timeout: 10_000 });
    await page.getByRole('button', { name: 'Procurar de novo' }).click();
    await expect(page.getByRole('button', { name: 'Procurar de novo' })).toBeEnabled({ timeout: 10_000 });
    await expect(page.getByRole('list', { name: 'TVs encontradas' }).getByText('TV da Sala')).toBeVisible();
  });

  test('tela de celular não tem rolagem para o lado', async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await open(page);
    await expect(page.getByRole('list', { name: 'TVs encontradas' })).toBeVisible({ timeout: 10_000 });
    expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(390);
  });
});
