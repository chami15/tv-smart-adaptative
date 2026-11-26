import os from 'node:os';
import path from 'node:path';
import { defineConfig, devices } from '@playwright/test';

export const E2E_PORT = 4790;
export const E2E_REAL_PORT = 4791;
export const E2E_TOKEN = 'e2e-token-somente-para-testes';
const home = path.join(os.tmpdir(), `tvsa-e2e-${process.pid}`);

export default defineConfig({
  testDir: 'studio/web/e2e',
  fullyParallel: false,
  workers: 1,
  retries: process.env.CI ? 1 : 0,
  timeout: 45_000,
  reporter: process.env.CI ? [['list'], ['html', { open: 'never' }]] : 'list',
  use: {
    baseURL: `http://127.0.0.1:${E2E_PORT}`,
    trace: 'off',
    ...devices['Desktop Chrome'],
    locale: 'pt-BR',
  },
  webServer: [
    {
      command: `node studio/server/src/main.ts --fake --no-open --port=${E2E_PORT}`,
      url: `http://127.0.0.1:${E2E_PORT}/favicon.svg`,
      reuseExistingServer: false,
      timeout: 30_000,
      env: { TVSA_TOKEN: E2E_TOKEN, TVSA_HOME: home, TVSA_NO_OPEN: '1' },
    },
    {
      // TVs simuladas tratadas como "TV real": para testar a trava do botão Aplicar
      command: `node studio/server/src/main.ts --fake --no-open --port=${E2E_REAL_PORT}`,
      url: `http://127.0.0.1:${E2E_REAL_PORT}/favicon.svg`,
      reuseExistingServer: false,
      timeout: 30_000,
      env: { TVSA_TOKEN: E2E_TOKEN, TVSA_HOME: `${home}-real`, TVSA_NO_OPEN: '1', TVSA_FAKE_AS_REAL: '1' },
    },
  ],
});
