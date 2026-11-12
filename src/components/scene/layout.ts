import type { RegId, StepInfo } from '../../cpu/cpu';

export interface Vec3 {
  x: number;
  y: number;
  z: number;
}

/** Dollhouse footprint. The front (+z) is open so the rooms read like a cutaway. */
export const HOUSE = {
  minX: -9.2,
  maxX: 9.2,
  minZ: -5.2,
  maxZ: 5.4,
  wallHeight: 2.55,
  floorY: 0.16,
};

export interface Locker {
  title: string;
  hint: string;
  position: Vec3;
}

export const LOCKERS: Record<RegId, Locker> = {
  pc: { title: 'PC', hint: '计数', position: { x: -7.15, y: 0.7, z: 1.2 } },
  ir: { title: 'IR', hint: '指令', position: { x: -5.85, y: 0.7, z: 1.2 } },
  acc: { title: 'ACC', hint: '累加', position: { x: -4.55, y: 0.7, z: 1.2 } },
  b: { title: 'B', hint: '帮手', position: { x: -3.25, y: 0.7, z: 1.2 } },
  mar: { title: 'MAR', hint: '地址', position: { x: -6.5, y: 0.7, z: 2.55 } },
  mdr: { title: 'MDR', hint: '数据', position: { x: -3.9, y: 0.7, z: 2.55 } },
  out: { title: 'OUT', hint: '送出', position: { x: -5.2, y: 0.7, z: 3.55 } },
};

export const CONTROL_DESK: Vec3 = { x: -6.4, y: 0.55, z: -2.15 };
export const ALU_MACHINE: Vec3 = { x: -3.55, y: 0.7, z: -2.15 };

export const FLAG_LAMPS: Record<'z' | 'n' | 'c', Vec3> = {
  z: { x: -8.55, y: 1.55, z: -1.6 },
  n: { x: -8.55, y: 1.55, z: -0.7 },
  c: { x: -8.55, y: 1.55, z: 0.2 },
};

export const WAREHOUSE = { x: 5.05, y: 0.38, z: 0.15 };
export const SHELF_PITCH = 0.34;

/** Shop window on the open front of the house. */
export const OUTPUT_DEVICE: Vec3 = { x: 0.15, y: 1.65, z: 5.35 };

export const ADDRESS_BUS: Vec3[] = [
  { x: -5.2, y: 0.22, z: 0.55 },
  { x: -1.6, y: 0.22, z: 0.15 },
  { x: 1.7, y: 0.22, z: 0.15 },
  { x: 4.4, y: 0.22, z: 0.15 },
];

export const DATA_BUS: Vec3[] = [
  { x: -5.2, y: 0.48, z: 1.85 },
  { x: -1.6, y: 0.48, z: 1.25 },
  { x: 1.7, y: 0.48, z: 1.25 },
  { x: 4.4, y: 0.48, z: 1.25 },
];

export const HOME_TARGET: Vec3 = { x: 0.1, y: 1.15, z: 0.2 };
export const HOME_CAMERA: Vec3 = { x: 0.2, y: 8.6, z: 13.4 };

export const ROOM_TITLES = {
  control: '控制室',
  alu: '运算车间',
  lockers: '寄存器柜',
  address: '地址走廊',
  data: '数据传送带',
  warehouse: '内存仓库',
  output: '输出橱窗',
  house: '计算机小屋',
} as const;

export function ramCellPosition(address: number): Vec3 {
  const col = address % 16;
  const row = Math.floor(address / 16);
  return {
    x: WAREHOUSE.x + (col - 7.5) * SHELF_PITCH,
    y: WAREHOUSE.y,
    z: WAREHOUSE.z + (row - 7.5) * SHELF_PITCH,
  };
}

export function registerPosition(id: RegId): Vec3 {
  return LOCKERS[id].position;
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
      return ramCellPosition(memoryAddress(step, mar) & 0xff);
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

export type FocusKind = 'house' | 'register' | 'alu' | 'control' | 'ram' | 'output' | 'bus';

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
  return { x: sum.x / points.length, y: 1.2, z: sum.z / points.length };
}

export function focusFor(step: StepInfo | null, mar: number): Focus {
  if (!step || step.phase === 'idle') return { kind: 'house', position: HOME_TARGET };
  if (step.writeMem !== null) return { kind: 'ram', position: ramCellPosition(step.writeMem) };
  if (step.readMem !== null) return { kind: 'ram', position: ramCellPosition(step.readMem) };
  if (step.title === '输出' || step.changedRegs.includes('out')) return { kind: 'output', position: OUTPUT_DEVICE };
  if (step.alu) return { kind: 'alu', position: ALU_MACHINE };
  const register = step.changedRegs[0] ?? step.activeRegs.find((id) => id !== 'out');
  if (register) return { kind: 'register', position: registerPosition(register) };
  if (step.phase === 'decode') return { kind: 'control', position: CONTROL_DESK };
  if (step.activeBus === 'address') {
    return { kind: 'bus', position: midpoint([midpoint(ADDRESS_BUS), ramCellPosition(mar & 0xff)]) };
  }
  if (step.activeBus === 'data') return { kind: 'bus', position: midpoint(DATA_BUS) };
  return { kind: 'house', position: HOME_TARGET };
}

export function activeRamRows(pc: number, step: StepInfo | null, mar: number): number[] {
  const focus = step ? (step.writeMem ?? step.readMem ?? mar) : pc;
  const rows = new Set<number>([Math.floor((pc & 0xff) / 16), Math.floor((focus & 0xff) / 16)]);
  return [...rows].sort((a, b) => a - b);
}

export function insideHouse(point: Vec3): boolean {
  return point.x >= HOUSE.minX && point.x <= HOUSE.maxX && point.z >= HOUSE.minZ && point.z <= HOUSE.maxZ;
}
