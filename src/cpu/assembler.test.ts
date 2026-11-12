import { describe, expect, it } from 'vitest';
import { assemble, assemblerOpcodes } from './assembler';
import { EXAMPLES } from './examples';
import { ISA } from './isa';

function mustAssemble(source: string) {
  const result = assemble(source);
  if (!result.ok) {
    throw new Error(result.errors.map((error) => `${error.line}: ${error.message}`).join('\n'));
  }
  return result;
}

describe('assembler', () => {
  it('encodes every instruction and stays aligned with the ISA table', () => {
    const source = `
      NOP
      LOAD A, 1
      LOADI A, 2
      STORE 3
      LOAD B, 4
      LOADI B, 5
      ADD
      SUB
      ADDI 6
      SUBI 7
      AND
      OR
      XOR
      NOT
      CMP
      JMP 8
      JZ 9
      JNZ 10
      JC 11
      OUT
      HALT
    `;
    const program = mustAssemble(source);
    expect(Array.from(program.image.slice(0, program.byteLength))).toEqual([
      0x00,
      0x01, 0x01,
      0x02, 0x02,
      0x03, 0x03,
      0x04, 0x04,
      0x05, 0x05,
      0x10,
      0x11,
      0x12, 0x06,
      0x13, 0x07,
      0x14,
      0x15,
      0x16,
      0x17,
      0x18,
      0x20, 0x08,
      0x21, 0x09,
      0x22, 0x0a,
      0x23, 0x0b,
      0x30,
      0xff,
    ]);
    expect(new Set(assemblerOpcodes())).toEqual(new Set(ISA.map((entry) => entry.opcode)));
    expect(new Set(ISA.map((entry) => entry.opcode)).size).toBe(ISA.length);
  });

  it('resolves forward and backward labels and ignores comments', () => {
    const program = mustAssemble(`
      ; 跳过下一条
      start: JMP end
      HALT
      end:
      JMP start // 再跳回去
    `);
    expect(program.labels.start).toBe(0);
    expect(program.labels.end).toBe(3);
    expect(Array.from(program.image.slice(0, 5))).toEqual([0x20, 0x03, 0xff, 0x20, 0x00]);
    expect(program.listing.map((entry) => entry.source)).toEqual(['start: JMP end', 'HALT', 'JMP start']);
  });

  it('accepts hex, binary, ACC, case differences, and .org', () => {
    const program = mustAssemble(`
      .org 0x10
      loadi acc, 0b00000101
      STORE value
      HALT
      value: .byte 0
    `);
    expect(program.origin).toBe(0x10);
    expect(program.image[0x10]).toBe(0x02);
    expect(program.image[0x11]).toBe(5);
    expect(program.image[0x12]).toBe(0x03);
    expect(program.image[0x13]).toBe(program.labels.value);
    expect(program.labels.value).toBe(0x15);
    expect(program.annotations[0x15]).toContain('.byte');
  });

  it('starts execution at the first instruction, not at leading data', () => {
    const program = mustAssemble(`
      .org 8
      pad: .db 1, 2, 3
      LOADI A, pad
      HALT
    `);
    expect(program.origin).toBe(11);
    expect(Array.from(program.image.slice(8, 11))).toEqual([1, 2, 3]);
    expect(program.image[11]).toBe(0x02);
    expect(program.image[12]).toBe(8);
  });

  it('assembles an empty program', () => {
    const program = mustAssemble('; 只有注释\n\n');
    expect(program.ok).toBe(true);
    expect(program.byteLength).toBe(0);
    expect(program.origin).toBe(0);
    expect(program.image.every((byte) => byte === 0)).toBe(true);
  });

  it('reports errors with line numbers and keeps going', () => {
    const result = assemble(`
      FOO
      LOADI A, 256
      LOADI A
      ADD 1
      JMP missing
      here: NOP
      here: HALT
      .org 0
      NOP
    `);
    expect(result.ok).toBe(false);
    if (result.ok) return;
    const lines = result.errors.map((error) => error.line);
    expect(lines).toContain(2);
    expect(lines).toContain(3);
    expect(lines).toContain(4);
    expect(lines).toContain(5);
    expect(lines).toContain(6);
    expect(result.errors.some((error) => error.message.includes('重复定义'))).toBe(true);
    expect(result.errors.some((error) => error.message.includes('找不到标号'))).toBe(true);
    expect(result.errors.some((error) => error.message.includes('超出'))).toBe(true);
    expect(result.errors.some((error) => error.message.includes('不认识的指令'))).toBe(true);
  });

  it('rejects overlapping writes', () => {
    const result = assemble(`
      .org 0
      NOP
      .org 0
      HALT
    `);
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.errors.some((error) => error.message.includes('重叠'))).toBe(true);
  });

  it('assembles every built-in example', () => {
    for (const example of EXAMPLES) {
      const program = assemble(example.source);
      expect(program.ok, example.id).toBe(true);
    }
  });
});
