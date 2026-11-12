import { describe, expect, it } from 'vitest';
import type { StepInfo } from '../../cpu/cpu';
import {
  ADDRESS_BUS,
  ALU_MACHINE,
  CONTROL_DESK,
  DATA_BUS,
  HOUSE,
  OUTPUT_DEVICE,
  ROOM_TITLES,
  activeRamRows,
  focusFor,
  insideHouse,
  packetRoute,
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

describe('computer house layout', () => {
  it('lays 256 warehouse shelves out as a 16 by 16 grid inside the house', () => {
    const origin = ramCellPosition(0);
    const nextColumn = ramCellPosition(1);
    const nextRow = ramCellPosition(16);
    const last = ramCellPosition(255);
    expect(nextColumn.x).toBeGreaterThan(origin.x);
    expect(nextColumn.z).toBeCloseTo(origin.z);
    expect(nextRow.z).toBeGreaterThan(origin.z);
    expect(nextRow.x).toBeCloseTo(origin.x);
    expect(insideHouse(origin)).toBe(true);
    expect(insideHouse(last)).toBe(true);
    const seen = new Set<string>();
    for (let address = 0; address < 256; address += 1) {
      const cell = ramCellPosition(address);
      seen.add(`${cell.x.toFixed(3)},${cell.z.toFixed(3)}`);
    }
    expect(seen.size).toBe(256);
  });

  it('keeps the cpu rooms on the left and the shop window in front', () => {
    const ids = ['pc', 'ir', 'acc', 'b', 'mar', 'mdr', 'out'] as const;
    const keys = new Set(ids.map((id) => {
      const position = registerPosition(id);
      expect(position.x).toBeLessThan(-2);
      expect(position.y).toBeGreaterThan(HOUSE.floorY);
      expect(insideHouse(position)).toBe(true);
      return `${position.x.toFixed(2)},${position.z.toFixed(2)}`;
    }));
    expect(keys.size).toBe(ids.length);
    expect(CONTROL_DESK.x).toBeLessThan(-2);
    expect(ALU_MACHINE.x).toBeLessThan(-2);
    expect(ALU_MACHINE.x).toBeGreaterThan(CONTROL_DESK.x);
    expect(OUTPUT_DEVICE.z).toBeGreaterThan(HOUSE.maxZ - 0.2);
    expect(ROOM_TITLES.control).toBe('控制室');
    expect(ROOM_TITLES.warehouse).toBe('内存仓库');
    expect(ROOM_TITLES.output).toBe('输出橱窗');
  });

  it('resolves the same bus endpoints the processor uses', () => {
    const info = step({ readMem: 20 });
    expect(resolveEndpoint('PC', info, 0)).toEqual(registerPosition('pc'));
    expect(resolveEndpoint('ACC', info, 0)).toEqual(registerPosition('acc'));
    expect(resolveEndpoint('B', info, 0)).toEqual(registerPosition('b'));
    expect(resolveEndpoint('地址', info, 0)).toEqual(registerPosition('mar'));
    expect(resolveEndpoint('目标', info, 0)).toEqual(registerPosition('pc'));
    expect(resolveEndpoint('OUT', info, 0)).toEqual(OUTPUT_DEVICE);
    expect(resolveEndpoint('内存', info, 4)).toEqual(ramCellPosition(20));
    expect(resolveEndpoint('不存在', info, 0)).toBeNull();
  });

  it('sends a cart along the active corridor and looks at the busy room', () => {
    expect(focusFor(null, 0).kind).toBe('house');

    const fetch = step({
      phase: 'fetch',
      activeBus: 'address',
      busValue: 4,
      busFrom: 'PC',
      busTo: '内存',
      changedRegs: ['mar'],
    });
    const route = packetRoute(fetch, 4);
    expect(route?.bus).toBe('address');
    expect(route?.from).toEqual(registerPosition('pc'));
    expect(route?.to).toEqual(ramCellPosition(4));

    const read = step({ activeBus: 'data', busValue: 2, busFrom: '内存', busTo: 'MDR', readMem: 0 });
    expect(packetRoute(read, 0)?.to).toEqual(registerPosition('mdr'));
    expect(focusFor(read, 0).kind).toBe('ram');

    const add = step({ alu: { op: 'ADD', left: 12, right: 30, result: 42 }, changedRegs: ['acc'] });
    expect(focusFor(add, 0).kind).toBe('alu');
    expect(packetRoute(add, 0)).toBeNull();

    const output = step({ title: '输出', activeBus: 'data', busValue: 42, busFrom: 'ACC', busTo: 'OUT', changedRegs: ['out'] });
    expect(focusFor(output, 0).kind).toBe('output');

    expect(focusFor(step({ phase: 'decode', title: '译码' }), 0).kind).toBe('control');
  });

  it('names the warehouse rows worth reading', () => {
    expect(activeRamRows(0, null, 0)).toEqual([0]);
    expect(activeRamRows(3, step({ readMem: 20 }), 3)).toEqual([0, 1]);
    expect(activeRamRows(255, step({ writeMem: 255 }), 255)).toEqual([15]);
  });

  it('runs both corridors from the cpu wing toward the warehouse', () => {
    expect(ADDRESS_BUS.at(-1)!.x).toBeGreaterThan(ADDRESS_BUS[0].x);
    expect(DATA_BUS.at(-1)!.x).toBeGreaterThan(DATA_BUS[0].x);
    expect(DATA_BUS[0].y).toBeGreaterThan(ADDRESS_BUS[0].y);
    expect(insideHouse(ADDRESS_BUS[0])).toBe(true);
    expect(insideHouse(DATA_BUS.at(-1)!)).toBe(true);
  });
});
