import { expect, it } from 'vitest';
import { parseDevicesOutput } from '../../src/adb/devices.ts';

it('interpreta adb devices -l, inclusive com CRLF do Windows e mensagens do daemon', () => {
  const out =
    '* daemon not running; starting now at tcp:5037\r\n* daemon started successfully\r\n' +
    'List of devices attached\r\n' +
    '192.168.0.50:5555      device product:g10 model:Smart_TV_Pro device:g10 transport_id:1\r\n' +
    '192.168.0.51:5555      unauthorized transport_id:2\r\n' +
    '192.168.0.52:5555      offline\r\n' +
    'weird-line\r\n\r\n';
  expect(parseDevicesOutput(out)).toEqual([
    { serial: '192.168.0.50:5555', state: 'device', model: 'Smart TV Pro', product: 'g10' },
    { serial: '192.168.0.51:5555', state: 'unauthorized' },
    { serial: '192.168.0.52:5555', state: 'offline' },
  ]);
});
