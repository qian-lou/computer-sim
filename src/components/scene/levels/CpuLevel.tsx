import { useFrame } from '@react-three/fiber';
import { useLayoutEffect, useMemo, useRef } from 'react';
import * as THREE from 'three';
import type { CpuView, RegId, StepInfo } from '../../../cpu/cpu';
import { hexByte } from '../../../cpu/format';
import { Clickable, Packet, Sign } from '../parts';
import { makeDieTexture } from '../textures';

const BLOCKS = {
  control: [-1.15, 0.16, 0.45] as [number, number, number],
  alu: [0.15, 0.16, 0.5] as [number, number, number],
  cache: [-0.2, 0.12, -0.7] as [number, number, number],
  bus: [0.1, 0.12, 1.12] as [number, number, number],
};

const REGS: Array<{ id: RegId; label: string; at: [number, number, number] }> = [
  { id: 'pc', label: 'PC', at: [1.22, 0.16, 0.85] },
  { id: 'ir', label: 'IR', at: [1.22, 0.16, 0.45] },
  { id: 'acc', label: 'ACC', at: [1.22, 0.16, 0.05] },
  { id: 'b', label: 'B', at: [1.22, 0.16, -0.35] },
  { id: 'mar', label: 'MAR', at: [1.22, 0.16, -0.75] },
  { id: 'mdr', label: 'MDR', at: [1.22, 0.16, -1.05] },
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
  const die = useMemo(() => makeDieTexture(), []);
  const route = dieRoute(step);
  return (
    <group>
      <mesh receiveShadow>
        <boxGeometry args={[3.7, 0.06, 2.9]} />
        <meshStandardMaterial color="#c5ccd4" metalness={0.75} roughness={0.28} />
      </mesh>
      <mesh position={[0, 0.05, 0]}>
        <planeGeometry args={[3.2, 2.35]} />
        <meshStandardMaterial map={die} color="#ffffff" roughness={0.42} metalness={0.45} />
      </mesh>
      <BondPads />
      <WireBonds />
      <Bumps />
      <Region position={BLOCKS.control} size={[1.15, 0.04, 0.8]} hot={step?.phase === 'decode' || step?.phase === 'fetch'} tint="#2f6ea8" />
      <Sign text="控制单元" position={[-1.15, 0.42, 0.45]} factor={14} />
      <CellArray origin={[-1.55, 0.08, 0.1]} cols={22} rows={12} gap={0.045} />
      <Clickable onClick={onOpenAlu}>
        <Region position={BLOCKS.alu} size={[1.15, 0.1, 0.85]} hot={Boolean(step?.alu)} tint="#c4844a" />
        <Sign text="ALU · 点击看电路" position={[0.15, 0.48, 0.5]} factor={13} />
      </Clickable>
      <Region position={BLOCKS.cache} size={[1.7, 0.03, 0.62]} hot={false} tint="#1d4a38" />
      <CellArray origin={[-0.95, 0.08, -0.98]} cols={28} rows={10} gap={0.05} />
      <Sign text="L1 缓存阵列" position={[-0.2, 0.36, -0.7]} factor={15} />
      <Bundle from={[-0.4, 0.12, 0.5]} to={[0.9, 0.12, 0.2]} hot={Boolean(step?.activeBus)} />
      <Region position={BLOCKS.bus} size={[2.1, 0.05, 0.22]} hot={Boolean(step?.activeBus)} tint="#8a6a32" />
      <Sign text="总线接口" position={[0.1, 0.34, 1.12]} factor={16} />
      {REGS.map((reg) => (
        <group key={reg.id} position={reg.at}>
          <mesh>
            <boxGeometry args={[0.62, 0.1, 0.26]} />
            <meshStandardMaterial
              color={hot.has(reg.id) ? '#f0c36a' : '#d5dbe3'}
              metalness={0.45}
              roughness={0.32}
              emissive={hot.has(reg.id) ? '#f0b429' : '#000'}
              emissiveIntensity={hot.has(reg.id) ? 0.65 : 0}
            />
          </mesh>
          <Sign text={`${reg.label} ${hexByte(view[reg.id])}`} position={[0, 0.22, 0]} factor={9} />
        </group>
      ))}
      <Flags z={view.flags.z} n={view.flags.n} c={view.flags.c} />
      <Sign text={`OUT ${hexByte(view.out)}`} position={[-1.2, 0.4, -0.15]} factor={12} />
      {route && <Packet from={route[0]} to={route[1]} color="#9ec8ff" token={view.cycles} animMs={animMs} />}
      {route && <ParticleStream from={route[0]} to={route[1]} />}
    </group>
  );
}

function Region({
  position,
  size,
  hot,
  tint,
}: {
  position: [number, number, number];
  size: [number, number, number];
  hot: boolean;
  tint: string;
}) {
  return (
    <mesh position={position}>
      <boxGeometry args={size} />
      <meshStandardMaterial
        color={tint}
        transparent
        opacity={0.22}
        roughness={0.35}
        metalness={0.4}
        emissive={hot ? '#f0b429' : tint}
        emissiveIntensity={hot ? 0.45 : 0.08}
      />
    </mesh>
  );
}

function CellArray({ origin, cols, rows, gap }: { origin: [number, number, number]; cols: number; rows: number; gap: number }) {
  const ref = useRef<THREE.InstancedMesh>(null);
  const count = cols * rows;
  useLayoutEffect(() => {
    const mesh = ref.current;
    if (!mesh) return;
    const dummy = new THREE.Object3D();
    let index = 0;
    for (let y = 0; y < rows; y += 1) {
      for (let x = 0; x < cols; x += 1) {
        dummy.position.set(origin[0] + x * gap, origin[1], origin[2] + y * gap);
        dummy.rotation.set(0, 0, 0);
        dummy.updateMatrix();
        mesh.setMatrixAt(index, dummy.matrix);
        index += 1;
      }
    }
    mesh.instanceMatrix.needsUpdate = true;
    mesh.frustumCulled = false;
  }, [cols, rows, gap, origin]);
  return (
    <instancedMesh ref={ref} args={[undefined, undefined, count]}>
      <boxGeometry args={[gap * 0.72, 0.02, gap * 0.72]} />
      <meshStandardMaterial color="#9fb4c8" metalness={0.7} roughness={0.3} />
    </instancedMesh>
  );
}

function BondPads() {
  const ref = useRef<THREE.InstancedMesh>(null);
  const count = 40 * 2 + 24 * 2;
  useLayoutEffect(() => {
    const mesh = ref.current;
    if (!mesh) return;
    const dummy = new THREE.Object3D();
    let index = 0;
    for (let i = 0; i < 40; i += 1) {
      dummy.position.set(-1.55 + i * 0.08, 0.07, 1.22);
      dummy.updateMatrix();
      mesh.setMatrixAt(index++, dummy.matrix);
      dummy.position.set(-1.55 + i * 0.08, 0.07, -1.22);
      dummy.updateMatrix();
      mesh.setMatrixAt(index++, dummy.matrix);
    }
    for (let i = 0; i < 24; i += 1) {
      dummy.position.set(-1.62, 0.07, -1.05 + i * 0.09);
      dummy.updateMatrix();
      mesh.setMatrixAt(index++, dummy.matrix);
      dummy.position.set(1.62, 0.07, -1.05 + i * 0.09);
      dummy.updateMatrix();
      mesh.setMatrixAt(index++, dummy.matrix);
    }
    mesh.instanceMatrix.needsUpdate = true;
  }, []);
  return (
    <instancedMesh ref={ref} args={[undefined, undefined, count]}>
      <boxGeometry args={[0.045, 0.015, 0.04]} />
      <meshStandardMaterial color="#e6c56a" metalness={0.92} roughness={0.18} />
    </instancedMesh>
  );
}

function WireBonds() {
  const geometry = useMemo(() => {
    const geoms: THREE.BufferGeometry[] = [];
    for (let i = 0; i < 18; i += 1) {
      const x = -1.35 + i * 0.15;
      const curve = new THREE.QuadraticBezierCurve3(
        new THREE.Vector3(x, 0.08, 1.18),
        new THREE.Vector3(x * 0.92, 0.28, 1.0),
        new THREE.Vector3(x * 0.8, 0.08, 0.78),
      );
      geoms.push(new THREE.TubeGeometry(curve, 6, 0.006, 4, false));
    }
    return geoms;
  }, []);
  return (
    <group>
      {geometry.map((geo, index) => (
        <mesh key={index} geometry={geo}>
          <meshStandardMaterial color="#d5dbe3" metalness={0.9} roughness={0.2} />
        </mesh>
      ))}
    </group>
  );
}

function Bumps() {
  const ref = useRef<THREE.InstancedMesh>(null);
  const count = 16 * 10;
  useLayoutEffect(() => {
    const mesh = ref.current;
    if (!mesh) return;
    const dummy = new THREE.Object3D();
    let index = 0;
    for (let y = 0; y < 10; y += 1) {
      for (let x = 0; x < 16; x += 1) {
        dummy.position.set(-0.7 + x * 0.09, 0.06, -0.85 + y * 0.07);
        dummy.updateMatrix();
        mesh.setMatrixAt(index++, dummy.matrix);
      }
    }
    mesh.instanceMatrix.needsUpdate = true;
  }, []);
  return (
    <instancedMesh ref={ref} args={[undefined, undefined, count]}>
      <sphereGeometry args={[0.012, 6, 6]} />
      <meshStandardMaterial color="#e6c56a" metalness={0.9} roughness={0.22} />
    </instancedMesh>
  );
}

function Bundle({ from, to, hot }: { from: [number, number, number]; to: [number, number, number]; hot: boolean }) {
  return (
    <group>
      {[ -0.04, 0, 0.04 ].map((offset) => (
        <mesh key={offset} position={[(from[0] + to[0]) / 2, from[1], (from[2] + to[2]) / 2 + offset]}>
          <boxGeometry args={[Math.abs(to[0] - from[0]), 0.012, 0.012]} />
          <meshStandardMaterial color="#d5dbe3" metalness={0.85} roughness={0.2} emissive={hot ? '#8eb6ff' : '#000'} emissiveIntensity={hot ? 0.8 : 0} />
        </mesh>
      ))}
    </group>
  );
}

function Flags({ z, n, c }: { z: boolean; n: boolean; c: boolean }) {
  const flags = [['Z', z], ['N', n], ['C', c]] as const;
  return (
    <group position={[-1.15, 0.16, -0.95]}>
      {flags.map(([name, on], index) => (
        <mesh key={name} position={[index * 0.22, 0.08, 0]}>
          <sphereGeometry args={[0.06, 12, 12]} />
          <meshStandardMaterial color={on ? '#d8fff1' : '#334'} emissive={on ? '#5ee0b5' : '#000'} emissiveIntensity={on ? 1.1 : 0} />
        </mesh>
      ))}
      <Sign text="Z N C" position={[0.22, 0.28, 0]} factor={11} />
    </group>
  );
}

function ParticleStream({ from, to }: { from: [number, number, number]; to: [number, number, number] }) {
  const ref = useRef<THREE.InstancedMesh>(null);
  const dummy = useMemo(() => new THREE.Object3D(), []);
  useFrame(({ clock }) => {
    const mesh = ref.current;
    if (!mesh) return;
    for (let i = 0; i < 8; i += 1) {
      const t = (clock.elapsedTime * 0.35 + i / 8) % 1;
      dummy.position.set(from[0] + (to[0] - from[0]) * t, from[1] + 0.08, from[2] + (to[2] - from[2]) * t);
      dummy.updateMatrix();
      mesh.setMatrixAt(i, dummy.matrix);
    }
    mesh.instanceMatrix.needsUpdate = true;
  });
  return (
    <instancedMesh ref={ref} args={[undefined, undefined, 8]} frustumCulled={false}>
      <sphereGeometry args={[0.025, 8, 8]} />
      <meshStandardMaterial color="#d7ecff" emissive="#8eb6ff" emissiveIntensity={2} toneMapped={false} />
    </instancedMesh>
  );
}

function dieRoute(step: StepInfo | null): [[number, number, number], [number, number, number]] | null {
  if (!step?.activeBus) return null;
  const table: Record<string, [number, number, number]> = {
    PC: [1.22, 0.3, 0.85],
    IR: [1.22, 0.3, 0.45],
    ACC: [1.22, 0.3, 0.05],
    B: [1.22, 0.3, -0.35],
    MAR: [1.22, 0.3, -0.75],
    MDR: [1.22, 0.3, -1.05],
    地址: [1.22, 0.3, -0.75],
    内存: [0.1, 0.25, 1.12],
    OUT: [-1.2, 0.3, -0.15],
    目标: [1.22, 0.3, 0.85],
    操作数: [1.22, 0.3, -1.05],
  };
  const from = table[step.busFrom];
  const to = table[step.busTo];
  if (!from || !to) return null;
  return [from, to];
}
