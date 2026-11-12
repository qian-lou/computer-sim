import { numText, u8 } from './format';
import { ISA_BY_OPCODE, OP } from './isa';

export type Phase = 'idle' | 'fetch' | 'decode' | 'execute' | 'halted';
export type RegId = 'pc' | 'ir' | 'acc' | 'b' | 'mar' | 'mdr' | 'out';
export type FlagId = 'z' | 'n' | 'c';
export type BusName = 'address' | 'data';
export type AluOp = 'ADD' | 'SUB' | 'AND' | 'OR' | 'XOR' | 'NOT' | 'CMP';

export interface Flags {
  z: boolean;
  n: boolean;
  c: boolean;
}

export interface AluView {
  op: AluOp;
  left: number;
  right: number;
  result: number;
}

export interface StepInfo {
  phase: Phase;
  title: string;
  summary: string;
  explanation: string;
  mnemonic: string;
  activeBus: BusName | null;
  busValue: number | null;
  busFrom: string;
  busTo: string;
  busForward: boolean;
  activeRegs: RegId[];
  changedRegs: RegId[];
  changedFlags: FlagId[];
  readMem: number | null;
  writeMem: number | null;
  alu: AluView | null;
  instructionComplete: boolean;
}

export interface CpuView {
  pc: number;
  ir: number;
  acc: number;
  b: number;
  mar: number;
  mdr: number;
  out: number;
  flags: Flags;
  ram: Uint8Array;
  halted: boolean;
  output: number[];
  phase: Phase;
  cycles: number;
  mnemonic: string;
  summary: string;
  origin: number;
}

interface StepBody {
  phase: Phase;
  title: string;
  summary: string;
  explanation: string;
  activeBus: BusName | null;
  busValue: number | null;
  busFrom: string;
  busTo: string;
  busForward: boolean;
  activeRegs: RegId[];
  changedRegs: RegId[];
  changedFlags: FlagId[];
  readMem: number | null;
  writeMem: number | null;
  alu: AluView | null;
}

type MicroFn = (cpu: Cpu) => StepBody;

const FETCH_SUMMARY = '把下一条指令从内存读进指令寄存器。';

function step(partial: {
  phase: Phase;
  title: string;
  explanation: string;
  summary?: string;
  activeBus?: BusName | null;
  busValue?: number | null;
  busFrom?: string;
  busTo?: string;
  busForward?: boolean;
  activeRegs?: RegId[];
  changedRegs?: RegId[];
  changedFlags?: FlagId[];
  readMem?: number | null;
  writeMem?: number | null;
  alu?: AluView | null;
}): StepBody {
  const changedRegs = partial.changedRegs ?? [];
  return {
    phase: partial.phase,
    title: partial.title,
    summary: partial.summary ?? '',
    explanation: partial.explanation,
    activeBus: partial.activeBus ?? null,
    busValue: partial.busValue ?? null,
    busFrom: partial.busFrom ?? '',
    busTo: partial.busTo ?? '',
    busForward: partial.busForward ?? true,
    changedRegs,
    activeRegs: partial.activeRegs ?? changedRegs,
    changedFlags: partial.changedFlags ?? [],
    readMem: partial.readMem ?? null,
    writeMem: partial.writeMem ?? null,
    alu: partial.alu ?? null,
  };
}

function transfer(options: {
  phase: Phase;
  title: string;
  explanation: string;
  summary?: string;
  bus: BusName;
  value: number;
  from: string;
  to: string;
  forward?: boolean;
  changedRegs?: RegId[];
  activeRegs?: RegId[];
  changedFlags?: FlagId[];
  readMem?: number | null;
  writeMem?: number | null;
}): StepBody {
  return step({
    phase: options.phase,
    title: options.title,
    explanation: options.explanation,
    summary: options.summary,
    activeBus: options.bus,
    busValue: options.value,
    busFrom: options.from,
    busTo: options.to,
    busForward: options.forward,
    changedRegs: options.changedRegs,
    activeRegs: options.activeRegs,
    changedFlags: options.changedFlags,
    readMem: options.readMem,
    writeMem: options.writeMem,
  });
}

function describeZn(result: number): string {
  const zero = result === 0 ? '结果是 0，零标志 Z 亮起。' : '结果不是 0，零标志 Z 熄灭。';
  const negative =
    (result & 0x80) !== 0 ? '最高位是 1，负标志 N 亮起。' : '最高位是 0，负标志 N 熄灭。';
  return zero + negative;
}

function describeLoaded(value: number): string {
  const zero = value === 0 ? '这个值是 0，零标志 Z 亮起。' : '这个值不是 0，零标志 Z 熄灭。';
  const negative =
    (value & 0x80) !== 0 ? '最高位是 1，负标志 N 亮起。' : '最高位是 0，负标志 N 熄灭。';
  return `${zero}${negative}进位标志 C 保持不变。`;
}

function readOperand(noun: string): MicroFn[] {
  return [
    (cpu) => {
      const address = cpu.pc;
      cpu.mar = address;
      return transfer({
        phase: 'execute',
        title: '操作数地址',
        summary: cpu.summary,
        bus: 'address',
        value: address,
        from: 'PC',
        to: '内存',
        forward: true,
        changedRegs: ['mar'],
        activeRegs: ['pc', 'mar'],
        explanation: `执行：${cpu.mnemonic} 还需要一个${noun}。控制单元把程序计数器 PC 里的 ${numText(address)} 送到地址总线，内存地址寄存器 MAR 记住这个地址。`,
      });
    },
    (cpu) => {
      const address = cpu.mar;
      const value = cpu.ram[address];
      cpu.mdr = value;
      return transfer({
        phase: 'execute',
        title: '读出操作数',
        summary: cpu.summary,
        bus: 'data',
        value,
        from: '内存',
        to: 'MDR',
        forward: false,
        changedRegs: ['mdr'],
        activeRegs: ['mdr'],
        readMem: address,
        explanation: `执行：内存 ${numText(address)} 里的字节是 ${numText(value)}。它沿着数据总线进入数据寄存器 MDR，这就是${noun}。`,
      });
    },
    (cpu) => {
      const previous = cpu.pc;
      cpu.operand = cpu.mdr;
      cpu.pc = u8(cpu.pc + 1);
      const wrapped = previous === 0xff;
      return step({
        phase: 'execute',
        title: 'PC 加 1',
        summary: cpu.summary,
        changedRegs: ['pc'],
        explanation: wrapped
          ? `执行：${noun} ${numText(cpu.operand)} 已经取到。PC 原本是 255，加 1 后绕回 ${numText(cpu.pc)}。`
          : `执行：${noun} ${numText(cpu.operand)} 已经取到。PC 加 1，变成 ${numText(cpu.pc)}，指向后面的字节。`,
      });
    },
  ];
}

function loadRegister(which: 'acc' | 'b'): MicroFn[] {
  const name = which === 'acc' ? 'ACC' : 'B';
  return [
    ...readOperand('地址'),
    (cpu) => {
      cpu.mar = cpu.operand;
      return transfer({
        phase: 'execute',
        title: '数据地址',
        summary: cpu.summary,
        bus: 'address',
        value: cpu.mar,
        from: '地址',
        to: '内存',
        forward: true,
        changedRegs: ['mar'],
        activeRegs: ['mar'],
        explanation: `执行：操作数 ${numText(cpu.operand)} 是内存地址。把它送到地址总线，准备读取要装进 ${name} 的数据。`,
      });
    },
    (cpu) => {
      const address = cpu.mar;
      const value = cpu.ram[address];
      cpu.mdr = value;
      return transfer({
        phase: 'execute',
        title: '读出数据',
        summary: cpu.summary,
        bus: 'data',
        value,
        from: '内存',
        to: 'MDR',
        forward: false,
        changedRegs: ['mdr'],
        activeRegs: ['mdr'],
        readMem: address,
        explanation: `执行：内存 ${numText(address)} 的内容是 ${numText(value)}，经数据总线进入 MDR。`,
      });
    },
    (cpu) => {
      const value = cpu.mdr;
      cpu[which] = value;
      cpu.flags = { z: value === 0, n: (value & 0x80) !== 0, c: cpu.flags.c };
      return transfer({
        phase: 'execute',
        title: `装入 ${name}`,
        summary: cpu.summary,
        bus: 'data',
        value,
        from: 'MDR',
        to: name,
        forward: true,
        changedRegs: [which],
        activeRegs: ['mdr', which],
        changedFlags: ['z', 'n'],
        explanation: `执行：MDR 里的 ${numText(value)} 写进寄存器 ${name}。${describeLoaded(value)}`,
      });
    },
  ];
}

function loadImmediate(which: 'acc' | 'b'): MicroFn[] {
  const name = which === 'acc' ? 'ACC' : 'B';
  return [
    ...readOperand('立即数'),
    (cpu) => {
      const value = cpu.operand;
      cpu[which] = value;
      cpu.flags = { z: value === 0, n: (value & 0x80) !== 0, c: cpu.flags.c };
      return transfer({
        phase: 'execute',
        title: `装入 ${name}`,
        summary: cpu.summary,
        bus: 'data',
        value,
        from: 'MDR',
        to: name,
        forward: true,
        changedRegs: [which],
        activeRegs: ['mdr', which],
        changedFlags: ['z', 'n'],
        explanation: `执行：立即数不用再去内存里找，它就跟在操作码后面。把 ${numText(value)} 写进 ${name}。${describeLoaded(value)}`,
      });
    },
  ];
}

function storeMemory(): MicroFn[] {
  return [
    ...readOperand('地址'),
    (cpu) => {
      cpu.mar = cpu.operand;
      return transfer({
        phase: 'execute',
        title: '写入地址',
        summary: cpu.summary,
        bus: 'address',
        value: cpu.mar,
        from: '地址',
        to: '内存',
        forward: true,
        changedRegs: ['mar'],
        activeRegs: ['mar'],
        explanation: `执行：要把数据放进内存 ${numText(cpu.operand)}。这个地址经地址总线送进 MAR。`,
      });
    },
    (cpu) => {
      cpu.mdr = cpu.acc;
      return transfer({
        phase: 'execute',
        title: '送出数据',
        summary: cpu.summary,
        bus: 'data',
        value: cpu.mdr,
        from: 'ACC',
        to: 'MDR',
        forward: true,
        changedRegs: ['mdr'],
        activeRegs: ['acc', 'mdr'],
        explanation: `执行：累加器 ACC 的值 ${numText(cpu.acc)} 复制到 MDR，它正站在数据总线上，等着写入内存。`,
      });
    },
    (cpu) => {
      const address = cpu.mar;
      const value = cpu.mdr;
      cpu.ram[address] = value;
      return transfer({
        phase: 'execute',
        title: '写入内存',
        summary: cpu.summary,
        bus: 'data',
        value,
        from: 'MDR',
        to: '内存',
        forward: true,
        changedRegs: [],
        activeRegs: ['mdr'],
        writeMem: address,
        explanation: `执行：MDR 里的 ${numText(value)} 写入内存地址 ${numText(address)}。这个格子换成了新的值，寄存器本身没有变。`,
      });
    },
  ];
}

function addValues(source: 'b' | 'imm'): MicroFn {
  return (cpu) => {
    const left = cpu.acc;
    const right = source === 'b' ? cpu.b : cpu.operand;
    const raw = left + right;
    const result = u8(raw);
    const carry = raw > 0xff;
    cpu.acc = result;
    cpu.flags = { z: result === 0, n: (result & 0x80) !== 0, c: carry };
    const rightName = source === 'b' ? '寄存器 B' : '立即数';
    return step({
      phase: 'execute',
      title: '加法',
      summary: cpu.summary,
      changedRegs: ['acc'],
      activeRegs: source === 'b' ? ['acc', 'b'] : ['acc'],
      changedFlags: ['z', 'n', 'c'],
      alu: { op: 'ADD', left, right, result },
      explanation:
        `执行：算术逻辑单元计算 ACC + ${rightName}，也就是 ${left} + ${right} = ${raw}。` +
        `寄存器只有 8 位，ACC 留下 ${numText(result)}。` +
        (carry ? '和超过了 255，进位标志 C 亮起。' : '没有超过 255，进位标志 C 熄灭。') +
        describeZn(result),
    });
  };
}

function subValues(source: 'b' | 'imm', writeBack: boolean): MicroFn {
  return (cpu) => {
    const left = cpu.acc;
    const right = source === 'b' ? cpu.b : cpu.operand;
    const result = u8(left - right);
    const borrow = left < right;
    if (writeBack) cpu.acc = result;
    cpu.flags = { z: result === 0, n: (result & 0x80) !== 0, c: borrow };
    const rightName = source === 'b' ? '寄存器 B' : '立即数';
    const verb = writeBack ? '减法' : '比较';
    return step({
      phase: 'execute',
      title: verb,
      summary: cpu.summary,
      changedRegs: writeBack ? ['acc'] : [],
      activeRegs: source === 'b' ? ['acc', 'b'] : ['acc'],
      changedFlags: ['z', 'n', 'c'],
      alu: { op: writeBack ? 'SUB' : 'CMP', left, right, result },
      explanation: writeBack
        ? `执行：算术逻辑单元计算 ACC − ${rightName}，也就是 ${left} − ${right}。8 位结果是 ${numText(result)}，写回 ACC。` +
          (borrow ? '被减数更小，需要借位，标志 C 亮起。' : '够减，没有借位，标志 C 熄灭。') +
          describeZn(result)
        : `执行：比较就是做一次减法，但差不写回寄存器。ACC − ${rightName} = ${left} − ${right}，8 位结果是 ${numText(result)}。ACC 仍然是 ${numText(left)}。` +
          (borrow ? '被减数更小，借位标志 C 亮起。' : '够减，借位标志 C 熄灭。') +
          describeZn(result),
    });
  };
}

function logic(op: 'AND' | 'OR' | 'XOR'): MicroFn {
  return (cpu) => {
    const left = cpu.acc;
    const right = cpu.b;
    const result = op === 'AND' ? left & right : op === 'OR' ? (left | right) : left ^ right;
    cpu.acc = result;
    cpu.flags = { z: result === 0, n: (result & 0x80) !== 0, c: cpu.flags.c };
    const verb = op === 'AND' ? '按位与' : op === 'OR' ? '按位或' : '按位异或';
    return step({
      phase: 'execute',
      title: verb,
      summary: cpu.summary,
      changedRegs: ['acc'],
      activeRegs: ['acc', 'b'],
      changedFlags: ['z', 'n'],
      alu: { op, left, right, result },
      explanation:
        `执行：算术逻辑单元把 ACC ${numText(left)} 和 B ${numText(right)} 做${verb}，得到 ${numText(result)}，写回 ACC。` +
        describeZn(result) +
        '进位标志 C 保持不变。',
    });
  };
}

function jump(kind: 'always' | 'z' | 'nz' | 'c'): MicroFn {
  return (cpu) => {
    const target = cpu.operand;
    let take = false;
    let because = '';
    if (kind === 'always') {
      take = true;
      because = 'JMP 不看标志，一定跳转。';
    } else if (kind === 'z') {
      take = cpu.flags.z;
      because = cpu.flags.z ? '零标志 Z 亮着，条件成立。' : '零标志 Z 灭着，条件不成立。';
    } else if (kind === 'nz') {
      take = !cpu.flags.z;
      because = cpu.flags.z ? '零标志 Z 亮着，所以“不是零才跳”不成立。' : '零标志 Z 灭着，条件成立。';
    } else {
      take = cpu.flags.c;
      because = cpu.flags.c ? '进位/借位标志 C 亮着，条件成立。' : '标志 C 灭着，条件不成立。';
    }

    if (!take) {
      return step({
        phase: 'execute',
        title: '不跳转',
        summary: cpu.summary,
        explanation: `执行：${because}程序计数器留在 ${numText(cpu.pc)}，下一条指令按顺序执行。`,
      });
    }

    cpu.pc = target;
    return transfer({
      phase: 'execute',
      title: '跳转',
      summary: cpu.summary,
      bus: 'address',
      value: target,
      from: '目标',
      to: 'PC',
      forward: true,
      changedRegs: ['pc'],
      activeRegs: ['pc'],
      explanation: `执行：${because}程序计数器 PC 改为 ${numText(target)}。下一条指令会从这里取出。`,
    });
  };
}

function microsFor(opcode: number): MicroFn[] {
  switch (opcode) {
    case OP.NOP:
      return [
        (cpu) =>
          step({
            phase: 'execute',
            title: '空操作',
            summary: cpu.summary,
            explanation: '执行：NOP 什么都不改。它只是占住这一拍，PC 在取指时已经指向下一字节。',
          }),
      ];
    case OP.LOAD_A:
      return loadRegister('acc');
    case OP.LOAD_B:
      return loadRegister('b');
    case OP.LOADI_A:
      return loadImmediate('acc');
    case OP.LOADI_B:
      return loadImmediate('b');
    case OP.STORE:
      return storeMemory();
    case OP.ADD:
      return [addValues('b')];
    case OP.ADDI:
      return [...readOperand('立即数'), addValues('imm')];
    case OP.SUB:
      return [subValues('b', true)];
    case OP.SUBI:
      return [...readOperand('立即数'), subValues('imm', true)];
    case OP.CMP:
      return [subValues('b', false)];
    case OP.AND:
      return [logic('AND')];
    case OP.OR:
      return [logic('OR')];
    case OP.XOR:
      return [logic('XOR')];
    case OP.NOT:
      return [
        (cpu) => {
          const left = cpu.acc;
          const result = (~left) & 0xff;
          cpu.acc = result;
          cpu.flags = { z: result === 0, n: (result & 0x80) !== 0, c: cpu.flags.c };
          return step({
            phase: 'execute',
            title: '取反',
            summary: cpu.summary,
            changedRegs: ['acc'],
            activeRegs: ['acc'],
            changedFlags: ['z', 'n'],
            alu: { op: 'NOT', left, right: 0, result },
            explanation:
              `执行：算术逻辑单元把 ACC 的 8 个位全部反过来。${numText(left)} 变成 ${numText(result)}。` +
              describeZn(result) +
              '进位标志 C 保持不变。',
          });
        },
      ];
    case OP.JMP:
      return [...readOperand('跳转地址'), jump('always')];
    case OP.JZ:
      return [...readOperand('跳转地址'), jump('z')];
    case OP.JNZ:
      return [...readOperand('跳转地址'), jump('nz')];
    case OP.JC:
      return [...readOperand('跳转地址'), jump('c')];
    case OP.OUT:
      return [
        (cpu) => {
          const value = cpu.acc;
          cpu.out = value;
          cpu.output.push(value);
          return transfer({
            phase: 'execute',
            title: '输出',
            summary: cpu.summary,
            bus: 'data',
            value,
            from: 'ACC',
            to: 'OUT',
            forward: true,
            changedRegs: ['out'],
            activeRegs: ['acc', 'out'],
            explanation: `执行：OUT 把累加器的值 ${numText(value)} 复制到输出寄存器。可以把它看成屏幕或指示灯上新出现的一个结果。`,
          });
        },
      ];
    case OP.HALT:
      return [
        (cpu) => {
          cpu.halted = true;
          return step({
            phase: 'execute',
            title: '停机',
            summary: cpu.summary,
            explanation: '执行：遇到 HALT。处理器停下来，不再取下一条指令。寄存器和内存保持现在的值，方便你对照结果。',
          });
        },
      ];
    default:
      return [];
  }
}

/**
 * An 8-bit teaching CPU. Each instruction is a short list of micro-steps
 * so the UI can light up fetch, decode, and execute one beat at a time.
 */
export class Cpu {
  pc = 0;
  ir = 0;
  acc = 0;
  b = 0;
  mar = 0;
  mdr = 0;
  out = 0;
  operand = 0;
  flags: Flags = { z: false, n: false, c: false };
  ram = new Uint8Array(256);
  halted = false;
  output: number[] = [];
  phase: Phase = 'idle';
  cycles = 0;
  mnemonic = '';
  summary = '';
  origin = 0;

  private image = new Uint8Array(256);
  private queue: MicroFn[] = [];

  load(image: Uint8Array, origin = 0): void {
    if (image.length !== 256) {
      throw new Error('内存映像必须是 256 字节');
    }
    this.image = new Uint8Array(image);
    this.origin = u8(origin);
    this.reset();
  }

  reset(): void {
    this.ram = new Uint8Array(this.image);
    this.pc = this.origin;
    this.ir = 0;
    this.acc = 0;
    this.b = 0;
    this.mar = 0;
    this.mdr = 0;
    this.out = 0;
    this.operand = 0;
    this.flags = { z: false, n: false, c: false };
    this.halted = false;
    this.output = [];
    this.phase = 'idle';
    this.cycles = 0;
    this.mnemonic = '';
    this.summary = '';
    this.queue = [];
  }

  view(): CpuView {
    return {
      pc: this.pc,
      ir: this.ir,
      acc: this.acc,
      b: this.b,
      mar: this.mar,
      mdr: this.mdr,
      out: this.out,
      flags: this.flags,
      ram: this.ram,
      halted: this.halted,
      output: this.output.slice(),
      phase: this.phase,
      cycles: this.cycles,
      mnemonic: this.mnemonic,
      summary: this.summary,
      origin: this.origin,
    };
  }

  stepMicro(): StepInfo {
    if (this.halted) return this.haltedInfo();
    if (this.queue.length === 0) this.enqueueFetch();
    const fn = this.queue.shift();
    if (!fn) return this.haltedInfo();
    const body = fn(this);
    this.cycles += 1;
    this.phase = body.phase;
    return {
      ...body,
      mnemonic: this.mnemonic,
      instructionComplete: this.queue.length === 0,
    };
  }

  /** Finish the current instruction, or run exactly one if we are between instructions. */
  stepInstruction(): StepInfo[] {
    if (this.halted) return [this.haltedInfo()];
    const steps: StepInfo[] = [];
    for (let guard = 0; guard < 64; guard += 1) {
      const info = this.stepMicro();
      steps.push(info);
      if (info.instructionComplete || this.halted) break;
    }
    return steps;
  }

  private haltedInfo(): StepInfo {
    this.phase = 'halted';
    return {
      phase: 'halted',
      title: '已经停机',
      summary: '处理器停在这里。',
      explanation: '处理器已经停机。寄存器和内存保持原样。按「复位」可以从入口重新开始，或改完程序后重新汇编。',
      mnemonic: this.mnemonic,
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
    };
  }

  private enqueueFetch(): void {
    this.queue.push(
      (cpu) => {
        const address = cpu.pc;
        cpu.mar = address;
        cpu.mnemonic = '';
        cpu.summary = FETCH_SUMMARY;
        return transfer({
          phase: 'fetch',
          title: '指令地址',
          summary: FETCH_SUMMARY,
          bus: 'address',
          value: address,
          from: 'PC',
          to: '内存',
          forward: true,
          changedRegs: ['mar'],
          activeRegs: ['pc', 'mar'],
          explanation: `取指：程序计数器 PC 保存着下一条指令的地址 ${numText(address)}。控制单元把它送到地址总线，内存地址寄存器 MAR 一并记住它。`,
        });
      },
      (cpu) => {
        const address = cpu.mar;
        const value = cpu.ram[address];
        cpu.mdr = value;
        return transfer({
          phase: 'fetch',
          title: '读出指令',
          summary: FETCH_SUMMARY,
          bus: 'data',
          value,
          from: '内存',
          to: 'MDR',
          forward: false,
          changedRegs: ['mdr'],
          activeRegs: ['mdr'],
          readMem: address,
          explanation: `取指：内存地址 ${numText(address)} 里放着字节 ${numText(value)}。这个字节经数据总线进入数据寄存器 MDR。`,
        });
      },
      (cpu) => {
        cpu.ir = cpu.mdr;
        return transfer({
          phase: 'fetch',
          title: '装入 IR',
          summary: FETCH_SUMMARY,
          bus: 'data',
          value: cpu.ir,
          from: 'MDR',
          to: 'IR',
          forward: true,
          changedRegs: ['ir'],
          activeRegs: ['mdr', 'ir'],
          explanation: `取指：MDR 里的字节再送到指令寄存器 IR。IR 现在是 ${numText(cpu.ir)}，这就是即将辨认的操作码。`,
        });
      },
      (cpu) => {
        const previous = cpu.pc;
        cpu.pc = u8(cpu.pc + 1);
        const wrapped = previous === 0xff;
        return step({
          phase: 'fetch',
          title: 'PC 加 1',
          summary: FETCH_SUMMARY,
          changedRegs: ['pc'],
          explanation: wrapped
            ? `取指：PC 已经是 255，加 1 后绕回 ${numText(cpu.pc)}。内存只有 256 个格子，地址到头会从头再数。`
            : `取指：PC 加 1，变成 ${numText(cpu.pc)}。这样下一次取指会读到后面的字节，而不是同一条指令。`,
        });
      },
      (cpu) => {
        const spec = ISA_BY_OPCODE.get(cpu.ir);
        if (!spec) {
          cpu.mnemonic = '???';
          cpu.summary = '这个操作码没有对应的指令。';
          cpu.queue.push((inner) => {
            inner.halted = true;
            return step({
              phase: 'execute',
              title: '无法执行',
              summary: inner.summary,
              explanation: `执行：操作码 ${numText(inner.ir)} 不在指令表里。处理器停机，避免把乱码当成指令继续跑。`,
            });
          });
          return step({
            phase: 'decode',
            title: '译码',
            summary: cpu.summary,
            explanation: `译码：控制单元查看指令寄存器里的 ${numText(cpu.ir)}，指令表中没有这条操作码。`,
          });
        }

        cpu.mnemonic = spec.short;
        cpu.summary = spec.summary;
        for (const micro of microsFor(spec.opcode)) cpu.queue.push(micro);
        return step({
          phase: 'decode',
          title: '译码',
          summary: spec.summary,
          explanation: `译码：控制单元认出操作码 ${numText(cpu.ir)} 是 ${spec.syntax}。${spec.summary}`,
        });
      },
    );
  }
}
