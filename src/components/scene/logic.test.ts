import { describe, expect, it } from 'vitest';
import { cmosNand, cmosNot, fullAdderSignals, rippleAdd, systemFlow } from './logic';

describe('gate-level hardware', () => {
  it('matches the CPU adder for every pair of bytes', () => {
    for (let left = 0; left < 256; left += 1) {
      for (let right = 0; right < 256; right += 1) {
        const added = rippleAdd(left, right);
        expect(added.sum).toBe((left + right) & 0xff);
        expect(added.carry).toBe(left + right > 255 ? 1 : 0);
      }
    }
  });

  it('ripples the carry the way a chain of full adders does', () => {
    const added = rippleAdd(0b00001100, 0b00011110);
    expect(added.sum).toBe(42);
    expect(added.bits.map((bit) => bit.sum).join('')).toBe('01010100');
    expect(added.bits[2].cout).toBe(1);
    expect(added.bits[2].cin).toBe(0);
    expect(added.bits[3].cin).toBe(1);
  });

  it('covers the full-adder truth table', () => {
    const rows: Array<[0 | 1, 0 | 1, 0 | 1, 0 | 1, 0 | 1]> = [
      [0, 0, 0, 0, 0],
      [0, 0, 1, 1, 0],
      [0, 1, 0, 1, 0],
      [0, 1, 1, 0, 1],
      [1, 0, 0, 1, 0],
      [1, 0, 1, 0, 1],
      [1, 1, 0, 0, 1],
      [1, 1, 1, 1, 1],
    ];
    for (const [a, b, cin, sum, cout] of rows) {
      const signals = fullAdderSignals(a, b, cin);
      expect(signals.sum).toBe(sum);
      expect(signals.cout).toBe(cout);
      expect(signals.xor1).toBe(a ^ b);
      expect(signals.and1).toBe(a & b);
    }
  });

  it('turns CMOS NAND transistors on for the four input pairs', () => {
    expect(cmosNand(0, 0)).toMatchObject({ output: 1, pmosA: true, pmosB: true, nmosA: false, nmosB: false });
    expect(cmosNand(0, 1)).toMatchObject({ output: 1, pmosA: true, nmosA: false, nmosB: true });
    expect(cmosNand(1, 0)).toMatchObject({ output: 1, pmosB: true, nmosA: true, nmosB: false });
    expect(cmosNand(1, 1)).toMatchObject({ output: 0, pmosA: false, pmosB: false, nmosA: true, nmosB: true });
  });

  it('turns the CMOS inverter to the opposite rail', () => {
    expect(cmosNot(0)).toEqual({ input: 0, output: 1, pmos: true, nmos: false });
    expect(cmosNot(1)).toEqual({ input: 1, output: 0, pmos: false, nmos: true });
  });

  it('picks a system-level data path from the current micro-step', () => {
    expect(systemFlow(null)).toBeNull();
    expect(systemFlow(flow({ phase: 'fetch', activeBus: 'data', busFrom: '内存', busTo: 'MDR' }))).toBe('ram-to-cpu');
    expect(systemFlow(flow({ writeMem: 20, busTo: '内存' }))).toBe('cpu-to-ram');
    expect(systemFlow(flow({ title: '输出', busTo: 'OUT', changedRegs: ['out'] }))).toBe('cpu-to-screen');
  });
});

function flow(partial: Partial<Parameters<typeof systemFlow>[0]>): NonNullable<Parameters<typeof systemFlow>[0]> {
  return {
    phase: 'execute',
    title: '',
    readMem: null,
    writeMem: null,
    changedRegs: [],
    activeBus: null,
    busFrom: '',
    busTo: '',
    ...partial,
  };
}
