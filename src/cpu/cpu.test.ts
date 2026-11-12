import { describe, expect, it } from 'vitest';
import { assemble } from './assembler';
import { Cpu } from './cpu';
import { EXAMPLES } from './examples';
import { ISA } from './isa';

function load(source: string): Cpu {
  const program = assemble(source);
  if (!program.ok) {
    throw new Error(program.errors.map((error) => `${error.line}: ${error.message}`).join('\n'));
  }
  const cpu = new Cpu();
  cpu.load(program.image, program.origin);
  return cpu;
}

function run(cpu: Cpu, limit = 100_000): void {
  let guard = limit;
  while (!cpu.halted && guard > 0) {
    cpu.stepMicro();
    guard -= 1;
  }
  if (!cpu.halted) throw new Error('程序没有在步数上限内停机');
}

describe('cpu', () => {
  it('fetch, decode, and execute LOADI one micro-step at a time', () => {
    const cpu = load('LOADI A, 12\nHALT\n');
    const steps = cpu.stepInstruction();
    expect(steps.map((step) => step.phase)).toEqual([
      'fetch', 'fetch', 'fetch', 'fetch',
      'decode',
      'execute', 'execute', 'execute', 'execute',
    ]);
    expect(steps.every((step, index) => step.instructionComplete === (index === steps.length - 1))).toBe(true);
    expect(steps[0].activeBus).toBe('address');
    expect(steps[0].busFrom).toBe('PC');
    expect(steps[1].activeBus).toBe('data');
    expect(steps[1].readMem).toBe(0);
    expect(steps[4].explanation).toContain('LOADI A');
    expect(steps.some((step) => step.explanation.includes('12'))).toBe(true);
    expect(cpu.acc).toBe(12);
    expect(cpu.pc).toBe(2);
    expect(cpu.ir).toBe(0x02);
    expect(cpu.flags.z).toBe(false);
    expect(cpu.halted).toBe(false);

    const midway = load('LOADI A, 12\nADD\nHALT\n');
    midway.stepMicro();
    midway.stepMicro();
    const rest = midway.stepInstruction();
    expect(rest[0].phase).toBe('fetch');
    expect(rest[rest.length - 1].instructionComplete).toBe(true);
    expect(midway.acc).toBe(12);
    expect(midway.pc).toBe(2);
    expect(midway.stepMicro().phase).toBe('fetch');
  });

  it('updates flags for arithmetic, logic, compare, and loads', () => {
    const add = load('LOADI A, 200\nLOADI B, 100\nADD\nHALT\n');
    run(add);
    expect(add.acc).toBe(44);
    expect(add.flags).toEqual({ z: false, n: false, c: true });

    const wrap = load('LOADI A, 128\nLOADI B, 128\nADD\nHALT\n');
    run(wrap);
    expect(wrap.acc).toBe(0);
    expect(wrap.flags).toEqual({ z: true, n: false, c: true });

    const sub = load('LOADI A, 5\nLOADI B, 10\nSUB\nHALT\n');
    run(sub);
    expect(sub.acc).toBe(251);
    expect(sub.flags).toEqual({ z: false, n: true, c: true });

    const zero = load('LOADI A, 10\nLOADI B, 10\nSUB\nHALT\n');
    run(zero);
    expect(zero.acc).toBe(0);
    expect(zero.flags).toEqual({ z: true, n: false, c: false });

    const compare = load('LOADI A, 3\nLOADI B, 9\nCMP\nHALT\n');
    const compareSteps = compare.stepInstruction();
    expect(compareSteps.at(-1)?.instructionComplete).toBe(true);
    compare.stepInstruction();
    compare.stepInstruction();
    expect(compare.acc).toBe(3);
    expect(compare.b).toBe(9);
    expect(compare.flags).toEqual({ z: false, n: true, c: true });

    const logic = load(`
      LOADI A, 200
      LOADI B, 100
      ADD
      LOADI B, 0x0F
      AND
      HALT
    `);
    run(logic);
    expect(logic.acc).toBe(12);
    expect(logic.flags.c).toBe(true);
    expect(logic.flags.z).toBe(false);

    const invert = load('LOADI A, 0x0F\nNOT\nHALT\n');
    run(invert);
    expect(invert.acc).toBe(0xf0);
    expect(invert.flags).toEqual({ z: false, n: true, c: false });

    const bits = load('LOADI A, 0b11110000\nLOADI B, 0b00001111\nOR\nHALT\n');
    run(bits);
    expect(bits.acc).toBe(0xff);
    expect(bits.flags.n).toBe(true);

    const different = load('LOADI A, 0b1100\nLOADI B, 0b1010\nXOR\nHALT\n');
    run(different);
    expect(different.acc).toBe(0b0110);

    const loaded = load('LOADI A, 200\nLOADI B, 100\nADD\nLOADI A, 0\nHALT\n');
    run(loaded);
    expect(loaded.acc).toBe(0);
    expect(loaded.flags).toEqual({ z: true, n: false, c: true });
  });

  it('loads, stores, and leaves neighboring bytes alone', () => {
    const cpu = load(`
      LOADI A, 9
      STORE 20
      LOAD A, 20
      OUT
      HALT
    `);
    const writes: number[] = [];
    while (!cpu.halted) {
      const step = cpu.stepMicro();
      if (step.writeMem !== null) writes.push(step.writeMem);
      expect(step.explanation).not.toMatch(/undefined|NaN/);
    }
    expect(writes).toEqual([20]);
    expect(cpu.ram[20]).toBe(9);
    expect(cpu.ram[19]).toBe(0);
    expect(cpu.ram[21]).toBe(0);
    expect(cpu.output).toEqual([9]);
  });

  it('jumps on true conditions and falls through on false ones', () => {
    const carry = load(`
      LOADI A, 200
      LOADI B, 100
      ADD
      JC yes
      LOADI A, 1
      OUT
      HALT
      yes: LOADI A, 7
      OUT
      HALT
    `);
    run(carry);
    expect(carry.output).toEqual([7]);

    const equal = load(`
      LOADI A, 4
      LOADI B, 4
      CMP
      JZ same
      LOADI A, 1
      OUT
      HALT
      same: LOADI A, 8
      OUT
      HALT
    `);
    run(equal);
    expect(equal.output).toEqual([8]);

    const notEqual = load(`
      LOADI A, 4
      LOADI B, 5
      CMP
      JNZ diff
      LOADI A, 1
      OUT
      HALT
      diff: LOADI A, 6
      OUT
      HALT
    `);
    run(notEqual);
    expect(notEqual.output).toEqual([6]);

    const noCarry = load(`
      LOADI A, 1
      LOADI B, 1
      ADD
      JC skip
      LOADI A, 3
      OUT
      HALT
      skip: LOADI A, 9
      OUT
      HALT
    `);
    run(noCarry);
    expect(noCarry.output).toEqual([3]);
  });

  it('halts on HALT and on an unknown opcode, then ignores further steps', () => {
    const cpu = load('LOADI A, 2\nOUT\nHALT\nADD\n');
    run(cpu);
    expect(cpu.output).toEqual([2]);
    expect(cpu.acc).toBe(2);
    const cycles = cpu.cycles;
    const pc = cpu.pc;
    const again = cpu.stepMicro();
    expect(again.phase).toBe('halted');
    expect(cpu.cycles).toBe(cycles);
    expect(cpu.pc).toBe(pc);
    expect(cpu.output).toEqual([2]);

    const unknown = new Cpu();
    const image = new Uint8Array(256);
    image[0] = 0xab;
    unknown.load(image, 0);
    run(unknown);
    expect(unknown.halted).toBe(true);
    expect(unknown.pc).toBe(1);
    expect(unknown.acc).toBe(0);
    expect(unknown.output).toEqual([]);
  });

  it('resets registers, output, and memory back to the loaded program', () => {
    const cpu = load('LOADI A, 12\nSTORE 30\nOUT\nHALT\n');
    run(cpu);
    expect(cpu.acc).toBe(12);
    expect(cpu.ram[30]).toBe(12);
    cpu.ram[4] = 99;
    cpu.ram[40] = 99;
    cpu.reset();
    expect(cpu.acc).toBe(0);
    expect(cpu.pc).toBe(0);
    expect(cpu.halted).toBe(false);
    expect(cpu.output).toEqual([]);
    expect(cpu.cycles).toBe(0);
    expect(cpu.phase).toBe('idle');
    expect(cpu.ram[30]).toBe(0);
    expect(cpu.ram[40]).toBe(0);
    expect(cpu.ram[4]).toBe(0x30);
    run(cpu);
    expect(cpu.output).toEqual([12]);
  });

  it('runs every opcode through one full instruction', () => {
    for (const entry of ISA) {
      const cpu = new Cpu();
      const image = new Uint8Array(256);
      image[0] = entry.opcode;
      cpu.load(image, 0);
      const steps = cpu.stepInstruction();
      expect(steps.length, entry.short).toBeGreaterThanOrEqual(6);
      expect(steps[0].phase).toBe('fetch');
      expect(steps.some((step) => step.phase === 'decode')).toBe(true);
      expect(steps.some((step) => step.phase === 'execute')).toBe(true);
      expect(steps[steps.length - 1].instructionComplete).toBe(true);
      expect(steps.every((step) => step.explanation.length > 0 && step.title.length > 0)).toBe(true);
    }
  });

  it('runs the built-in examples to their known results', () => {
    const expected: Record<string, { output: number[]; acc: number }> = {
      add: { output: [42], acc: 42 },
      countdown: { output: [5, 4, 3, 2, 1], acc: 0 },
      sum: { output: [55], acc: 55 },
      multiply: { output: [42], acc: 42 },
    };
    for (const example of EXAMPLES) {
      const cpu = load(example.source);
      const seen = new Set<string>();
      let guard = 100_000;
      while (!cpu.halted && guard > 0) {
        const step = cpu.stepMicro();
        seen.add(step.phase);
        expect(step.explanation, example.id).not.toMatch(/undefined|NaN/);
        guard -= 1;
      }
      expect(cpu.halted, example.id).toBe(true);
      expect(cpu.output, example.id).toEqual(expected[example.id].output);
      expect(cpu.acc, example.id).toEqual(expected[example.id].acc);
      expect(seen.has('fetch')).toBe(true);
      expect(seen.has('decode')).toBe(true);
      expect(seen.has('execute')).toBe(true);
    }
  });

  it('honors an origin other than zero', () => {
    const cpu = load(`
      .org 16
      LOADI A, 3
      OUT
      HALT
    `);
    expect(cpu.pc).toBe(16);
    run(cpu);
    expect(cpu.output).toEqual([3]);
    expect(cpu.ram[0]).toBe(0);
  });
});
