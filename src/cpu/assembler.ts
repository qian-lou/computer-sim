import { hexByte, u8 } from './format';
import { OP } from './isa';

export interface SourceError {
  line: number;
  message: string;
}

export interface ListingEntry {
  line: number;
  address: number;
  bytes: number[];
  source: string;
}

export interface Program {
  ok: true;
  image: Uint8Array;
  origin: number;
  listing: ListingEntry[];
  labels: Record<string, number>;
  annotations: Record<number, string>;
  byteLength: number;
}

export interface AssembleFailure {
  ok: false;
  errors: SourceError[];
}

type OperandKind = 'none' | 'imm' | 'addr' | 'reg-mem' | 'reg-imm';

interface Form {
  kind: OperandKind;
  opcode?: number;
  opcodeA?: number;
  opcodeB?: number;
}

const FORMS: Record<string, Form> = {
  NOP: { kind: 'none', opcode: OP.NOP },
  ADD: { kind: 'none', opcode: OP.ADD },
  SUB: { kind: 'none', opcode: OP.SUB },
  AND: { kind: 'none', opcode: OP.AND },
  OR: { kind: 'none', opcode: OP.OR },
  XOR: { kind: 'none', opcode: OP.XOR },
  NOT: { kind: 'none', opcode: OP.NOT },
  CMP: { kind: 'none', opcode: OP.CMP },
  OUT: { kind: 'none', opcode: OP.OUT },
  HALT: { kind: 'none', opcode: OP.HALT },
  STORE: { kind: 'addr', opcode: OP.STORE },
  ADDI: { kind: 'imm', opcode: OP.ADDI },
  SUBI: { kind: 'imm', opcode: OP.SUBI },
  JMP: { kind: 'addr', opcode: OP.JMP },
  JZ: { kind: 'addr', opcode: OP.JZ },
  JNZ: { kind: 'addr', opcode: OP.JNZ },
  JC: { kind: 'addr', opcode: OP.JC },
  LOAD: { kind: 'reg-mem', opcodeA: OP.LOAD_A, opcodeB: OP.LOAD_B },
  LOADI: { kind: 'reg-imm', opcodeA: OP.LOADI_A, opcodeB: OP.LOADI_B },
};

interface Symbolic {
  line: number;
  source: string;
  address: number;
  opcode: number;
  operand: string | null;
}

interface DataBytes {
  line: number;
  source: string;
  address: number;
  values: number[];
}

type Item = { kind: 'code'; body: Symbolic } | { kind: 'data'; body: DataBytes };

function stripComment(line: string): string {
  const semi = line.indexOf(';');
  const slash = line.indexOf('//');
  let cut = -1;
  if (semi >= 0) cut = semi;
  if (slash >= 0 && (cut < 0 || slash < cut)) cut = slash;
  return (cut >= 0 ? line.slice(0, cut) : line).trim();
}

function tokenize(statement: string): string[] {
  return statement.replace(/,/g, ' ').trim().split(/\s+/).filter(Boolean);
}

function parseNumberToken(token: string): number | null {
  if (/^0x[0-9a-f]+$/i.test(token)) return parseInt(token.slice(2), 16);
  if (/^0b[01]+$/i.test(token)) return parseInt(token.slice(2), 2);
  if (/^[0-9]+$/.test(token)) return parseInt(token, 10);
  return null;
}

function isLabelName(token: string): boolean {
  return /^[A-Za-z_][A-Za-z0-9_]*$/.test(token);
}

function normalizeReg(token: string): 'A' | 'B' | null {
  const upper = token.toUpperCase();
  if (upper === 'A' || upper === 'ACC') return 'A';
  if (upper === 'B') return 'B';
  return null;
}

/**
 * Two-pass assembler. Labels may be used before they are defined.
 * Numbers are unsigned bytes: decimal, 0x hex, or 0b binary.
 */
export function assemble(source: string): Program | AssembleFailure {
  const errors: SourceError[] = [];
  const labels: Record<string, number> = {};
  const items: Item[] = [];
  let location = 0;
  let origin = 0;
  let originSet = false;

  const fail = (line: number, message: string) => {
    errors.push({ line, message });
  };

  const lines = source.split(/\r?\n/);

  lines.forEach((raw, index) => {
    const lineNo = index + 1;
    const text = stripComment(raw);
    if (!text) return;

    let statement = text;
    const labelMatch = /^([A-Za-z_][A-Za-z0-9_]*)\s*:(.*)$/.exec(statement);
    if (labelMatch) {
      const name = labelMatch[1];
      if (Object.prototype.hasOwnProperty.call(labels, name)) {
        fail(lineNo, `标号「${name}」重复定义`);
      } else {
        labels[name] = location;
      }
      statement = labelMatch[2].trim();
      if (!statement) return;
    }

    const tokens = tokenize(statement);
    const head = tokens[0].toUpperCase();

    if (head === '.ORG') {
      if (tokens.length !== 2) {
        fail(lineNo, '.org 需要一个 0–255 的地址');
        return;
      }
      const address = parseNumberToken(tokens[1]);
      if (address === null || /^0x$/i.test(tokens[1]) || /^0b$/i.test(tokens[1])) {
        fail(lineNo, `地址「${tokens[1]}」无法识别，可用十进制、0x 十六进制或 0b 二进制`);
        return;
      }
      if (address < 0 || address > 255) {
        fail(lineNo, `地址 ${address} 超出 0–255`);
        return;
      }
      location = address;
      return;
    }

    if (head === '.BYTE' || head === '.DB' || head === 'DB') {
      const parts = tokens.slice(1);
      if (parts.length === 0) {
        fail(lineNo, '.byte 至少需要一个 0–255 的数');
        return;
      }
      const values: number[] = [];
      let bad = false;
      for (const part of parts) {
        const value = parseNumberToken(part);
        if (value === null) {
          fail(lineNo, `数值「${part}」无法识别`);
          bad = true;
          continue;
        }
        if (value < 0 || value > 255) {
          fail(lineNo, `数值 ${value} 超出 0–255`);
          bad = true;
          continue;
        }
        values.push(value);
      }
      if (bad) return;
      if (location + values.length > 256) {
        fail(lineNo, '程序超出了 256 字节内存');
        return;
      }
      items.push({
        kind: 'data',
        body: { line: lineNo, source: text, address: location, values },
      });
      location += values.length;
      return;
    }

    const form = FORMS[head];
    if (!form) {
      fail(lineNo, `不认识的指令「${tokens[0]}」`);
      return;
    }

    let opcode = form.opcode ?? 0;
    let operand: string | null = null;

    if (form.kind === 'none') {
      if (tokens.length !== 1) {
        fail(lineNo, `${head} 不需要操作数`);
        return;
      }
    } else if (form.kind === 'imm' || form.kind === 'addr') {
      if (tokens.length < 2) {
        fail(lineNo, `${head} 需要一个操作数`);
        return;
      }
      if (tokens.length > 2) {
        fail(lineNo, `${head} 的操作数太多`);
        return;
      }
      operand = tokens[1];
      if (!isLabelName(operand)) {
        const value = parseNumberToken(operand);
        if (value === null) {
          fail(lineNo, `数值「${operand}」无法识别，可用十进制、0x 十六进制、0b 二进制或标号`);
          return;
        }
        if (value > 255) {
          fail(lineNo, `数值 ${value} 超出 0–255`);
          return;
        }
      }
    } else {
      if (tokens.length < 3) {
        fail(lineNo, `${head} 的写法是 ${head} A, 数或标号`);
        return;
      }
      if (tokens.length > 3) {
        fail(lineNo, `${head} 的操作数太多`);
        return;
      }
      const reg = normalizeReg(tokens[1]);
      if (!reg) {
        fail(lineNo, '寄存器只能是 A（或 ACC）和 B');
        return;
      }
      opcode = reg === 'A' ? form.opcodeA! : form.opcodeB!;
      operand = tokens[2];
      if (!isLabelName(operand)) {
        const value = parseNumberToken(operand);
        if (value === null) {
          fail(lineNo, `数值「${operand}」无法识别`);
          return;
        }
        if (value > 255) {
          fail(lineNo, `数值 ${value} 超出 0–255`);
          return;
        }
      }
    }

    const size = operand === null ? 1 : 2;
    if (location + size > 256) {
      fail(lineNo, '程序超出了 256 字节内存');
      return;
    }
    if (!originSet) {
      origin = location;
      originSet = true;
    }
    items.push({
      kind: 'code',
      body: { line: lineNo, source: text, address: location, opcode, operand },
    });
    location += size;
  });

  const image = new Uint8Array(256);
  const occupied = new Uint8Array(256);
  const listing: ListingEntry[] = [];
  const annotations: Record<number, string> = {};

  const resolve = (token: string, line: number): number | null => {
    if (isLabelName(token) && !/^[0-9]+$/.test(token)) {
      if (!Object.prototype.hasOwnProperty.call(labels, token)) {
        fail(line, `找不到标号「${token}」`);
        return null;
      }
      return labels[token];
    }
    const value = parseNumberToken(token);
    if (value === null || value > 255) {
      fail(line, `数值「${token}」无法识别`);
      return null;
    }
    return value;
  };

  const place = (address: number, value: number, line: number): boolean => {
    if (address < 0 || address > 255) {
      fail(line, '程序超出了 256 字节内存');
      return false;
    }
    if (occupied[address]) {
      fail(line, `地址 ${hexByte(address)} 被写了两次，后面的内容和前面重叠了`);
      return false;
    }
    occupied[address] = 1;
    image[address] = u8(value);
    return true;
  };

  for (const item of items) {
    if (item.kind === 'data') {
      const { address, values, line, source: text } = item.body;
      let ok = true;
      values.forEach((value, offset) => {
        if (!place(address + offset, value, line)) ok = false;
      });
      if (!ok) continue;
      listing.push({ line, address, bytes: values.map((value) => u8(value)), source: text });
      values.forEach((_, offset) => {
        annotations[address + offset] = text;
      });
      continue;
    }

    const { address, opcode, operand, line, source: text } = item.body;
    const bytes = [opcode];
    if (operand !== null) {
      const resolved = resolve(operand, line);
      if (resolved === null) continue;
      bytes.push(resolved);
    }
    let ok = true;
    bytes.forEach((value, offset) => {
      if (!place(address + offset, value, line)) ok = false;
    });
    if (!ok) continue;
    listing.push({ line, address, bytes, source: text });
    bytes.forEach((_, offset) => {
      annotations[address + offset] = text;
    });
  }

  if (errors.length > 0) {
    return { ok: false, errors };
  }

  return {
    ok: true,
    image,
    origin,
    listing,
    labels,
    annotations,
    byteLength: listing.reduce((total, entry) => total + entry.bytes.length, 0),
  };
}

/** Opcodes the assembler can emit. Used to keep the ISA table and parser in sync. */
export function assemblerOpcodes(): number[] {
  const opcodes = new Set<number>();
  for (const form of Object.values(FORMS)) {
    if (form.opcode !== undefined) opcodes.add(form.opcode);
    if (form.opcodeA !== undefined) opcodes.add(form.opcodeA);
    if (form.opcodeB !== undefined) opcodes.add(form.opcodeB);
  }
  return [...opcodes];
}
