import fs from 'node:fs';
import { expect, it } from 'vitest';

it('connection-hints.json é válido e tem todas as seções', () => {
  const data = JSON.parse(fs.readFileSync(new URL('../catalog/connection-hints.json', import.meta.url), 'utf8'));
  for (const k of ['developerMode', 'debugging', 'findIp', 'accept', 'pairing']) {
    expect(Array.isArray(data.generic[k]) && data.generic[k].length > 0).toBe(true);
  }
  expect(data.brands.every((b: { name: string; tip: string }) => b.name && b.tip)).toBe(true);
});
