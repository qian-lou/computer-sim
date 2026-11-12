import { Html, OrbitControls, RoundedBox } from '@react-three/drei';
import { Canvas, useFrame, useThree } from '@react-three/fiber';
import { Component, useEffect, useLayoutEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import * as THREE from 'three';
import type { CpuView, StepInfo } from '../../cpu/cpu';
import { hexByte } from '../../cpu/format';
import {
  ADDRESS_BUS,
  BOARD,
  CPU_PACKAGE,
  DATA_BUS,
  DIES,
  FLAG_LAMPS,
  HOME_CAMERA,
  HOME_TARGET,
  OUTPUT_DEVICE,
  RAM_ORIGIN,
  activeRamRows,
  focusFor,
  packetRoute,
  pinPositions,
  ramCellPosition,
  type Vec3,
} from './layout';

interface BoardSceneProps {
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
    if (this.state.failed) {
      return <p className="status warn">这个浏览器画不出立体画面，已改回平面视图。</p>;
    }
    return this.props.children;
  }
}

export function BoardScene({ view, step, animMs, follow, onWebglFail }: BoardSceneProps) {
  const [homeToken, setHomeToken] = useState(0);
  return (
    <div className="scene-frame">
      <SceneBoundary onFail={onWebglFail}>
        <Canvas
          camera={{ position: [HOME_CAMERA.x, HOME_CAMERA.y, HOME_CAMERA.z], fov: 46, near: 0.1, far: 80 }}
          dpr={[1, 1.6]}
          gl={{ antialias: true, powerPreference: 'high-performance', alpha: false }}
          performance={{ min: 0.5 }}
        >
          <color attach="background" args={['#0c1412']} />
      <fog attach="fog" args={['#0c1412', 18, 36]} />
          <Scene view={view} step={step} animMs={animMs} follow={follow} homeToken={homeToken} />
        </Canvas>
      </SceneBoundary>
      <div className="scene-hud">
        <p>拖动旋转，滚轮缩放，右键平移</p>
        <button type="button" onClick={() => setHomeToken((value) => value + 1)}>
          回到全景
        </button>
      </div>
    </div>
  );
}

function Scene({
  view,
  step,
  animMs,
  follow,
  homeToken,
}: {
  view: CpuView;
  step: StepInfo | null;
  animMs: number;
  follow: boolean;
  homeToken: number;
}) {
  const focus = focusFor(step, view.mar);
  const route = packetRoute(step, view.mar);
  return (
    <>
      <ambientLight intensity={0.55} />
      <directionalLight position={[7, 12, 6]} intensity={1.25} />
      <pointLight position={[-4, 6, -2]} intensity={8} distance={18} color="#8eb6ff" />
      <Board />
      <Pins />
      <CpuPackage view={view} step={step} />
      <RamBank view={view} step={step} />
      <OutputModule view={view} hot={step?.changedRegs.includes('out') ?? false} />
      <BusRibbon points={ADDRESS_BUS} active={step?.activeBus === 'address'} color="#8eb6ff" />
      <BusRibbon points={DATA_BUS} active={step?.activeBus === 'data'} color="#5ee0b5" />
      {route && <Packet key={view.cycles} route={route} animMs={animMs} />}
      <OrbitControls
        makeDefault
        enableDamping
        dampingFactor={0.08}
        maxPolarAngle={Math.PI / 2.08}
        minPolarAngle={0.2}
        minDistance={4.2}
        maxDistance={24}
        target={[HOME_TARGET.x, HOME_TARGET.y, HOME_TARGET.z]}
      />
      <CameraRig target={focus.position} enabled={follow && step !== null} homeToken={homeToken} />
    </>
  );
}

function Board() {
  const texture = useMemo(() => makeBoardTexture(), []);
  useEffect(() => () => texture.dispose(), [texture]);
  return (
    <group>
      <mesh position={[BOARD.position.x, BOARD.position.y, BOARD.position.z]} receiveShadow>
        <boxGeometry args={BOARD.size} />
        <meshStandardMaterial map={texture} color="#d5efe4" roughness={0.82} metalness={0.08} />
      </mesh>
      <Html transform sprite distanceFactor={10} position={[-6.2, 0.2, -3.6]} center style={{ pointerEvents: 'none' }}>
        <div className="die-tag">
          <small>教学主板</small>
        </div>
      </Html>
    </group>
  );
}

function makeBoardTexture(): THREE.CanvasTexture {
  const canvas = document.createElement('canvas');
  canvas.width = 1024;
  canvas.height = 704;
  const ctx = canvas.getContext('2d');
  if (!ctx) {
    const fallback = new THREE.CanvasTexture(canvas);
    return fallback;
  }
  ctx.fillStyle = '#123028';
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  ctx.strokeStyle = '#1c4638';
  ctx.lineWidth = 1;
  for (let i = 0; i <= canvas.width; i += 32) {
    ctx.beginPath();
    ctx.moveTo(i, 0);
    ctx.lineTo(i, canvas.height);
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(0, i);
    ctx.lineTo(canvas.width, i);
    ctx.stroke();
  }
  ctx.strokeStyle = '#8d5b34';
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.moveTo(80, 120);
  ctx.lineTo(360, 120);
  ctx.lineTo(420, 280);
  ctx.lineTo(760, 280);
  ctx.stroke();
  ctx.strokeStyle = '#2f6d5c';
  ctx.beginPath();
  ctx.moveTo(90, 180);
  ctx.lineTo(300, 180);
  ctx.lineTo(340, 420);
  ctx.lineTo(820, 460);
  ctx.stroke();
  ctx.fillStyle = '#0c1c18';
  for (const [x, y] of [
    [70, 70],
    [950, 70],
    [70, 630],
    [950, 630],
  ]) {
    ctx.beginPath();
    ctx.arc(x, y, 16, 0, Math.PI * 2);
    ctx.fill();
  }
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.anisotropy = 4;
  return texture;
}

function Pins() {
  const ref = useRef<THREE.InstancedMesh>(null);
  const pins = useMemo(() => pinPositions(), []);
  useLayoutEffect(() => {
    const mesh = ref.current;
    if (!mesh) return;
    const dummy = new THREE.Object3D();
    pins.forEach((pin, index) => {
      dummy.position.set(pin.x, pin.y, pin.z);
      dummy.scale.set(1, 1, 1);
      dummy.updateMatrix();
      mesh.setMatrixAt(index, dummy.matrix);
    });
    mesh.instanceMatrix.needsUpdate = true;
    mesh.frustumCulled = false;
  }, [pins]);
  return (
    <instancedMesh ref={ref} args={[undefined, undefined, pins.length]}>
      <boxGeometry args={[0.1, 0.14, 0.16]} />
      <meshStandardMaterial color="#d7b15a" metalness={0.85} roughness={0.28} />
    </instancedMesh>
  );
}

function CpuPackage({ view, step }: { view: CpuView; step: StepInfo | null }) {
  const hotRegs = new Set(step?.changedRegs ?? []);
  const activeRegs = new Set(step?.activeRegs ?? []);
  return (
    <group>
      <RoundedBox
        args={CPU_PACKAGE.size}
        radius={0.08}
        smoothness={3}
        position={[CPU_PACKAGE.position.x, CPU_PACKAGE.position.y, CPU_PACKAGE.position.z]}
      >
        <meshStandardMaterial color="#232a33" metalness={0.55} roughness={0.35} />
      </RoundedBox>
      <Die block={DIES.control} hot={step?.phase === 'decode'} active={step?.phase === 'fetch' || step?.phase === 'execute'}>
        <DieLabel title="控制单元" value={step?.mnemonic || (step?.phase === 'fetch' ? '取指' : '待命')} />
      </Die>
      <Die block={DIES.alu} hot={Boolean(step?.alu)} active={false}>
        <DieLabel title="ALU" value={aluText(step)} />
      </Die>
      <RegisterDie id="pc" title="PC" value={view.pc} hot={hotRegs.has('pc')} active={activeRegs.has('pc')} />
      <RegisterDie id="ir" title="IR" value={view.ir} hot={hotRegs.has('ir')} active={activeRegs.has('ir')} />
      <RegisterDie id="acc" title="ACC" value={view.acc} hot={hotRegs.has('acc')} active={activeRegs.has('acc')} />
      <RegisterDie id="b" title="B" value={view.b} hot={hotRegs.has('b')} active={activeRegs.has('b')} />
      <RegisterDie id="mar" title="MAR" value={view.mar} hot={hotRegs.has('mar')} active={activeRegs.has('mar')} />
      <RegisterDie id="mdr" title="MDR" value={view.mdr} hot={hotRegs.has('mdr')} active={activeRegs.has('mdr')} />
      <RegisterDie id="out" title="OUT" value={view.out} hot={hotRegs.has('out')} active={activeRegs.has('out')} />
      <FlagLamp name="Z" on={view.flags.z} hot={step?.changedFlags.includes('z') ?? false} position={FLAG_LAMPS.z} />
      <FlagLamp name="N" on={view.flags.n} hot={step?.changedFlags.includes('n') ?? false} position={FLAG_LAMPS.n} />
      <FlagLamp name="C" on={view.flags.c} hot={step?.changedFlags.includes('c') ?? false} position={FLAG_LAMPS.c} />
    </group>
  );
}

function RegisterDie({
  id,
  title,
  value,
  hot,
  active,
}: {
  id: keyof typeof DIES;
  title: string;
  value: number;
  hot: boolean;
  active: boolean;
}) {
  return (
    <Die block={DIES[id]} hot={hot} active={active && !hot}>
      <DieLabel title={title} value={`${hexByte(value)} · ${value}`} />
    </Die>
  );
}

function Die({
  block,
  hot,
  active,
  children,
}: {
  block: { position: Vec3; size: [number, number, number] };
  hot: boolean;
  active: boolean;
  children?: ReactNode;
}) {
  return (
    <group position={[block.position.x, block.position.y, block.position.z]}>
      <RoundedBox args={block.size} radius={0.05} smoothness={2}>
        <meshStandardMaterial
          color={hot ? '#4a3412' : active ? '#14382f' : '#1a2430'}
          emissive={hot ? '#f0b429' : active ? '#5ee0b5' : '#000000'}
          emissiveIntensity={hot ? 0.7 : active ? 0.4 : 0}
          roughness={0.42}
          metalness={0.18}
        />
      </RoundedBox>
      <group position={[0, block.size[1] / 2 + 0.02, 0]}>{children}</group>
    </group>
  );
}

function DieLabel({ title, value, hint }: { title: string; value: string; hint?: string }) {
  return (
    <Html transform sprite distanceFactor={5.2} center style={{ pointerEvents: 'none' }}>
      <div className="die-tag">
        <b>{title}</b>
        <span>{value}</span>
        {hint && <small>{hint}</small>}
      </div>
    </Html>
  );
}

function aluText(step: StepInfo | null): string {
  const alu = step?.alu;
  if (!alu) return '—';
  if (alu.op === 'NOT') return `~${alu.left}=${alu.result}`;
  const symbol = alu.op === 'ADD' ? '+' : alu.op === 'AND' ? '&' : alu.op === 'OR' ? '|' : alu.op === 'XOR' ? '^' : '−';
  return `${alu.left}${symbol}${alu.right}=${alu.result}`;
}

function FlagLamp({ name, on, hot, position }: { name: string; on: boolean; hot: boolean; position: Vec3 }) {
  return (
    <group position={[position.x, position.y, position.z]}>
      <mesh>
        <cylinderGeometry args={[0.1, 0.1, 0.12, 16]} />
        <meshStandardMaterial
          color={on ? '#b8ffe8' : '#24302c'}
          emissive={on ? '#5ee0b5' : '#000000'}
          emissiveIntensity={on ? (hot ? 1.6 : 0.9) : 0}
          toneMapped={false}
        />
      </mesh>
      <Html transform sprite distanceFactor={5.5} center position={[0.18, 0.02, 0]} style={{ pointerEvents: 'none' }}>
        <div className="die-tag">
          <b>{name}</b>
        </div>
      </Html>
    </group>
  );
}

function RamBank({ view, step }: { view: CpuView; step: StepInfo | null }) {
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
      dummy.position.set(cell.x, cell.y + (lifted ? 0.05 : 0), cell.z);
      dummy.scale.set(1, lifted ? 1.85 : 1, 1);
      dummy.rotation.set(0, 0, 0);
      dummy.updateMatrix();
      mesh.setMatrixAt(address, dummy.matrix);
      color.set(cellColor(address, view.ram[address], view.pc, view.mar, read, write));
      mesh.setColorAt(address, color);
    }
    mesh.instanceMatrix.needsUpdate = true;
    if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;
    mesh.frustumCulled = false;
  }, [view, step, read, write]);

  const anchor = ramCellPosition(rows[0] * 16);
  return (
    <group>
      <mesh position={[RAM_ORIGIN.x, 0.12, RAM_ORIGIN.z]}>
        <boxGeometry args={[4.7, 0.16, 4.7]} />
        <meshStandardMaterial color="#141c22" metalness={0.4} roughness={0.45} />
      </mesh>
      <instancedMesh ref={ref} args={[undefined, undefined, 256]}>
        <boxGeometry args={[0.2, 0.1, 0.2]} />
        <meshStandardMaterial roughness={0.55} metalness={0.05} />
      </instancedMesh>
      <Html
        transform
        sprite
        distanceFactor={6.5}
        center
        position={[anchor.x - 1.6, 0.85, anchor.z]}
        style={{ pointerEvents: 'none' }}
      >
        <RamWindow ram={view.ram} rows={rows} pc={view.pc} hot={hotAddress} />
      </Html>
      <CellCallout address={hotAddress} value={view.ram[hotAddress]} />
    </group>
  );
}

function cellColor(
  address: number,
  value: number,
  pc: number,
  mar: number,
  read: number | null,
  write: number | null,
): string {
  if (address === write) return '#ff8b6a';
  if (address === read) return '#8eb6ff';
  if (address === pc) return '#f0b429';
  if (address === mar && mar !== pc) return '#5ee0b5';
  if (value !== 0) return '#3f7360';
  return '#1b2c28';
}

function RamWindow({
  ram,
  rows,
  pc,
  hot,
}: {
  ram: Uint8Array;
  rows: number[];
  pc: number;
  hot: number;
}) {
  return (
    <div className="ram-window">
      <strong>内存 · 正在看的行</strong>
      {rows.map((row) => (
        <div key={row}>
          <em>{row.toString(16).toUpperCase()}0</em>
          {Array.from({ length: 16 }, (_, column) => {
            const address = row * 16 + column;
            const text = hexByte(ram[address]);
            const marked = address === hot || address === pc;
            return (
              <i key={address} className={marked ? 'hot' : ''}>
                {text}
              </i>
            );
          })}
        </div>
      ))}
    </div>
  );
}

function CellCallout({ address, value }: { address: number; value: number }) {
  const cell = ramCellPosition(address);
  return (
    <Html transform sprite distanceFactor={4.2} center position={[cell.x, cell.y + 0.42, cell.z]} style={{ pointerEvents: 'none' }}>
      <div className="die-tag">
        <b>{hexByte(address)}</b>
        <span>{hexByte(value)}</span>
      </div>
    </Html>
  );
}

function OutputModule({ view, hot }: { view: CpuView; hot: boolean }) {
  const latest = view.output[view.output.length - 1];
  return (
    <group position={[OUTPUT_DEVICE.x, OUTPUT_DEVICE.y, OUTPUT_DEVICE.z]}>
      <RoundedBox args={[2.6, 0.85, 1.5]} radius={0.08} smoothness={3}>
        <meshStandardMaterial color="#1b2420" metalness={0.35} roughness={0.4} />
      </RoundedBox>
      <mesh position={[0, 0.2, 0.42]}>
        <planeGeometry args={[1.7, 0.62]} />
        <meshStandardMaterial
          color={hot ? '#3a2a12' : '#07110e'}
          emissive={hot ? '#f0b429' : '#10241c'}
          emissiveIntensity={hot ? 0.8 : 0.35}
        />
      </mesh>
      <Html transform sprite distanceFactor={4.2} center position={[0, 0.22, 0.48]} style={{ pointerEvents: 'none' }}>
        <div className="die-tag out-tag">
          <small>输出设备</small>
          <span>{latest === undefined ? '—' : String(latest)}</span>
          <small>{latest === undefined ? '还没有输出' : `0x${hexByte(latest)}`}</small>
        </div>
      </Html>
      {Array.from({ length: 8 }, (_, index) => {
        const bit = 7 - index;
        const on = ((view.out >> bit) & 1) === 1;
        return (
          <mesh key={bit} position={[-0.7 + index * 0.2, -0.22, 0.7]}>
            <sphereGeometry args={[0.05, 10, 10]} />
            <meshStandardMaterial color={on ? '#f0b429' : '#24302c'} emissive={on ? '#f0b429' : '#000'} emissiveIntensity={on ? 1 : 0} />
          </mesh>
        );
      })}
    </group>
  );
}

function BusRibbon({ points, active, color }: { points: Vec3[]; active: boolean; color: string }) {
  const geometry = useMemo(() => {
    const curve = new THREE.CatmullRomCurve3(points.map((point) => new THREE.Vector3(point.x, point.y, point.z)));
    return new THREE.TubeGeometry(curve, 40, active ? 0.055 : 0.04, 6, false);
  }, [points, active]);
  useEffect(() => () => geometry.dispose(), [geometry]);
  return (
    <mesh geometry={geometry}>
      <meshStandardMaterial
        color={color}
        emissive={color}
        emissiveIntensity={active ? 1.35 : 0.18}
        roughness={0.32}
        metalness={0.2}
        toneMapped={!active}
      />
    </mesh>
  );
}

function Packet({ route, animMs }: { route: { from: Vec3; to: Vec3; value: number; bus: 'address' | 'data' }; animMs: number }) {
  const mesh = useRef<THREE.Mesh>(null);
  const light = useRef<THREE.PointLight>(null);
  const started = useRef(performance.now());
  const curve = useMemo(() => {
    const from = route.from;
    const to = route.to;
    return new THREE.CatmullRomCurve3([
      new THREE.Vector3(from.x, from.y + 0.35, from.z),
      new THREE.Vector3((from.x + to.x) / 2, Math.max(from.y, to.y) + 0.95, (from.z + to.z) / 2),
      new THREE.Vector3(to.x, to.y + 0.35, to.z),
    ]);
  }, [route.from, route.to]);
  useEffect(() => {
    started.current = performance.now();
  }, [route]);
  useFrame(() => {
    const t = Math.min(1, (performance.now() - started.current) / Math.max(animMs, 90));
    const eased = t < 0.5 ? 2 * t * t : 1 - ((-2 * t + 2) ** 2) / 2;
    const point = curve.getPoint(eased);
    mesh.current?.position.copy(point);
    light.current?.position.copy(point);
  });
  const color = route.bus === 'address' ? '#8eb6ff' : '#5ee0b5';
  return (
    <group>
      <mesh ref={mesh}>
        <sphereGeometry args={[0.13, 18, 18]} />
        <meshStandardMaterial color={color} emissive={color} emissiveIntensity={2.4} toneMapped={false} />
        <Html transform sprite distanceFactor={3.4} center position={[0, 0.28, 0]} style={{ pointerEvents: 'none' }}>
          <div className="die-tag">
            <span>{hexByte(route.value)}</span>
          </div>
        </Html>
      </mesh>
      <pointLight ref={light} color={color} intensity={6} distance={3.2} />
    </group>
  );
}

function CameraRig({ target, enabled, homeToken }: { target: Vec3; enabled: boolean; homeToken: number }) {
  const controls = useThree((state) => state.controls) as
    | {
        target: THREE.Vector3;
        update: () => void;
        object: THREE.Camera;
        addEventListener: (type: string, listener: () => void) => void;
        removeEventListener: (type: string, listener: () => void) => void;
      }
    | null;
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
    desired.set(target.x, target.y + 0.2, target.z);
    offset.copy(camera.position).sub(controls.target);
    const distance = offset.length();
    if (distance > 8.4) offset.multiplyScalar(7.4 / distance);
    const blend = 1 - Math.pow(0.1, delta);
    controls.target.lerp(desired, blend);
    camera.position.lerp(desired.clone().add(offset), blend * 0.65);
    controls.update();
  });

  return null;
}
