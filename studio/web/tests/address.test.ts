import { describe, expect, it } from 'vitest';
import { parseAddress } from '../src/address.ts';

describe('parseAddress (o que o usuário digita)', () => {
  it.each([
    ['192.168.0.25', { host: '192.168.0.25', port: null }],
    ['  192.168.0.25  ', { host: '192.168.0.25', port: null }],
    ['192.168.0.25:5555', { host: '192.168.0.25', port: 5555 }],
    ['192,168,0,25', { host: '192.168.0.25', port: null }], // teclado numérico BR
    ['adb connect 192.168.0.25:5555', { host: '192.168.0.25', port: 5555 }],
    ['http://192.168.0.25/', { host: '192.168.0.25', port: null }],
    ['192.168.0. 25', { host: '192.168.0.25', port: null }],
    ['minha-tv.local', { host: 'minha-tv.local', port: null }],
  ])('%j → ok', (input, expected) => {
    expect(parseAddress(input)).toEqual(expected);
  });

  it.each(['', '192.168.0', '300.1.1.1', '192.168.0.25:99999', 'tv da sala', '192.168.0.25;reboot'])('%j → erro', (input) => {
    expect(parseAddress(input)).toHaveProperty('error');
  });
});
