import { describe, expect, it } from 'vitest';
import type { StepInfo } from '../../cpu/cpu';
import {
  ADDRESS_BUS,
  DATA_BUS,
  DIES,
  activeRamRows,
  focusFor,
  packetRoute,
  pinPositions,
  ramCellPosition,
  registerPosition,
  resolveEndpoint,
} from './layout';

function step(partial: Partial<StepInfo>): StepInfo {
  return {
    phase: 'execute',
    title: '测试',
    summary: '',
    explanation: '',
    mnemonic: '',
    activeBus: null,
    busValue: null,
    busFrom: '',
    busTo: '',
    busForward: true,
    activeRegs: [],
    changedRegs: [],
    changedFlags: [],
    readMem: null,
    writeMem: null,
    alu: null,
    instructionComplete: false,
    ...partial,
  };
}

describe('3d scene layout', () => {
  it('lays the 256 memory cells out as a 16 by 16 grid', () => {
    const origin = ramCellPosition(0);
    const nextColumn = ramCellPosition(1);
    const nextRow = ramCellPosition(16);
    const last = ramCellPosition(255);
    expect(nextColumn.x).toBeGreaterThan(origin.x);
    expect(nextColumn.z).toBeCloseTo(origin.z);
    expect(nextRow.z).toBeGreaterThan(origin.z);
    expect(nextRow.x).toBeCloseTo(origin.x);
    expect(last.x).toBeGreaterThan(origin.x);
    expect(last.z).toBeGreaterThan(origin.z);
    const seen = new Set<string>();
    for (let address = 0; address < 256; address += 1) {
      const cell = ramCellPosition(address);
      seen.add(`${cell.x.toFixed(3)},${cell.z.toFixed(3)}`);
    }
    expect(seen.size).toBe(256);
  });

  it('gives every register its own block on the cpu package', () => {
    const ids = ['pc', 'ir', 'acc', 'b', 'mar', 'mdr', 'out'] as const;
    const keys = ids.map((id) => {
      const position = registerPosition(id);
      return `${position.x.toFixed(2)},${position.z.toFixed(2)}`;
    });
    expect(new Set(keys).size).toBe(ids.length);
    expect(DIES.control.position.z).toBeLessThan(DIES.pc.position.z);
    expect(DIES.alu.title).toContain('算术');
  });

  it('resolves bus endpoints used by the processor', () => {
    const info = step({ readMem: 20, writeMem: null });
    expect(resolveEndpoint('PC', info, 0)).toEqual(registerPosition('pc'));
    expect(resolveEndpoint('ACC', info, 0)).toEqual(registerPosition('acc'));
    expect(resolveEndpoint('B', info, 0)).toEqual(registerPosition('b'));
    expect(resolveEndpoint('MDR', info, 4)).toEqual(registerPosition('mdr'));
    expect(resolveEndpoint('IR', info, 0)).toEqual(registerPosition('ir'));
    expect(resolveEndpoint('地址', info, 0)).toEqual(registerPosition('mar'));
    expect(resolveEndpoint('目标', info, 0)).toEqual(registerPosition('pc'));
    expect(resolveEndpoint('OUT', info, 0)?.z).toBeLessThan(0);
    expect(resolveEndpoint('内存', info, 4)).toEqual(ramCellPosition(20));
    expect(resolveEndpoint('不存在', info, 0)).toBeNull();
  });

  it('builds a packet along the active bus and aims the camera at the busy part', () => {
    const idle = focusFor(null, 0);
    expect(idle.kind).toBe('cpu');

    const fetch = step({
      phase: 'fetch',
      activeBus: 'address',
      busValue: 0,
      busFrom: 'PC',
      busTo: '内存',
      activeRegs: ['pc', 'mar'],
      changedRegs: ['mar'],
    });
    const route = packetRoute(fetch, 0);
    expect(route?.bus).toBe('address');
    expect(route?.from).toEqual(registerPosition('pc'));
    expect(route?.to).toEqual(ramCellPosition(0));
    expect(route?.value).toBe(0);

    const read = step({
      phase: 'fetch',
      activeBus: 'data',
      busValue: 0x02,
      busFrom: '内存',
      busTo: 'MDR',
      readMem: 0,
    });
    expect(packetRoute(read, 0)?.to).toEqual(registerPosition('mdr'));
    expect(focusFor(read, 0).kind).toBe('ram');

    const add = step({
      title: '加法',
      alu: { op: 'ADD', left: 12, right: 30, result: 42 },
      changedRegs: ['acc'],
    });
    expect(focusFor(add, 0).kind).toBe('alu');
    expect(packetRoute(add, 0)).toBeNull();

    const output = step({ title: '输出', activeBus: 'data', busValue: 42, busFrom: 'ACC', busTo: 'OUT', changedRegs: ['out'] });
    expect(focusFor(output, 0).kind).toBe('output');
    expect(packetRoute(output, 0)?.to.z).toBeLessThan(0);

    const decode = step({ phase: 'decode', title: '译码' });
    expect(focusFor(decode, 0).kind).toBe('control');
  });

  it('prints the program-counter row and the row being touched', () => {
    expect(activeRamRows(0, null, 0)).toEqual([0]);
    expect(activeRamRows(3, step({ readMem: 20 }), 3)).toEqual([0, 1]);
    expect(activeRamRows(255, step({ writeMem: 255 }), 255)).toEqual([15]);
  });

  it('keeps the buses and the pin skirt on the board', () => {
    expect(ADDRESS_BUS.length).toBeGreaterThan(2);
    expect(DATA_BUS[0].z).toBeGreaterThan(ADDRESS_BUS[0].z);
    expect(pinPositions().length).toBeGreaterThan(40);
  });
});
