export type Bit = 0 | 1;

export interface FullAdderSignals {
  a: Bit;
  b: Bit;
  cin: Bit;
  xor1: Bit;
  sum: Bit;
  and1: Bit;
  and2: Bit;
  cout: Bit;
}

export interface RippleBit extends FullAdderSignals {
  index: number;
}

export interface RippleResult {
  sum: number;
  carry: Bit;
  bits: RippleBit[];
}

function bit(value: number): Bit {
  return value ? 1 : 0;
}

/** One full-adder bit, with the internal gate wires exposed. */
export function fullAdderSignals(a: Bit, b: Bit, cin: Bit): FullAdderSignals {
  const xor1 = bit(a ^ b);
  const sum = bit(xor1 ^ cin);
  const and1 = bit(a & b);
  const and2 = bit(cin & xor1);
  const cout = bit(and1 | and2);
  return { a, b, cin, xor1, sum, and1, and2, cout };
}

/** 8-bit ripple-carry adder. Sum and carry match the teaching CPU's ADD. */
export function rippleAdd(left: number, right: number): RippleResult {
  const a = left & 0xff;
  const b = right & 0xff;
  let cin: Bit = 0;
  let sum = 0;
  const bits: RippleBit[] = [];
  for (let index = 0; index < 8; index += 1) {
    const signals = fullAdderSignals(bit((a >> index) & 1), bit((b >> index) & 1), cin);
    bits.push({ index, ...signals });
    sum |= signals.sum << index;
    cin = signals.cout;
  }
  return { sum, carry: cin, bits };
}

export interface CmosNand {
  a: Bit;
  b: Bit;
  output: Bit;
  pmosA: boolean;
  pmosB: boolean;
  nmosA: boolean;
  nmosB: boolean;
}

/** 2-input CMOS NAND: PMOS in parallel to Vdd, NMOS in series to GND. */
export function cmosNand(a: Bit, b: Bit): CmosNand {
  const pmosA = a === 0;
  const pmosB = b === 0;
  const nmosA = a === 1;
  const nmosB = b === 1;
  const output: Bit = nmosA && nmosB ? 0 : 1;
  return { a, b, output, pmosA, pmosB, nmosA, nmosB };
}

export interface CmosNot {
  input: Bit;
  output: Bit;
  pmos: boolean;
  nmos: boolean;
}

/** CMOS inverter: PMOS to Vdd, NMOS to GND, gates tied together. */
export function cmosNot(input: Bit): CmosNot {
  return {
    input,
    output: input === 1 ? 0 : 1,
    pmos: input === 0,
    nmos: input === 1,
  };
}

export interface FlowStep {
  phase: string;
  title: string;
  readMem: number | null;
  writeMem: number | null;
  changedRegs: string[];
  activeBus: string | null;
  busFrom: string;
  busTo: string;
}

export type SystemFlow = 'ram-to-cpu' | 'cpu-to-ram' | 'cpu-to-screen';

export function systemFlow(step: FlowStep | null): SystemFlow | null {
  if (!step) return null;
  if (step.writeMem !== null || step.busTo === '内存') return 'cpu-to-ram';
  if (step.title === '输出' || step.changedRegs.includes('out') || step.busTo === 'OUT') return 'cpu-to-screen';
  if (step.readMem !== null || step.busFrom === '内存' || (step.phase === 'fetch' && step.activeBus)) return 'ram-to-cpu';
  return null;
}
