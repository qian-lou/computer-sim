import { RoundedBox } from '@react-three/drei';
import { useFrame } from '@react-three/fiber';
import { useEffect, useLayoutEffect, useMemo, useRef } from 'react';
import * as THREE from 'three';
import type { CpuView, StepInfo } from '../../../cpu/cpu';
import { hexByte } from '../../../cpu/format';
import { systemFlow } from '../logic';
import { Clickable, Packet, Sign } from '../parts';
import {
  drawScreen,
  makeBackdropTexture,
  makePcbMaps,
  makeScreenTexture,
  makeVentTexture,
  makeWoodTexture,
} from '../textures';

export function MachineLevel({
  view,
  step,
  animMs,
  dense,
  onOpenCpu,
  onOpenEditor,
}: {
  view: CpuView;
  step: StepInfo | null;
  animMs: number;
  dense: boolean;
  onOpenCpu: () => void;
  onOpenEditor: () => void;
}) {
  const flow = systemFlow(step);
  const memoryHot = flow === 'ram-to-cpu' || flow === 'cpu-to-ram';
  const screenHot = flow === 'cpu-to-screen';
  return (
    <group>
      <Studio />
      <Tower />
      <Board dense={dense} onOpenCpu={onOpenCpu} memoryHot={memoryHot} />
      <Cables />
      <Monitor view={view} hot={screenHot} />
      <Clickable onClick={onOpenEditor}>
        <Keyboard />
        <Sign text="键盘 · 打开程序" position={[1.15, 0.2, 1.35]} factor={4} />
      </Clickable>
      {flow === 'ram-to-cpu' && (
        <Packet from={[0.15, 1.7, -0.78]} to={[-0.85, 1.55, -0.72]} color="#8eb6ff" token={view.cycles} animMs={animMs} />
      )}
      {flow === 'cpu-to-ram' && (
        <Packet from={[-0.85, 1.55, -0.72]} to={[0.15, 1.7, -0.78]} color="#f0b429" token={view.cycles} animMs={animMs} />
      )}
      {flow === 'cpu-to-screen' && (
        <Packet from={[-0.4, 1.7, -0.5]} to={[2.15, 1.35, 0.15]} color="#5ee0b5" token={view.cycles} animMs={animMs} />
      )}
    </group>
  );
}

function Studio() {
  const wood = useMemo(() => makeWoodTexture(), []);
  const backdrop = useMemo(() => makeBackdropTexture(), []);
  return (
    <group>
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0.4, 0, 0.35]} receiveShadow>
        <planeGeometry args={[16, 11]} />
        <meshStandardMaterial map={wood} roughness={0.78} metalness={0.04} />
      </mesh>
      <mesh position={[0.2, 2.6, -2.6]}>
        <planeGeometry args={[18, 7]} />
        <meshStandardMaterial map={backdrop} roughness={0.95} metalness={0} />
      </mesh>
    </group>
  );
}

function steel(color = '#3a414a') {
  return { color, metalness: 0.82, roughness: 0.32 };
}

function Tower() {
  const vent = useMemo(() => makeVentTexture(), []);
  return (
    <group>
      <RoundedBox args={[2.55, 0.06, 1.35]} radius={0.01} position={[-0.5, 0.05, -0.42]}>
        <meshStandardMaterial {...steel('#2c323a')} />
      </RoundedBox>
      <RoundedBox args={[2.55, 0.05, 1.35]} radius={0.01} position={[-0.5, 2.58, -0.42]}>
        <meshStandardMaterial {...steel()} />
      </RoundedBox>
      <RoundedBox args={[0.05, 2.5, 1.35]} radius={0.008} position={[-1.75, 1.32, -0.42]}>
        <meshStandardMaterial {...steel()} />
      </RoundedBox>
      <mesh position={[-1.775, 1.45, -0.42]} rotation={[0, Math.PI / 2, 0]}>
        <planeGeometry args={[1.05, 1.55]} />
        <meshStandardMaterial color="#8b939c" alphaMap={vent} transparent alphaTest={0.35} metalness={0.7} roughness={0.35} side={THREE.DoubleSide} />
      </mesh>
      <RoundedBox args={[0.05, 2.5, 1.28]} radius={0.008} position={[0.75, 1.32, -0.42]}>
        <meshStandardMaterial {...steel()} />
      </RoundedBox>
      <RoundedBox args={[2.45, 2.5, 0.045]} radius={0.01} position={[-0.5, 1.32, -1.08]}>
        <meshStandardMaterial {...steel('#343b44')} />
      </RoundedBox>
      <mesh position={[-0.5, 1.32, 0.22]}>
        <boxGeometry args={[2.4, 2.46, 0.02]} />
        <meshStandardMaterial color="#9eb0c4" transparent opacity={0.05} roughness={0.05} metalness={0.1} depthWrite={false} />
      </mesh>
      {[-1.7, 0.7].map((x) =>
        [0.12, 2.5].map((y) => (
          <mesh key={`${x}-${y}`} position={[x, y, 0.18]}>
            <boxGeometry args={[0.08, 0.03, 0.04]} />
            <meshStandardMaterial {...steel('#8d949c')} />
          </mesh>
        )),
      )}
      <Fan position={[-1.72, 1.55, -0.42]} rotation={[0, -Math.PI / 2, 0]} />
      <Fan position={[0.78, 1.7, -0.42]} rotation={[0, Math.PI / 2, 0]} />
      <IoShield />
      <group position={[-0.15, 0.42, -0.5]}>
        <RoundedBox args={[1.35, 0.62, 0.85]} radius={0.02} smoothness={2}>
          <meshStandardMaterial color="#2a3038" metalness={0.7} roughness={0.38} />
        </RoundedBox>
        <mesh position={[0.55, 0, 0.28]} rotation={[Math.PI / 2, 0, 0]}>
          <torusGeometry args={[0.16, 0.012, 8, 20]} />
          <meshStandardMaterial color="#111" metalness={0.5} roughness={0.4} />
        </mesh>
      </group>
    </group>
  );
}

function Fan({ position, rotation }: { position: [number, number, number]; rotation: [number, number, number] }) {
  const blades = useRef<THREE.Group>(null);
  useFrame((_, delta) => {
    if (blades.current) blades.current.rotation.z += delta * 3.2;
  });
  return (
    <group position={position} rotation={rotation}>
      <mesh>
        <torusGeometry args={[0.28, 0.035, 10, 28]} />
        <meshStandardMaterial color="#14181e" metalness={0.45} roughness={0.4} />
      </mesh>
      <group ref={blades}>
        {Array.from({ length: 7 }, (_, index) => (
          <mesh key={index} rotation={[0, 0, (index / 7) * Math.PI * 2]} position={[0.1, 0, 0]}>
            <boxGeometry args={[0.2, 0.07, 0.015]} />
            <meshStandardMaterial color="#2c333c" metalness={0.55} roughness={0.35} />
          </mesh>
        ))}
        <mesh>
          <cylinderGeometry args={[0.05, 0.05, 0.04, 16]} />
          <meshStandardMaterial color="#11161c" metalness={0.6} roughness={0.3} />
        </mesh>
      </group>
      <mesh position={[0, 0, 0.03]}>
        <torusGeometry args={[0.3, 0.006, 6, 32]} />
        <meshStandardMaterial color="#c5ccd4" metalness={0.8} roughness={0.25} />
      </mesh>
      {[0, 1, 2, 3].map((index) => (
        <mesh key={index} rotation={[0, 0, (index * Math.PI) / 4]} position={[0, 0, 0.04]}>
          <boxGeometry args={[0.58, 0.008, 0.008]} />
          <meshStandardMaterial color="#d5dbe3" metalness={0.75} roughness={0.25} />
        </mesh>
      ))}
    </group>
  );
}

function IoShield() {
  return (
    <group position={[0.78, 1.15, -0.55]}>
      <mesh>
        <boxGeometry args={[0.02, 0.55, 0.7]} />
        <meshStandardMaterial color="#c5ccd4" metalness={0.85} roughness={0.22} />
      </mesh>
      {[-0.18, -0.06, 0.06, 0.18].map((z) => (
        <mesh key={z} position={[0.012, 0.08, z]}>
          <boxGeometry args={[0.012, 0.06, 0.09]} />
          <meshStandardMaterial color="#1a1e24" />
        </mesh>
      ))}
    </group>
  );
}

function Board({ dense, onOpenCpu, memoryHot }: { dense: boolean; onOpenCpu: () => void; memoryHot: boolean }) {
  const maps = useMemo(() => makePcbMaps(), []);
  return (
    <group position={[-0.5, 1.28, -0.9]}>
      <mesh castShadow receiveShadow>
        <boxGeometry args={[2.05, 2.15, 0.035]} />
        <meshStandardMaterial {...maps} color="#ffffff" metalness={0.35} roughness={0.55} />
      </mesh>
      <Passives count={dense ? 340 : 90} />
      <Clickable onClick={onOpenCpu}>
        <CpuSocket />
        <Sign text="CPU · 点击进入" position={[-0.42, 0.72, 0.28]} factor={7} />
      </Clickable>
      <Dimm />
      <Sign text="内存" position={[0.55, 0.78, 0.2]} factor={8} />
      <Qfp position={[0.55, -0.15, 0.05]} />
      <Vrm />
      <Gpu />
      <Sign text="显卡" position={[0.15, -0.72, 0.16]} factor={8} />
      <Ssd />
      <Sign text="硬盘" position={[-0.72, -0.55, 0.08]} factor={8} />
      {memoryHot && (
        <mesh position={[0.05, 0.45, 0.04]}>
          <boxGeometry args={[0.9, 0.02, 0.012]} />
          <meshStandardMaterial color="#8eb6ff" emissive="#8eb6ff" emissiveIntensity={1.4} toneMapped={false} />
        </mesh>
      )}
    </group>
  );
}

function Passives({ count }: { count: number }) {
  const ref = useRef<THREE.InstancedMesh>(null);
  useLayoutEffect(() => {
    const mesh = ref.current;
    if (!mesh) return;
    const dummy = new THREE.Object3D();
    let index = 0;
    let salt = 5;
    const unit = (n: number) => {
      const x = Math.sin(n * 12.9898 + salt * 78.233) * 43758.5453;
      return x - Math.floor(x);
    };
    while (index < count) {
      salt += 1;
      const x = -0.95 + unit(salt) * 1.9;
      const y = -1.0 + unit(salt + 2) * 2.0;
      const inSocket = x > -0.78 && x < -0.05 && y > -0.05 && y < 0.7;
      const inDimm = x > 0.28 && x < 0.85 && y > 0.15 && y < 0.95;
      if (inSocket || inDimm) continue;
      const small = unit(salt + 4) > 0.35;
      dummy.position.set(x, y, 0.03);
      dummy.rotation.set(0, 0, unit(salt + 1) > 0.5 ? 0 : Math.PI / 2);
      dummy.scale.set(small ? 1 : 1.6, 1, small ? 1 : 1.35);
      dummy.updateMatrix();
      mesh.setMatrixAt(index, dummy.matrix);
      index += 1;
    }
    mesh.instanceMatrix.needsUpdate = true;
    mesh.frustumCulled = false;
  }, [count]);
  return (
    <instancedMesh ref={ref} args={[undefined, undefined, count]}>
      <boxGeometry args={[0.028, 0.012, 0.01]} />
      <meshStandardMaterial color="#1a1c1f" roughness={0.45} metalness={0.25} />
    </instancedMesh>
  );
}

function CpuSocket() {
  return (
    <group position={[-0.42, 0.32, 0.04]}>
      <mesh>
        <boxGeometry args={[0.78, 0.78, 0.04]} />
        <meshStandardMaterial color="#16191e" roughness={0.45} metalness={0.35} />
      </mesh>
      <LgaContacts />
      <mesh position={[0, 0, 0.05]}>
        <boxGeometry args={[0.46, 0.46, 0.03]} />
        <meshStandardMaterial color="#d5dbe3" metalness={0.88} roughness={0.18} />
      </mesh>
      {Array.from({ length: 10 }, (_, index) => (
        <mesh key={index} position={[0, -0.22 + index * 0.05, 0.22]}>
          <boxGeometry args={[0.72, 0.012, 0.42]} />
          <meshStandardMaterial color="#f4f7fa" metalness={0.94} roughness={0.14} />
        </mesh>
      ))}
      <mesh position={[0.16, 0, 0.2]} rotation={[Math.PI / 2, 0, 0]}>
        <torusGeometry args={[0.16, 0.018, 8, 16, Math.PI]} />
        <meshStandardMaterial color="#c47a3a" metalness={0.85} roughness={0.25} />
      </mesh>
      <mesh position={[-0.16, 0, 0.2]} rotation={[Math.PI / 2, 0, 0]}>
        <torusGeometry args={[0.16, 0.018, 8, 16, Math.PI]} />
        <meshStandardMaterial color="#c47a3a" metalness={0.85} roughness={0.25} />
      </mesh>
    </group>
  );
}

function LgaContacts() {
  const ref = useRef<THREE.InstancedMesh>(null);
  const count = 24 * 24;
  useLayoutEffect(() => {
    const mesh = ref.current;
    if (!mesh) return;
    const dummy = new THREE.Object3D();
    let index = 0;
    for (let y = 0; y < 24; y += 1) {
      for (let x = 0; x < 24; x += 1) {
        dummy.position.set(-0.3 + x * 0.026, -0.3 + y * 0.026, 0.028);
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
    <instancedMesh ref={ref} args={[undefined, undefined, count]}>
      <boxGeometry args={[0.012, 0.012, 0.008]} />
      <meshStandardMaterial color="#e6c56a" metalness={0.95} roughness={0.18} />
    </instancedMesh>
  );
}

function Dimm() {
  return (
    <group position={[0.48, 0.48, 0.05]}>
      <Stick x={0} />
      <Stick x={0.2} />
    </group>
  );
}

function Stick({ x }: { x: number }) {
  return (
    <group position={[x, 0, 0]}>
      <mesh>
        <boxGeometry args={[0.16, 0.85, 0.05]} />
        <meshStandardMaterial color="#111418" roughness={0.4} metalness={0.2} />
      </mesh>
      <mesh position={[0, -0.32, 0.03]}>
        <boxGeometry args={[0.12, 0.16, 0.012]} />
        <meshStandardMaterial color="#e6c56a" metalness={0.9} roughness={0.2} />
      </mesh>
      <DramChips />
      <mesh position={[0.02, 0.18, 0.045]}>
        <planeGeometry args={[0.09, 0.18]} />
        <meshStandardMaterial color="#f7f4ee" roughness={0.55} />
      </mesh>
    </group>
  );
}

function DramChips() {
  const ref = useRef<THREE.InstancedMesh>(null);
  useLayoutEffect(() => {
    const mesh = ref.current;
    if (!mesh) return;
    const dummy = new THREE.Object3D();
    for (let i = 0; i < 8; i += 1) {
      dummy.position.set(0, -0.12 + i * 0.08, 0.03);
      dummy.updateMatrix();
      mesh.setMatrixAt(i, dummy.matrix);
    }
    mesh.instanceMatrix.needsUpdate = true;
  }, []);
  return (
    <instancedMesh ref={ref} args={[undefined, undefined, 8]}>
      <boxGeometry args={[0.1, 0.055, 0.012]} />
      <meshStandardMaterial color="#0c0e12" metalness={0.45} roughness={0.32} />
    </instancedMesh>
  );
}

function Qfp({ position }: { position: [number, number, number] }) {
  const ref = useRef<THREE.InstancedMesh>(null);
  useLayoutEffect(() => {
    const mesh = ref.current;
    if (!mesh) return;
    const dummy = new THREE.Object3D();
    let index = 0;
    for (let side = 0; side < 4; side += 1) {
      for (let i = 0; i < 12; i += 1) {
        const t = -0.16 + i * 0.029;
        const x = side % 2 === 0 ? t : side === 1 ? 0.2 : -0.2;
        const y = side % 2 === 1 ? t : side === 0 ? 0.2 : -0.2;
        dummy.position.set(x, y, 0.02);
        dummy.rotation.set(0, 0, side % 2 === 0 ? Math.PI / 2 : 0);
        dummy.scale.set(1, 1, 1);
        dummy.updateMatrix();
        mesh.setMatrixAt(index, dummy.matrix);
        index += 1;
      }
    }
    mesh.instanceMatrix.needsUpdate = true;
  }, []);
  return (
    <group position={position}>
      <RoundedBox args={[0.32, 0.32, 0.04]} radius={0.01} smoothness={2}>
        <meshStandardMaterial color="#1c1f24" roughness={0.4} metalness={0.3} />
      </RoundedBox>
      <mesh position={[-0.08, 0.08, 0.025]}>
        <circleGeometry args={[0.02, 12]} />
        <meshStandardMaterial color="#d7dbe0" metalness={0.6} roughness={0.3} />
      </mesh>
      <instancedMesh ref={ref} args={[undefined, undefined, 48]}>
        <boxGeometry args={[0.02, 0.012, 0.012]} />
        <meshStandardMaterial color="#c5ccd4" metalness={0.9} roughness={0.2} />
      </instancedMesh>
    </group>
  );
}

function Vrm() {
  return (
    <group position={[-0.82, -0.72, 0.06]}>
      {[0, 0.16, 0.32].map((x) => (
        <mesh key={x} position={[x, 0, 0]} castShadow>
          <boxGeometry args={[0.1, 0.1, 0.08]} />
          <meshStandardMaterial color="#2a3036" metalness={0.55} roughness={0.35} />
        </mesh>
      ))}
      {[0.1, -0.12].map((y) => (
        <group key={y} position={[0.5, y, 0]}>
          <mesh>
            <cylinderGeometry args={[0.045, 0.045, 0.09, 14]} />
            <meshStandardMaterial color="#1a1a1a" roughness={0.35} />
          </mesh>
          <mesh position={[0, 0, 0.05]} rotation={[Math.PI / 2, 0, 0.4]}>
            <boxGeometry args={[0.06, 0.008, 0.008]} />
            <meshStandardMaterial color="#d0d4d8" metalness={0.7} roughness={0.25} />
          </mesh>
        </group>
      ))}
    </group>
  );
}

function Gpu() {
  return (
    <group position={[0.1, -0.62, 0.06]}>
      <RoundedBox args={[1.15, 0.28, 0.08]} radius={0.02} smoothness={2}>
        <meshStandardMaterial color="#12161c" metalness={0.5} roughness={0.35} />
      </RoundedBox>
      <mesh position={[0.28, 0, 0.05]} rotation={[0, 0, 0]}>
        <cylinderGeometry args={[0.09, 0.09, 0.02, 20]} />
        <meshStandardMaterial color="#2c333b" metalness={0.65} roughness={0.3} />
      </mesh>
    </group>
  );
}

function Ssd() {
  return (
    <group position={[-0.72, -0.55, 0.04]}>
      <RoundedBox args={[0.42, 0.16, 0.025]} radius={0.01} smoothness={2}>
        <meshStandardMaterial color="#e4e8ee" metalness={0.65} roughness={0.25} />
      </RoundedBox>
      <mesh position={[0.1, 0, 0.016]}>
        <boxGeometry args={[0.1, 0.08, 0.008]} />
        <meshStandardMaterial color="#1a1c20" />
      </mesh>
    </group>
  );
}

function Cables() {
  const power = useMemo(() => {
    const curve = new THREE.CatmullRomCurve3([
      new THREE.Vector3(-0.2, 0.7, -0.55),
      new THREE.Vector3(-0.55, 0.85, -0.5),
      new THREE.Vector3(-0.9, 1.15, -0.72),
      new THREE.Vector3(-1.15, 1.55, -0.78),
    ]);
    return new THREE.TubeGeometry(curve, 20, 0.025, 6, false);
  }, []);
  const sata = useMemo(() => {
    const curve = new THREE.CatmullRomCurve3([
      new THREE.Vector3(0.15, 0.62, -0.45),
      new THREE.Vector3(-0.4, 0.7, -0.55),
      new THREE.Vector3(-1.05, 0.72, -0.78),
    ]);
    return new THREE.TubeGeometry(curve, 16, 0.012, 5, false);
  }, []);
  return (
    <group>
      {[0, 0.018, -0.018].map((offset) => (
        <mesh key={offset} geometry={power} position={[offset, 0, offset * 0.4]}>
          <meshStandardMaterial color={offset === 0 ? '#222' : '#b42318'} roughness={0.55} />
        </mesh>
      ))}
      <mesh geometry={sata}>
        <meshStandardMaterial color="#c43a2f" roughness={0.5} />
      </mesh>
    </group>
  );
}

function Monitor({ view, hot }: { view: CpuView; hot: boolean }) {
  const texture = useMemo(() => makeScreenTexture(), []);
  const lines = useMemo(() => {
    const shown = view.output.slice(-6);
    return [
      `OUT  ${shown.length ? shown.join('  ') : '—'}`,
      `PC ${hexByte(view.pc)}   IR ${hexByte(view.ir)}`,
      `ACC ${hexByte(view.acc)}  B ${hexByte(view.b)}`,
      view.mnemonic || '就绪',
      view.summary || '',
    ];
  }, [view.acc, view.b, view.ir, view.mnemonic, view.output, view.pc, view.summary]);
  useEffect(() => {
    drawScreen(texture, lines);
  }, [lines, texture]);
  return (
    <group position={[2.15, 0, 0.15]}>
      <mesh position={[0, 0.04, 0.15]} rotation={[-Math.PI / 2, 0, 0]}>
        <cylinderGeometry args={[0.28, 0.34, 0.04, 24]} />
        <meshStandardMaterial color="#1c2128" metalness={0.7} roughness={0.3} />
      </mesh>
      <mesh position={[0, 0.38, 0.05]}>
        <cylinderGeometry args={[0.04, 0.05, 0.55, 12]} />
        <meshStandardMaterial color="#2a3038" metalness={0.65} roughness={0.32} />
      </mesh>
      <RoundedBox args={[1.72, 1.08, 0.08]} radius={0.03} smoothness={3} position={[0, 1.05, 0]}>
        <meshStandardMaterial color="#14181e" metalness={0.55} roughness={0.32} />
      </RoundedBox>
      <RoundedBox args={[1.78, 1.14, 0.045]} radius={0.02} smoothness={2} position={[0, 1.05, 0.04]}>
        <meshStandardMaterial color="#0c0e12" metalness={0.4} roughness={0.35} />
      </RoundedBox>
      <mesh position={[0, 1.05, 0.065]}>
        <planeGeometry args={[1.62, 0.98]} />
        <meshStandardMaterial
          map={texture}
          emissive="#9ee0c2"
          emissiveMap={texture}
          emissiveIntensity={hot ? 0.45 : 0.18}
          roughness={0.25}
          metalness={0.05}
        />
      </mesh>
    </group>
  );
}

const KEY_ROWS = [
  ['Esc', '1', '2', '3', '4', '5', '6', '7', '8', '9', '0', '-', '=', 'Bksp'],
  ['Tab', 'Q', 'W', 'E', 'R', 'T', 'Y', 'U', 'I', 'O', 'P', '[', ']', '\\'],
  ['Caps', 'A', 'S', 'D', 'F', 'G', 'H', 'J', 'K', 'L', ';', "'", 'Enter'],
  ['Shift', 'Z', 'X', 'C', 'V', 'B', 'N', 'M', ',', '.', '/', 'Shift'],
  ['Ctrl', 'Win', 'Alt', 'Space', 'Alt', 'Fn', 'Ctrl'],
];

const KEY_WIDTH: Record<string, number> = {
  Bksp: 2,
  Tab: 1.5,
  '\\': 1.5,
  Caps: 1.75,
  Enter: 2.15,
  Shift: 2.25,
  Space: 6.1,
  Ctrl: 1.3,
  Alt: 1.25,
  Win: 1.25,
  Fn: 1.25,
};

function keyboardLayout() {
  const unit = 0.092;
  const keys: Array<{ label: string; x: number; z: number; w: number }> = [];
  KEY_ROWS.forEach((row, rowIndex) => {
    let cursor = 0;
    row.forEach((label) => {
      const w = (KEY_WIDTH[label] ?? 1) * unit;
      keys.push({ label, x: cursor + w / 2, z: rowIndex * unit * 1.08, w: w - 0.01 });
      cursor += w + 0.006;
    });
  });
  const maxX = Math.max(...keys.map((key) => key.x + key.w / 2));
  const maxZ = Math.max(...keys.map((key) => key.z));
  return { keys, width: maxX + 0.06, depth: maxZ + unit };
}

function Keyboard() {
  const layout = useMemo(() => keyboardLayout(), []);
  const legend = useMemo(() => {
    const canvas = document.createElement('canvas');
    canvas.width = 1024;
    canvas.height = 512;
    const g = canvas.getContext('2d');
    if (!g) return new THREE.CanvasTexture(canvas);
    g.clearRect(0, 0, 1024, 512);
    g.fillStyle = 'rgba(255,255,255,0.88)';
    g.font = 'bold 28px sans-serif';
    g.textAlign = 'center';
    g.textBaseline = 'middle';
    layout.keys.forEach((key) => {
      const x = (key.x / layout.width) * 1024;
      const y = (key.z / layout.depth) * 512;
      g.fillText(key.label.length > 3 ? key.label.slice(0, 2) : key.label, x, y);
    });
    const texture = new THREE.CanvasTexture(canvas);
    texture.colorSpace = THREE.SRGBColorSpace;
    texture.needsUpdate = true;
    return texture;
  }, [layout]);
  const caps = useRef<THREE.InstancedMesh>(null);
  useLayoutEffect(() => {
    const mesh = caps.current;
    if (!mesh) return;
    const dummy = new THREE.Object3D();
    layout.keys.forEach((key, index) => {
      dummy.position.set(key.x - layout.width / 2, 0.055, key.z - layout.depth / 2);
      dummy.scale.set(key.w / 0.08, 1, 1);
      dummy.rotation.set(0, 0, 0);
      dummy.updateMatrix();
      mesh.setMatrixAt(index, dummy.matrix);
    });
    mesh.instanceMatrix.needsUpdate = true;
  }, [layout]);
  return (
    <group position={[1.15, 0.02, 1.45]} rotation={[0, -0.25, 0]}>
      <RoundedBox args={[layout.width + 0.12, 0.05, layout.depth + 0.12]} radius={0.015} smoothness={2} position={[0, 0.02, 0]}>
        <meshStandardMaterial color="#23282f" metalness={0.35} roughness={0.45} />
      </RoundedBox>
      <instancedMesh ref={caps} args={[undefined, undefined, layout.keys.length]}>
        <boxGeometry args={[0.08, 0.045, 0.08]} />
        <meshStandardMaterial color="#3a4048" roughness={0.42} metalness={0.25} />
      </instancedMesh>
      <mesh position={[0, 0.08, 0]} rotation={[-Math.PI / 2, 0, 0]}>
        <planeGeometry args={[layout.width, layout.depth]} />
        <meshStandardMaterial map={legend} transparent depthWrite={false} roughness={0.4} />
      </mesh>
    </group>
  );
}
