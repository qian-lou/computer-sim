import type { CpuView, RegId, StepInfo } from '../../../cpu/cpu';
import { hexByte } from '../../../cpu/format';
import { Clickable, Packet, Sign, Wire } from '../parts';

const BLOCKS: Record<string, [number, number, number]> = {
  control: [-1.2, 0.18, 0.55],
  alu: [0.2, 0.18, 0.55],
  cache: [-0.15, 0.12, -0.75],
  bus: [0, 0.12, 1.15],
};

const REGS: Array<{ id: RegId; label: string; at: [number, number, number] }> = [
  { id: 'pc', label: 'PC', at: [1.25, 0.16, 0.85] },
  { id: 'ir', label: 'IR', at: [1.25, 0.16, 0.45] },
  { id: 'acc', label: 'ACC', at: [1.25, 0.16, 0.05] },
  { id: 'b', label: 'B', at: [1.25, 0.16, -0.35] },
  { id: 'mar', label: 'MAR', at: [1.25, 0.16, -0.75] },
  { id: 'mdr', label: 'MDR', at: [1.25, 0.16, -1.1] },
];

export function CpuLevel({
  view,
  step,
  animMs,
  onOpenAlu,
}: {
  view: CpuView;
  step: StepInfo | null;
  animMs: number;
  onOpenAlu: () => void;
}) {
  const hot = new Set(step?.changedRegs ?? []);
  const route = dieRoute(step);
  return (
    <group>
      <mesh receiveShadow>
        <boxGeometry args={[3.6, 0.08, 2.8]} />
        <meshStandardMaterial color="#1b3f73" metalness={0.35} roughness={0.4} />
      </mesh>
      <mesh position={[0, 0.06, 0]}>
        <boxGeometry args={[3.15, 0.06, 2.35]} />
        <meshStandardMaterial color="#142033" metalness={0.2} roughness={0.55} />
      </mesh>
      <DieBlock position={BLOCKS.control} size={[1.15, 0.22, 0.85]} hot={step?.phase === 'decode' || step?.phase === 'fetch'} color="#3d6b8a" />
      <Sign text={step?.phase === 'decode' ? '控制单元 · 译码' : '控制单元'} position={[-1.2, 0.55, 0.55]} factor={6} />
      <Clickable onClick={onOpenAlu}>
        <DieBlock position={BLOCKS.alu} size={[1.2, 0.24, 0.9]} hot={Boolean(step?.alu)} color="#c9845a" />
        <Sign text="ALU · 点击看电路" position={[0.2, 0.58, 0.55]} factor={5.5} />
      </Clickable>
      <DieBlock position={BLOCKS.cache} size={[1.5, 0.14, 0.55]} hot={false} color="#3d5a4a" />
      <Sign text="L1 缓存" position={[-0.15, 0.4, -0.75]} factor={7} />
      <DieBlock position={BLOCKS.bus} size={[1.8, 0.14, 0.32]} hot={Boolean(step?.activeBus)} color="#8a6a32" />
      <Sign text="总线接口" position={[0, 0.4, 1.15]} factor={7} />
      {REGS.map((reg) => (
        <group key={reg.id} position={reg.at}>
          <mesh>
            <boxGeometry args={[0.7, 0.2, 0.28]} />
            <meshStandardMaterial
              color={hot.has(reg.id) ? '#f0c36a' : '#d7deE6'}
              emissive={hot.has(reg.id) ? '#f0b429' : '#000'}
              emissiveIntensity={hot.has(reg.id) ? 0.55 : 0}
              metalness={0.25}
              roughness={0.4}
            />
          </mesh>
          <Sign text={`${reg.label} ${hexByte(view[reg.id])}`} position={[0, 0.28, 0]} factor={4.4} />
        </group>
      ))}
      <FlagRow z={view.flags.z} n={view.flags.n} c={view.flags.c} />
      <Sign text={`OUT ${hexByte(view.out)}`} position={[-1.15, 0.45, -0.2]} factor={6} />
      {route && <Packet from={route[0]} to={route[1]} color="#8eb6ff" token={view.cycles} animMs={animMs} />}
      <Wire a={[-0.55, 0.25, 0.55]} b={[0.2, 0.32, 0.55]} on={Boolean(step?.alu)} />
      <Wire a={[0.7, 0.25, 0.2]} b={[1.0, 0.25, 0.2]} on={hot.has('acc')} />
    </group>
  );
}

function DieBlock({
  position,
  size,
  hot,
  color,
}: {
  position: [number, number, number];
  size: [number, number, number];
  hot: boolean;
  color: string;
}) {
  return (
    <mesh position={position}>
      <boxGeometry args={size} />
      <meshStandardMaterial color={color} emissive={hot ? '#f0b429' : '#000'} emissiveIntensity={hot ? 0.45 : 0} metalness={0.25} roughness={0.45} />
    </mesh>
  );
}

function FlagRow({ z, n, c }: { z: boolean; n: boolean; c: boolean }) {
  const flags = [
    ['Z', z],
    ['N', n],
    ['C', c],
  ] as const;
  return (
    <group position={[-1.15, 0.2, -1.05]}>
      {flags.map(([name, on], index) => (
        <mesh key={name} position={[index * 0.28, 0, 0]}>
          <sphereGeometry args={[0.08, 12, 12]} />
          <meshStandardMaterial color={on ? '#d8fff1' : '#445' } emissive={on ? '#5ee0b5' : '#000'} emissiveIntensity={on ? 1 : 0} />
        </mesh>
      ))}
      <Sign text="标志 Z N C" position={[0.28, 0.28, 0]} factor={5} />
    </group>
  );
}

function dieRoute(step: StepInfo | null): [[number, number, number], [number, number, number]] | null {
  if (!step?.activeBus) return null;
  const table: Record<string, [number, number, number]> = {
    PC: [1.25, 0.35, 0.85],
    IR: [1.25, 0.35, 0.45],
    ACC: [1.25, 0.35, 0.05],
    B: [1.25, 0.35, -0.35],
    MAR: [1.25, 0.35, -0.75],
    MDR: [1.25, 0.35, -1.1],
    地址: [1.25, 0.35, -0.75],
    内存: [0, 0.3, 1.15],
    OUT: [-1.15, 0.35, -0.2],
    目标: [1.25, 0.35, 0.85],
    操作数: [1.25, 0.35, -1.1],
  };
  const from = table[step.busFrom];
  const to = table[step.busTo];
  if (!from || !to) return null;
  return [from, to];
}
