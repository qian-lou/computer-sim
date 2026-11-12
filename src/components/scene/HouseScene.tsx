import { Html, OrbitControls } from '@react-three/drei';
import { Canvas, useFrame, useThree } from '@react-three/fiber';
import { Component, useEffect, useLayoutEffect, useMemo, useRef, useState, type PointerEvent as ReactPointerEvent, type ReactNode } from 'react';
import * as THREE from 'three';
import type { CpuView, RegId, StepInfo } from '../../cpu/cpu';
import { hexByte } from '../../cpu/format';
import {
  ADDRESS_BUS,
  ALU_MACHINE,
  CONTROL_DESK,
  DATA_BUS,
  FLAG_LAMPS,
  HOME_CAMERA,
  HOME_TARGET,
  LOCKERS,
  OUTPUT_DEVICE,
  ROOM_TITLES,
  WAREHOUSE,
  activeRamRows,
  focusFor,
  packetRoute,
  ramCellPosition,
  type Vec3,
} from './layout';

const held = new Set<string>();

interface HouseSceneProps {
  view: CpuView;
  step: StepInfo | null;
  animMs: number;
  follow: boolean;
  onWebglFail: () => void;
}

class SceneBoundary extends Component<{ onFail: () => void; children: ReactNode }, { failed: boolean }> {
  state = { failed: false };

  static getDerivedStateFromError() {
    return { failed: true };
  }

  componentDidCatch() {
    this.props.onFail();
  }

  render() {
    if (this.state.failed) return <p className="status warn">这个浏览器画不出立体小屋，已改回平面视图。</p>;
    return this.props.children;
  }
}

export function HouseScene({ view, step, animMs, follow, onWebglFail }: HouseSceneProps) {
  const [homeToken, setHomeToken] = useState(0);
  const [nav, setNav] = useState<'orbit' | 'walk'>('orbit');
  const [roof, setRoof] = useState(false);

  return (
    <div className="scene-frame">
      <SceneBoundary onFail={onWebglFail}>
        <Canvas
          shadows
          camera={{ position: [HOME_CAMERA.x, HOME_CAMERA.y, HOME_CAMERA.z], fov: 42, near: 0.1, far: 80 }}
          dpr={[1, 1.5]}
          gl={{ antialias: true, powerPreference: 'high-performance', alpha: false }}
          performance={{ min: 0.5 }}
        >
          <color attach="background" args={['#c5daf0']} />
          <fog attach="fog" args={['#c5daf0', 28, 52]} />
          <World
            view={view}
            step={step}
            animMs={animMs}
            follow={follow && nav === 'orbit'}
            homeToken={homeToken}
            nav={nav}
            roof={roof}
          />
        </Canvas>
      </SceneBoundary>
      <div className="scene-hud">
        <p>{nav === 'orbit' ? '拖动旋转，滚轮缩放，右键平移' : '拖动环顾，WASD 走动，空格上升'}</p>
        <div className="scene-actions">
          <div className="view-toggle" role="group" aria-label="观察方式">
            <button type="button" className={nav === 'orbit' ? 'on' : ''} onClick={() => setNav('orbit')}>
              环视
            </button>
            <button type="button" className={nav === 'walk' ? 'on' : ''} onClick={() => setNav('walk')}>
              漫步
            </button>
          </div>
          <label className="follow">
            <input type="checkbox" checked={roof} onChange={(event) => setRoof(event.target.checked)} />
            屋顶
          </label>
          <button type="button" onClick={() => setHomeToken((value) => value + 1)}>
            回到全景
          </button>
        </div>
      </div>
      {nav === 'walk' && <WalkPad />}
    </div>
  );
}

function WalkPad() {
  const press = (key: string) => (event: ReactPointerEvent) => {
    event.preventDefault();
    held.add(key);
  };
  const release = (key: string) => () => held.delete(key);
  const keyButton = (key: string, label: string) => (
    <button type="button" onPointerDown={press(key)} onPointerUp={release(key)} onPointerLeave={release(key)}>
      {label}
    </button>
  );
  return (
    <div className="walk-pad" aria-label="漫步方向">
      <span />
      {keyButton('w', '前')}
      {keyButton('e', '升')}
      {keyButton('a', '左')}
      {keyButton('s', '后')}
      {keyButton('d', '右')}
      <span />
      {keyButton('q', '降')}
      <span />
    </div>
  );
}

function World({
  view,
  step,
  animMs,
  follow,
  homeToken,
  nav,
  roof,
}: {
  view: CpuView;
  step: StepInfo | null;
  animMs: number;
  follow: boolean;
  homeToken: number;
  nav: 'orbit' | 'walk';
  roof: boolean;
}) {
  const focus = focusFor(step, view.mar);
  const route = packetRoute(step, view.mar);
  return (
    <>
      <hemisphereLight args={['#fff6e4', '#7f9a62', 0.72]} />
      <ambientLight intensity={0.25} />
      <directionalLight
        castShadow
        position={[8, 14, 9]}
        intensity={1.45}
        shadow-mapSize={[1024, 1024]}
        shadow-camera-near={1}
        shadow-camera-far={40}
        shadow-camera-left={-16}
        shadow-camera-right={16}
        shadow-camera-top={16}
        shadow-camera-bottom={-16}
        shadow-bias={-0.0006}
      />
      <Ground />
      <Shell roof={roof} />
      <CpuWing view={view} step={step} />
      <Corridors active={step?.activeBus ?? null} />
      <Warehouse view={view} step={step} />
      <Billboard value={view.output[view.output.length - 1]} hot={step?.changedRegs.includes('out') ?? false} />
      <Trees />
      {route && <Courier key={view.cycles} route={route} animMs={animMs} />}
      <OrbitControls
        makeDefault
        enabled={nav === 'orbit'}
        enableDamping
        dampingFactor={0.08}
        maxPolarAngle={Math.PI / 2.08}
        minPolarAngle={0.18}
        minDistance={2.4}
        maxDistance={28}
        target={[HOME_TARGET.x, HOME_TARGET.y, HOME_TARGET.z]}
      />
      <CameraRig target={focus.position} enabled={follow && step !== null} homeToken={homeToken} />
      <WalkController active={nav === 'walk'} />
    </>
  );
}

function Ground() {
  return (
    <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -0.02, 0]} receiveShadow>
      <circleGeometry args={[26, 40]} />
      <meshStandardMaterial color="#8eae72" />
    </mesh>
  );
}

function Shell({ roof }: { roof: boolean }) {
  const plaster = '#f4e6d2';
  const trim = '#7a4e36';
  return (
    <group>
      <mesh position={[0, 0.08, 0]} receiveShadow>
        <boxGeometry args={[18.2, 0.16, 10.4]} />
        <meshStandardMaterial color="#e7c99a" />
      </mesh>
      <Wall position={[0, 1.35, -5.05]} size={[18.3, 2.55, 0.22]} color={plaster} />
      <Wall position={[-9.15, 1.35, 0]} size={[0.22, 2.55, 10.3]} color={plaster} />
      <Wall position={[9.15, 1.35, 0]} size={[0.22, 2.55, 10.3]} color={plaster} />
      <mesh position={[-9.15, 1.35, 1.2]}>
        <boxGeometry args={[0.05, 1.1, 1.5]} />
        <meshStandardMaterial color="#9ec4de" roughness={0.15} />
      </mesh>
      <mesh position={[9.15, 1.35, -1.4]}>
        <boxGeometry args={[0.05, 1.1, 1.5]} />
        <meshStandardMaterial color="#9ec4de" roughness={0.15} />
      </mesh>
      <Divider x={-2.15} />
      <Divider x={1.55} />
      <mesh position={[0, 0.18, 5.15]} receiveShadow>
        <boxGeometry args={[6.2, 0.28, 0.28]} />
        <meshStandardMaterial color={trim} />
      </mesh>
      <mesh position={[-2.4, 1.5, 5.15]} castShadow>
        <boxGeometry args={[0.22, 2.5, 0.22]} />
        <meshStandardMaterial color={trim} />
      </mesh>
      <mesh position={[2.7, 1.5, 5.15]} castShadow>
        <boxGeometry args={[0.22, 2.5, 0.22]} />
        <meshStandardMaterial color={trim} />
      </mesh>
      <mesh position={[0.15, 2.7, 5.15]}>
        <boxGeometry args={[5.4, 0.18, 0.22]} />
        <meshStandardMaterial color={trim} />
      </mesh>
      <Sign text={ROOM_TITLES.house} position={[0.15, 2.95, 5.2]} factor={9} />
      <Roof showFront={roof} />
    </group>
  );
}

function Wall({ position, size, color }: { position: [number, number, number]; size: [number, number, number]; color: string }) {
  return (
    <mesh position={position} castShadow receiveShadow>
      <boxGeometry args={size} />
      <meshStandardMaterial color={color} />
    </mesh>
  );
}

function Divider({ x }: { x: number }) {
  const color = '#f7efe4';
  return (
    <group>
      <Wall position={[x, 1.28, -3.35]} size={[0.16, 2.55, 3.3]} color={color} />
      <Wall position={[x, 1.28, 3.55]} size={[0.16, 2.55, 2.9]} color={color} />
      <Wall position={[x, 2.28, 0.35]} size={[0.16, 0.55, 3.5]} color={color} />
    </group>
  );
}

function Roof({ showFront }: { showFront: boolean }) {
  return (
    <group>
      <mesh position={[0, 3.15, -2.35]} rotation={[0.55, 0, 0]} castShadow>
        <boxGeometry args={[18.6, 0.12, 6.2]} />
        <meshStandardMaterial color="#c45c4a" />
      </mesh>
      <mesh position={[-6.4, 3.55, -3.4]} castShadow>
        <boxGeometry args={[0.7, 0.9, 0.7]} />
        <meshStandardMaterial color="#8d4b3c" />
      </mesh>
      {showFront && (
        <mesh position={[0, 3.15, 2.35]} rotation={[-0.55, 0, 0]}>
          <boxGeometry args={[18.6, 0.12, 6.2]} />
          <meshStandardMaterial color="#c45c4a" transparent opacity={0.42} />
        </mesh>
      )}
    </group>
  );
}

function CpuWing({ view, step }: { view: CpuView; step: StepInfo | null }) {
  const hotRegs = new Set(step?.changedRegs ?? []);
  const activeRegs = new Set(step?.activeRegs ?? []);
  const controlHot = step?.phase === 'decode' || step?.phase === 'fetch';
  const aluHot = Boolean(step?.alu);
  return (
    <group>
      <mesh position={[-5.5, 0.18, 0.4]} receiveShadow>
        <boxGeometry args={[6.6, 0.06, 8.4]} />
        <meshStandardMaterial color="#efd7b0" />
      </mesh>
      <Sign text={ROOM_TITLES.lockers} position={[-5.2, 2.15, 0.2]} factor={8} />
      <Desk position={CONTROL_DESK} hot={controlHot} title={ROOM_TITLES.control} value={step?.mnemonic || (step?.phase === 'fetch' ? '取指' : '待命')} />
      <Manager position={[CONTROL_DESK.x + 0.15, 0.16, CONTROL_DESK.z + 0.55]} />
      <Workshop hot={aluHot} value={aluText(step)} />
      {(Object.keys(LOCKERS) as RegId[]).map((id) => (
        <Locker
          key={id}
          id={id}
          value={view[id]}
          hot={hotRegs.has(id)}
          active={activeRegs.has(id) && !hotRegs.has(id)}
        />
      ))}
      <FlagLamp name="Z" on={view.flags.z} hot={step?.changedFlags.includes('z') ?? false} position={FLAG_LAMPS.z} />
      <FlagLamp name="N" on={view.flags.n} hot={step?.changedFlags.includes('n') ?? false} position={FLAG_LAMPS.n} />
      <FlagLamp name="C" on={view.flags.c} hot={step?.changedFlags.includes('c') ?? false} position={FLAG_LAMPS.c} />
      {controlHot && <pointLight position={[CONTROL_DESK.x, 2.1, CONTROL_DESK.z]} intensity={6} distance={5} color="#ffe1a8" />}
      {aluHot && <pointLight position={[ALU_MACHINE.x, 2.1, ALU_MACHINE.z]} intensity={7} distance={5} color="#ffd089" />}
    </group>
  );
}

function Desk({ position, hot, title, value }: { position: Vec3; hot: boolean; title: string; value: string }) {
  return (
    <group position={[position.x, position.y, position.z]}>
      <mesh castShadow receiveShadow>
        <boxGeometry args={[1.7, 0.72, 0.9]} />
        <meshStandardMaterial color={hot ? '#f0d7a4' : '#c9845a'} emissive={hot ? '#f0b429' : '#000'} emissiveIntensity={hot ? 0.35 : 0} />
      </mesh>
      <mesh position={[0, 0.7, -0.15]}>
        <boxGeometry args={[0.7, 0.45, 0.08]} />
        <meshStandardMaterial color="#243044" emissive={hot ? '#8eb6ff' : '#000'} emissiveIntensity={hot ? 0.6 : 0} />
      </mesh>
      <Sign text={title} sub={value} position={[0, 1.15, 0]} factor={6} />
    </group>
  );
}

function Manager({ position }: { position: [number, number, number] }) {
  return (
    <group position={position}>
      <mesh position={[0, 0.55, 0]} castShadow>
        <boxGeometry args={[0.28, 0.38, 0.18]} />
        <meshStandardMaterial color="#3d6b8a" />
      </mesh>
      <mesh position={[0, 0.86, 0]}>
        <sphereGeometry args={[0.13, 12, 12]} />
        <meshStandardMaterial color="#f0c7a2" />
      </mesh>
    </group>
  );
}

function aluText(step: StepInfo | null): string {
  const alu = step?.alu;
  if (!alu) return '空闲';
  if (alu.op === 'NOT') return `~${alu.left}=${alu.result}`;
  const symbol = alu.op === 'ADD' ? '+' : alu.op === 'AND' ? '&' : alu.op === 'OR' ? '|' : alu.op === 'XOR' ? '^' : '−';
  return `${alu.left}${symbol}${alu.right}=${alu.result}`;
}

function Workshop({ hot, value }: { hot: boolean; value: string }) {
  const gear = useRef<THREE.Mesh>(null);
  useFrame((_, delta) => {
    if (gear.current) gear.current.rotation.z += delta * (hot ? 2.4 : 0.3);
  });
  return (
    <group position={[ALU_MACHINE.x, ALU_MACHINE.y, ALU_MACHINE.z]}>
      <mesh position={[0, -0.15, 0]} castShadow receiveShadow>
        <boxGeometry args={[1.8, 0.7, 1.15]} />
        <meshStandardMaterial color={hot ? '#d7b07a' : '#8d6a4a'} emissive={hot ? '#f0b429' : '#000'} emissiveIntensity={hot ? 0.4 : 0} />
      </mesh>
      <mesh position={[-0.35, 0.45, 0]} castShadow>
        <cylinderGeometry args={[0.16, 0.16, 0.7, 10]} />
        <meshStandardMaterial color="#b9c4ce" metalness={0.6} roughness={0.3} />
      </mesh>
      <mesh ref={gear} position={[0.35, 0.55, 0]}>
        <cylinderGeometry args={[0.28, 0.28, 0.12, 8]} />
        <meshStandardMaterial color="#d7b15a" metalness={0.7} roughness={0.25} emissive={hot ? '#f0b429' : '#000'} emissiveIntensity={hot ? 0.5 : 0} />
      </mesh>
      <Sign text={ROOM_TITLES.alu} sub={value} position={[0, 1.15, 0]} factor={6} />
    </group>
  );
}

function Locker({ id, value, hot, active }: { id: RegId; value: number; hot: boolean; active: boolean }) {
  const locker = LOCKERS[id];
  return (
    <group position={[locker.position.x, locker.position.y, locker.position.z]}>
      <mesh castShadow receiveShadow>
        <boxGeometry args={[0.78, 1.05, 0.58]} />
        <meshStandardMaterial
          color={hot ? '#f2c56b' : active ? '#d7efe4' : '#f7efe2'}
          emissive={hot ? '#f0b429' : active ? '#5ee0b5' : '#000'}
          emissiveIntensity={hot ? 0.55 : active ? 0.28 : 0}
        />
      </mesh>
      <mesh position={[0, 0.05, 0.3]}>
        <boxGeometry args={[0.5, 0.62, 0.04]} />
        <meshStandardMaterial color="#c9845a" />
      </mesh>
      <Sign text={`${locker.title} ${hexByte(value)}`} sub={`${locker.hint} · ${value}`} position={[0, 0.78, 0.2]} factor={4.6} />
    </group>
  );
}

function FlagLamp({ name, on, hot, position }: { name: string; on: boolean; hot: boolean; position: Vec3 }) {
  return (
    <group position={[position.x, position.y, position.z]}>
      <mesh>
        <sphereGeometry args={[0.1, 12, 12]} />
        <meshStandardMaterial color={on ? '#d8fff1' : '#cabb9e'} emissive={on ? '#5ee0b5' : '#000'} emissiveIntensity={on ? (hot ? 1.5 : 0.8) : 0} />
      </mesh>
      <Sign text={name} position={[0.28, 0, 0]} factor={3.4} />
    </group>
  );
}

function Corridors({ active }: { active: 'address' | 'data' | null }) {
  return (
    <group>
      <Pipe points={ADDRESS_BUS} color="#d7b15a" active={active === 'address'} radius={0.12} />
      <Pipe points={DATA_BUS} color="#3d9e8f" active={active === 'data'} radius={0.1} />
      <Rollers />
      <Sign text={ROOM_TITLES.address} position={[-0.3, 1.15, 0.15]} factor={12} />
      <Sign text={ROOM_TITLES.data} position={[-0.3, 1.35, 1.35]} factor={12} />
    </group>
  );
}

function Pipe({ points, color, active, radius }: { points: Vec3[]; color: string; active: boolean; radius: number }) {
  const geometry = useMemo(() => {
    const curve = new THREE.CatmullRomCurve3(points.map((point) => new THREE.Vector3(point.x, point.y, point.z)));
    return new THREE.TubeGeometry(curve, 28, active ? radius + 0.02 : radius, 6, false);
  }, [points, active, radius]);
  useEffect(() => () => geometry.dispose(), [geometry]);
  return (
    <mesh geometry={geometry}>
      <meshStandardMaterial color={color} emissive={color} emissiveIntensity={active ? 0.9 : 0.12} roughness={0.4} />
    </mesh>
  );
}

function Rollers() {
  const ref = useRef<THREE.InstancedMesh>(null);
  const count = 10;
  useLayoutEffect(() => {
    const mesh = ref.current;
    if (!mesh) return;
    const dummy = new THREE.Object3D();
    for (let index = 0; index < count; index += 1) {
      const t = index / (count - 1);
      dummy.position.set(-4.6 + t * 8.2, 0.4, 1.25);
      dummy.rotation.set(0, 0, Math.PI / 2);
      dummy.updateMatrix();
      mesh.setMatrixAt(index, dummy.matrix);
    }
    mesh.instanceMatrix.needsUpdate = true;
  }, []);
  return (
    <instancedMesh ref={ref} args={[undefined, undefined, count]}>
      <cylinderGeometry args={[0.06, 0.06, 0.55, 8]} />
      <meshStandardMaterial color="#d9dee3" metalness={0.45} roughness={0.35} />
    </instancedMesh>
  );
}

function Warehouse({ view, step }: { view: CpuView; step: StepInfo | null }) {
  const ref = useRef<THREE.InstancedMesh>(null);
  const read = step?.readMem ?? null;
  const write = step?.writeMem ?? null;
  const rows = activeRamRows(view.pc, step, view.mar);
  const hotAddress = write ?? read ?? view.pc;

  useLayoutEffect(() => {
    const mesh = ref.current;
    if (!mesh) return;
    const dummy = new THREE.Object3D();
    const color = new THREE.Color();
    for (let address = 0; address < 256; address += 1) {
      const cell = ramCellPosition(address);
      const lifted = address === write || address === read;
      dummy.position.set(cell.x, cell.y + (lifted ? 0.08 : 0), cell.z);
      dummy.scale.set(1, lifted ? 1.7 : 1, 1);
      dummy.rotation.set(0, 0, 0);
      dummy.updateMatrix();
      mesh.setMatrixAt(address, dummy.matrix);
      color.set(shelfColor(address, view.ram[address], view.pc, view.mar, read, write));
      mesh.setColorAt(address, color);
    }
    mesh.instanceMatrix.needsUpdate = true;
    if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;
    mesh.frustumCulled = false;
  }, [view, step, read, write]);

  return (
    <group>
      <mesh position={[WAREHOUSE.x, 0.18, WAREHOUSE.z]} receiveShadow>
        <boxGeometry args={[6.4, 0.06, 6.2]} />
        <meshStandardMaterial color="#d8b48a" />
      </mesh>
      <instancedMesh ref={ref} args={[undefined, undefined, 256]} castShadow={false}>
        <boxGeometry args={[0.26, 0.22, 0.26]} />
        <meshStandardMaterial roughness={0.7} />
      </instancedMesh>
      <Sign text={ROOM_TITLES.warehouse} position={[WAREHOUSE.x, 2.15, WAREHOUSE.z - 2.6]} factor={8} />
      <Html transform sprite distanceFactor={8} center position={[WAREHOUSE.x, 1.15, WAREHOUSE.z + 2.9]} style={{ pointerEvents: 'none' }}>
        <ShelfCard ram={view.ram} rows={rows} pc={view.pc} hot={hotAddress} />
      </Html>
      <ShelfCallout address={hotAddress} value={view.ram[hotAddress]} />
      {(read !== null || write !== null) && (
        <pointLight position={[WAREHOUSE.x, 2.2, WAREHOUSE.z]} intensity={5} distance={7} color="#ffe1a8" />
      )}
    </group>
  );
}

function shelfColor(address: number, value: number, pc: number, mar: number, read: number | null, write: number | null): string {
  if (address === write) return '#ff8b6a';
  if (address === read) return '#8eb6ff';
  if (address === pc) return '#f0b429';
  if (address === mar && mar !== pc) return '#5ee0b5';
  if (value !== 0) return '#b08968';
  return '#f3e6d0';
}

function ShelfCard({ ram, rows, pc, hot }: { ram: Uint8Array; rows: number[]; pc: number; hot: number }) {
  return (
    <div className="ram-window">
      <strong>仓库里正在看的架子</strong>
      {rows.map((row) => (
        <div key={row}>
          <em>{row.toString(16).toUpperCase()}0</em>
          {Array.from({ length: 16 }, (_, column) => {
            const address = row * 16 + column;
            return (
              <i key={address} className={address === hot || address === pc ? 'hot' : ''}>
                {hexByte(ram[address])}
              </i>
            );
          })}
        </div>
      ))}
    </div>
  );
}

function ShelfCallout({ address, value }: { address: number; value: number }) {
  const cell = ramCellPosition(address);
  return <Sign text={`${hexByte(address)} 格`} sub={hexByte(value)} position={[cell.x, cell.y + 0.45, cell.z]} factor={4.2} />;
}

function Billboard({ value, hot }: { value: number | undefined; hot: boolean }) {
  return (
    <group position={[OUTPUT_DEVICE.x, OUTPUT_DEVICE.y, OUTPUT_DEVICE.z]}>
      <mesh castShadow>
        <boxGeometry args={[2.8, 1.5, 0.16]} />
        <meshStandardMaterial color="#5c3b2e" />
      </mesh>
      <mesh position={[0, 0, 0.09]}>
        <planeGeometry args={[2.3, 1.05]} />
        <meshStandardMaterial color={hot ? '#3a2a12' : '#102018'} emissive={hot ? '#f0b429' : '#163028'} emissiveIntensity={hot ? 0.7 : 0.35} />
      </mesh>
      <Sign
        text={value === undefined ? '—' : String(value)}
        sub={value === undefined ? ROOM_TITLES.output : `0x${hexByte(value)}`}
        position={[0, 0.05, 0.16]}
        factor={4.4}
      />
    </group>
  );
}

function Trees() {
  const spots: Vec3[] = [
    { x: -12, y: 0, z: -3 },
    { x: 12.2, y: 0, z: 2 },
    { x: -11, y: 0, z: 6 },
    { x: 11, y: 0, z: -6 },
  ];
  return (
    <group>
      {spots.map((spot) => (
        <group key={`${spot.x},${spot.z}`} position={[spot.x, spot.y, spot.z]}>
          <mesh position={[0, 0.45, 0]} castShadow>
            <cylinderGeometry args={[0.12, 0.16, 0.9, 6]} />
            <meshStandardMaterial color="#8d5a3c" />
          </mesh>
          <mesh position={[0, 1.25, 0]} castShadow>
            <coneGeometry args={[0.55, 1.1, 7]} />
            <meshStandardMaterial color="#3f7d4e" />
          </mesh>
        </group>
      ))}
    </group>
  );
}

function Courier({
  route,
  animMs,
}: {
  route: { from: Vec3; to: Vec3; value: number; bus: 'address' | 'data' };
  animMs: number;
}) {
  const group = useRef<THREE.Group>(null);
  const started = useRef(performance.now());
  const curve = useMemo(() => {
    const from = route.from;
    const to = route.to;
    const midY = 0.45;
    return new THREE.CatmullRomCurve3([
      new THREE.Vector3(from.x, midY, from.z),
      new THREE.Vector3((from.x + to.x) / 2, midY + 0.15, (from.z + to.z) / 2),
      new THREE.Vector3(to.x, midY, to.z),
    ]);
  }, [route.from, route.to]);
  useEffect(() => {
    started.current = performance.now();
  }, [route]);
  useFrame(() => {
    const t = Math.min(1, (performance.now() - started.current) / Math.max(animMs, 120));
    const eased = t < 0.5 ? 2 * t * t : 1 - ((-2 * t + 2) ** 2) / 2;
    const point = curve.getPoint(eased);
    const tangent = curve.getTangent(eased);
    if (!group.current) return;
    group.current.position.copy(point);
    group.current.rotation.y = Math.atan2(tangent.x, tangent.z);
  });
  const parcel = route.bus === 'address' ? '#8eb6ff' : '#5ee0b5';
  return (
    <group ref={group}>
      <mesh position={[0, 0.12, 0]} castShadow>
        <boxGeometry args={[0.42, 0.16, 0.3]} />
        <meshStandardMaterial color="#8d4b32" />
      </mesh>
      <mesh position={[-0.12, 0.02, 0.1]} rotation={[Math.PI / 2, 0, 0]}>
        <cylinderGeometry args={[0.06, 0.06, 0.04, 8]} />
        <meshStandardMaterial color="#2c241c" />
      </mesh>
      <mesh position={[0.12, 0.02, -0.1]} rotation={[Math.PI / 2, 0, 0]}>
        <cylinderGeometry args={[0.06, 0.06, 0.04, 8]} />
        <meshStandardMaterial color="#2c241c" />
      </mesh>
      <mesh position={[0, 0.32, 0.02]}>
        <boxGeometry args={[0.16, 0.2, 0.12]} />
        <meshStandardMaterial color="#3d6b8a" />
      </mesh>
      <mesh position={[0, 0.5, 0.02]}>
        <sphereGeometry args={[0.09, 10, 10]} />
        <meshStandardMaterial color="#f0c7a2" />
      </mesh>
      <mesh position={[0, 0.32, -0.12]}>
        <boxGeometry args={[0.18, 0.16, 0.16]} />
        <meshStandardMaterial color={parcel} emissive={parcel} emissiveIntensity={1.4} />
      </mesh>
      <Sign text={hexByte(route.value)} position={[0, 0.62, -0.12]} factor={3} />
    </group>
  );
}

function Sign({
  text,
  sub,
  position,
  factor,
}: {
  text: string;
  sub?: string;
  position: Vec3 | [number, number, number];
  factor: number;
}) {
  const [x, y, z] = Array.isArray(position) ? position : [position.x, position.y, position.z];
  return (
    <Html transform sprite distanceFactor={factor} center position={[x, y, z]} style={{ pointerEvents: 'none' }}>
      <div className="die-tag">
        <b>{text}</b>
        {sub && <span>{sub}</span>}
      </div>
    </Html>
  );
}

function CameraRig({ target, enabled, homeToken }: { target: Vec3; enabled: boolean; homeToken: number }) {
  const controls = useThree((state) => state.controls) as OrbitLike | null;
  const camera = useThree((state) => state.camera);
  const dragging = useRef(false);
  const desired = useMemo(() => new THREE.Vector3(), []);
  const offset = useMemo(() => new THREE.Vector3(), []);

  useEffect(() => {
    if (!controls) return;
    const start = () => {
      dragging.current = true;
    };
    const end = () => {
      dragging.current = false;
    };
    controls.addEventListener('start', start);
    controls.addEventListener('end', end);
    return () => {
      controls.removeEventListener('start', start);
      controls.removeEventListener('end', end);
    };
  }, [controls]);

  useEffect(() => {
    if (!controls || homeToken === 0) return;
    camera.position.set(HOME_CAMERA.x, HOME_CAMERA.y, HOME_CAMERA.z);
    controls.target.set(HOME_TARGET.x, HOME_TARGET.y, HOME_TARGET.z);
    controls.update();
  }, [camera, controls, homeToken]);

  useFrame((_, delta) => {
    if (!enabled || dragging.current || !controls) return;
    desired.set(target.x, Math.max(1.2, target.y), target.z);
    offset.set(HOME_CAMERA.x + target.x * 0.22, 8.2, 11.6);
    const blend = 1 - Math.pow(0.16, delta);
    controls.target.lerp(desired, blend);
    camera.position.lerp(offset, blend * 0.4);
    controls.update();
  });

  return null;
}

type OrbitLike = {
  target: THREE.Vector3;
  update: () => void;
  addEventListener: (type: string, listener: () => void) => void;
  removeEventListener: (type: string, listener: () => void) => void;
};

function WalkController({ active }: { active: boolean }) {
  const camera = useThree((state) => state.camera);
  const gl = useThree((state) => state.gl);
  const yaw = useRef(Math.PI);
  const pitch = useRef(-0.2);
  const keys = useRef(new Set<string>());
  const drag = useRef<{ x: number; y: number } | null>(null);

  useEffect(() => {
    if (!active) return;
    camera.position.set(-0.4, 1.7, 4.05);
    yaw.current = 0;
    pitch.current = -0.18;
    const down = (event: KeyboardEvent) => {
      keys.current.add(event.key.toLowerCase());
      if (['arrowup', 'arrowdown', 'arrowleft', 'arrowright', ' '].includes(event.key.toLowerCase())) event.preventDefault();
    };
    const up = (event: KeyboardEvent) => keys.current.delete(event.key.toLowerCase());
    window.addEventListener('keydown', down);
    window.addEventListener('keyup', up);
    const element = gl.domElement;
    const pointerDown = (event: PointerEvent) => {
      drag.current = { x: event.clientX, y: event.clientY };
    };
    const pointerMove = (event: PointerEvent) => {
      if (!drag.current) return;
      yaw.current -= (event.clientX - drag.current.x) * 0.005;
      pitch.current = Math.max(-1.05, Math.min(0.85, pitch.current - (event.clientY - drag.current.y) * 0.005));
      drag.current = { x: event.clientX, y: event.clientY };
    };
    const pointerUp = () => {
      drag.current = null;
    };
    element.addEventListener('pointerdown', pointerDown);
    window.addEventListener('pointermove', pointerMove);
    window.addEventListener('pointerup', pointerUp);
    return () => {
      window.removeEventListener('keydown', down);
      window.removeEventListener('keyup', up);
      element.removeEventListener('pointerdown', pointerDown);
      window.removeEventListener('pointermove', pointerMove);
      window.removeEventListener('pointerup', pointerUp);
      keys.current.clear();
      held.clear();
    };
  }, [active, camera, gl]);

  useFrame((_, delta) => {
    if (!active) return;
    camera.rotation.order = 'YXZ';
    camera.rotation.y = yaw.current;
    camera.rotation.x = pitch.current;
    const pressed = new Set([...keys.current, ...held]);
    const speed = (pressed.has('shift') ? 7.5 : 3.6) * delta;
    const sin = Math.sin(yaw.current);
    const cos = Math.cos(yaw.current);
    if (pressed.has('w') || pressed.has('arrowup')) {
      camera.position.x -= sin * speed;
      camera.position.z -= cos * speed;
    }
    if (pressed.has('s') || pressed.has('arrowdown')) {
      camera.position.x += sin * speed;
      camera.position.z += cos * speed;
    }
    if (pressed.has('a') || pressed.has('arrowleft')) {
      camera.position.x -= cos * speed;
      camera.position.z += sin * speed;
    }
    if (pressed.has('d') || pressed.has('arrowright')) {
      camera.position.x += cos * speed;
      camera.position.z -= sin * speed;
    }
    if (pressed.has('e') || pressed.has(' ')) camera.position.y += speed;
    if (pressed.has('q')) camera.position.y -= speed;
    camera.position.y = Math.max(0.45, Math.min(7.5, camera.position.y));
    camera.position.x = Math.max(-14, Math.min(14, camera.position.x));
    camera.position.z = Math.max(-10, Math.min(16, camera.position.z));
  });

  return null;
}
