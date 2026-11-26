// Uso: npm run export:fixture -- "<pasta do backup>"
// Gera studio/core/src/fake/devices/real-<marca>-<modelo>.json a partir de um backup, ANONIMIZADO.
import fs from 'node:fs';
import path from 'node:path';
import { inventoryToFixture, safeSegment, type SnapshotFile } from '@tvsa/core';

const dir = process.argv[2];
if (!dir) {
  console.error('Informe a pasta do backup. Ex.: npm run export:fixture -- "C:\\Users\\voce\\TVSmartAdaptative\\backups\\..."');
  process.exit(1);
}
const file = fs.statSync(dir).isDirectory() ? path.join(dir, 'snapshot.json') : dir;
const snap = JSON.parse(fs.readFileSync(file, 'utf8')) as SnapshotFile;
if (snap.kind !== 'tvsa-snapshot') throw new Error('Arquivo não é um backup do Studio.');

const inv = snap.inventory;
const id = 'real-' + safeSegment(`${inv.device.brand}-${inv.device.model}`).toLowerCase();
const fixture = inventoryToFixture(inv, id);
const out = new URL(`../studio/core/src/fake/devices/${id}.json`, import.meta.url);
fs.writeFileSync(out, JSON.stringify(fixture, null, 2) + '\n');
console.log(`Aparelho simulado criado: ${out.pathname}`);
console.log(`Apps de sistema mantidos; ${fixture.packages.filter((p) => !p.system).length} apps seus foram renomeados.`);
console.log('Revise o arquivo antes de enviar para o repositório.');
