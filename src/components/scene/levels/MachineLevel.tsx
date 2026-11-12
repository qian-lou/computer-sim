import { RoundedBox } from '@react-three/drei';
import { useLayoutEffect, useMemo, useRef } from 'react';
import * as THREE from 'three';
import type { CpuView, StepInfo } from '../../../cpu/cpu';
import { systemFlow } from '../logic';
import { Clickable, Packet, Sign } from '../parts';
import { makePcbTexture } from '../textures';

export function MachineLevel({
  view,
  step,
  animMs,
  onOpenCpu,
  onOpenEditor,
}: {
  view: CpuView;
  step: StepInfo | null;
  animMs: number;
  onOpenCpu: () => void;
  onOpenEditor: () => void;
}) {
  const flow = systemFlow(step);
  const memoryHot = flow === 'ram-to-cpu' || flow === 'cpu-to-ram';
  const screenHot = flow === 'cpu-to-screen';
  const latest = view.output[view.output.length - 1];
  const pcb = useMemo(() => makePcbTexture(), []);
  return (
    <group>
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0.5, -0.03, 0.15]} receiveShadow>
        <circleGeometry args={[8.5, 48]} />
        <meshStandardMaterial color="#2a313b" roughness={0.85} metalness={0.05} />
      </mesh>
      <Case />
      <mesh position={[0, 0.13, 0]} receiveShadow>
        <boxGeometry args={[3.85, 0.045, 3.1]} />
        <meshStandardMaterial map={pcb} color="#ffffff" roughness={0.55} metalness={0.18} />
      </mesh>
      <Passives />
      <Vrm />
      <Clickable onClick={onOpenCpu}>
        <CpuAssembly hot={Boolean(step)} />
        <Sign text="CPU · 点击进入" position={[-1.05, 1.15, -0.35]} factor={22} />
      </Clickable>
      <Dimm />
      <Sign text="内存" position={[0.15, 0.85, -1.25]} factor={24} />
      <Ssd />
      <Sign text="硬盘" position={[-1.35, 0.42, 0.95]} factor={26} />
      <Gpu />
      <Sign text="显卡" position={[1.15, 0.78, 0.55]} factor={24} />
      <Psu />
      <Sign text="电源" position={[1.55, 0.95, -1.15]} factor={26} />
      <Chipset />
      <Cable />
      <Monitor value={latest} hot={screenHot} />
      <Clickable onClick={onOpenEditor}>
        <Keyboard />
        <Sign text="键盘 · 打开程序" position={[3.15, 0.55, 1.25]} factor={28} />
      </Clickable>
      {flow === 'ram-to-cpu' && (
        <Packet from={[0.05, 0.55, -1.05]} to={[-1.05, 0.7, -0.35]} color="#8eb6ff" token={view.cycles} animMs={animMs} />
      )}
      {flow === 'cpu-to-ram' && (
        <Packet from={[-1.05, 0.7, -0.35]} to={[0.05, 0.55, -1.05]} color="#f0b429" token={view.cycles} animMs={animMs} />
      )}
      {flow === 'cpu-to-screen' && (
        <Packet from={[-0.3, 0.8, 0.1]} to={[3.55, 1.15, -0.15]} color="#5ee0b5" token={view.cycles} animMs={animMs} />
      )}
      {memoryHot && <BusGlow from={[-1.05, -0.35]} to={[0.05, -1.05]} color="#8eb6ff" />}
    </group>
  );
}

function metal(color: string, roughness = 0.35, metalness = 0.72) {
  return { color, roughness, metalness };
}

function Case() {
  return (
    <group>
      <RoundedBox args={[4.6, 0.1, 3.8]} radius={0.04} smoothness={3} position={[0, 0.04, 0]}>
        <meshStandardMaterial {...metal('#2e353e', 0.4)} />
      </RoundedBox>
      <RoundedBox args={[4.6, 1.25, 0.08]} radius={0.02} smoothness={2} position={[0, 0.7, -1.86]}>
        <meshStandardMaterial {...metal('#343b44')} />
      </RoundedBox>
      <RoundedBox args={[0.08, 1.25, 3.8]} radius={0.02} smoothness={2} position={[-2.26, 0.7, 0]}>
        <meshStandardMaterial {...metal('#343b44')} />
      </RoundedBox>
      <RoundedBox args={[4.6, 0.18, 0.08]} radius={0.02} smoothness={2} position={[0, 0.16, 1.86]}>
        <meshStandardMaterial {...metal('#343b44')} />
      </RoundedBox>
      <mesh position={[2.26, 0.72, 0]} raycast={() => null}>
        <boxGeometry args={[0.025, 1.12, 3.35]} />
        <meshStandardMaterial color="#d5e6ff" transparent opacity={0.14} roughness={0.04} metalness={0.2} depthWrite={false} />
      </mesh>
    </group>
  );
}

function unit(index: number, salt: number) {
  const x = Math.sin(index * 12.9898 + salt * 78.233) * 43758.5453;
  return x - Math.floor(x);
}

function Instanced({
  count,
  seed,
  span,
  args,
  color,
  roughness = 0.45,
  metalness = 0.35,
}: {
  count: number;
  seed: number;
  span: [number, number, number, number];
  args: [number, number, number];
  color: string;
  roughness?: number;
  metalness?: number;
}) {
  const ref = useRef<THREE.InstancedMesh>(null);
  useLayoutEffect(() => {
    const mesh = ref.current;
    if (!mesh) return;
    const dummy = new THREE.Object3D();
    for (let index = 0; index < count; index += 1) {
      dummy.position.set(
        span[0] + unit(index, seed) * span[1],
        0.175,
        span[2] + unit(index, seed + 3) * span[3],
      );
      dummy.rotation.set(0, unit(index, seed + 1) * Math.PI, 0);
      dummy.scale.set(1, 1, 1);
      dummy.updateMatrix();
      mesh.setMatrixAt(index, dummy.matrix);
    }
    mesh.instanceMatrix.needsUpdate = true;
    mesh.frustumCulled = false;
  }, [count, seed, span]);
  return (
    <instancedMesh ref={ref} args={[undefined, undefined, count]}>
      <boxGeometry args={args} />
      <meshStandardMaterial color={color} roughness={roughness} metalness={metalness} />
    </instancedMesh>
  );
}

function Passives() {
  return (
    <group>
      <Instanced count={64} seed={3} span={[-1.6, 3.2, -1.25, 2.5]} args={[0.07, 0.02, 0.03]} color="#1a1c1f" roughness={0.55} metalness={0.2} />
      <Instanced count={28} seed={9} span={[-1.5, 2.8, -1.2, 2.3]} args={[0.045, 0.025, 0.045]} color="#d8c7a2" roughness={0.4} metalness={0.1} />
    </group>
  );
}

function Vrm() {
  return (
    <group position={[-1.7, 0.2, 0.9]}>
      {[-0.18, 0, 0.18].map((x) => (
        <mesh key={x} position={[x, 0.08, 0]} castShadow>
          <boxGeometry args={[0.12, 0.14, 0.12]} />
          <meshStandardMaterial color="#3a4148" metalness={0.55} roughness={0.35} />
        </mesh>
      ))}
      {[-0.28, 0.1].map((z) => (
        <mesh key={z} position={[0.32, 0.1, z]} castShadow>
          <cylinderGeometry args={[0.06, 0.06, 0.16, 12]} />
          <meshStandardMaterial color="#1c1c1c" roughness={0.4} />
        </mesh>
      ))}
      <mesh position={[0.32, 0.19, -0.09]}>
        <cylinderGeometry args={[0.035, 0.035, 0.01, 10]} />
        <meshStandardMaterial color="#c9cdd2" metalness={0.8} roughness={0.25} />
      </mesh>
    </group>
  );
}

function CpuAssembly({ hot }: { hot: boolean }) {
  return (
    <group position={[-1.05, 0.2, -0.35]}>
      <mesh>
        <boxGeometry args={[1.05, 0.06, 1.05]} />
        <meshStandardMaterial color="#1a1e24" roughness={0.5} metalness={0.3} />
      </mesh>
      <SocketPins />
      <mesh position={[0, 0.08, 0]}>
        <boxGeometry args={[0.62, 0.06, 0.62]} />
        <meshStandardMaterial color="#c5ccd4" metalness={0.82} roughness={0.22} />
      </mesh>
      {Array.from({ length: 8 }, (_, index) => (
        <mesh key={index} position={[0, 0.18 + index * 0.045, 0]}>
          <boxGeometry args={[0.82, 0.016, 0.7]} />
          <meshStandardMaterial color="#e7edf3" metalness={0.92} roughness={0.16} />
        </mesh>
      ))}
      <mesh position={[0.22, 0.28, 0]} rotation={[0, 0, Math.PI / 2]}>
        <torusGeometry args={[0.22, 0.028, 8, 18, Math.PI]} />
        <meshStandardMaterial color="#b7c0c8" metalness={0.9} roughness={0.2} emissive={hot ? '#335' : '#000'} emissiveIntensity={0.2} />
      </mesh>
      <mesh position={[-0.22, 0.28, 0]} rotation={[0, 0, Math.PI / 2]}>
        <torusGeometry args={[0.22, 0.028, 8, 18, Math.PI]} />
        <meshStandardMaterial color="#b7c0c8" metalness={0.9} roughness={0.2} />
      </mesh>
    </group>
  );
}

function SocketPins() {
  const ref = useRef<THREE.InstancedMesh>(null);
  useLayoutEffect(() => {
    const mesh = ref.current;
    if (!mesh) return;
    const dummy = new THREE.Object3D();
    let index = 0;
    for (let side = 0; side < 4; side += 1) {
      for (let i = 0; i < 12; i += 1) {
        const t = -0.42 + i * 0.076;
        const x = side % 2 === 0 ? t : side === 1 ? 0.48 : -0.48;
        const z = side % 2 === 1 ? t : side === 0 ? 0.48 : -0.48;
        dummy.position.set(x, 0.05, z);
        dummy.rotation.set(0, 0, 0);
        dummy.scale.set(1, 1, 1);
        dummy.updateMatrix();
        mesh.setMatrixAt(index, dummy.matrix);
        index += 1;
      }
    }
    mesh.instanceMatrix.needsUpdate = true;
  }, []);
  return (
    <instancedMesh ref={ref} args={[undefined, undefined, 48]}>
      <boxGeometry args={[0.03, 0.05, 0.03]} />
      <meshStandardMaterial color="#d7b15a" metalness={0.9} roughness={0.25} />
    </instancedMesh>
  );
}

function Dimm() {
  return (
    <group position={[0.05, 0.28, -1.05]}>
      <RoundedBox args={[0.16, 0.12, 1.35]} radius={0.01} smoothness={2} position={[0, -0.02, 0]}>
        <meshStandardMaterial color="#111418" roughness={0.45} />
      </RoundedBox>
      {[0, 0.18].map((x) => (
        <group key={x} position={[x, 0.22, 0]}>
          <RoundedBox args={[0.06, 0.48, 1.2]} radius={0.01} smoothness={2}>
            <meshStandardMaterial color="#16191e" roughness={0.4} metalness={0.25} />
          </RoundedBox>
          <mesh position={[0.034, -0.12, 0]}>
            <boxGeometry args={[0.012, 0.16, 1.05]} />
            <meshStandardMaterial color="#e0c36a" metalness={0.85} roughness={0.22} />
          </mesh>
          <RamChips />
        </group>
      ))}
    </group>
  );
}

function RamChips() {
  const ref = useRef<THREE.InstancedMesh>(null);
  useLayoutEffect(() => {
    const mesh = ref.current;
    if (!mesh) return;
    const dummy = new THREE.Object3D();
    for (let i = 0; i < 8; i += 1) {
      dummy.position.set(0.02, 0.05, -0.48 + i * 0.14);
      dummy.rotation.set(0, 0, 0);
      dummy.updateMatrix();
      mesh.setMatrixAt(i, dummy.matrix);
    }
    mesh.instanceMatrix.needsUpdate = true;
  }, []);
  return (
    <instancedMesh ref={ref} args={[undefined, undefined, 8]}>
      <boxGeometry args={[0.02, 0.08, 0.1]} />
      <meshStandardMaterial color="#0c0d10" roughness={0.35} metalness={0.4} />
    </instancedMesh>
  );
}

function Ssd() {
  return (
    <group position={[-1.35, 0.18, 0.85]}>
      <RoundedBox args={[0.78, 0.05, 0.32]} radius={0.02} smoothness={2}>
        <meshStandardMaterial color="#e4e8ee" metalness={0.7} roughness={0.25} />
      </RoundedBox>
      <mesh position={[0.22, 0.035, 0]}>
        <boxGeometry args={[0.18, 0.02, 0.18]} />
        <meshStandardMaterial color="#1a1c20" />
      </mesh>
    </group>
  );
}

function Gpu() {
  return (
    <group position={[1.05, 0.32, 0.5]}>
      <RoundedBox args={[1.25, 0.22, 0.48]} radius={0.03} smoothness={2} castShadow>
        <meshStandardMaterial color="#12161c" metalness={0.45} roughness={0.38} />
      </RoundedBox>
      <mesh position={[0.28, 0.14, 0]} rotation={[Math.PI / 2, 0, 0]}>
        <cylinderGeometry args={[0.13, 0.13, 0.03, 20]} />
        <meshStandardMaterial color="#2c333b" metalness={0.6} roughness={0.3} />
      </mesh>
      <mesh position={[-0.35, 0.13, 0]}>
        <boxGeometry args={[0.28, 0.04, 0.28]} />
        <meshStandardMaterial color="#0e1014" />
      </mesh>
    </group>
  );
}

function Psu() {
  return (
    <group position={[1.55, 0.4, -1.05]}>
      <RoundedBox args={[0.72, 0.58, 0.9]} radius={0.03} smoothness={2} castShadow>
        <meshStandardMaterial color="#3c444e" metalness={0.55} roughness={0.38} />
      </RoundedBox>
      <mesh position={[0, 0, 0.46]} rotation={[Math.PI / 2, 0, 0]}>
        <torusGeometry args={[0.18, 0.018, 8, 20]} />
        <meshStandardMaterial color="#111" metalness={0.4} roughness={0.4} />
      </mesh>
    </group>
  );
}

function Chipset() {
  return (
    <group position={[0.28, 0.18, 0.15]}>
      <mesh>
        <boxGeometry args={[0.32, 0.07, 0.32]} />
        <meshStandardMaterial color="#1a1e24" metalness={0.35} roughness={0.4} />
      </mesh>
      <mesh position={[0, 0.05, 0]}>
        <boxGeometry args={[0.22, 0.03, 0.22]} />
        <meshStandardMaterial color="#2a3138" metalness={0.5} roughness={0.35} />
      </mesh>
    </group>
  );
}

function Cable() {
  const geometry = useMemo(() => {
    const curve = new THREE.CatmullRomCurve3([
      new THREE.Vector3(1.2, 0.35, -1.05),
      new THREE.Vector3(0.7, 0.22, -0.4),
      new THREE.Vector3(0.15, 0.2, 0.15),
    ]);
    return new THREE.TubeGeometry(curve, 12, 0.025, 6, false);
  }, []);
  return (
    <mesh geometry={geometry}>
      <meshStandardMaterial color="#1a1a1a" roughness={0.6} />
    </mesh>
  );
}

function BusGlow({ from, to, color }: { from: [number, number]; to: [number, number]; color: string }) {
  const dx = to[0] - from[0];
  const dz = to[1] - from[1];
  const length = Math.hypot(dx, dz);
  return (
    <mesh position={[(from[0] + to[0]) / 2, 0.17, (from[1] + to[1]) / 2]} rotation={[0, -Math.atan2(dz, dx), 0]}>
      <boxGeometry args={[length, 0.015, 0.05]} />
      <meshStandardMaterial color={color} emissive={color} emissiveIntensity={1.1} toneMapped={false} />
    </mesh>
  );
}

function Monitor({ value, hot }: { value: number | undefined; hot: boolean }) {
  return (
    <group position={[3.55, 0.9, -0.2]}>
      <mesh position={[0, -0.78, 0.05]} receiveShadow>
        <cylinderGeometry args={[0.28, 0.32, 0.06, 24]} />
        <meshStandardMaterial {...metal('#2c333b', 0.4, 0.5)} />
      </mesh>
      <mesh position={[0, -0.42, 0]}>
        <cylinderGeometry args={[0.045, 0.06, 0.62, 12]} />
        <meshStandardMaterial {...metal('#3a424c', 0.35, 0.55)} />
      </mesh>
      <RoundedBox args={[1.85, 1.15, 0.08]} radius={0.04} smoothness={4} castShadow>
        <meshStandardMaterial color="#1a1f26" metalness={0.45} roughness={0.32} />
      </RoundedBox>
      <mesh position={[0, 0, 0.045]}>
        <planeGeometry args={[1.62, 0.92]} />
        <meshStandardMaterial color="#071018" emissive={hot ? '#7dfff0' : '#16324a'} emissiveIntensity={hot ? 0.85 : 0.35} />
      </mesh>
      <Sign text={value === undefined ? '—' : String(value)} position={[0, 0.02, 0.07]} factor={4.4} />
    </group>
  );
}

function Keyboard() {
  const ref = useRef<THREE.InstancedMesh>(null);
  useLayoutEffect(() => {
    const mesh = ref.current;
    if (!mesh) return;
    const dummy = new THREE.Object3D();
    let index = 0;
    for (let row = 0; row < 4; row += 1) {
      for (let col = 0; col < 13; col += 1) {
        dummy.position.set(-0.72 + col * 0.12, 0.055, -0.2 + row * 0.13);
        dummy.rotation.set(0, 0, 0);
        dummy.scale.set(1, 1, 1);
        dummy.updateMatrix();
        mesh.setMatrixAt(index, dummy.matrix);
        index += 1;
      }
    }
    mesh.instanceMatrix.needsUpdate = true;
  }, []);
  return (
    <group position={[3.15, 0.06, 1.28]}>
      <RoundedBox args={[1.9, 0.07, 0.7]} radius={0.03} smoothness={3} receiveShadow>
        <meshStandardMaterial color="#2a3038" roughness={0.48} metalness={0.28} />
      </RoundedBox>
      <instancedMesh ref={ref} args={[undefined, undefined, 52]}>
        <boxGeometry args={[0.09, 0.045, 0.09]} />
        <meshStandardMaterial color="#3e4650" roughness={0.4} metalness={0.2} />
      </instancedMesh>
    </group>
  );
}
