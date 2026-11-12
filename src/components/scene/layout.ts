import type { RegId, StepInfo } from '../../cpu/cpu';

export interface Vec3 {
  x: number;
  y: number;
  z: number;
}

export interface DieBlock {
  id: string;
  title: string;
  position: Vec3;
  size: [number, number, number];
}

export const CPU_PACKAGE = {
  position: { x: -2.8, y: 0.28, z: -1.35 } as Vec3,
  size: [6.9, 0.32, 5.05] as [number, number, number],
};

export const RAM_ORIGIN: Vec3 = { x: 4.55, y: 0.2, z: 2.45 };
export const RAM_PITCH = 0.27;

export const OUTPUT_DEVICE: Vec3 = { x: 6.35, y: 0.52, z: -1.55 };

export const BOARD = {
  position: { x: 0.45, y: 0, z: 0.55 } as Vec3,
  size: [16.6, 0.16, 11.4] as [number, number, number],
};

const SURFACE_Y = CPU_PACKAGE.position.y + CPU_PACKAGE.size[1] / 2;

function die(id: string, title: string, dx: number, dz: number, w: number, d: number, h = 0.3): DieBlock {
  return {
    id,
    title,
    position: {
      x: CPU_PACKAGE.position.x + dx,
      y: SURFACE_Y + h / 2,
      z: CPU_PACKAGE.position.z + dz,
    },
    size: [w, h, d],
  };
}

export const DIES = {
  control: die('control', '控制单元', -1.7, -1.25, 2.6, 1.4),
  alu: die('alu', '算术逻辑单元', 1.05, -1.25, 2.5, 1.4),
  pc: die('pc', 'PC', -2.25, 0.35, 1.2, 1.05, 0.28),
  ir: die('ir', 'IR', -0.85, 0.35, 1.2, 1.05, 0.28),
  acc: die('acc', 'ACC', 0.55, 0.35, 1.2, 1.05, 0.28),
  b: die('b', 'B', 1.95, 0.35, 1.2, 1.05, 0.28),
  mar: die('mar', 'MAR', -1.55, 1.6, 1.35, 1.05, 0.28),
  mdr: die('mdr', 'MDR', 0.05, 1.6, 1.35, 1.05, 0.28),
  out: die('out', 'OUT', 1.7, 1.6, 1.35, 1.05, 0.28),
} as const;

export const REGISTER_BLOCKS: Record<Exclude<RegId, never>, DieBlock> = {
  pc: DIES.pc,
  ir: DIES.ir,
  acc: DIES.acc,
  b: DIES.b,
  mar: DIES.mar,
  mdr: DIES.mdr,
  out: DIES.out,
};

export const FLAG_LAMPS: Record<'z' | 'n' | 'c', Vec3> = {
  z: { x: CPU_PACKAGE.position.x + 2.55, y: SURFACE_Y + 0.16, z: CPU_PACKAGE.position.z - 1.55 },
  n: { x: CPU_PACKAGE.position.x + 2.55, y: SURFACE_Y + 0.16, z: CPU_PACKAGE.position.z - 1.15 },
  c: { x: CPU_PACKAGE.position.x + 2.55, y: SURFACE_Y + 0.16, z: CPU_PACKAGE.position.z - 0.75 },
};

export const ADDRESS_BUS: Vec3[] = [
  { x: 0.75, y: 0.12, z: -0.7 },
  { x: 1.85, y: 0.12, z: 0.15 },
  { x: 2.7, y: 0.12, z: 1.45 },
  { x: 2.85, y: 0.12, z: 2.45 },
];

export const DATA_BUS: Vec3[] = [
  { x: 0.75, y: 0.12, z: 0.15 },
  { x: 1.7, y: 0.12, z: 0.95 },
  { x: 2.45, y: 0.12, z: 2.05 },
  { x: 2.85, y: 0.12, z: 3.2 },
];

export const HOME_TARGET: Vec3 = { x: 0.55, y: 0.15, z: 0.35 };
export const HOME_CAMERA: Vec3 = { x: 0.15, y: 12.4, z: 9.6 };

export function ramCellPosition(address: number): Vec3 {
  const col = address % 16;
  const row = Math.floor(address / 16);
  return {
    x: RAM_ORIGIN.x + (col - 7.5) * RAM_PITCH,
    y: RAM_ORIGIN.y + 0.16,
    z: RAM_ORIGIN.z + (row - 7.5) * RAM_PITCH,
  };
}

export function registerPosition(id: RegId): Vec3 {
  return REGISTER_BLOCKS[id].position;
}

function memoryAddress(step: StepInfo, mar: number): number {
  return step.writeMem ?? step.readMem ?? mar;
}

export function resolveEndpoint(name: string, step: StepInfo, mar: number): Vec3 | null {
  switch (name) {
    case 'PC':
      return registerPosition('pc');
    case 'IR':
      return registerPosition('ir');
    case 'ACC':
      return registerPosition('acc');
    case 'B':
      return registerPosition('b');
    case 'MAR':
    case '地址':
      return registerPosition('mar');
    case 'MDR':
    case '操作数':
      return registerPosition('mdr');
    case 'OUT':
      return OUTPUT_DEVICE;
    case '目标':
    case '目标地址':
      return registerPosition('pc');
    case '内存':
      return ramCellPosition(memoryAddress(step, mar));
    default:
      return null;
  }
}

export interface PacketRoute {
  bus: 'address' | 'data';
  from: Vec3;
  to: Vec3;
  value: number;
}

export function packetRoute(step: StepInfo | null, mar: number): PacketRoute | null {
  if (!step?.activeBus || step.busValue === null) return null;
  const from = resolveEndpoint(step.busFrom, step, mar);
  const to = resolveEndpoint(step.busTo, step, mar);
  if (!from || !to) return null;
  return { bus: step.activeBus, from, to, value: step.busValue & 0xff };
}

export type FocusKind = 'cpu' | 'register' | 'alu' | 'control' | 'ram' | 'output' | 'bus';

export interface Focus {
  kind: FocusKind;
  position: Vec3;
}

function midpoint(points: Vec3[]): Vec3 {
  const sum = points.reduce((acc, point) => ({ x: acc.x + point.x, y: acc.y + point.y, z: acc.z + point.z }), {
    x: 0,
    y: 0,
    z: 0,
  });
  return { x: sum.x / points.length, y: sum.y / points.length, z: sum.z / points.length };
}

export function focusFor(step: StepInfo | null, mar: number): Focus {
  if (!step || step.phase === 'idle') return { kind: 'cpu', position: HOME_TARGET };
  if (step.writeMem !== null) return { kind: 'ram', position: ramCellPosition(step.writeMem) };
  if (step.readMem !== null) return { kind: 'ram', position: ramCellPosition(step.readMem) };
  if (step.title === '输出' || step.changedRegs.includes('out')) return { kind: 'output', position: OUTPUT_DEVICE };
  if (step.alu) return { kind: 'alu', position: DIES.alu.position };
  const register = step.changedRegs[0] ?? step.activeRegs.find((id) => id !== 'out');
  if (register) return { kind: 'register', position: registerPosition(register) };
  if (step.phase === 'decode') return { kind: 'control', position: DIES.control.position };
  if (step.activeBus === 'address') {
    return { kind: 'bus', position: midpoint([midpoint(ADDRESS_BUS), ramCellPosition(mar & 0xff)]) };
  }
  if (step.activeBus === 'data') return { kind: 'bus', position: midpoint(DATA_BUS) };
  return { kind: 'cpu', position: { ...CPU_PACKAGE.position, y: 0.6 } };
}

/** Rows worth printing next to the RAM chip: the program counter, and the cell being touched. */
export function activeRamRows(pc: number, step: StepInfo | null, mar: number): number[] {
  const focus = step ? (step.writeMem ?? step.readMem ?? mar) : pc;
  const rows = new Set<number>([Math.floor(pc / 16) % 16, Math.floor((focus & 0xff) / 16)]);
  return [...rows].sort((a, b) => a - b);
}

export function pinPositions(): Vec3[] {
  const { position, size } = CPU_PACKAGE;
  const [width, , depth] = size;
  const pins: Vec3[] = [];
  const gap = 0.36;
  const y = 0.1;
  const halfW = width / 2 + 0.16;
  const halfD = depth / 2 + 0.16;
  for (let x = -halfW; x <= halfW + 0.001; x += gap) {
    pins.push({ x: position.x + x, y, z: position.z - halfD });
    pins.push({ x: position.x + x, y, z: position.z + halfD });
  }
  for (let z = -halfD + gap; z <= halfD - gap + 0.001; z += gap) {
    pins.push({ x: position.x - halfW, y, z: position.z + z });
    pins.push({ x: position.x + halfW, y, z: position.z + z });
  }
  return pins;
}
