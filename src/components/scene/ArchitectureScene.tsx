import { OrbitControls } from '@react-three/drei';
import { Canvas, useFrame, useThree } from '@react-three/fiber';
import { Component, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import * as THREE from 'three';
import type { CpuView, StepInfo } from '../../cpu/cpu';
import { describeLevel, dieFocus, parentLevel, POSES, crumbs, type LevelId } from './guide';
import { rippleAdd } from './logic';
import { AdderLevel, AluLevel, CmosLevel } from './levels/CircuitLevels';
import { CpuLevel } from './levels/CpuLevel';
import { MachineLevel } from './levels/MachineLevel';

interface ArchitectureSceneProps {
  view: CpuView;
  step: StepInfo | null;
  animMs: number;
  follow: boolean;
  onWebglFail: () => void;
  onOpenEditor: () => void;
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
    if (this.state.failed) return <p className="status warn">这个浏览器画不出立体结构，已改回平面视图。</p>;
    return this.props.children;
  }
}

export function ArchitectureScene({ view, step, animMs, follow, onWebglFail, onOpenEditor }: ArchitectureSceneProps) {
  const [level, setLevel] = useState<LevelId>('machine');
  const [bit, setBit] = useState(0);
  const [homeToken, setHomeToken] = useState(0);
  const added = useMemo(() => rippleAdd(view.acc, view.b), [view.acc, view.b]);
  const signals = added.bits[bit] ?? added.bits[0];
  const text = describeLevel(level, view, step, bit);
  const parent = parentLevel(level);

  const go = (next: LevelId) => setLevel(next);

  return (
    <div className="scene-frame">
      <SceneBoundary onFail={onWebglFail}>
        <Canvas
          shadows
          camera={{ position: [9.7, 7.9, 12.1], fov: 40, near: 0.05, far: 80 }}
          dpr={[1, 1.5]}
          gl={{ antialias: true, powerPreference: 'high-performance', alpha: false }}
          performance={{ min: 0.5 }}
        >
          <color attach="background" args={['#12161c']} />
          <hemisphereLight args={['#f4f7fb', '#2a3340', 0.55]} />
          <ambientLight intensity={0.25} />
          <directionalLight
            castShadow
            position={[6, 9, 5]}
            intensity={1.55}
            shadow-mapSize={[1024, 1024]}
            shadow-camera-near={1}
            shadow-camera-far={30}
            shadow-camera-left={-8}
            shadow-camera-right={8}
            shadow-camera-top={8}
            shadow-camera-bottom={-8}
            shadow-bias={-0.0005}
          />
          {level === 'machine' && (
            <MachineLevel view={view} step={step} animMs={animMs} onOpenCpu={() => go('cpu')} onOpenEditor={onOpenEditor} />
          )}
          {level === 'cpu' && <CpuLevel view={view} step={step} animMs={animMs} onOpenAlu={() => go('alu')} />}
          {level === 'alu' && <AluLevel acc={view.acc} b={view.b} onOpenBit={(index) => { setBit(index); go('bit'); }} />}
          {level === 'bit' && (
            <AdderLevel acc={view.acc} b={view.b} bitIndex={bit} onOpenCmos={() => go('cmos')} />
          )}
          {level === 'cmos' && <CmosLevel a={signals.a} b={signals.b} />}
          <OrbitControls
            makeDefault
            enableDamping
            dampingFactor={0.08}
            maxPolarAngle={Math.PI / 2.05}
            minDistance={1.2}
            maxDistance={18}
            target={POSES[level].target}
          />
          <Flight level={level} homeToken={homeToken} follow={follow} step={step} />
        </Canvas>
      </SceneBoundary>
      <div className="arch-overlay">
        <div className="arch-card arch-nav">
          <nav aria-label="缩放层级">
            {crumbs(level).map((crumb, index) => (
              <span key={crumb.id}>
                {index > 0 && <span className="arch-sep"> › </span>}
                <button type="button" onClick={() => go(crumb.id)} disabled={crumb.id === level}>
                  {crumb.label}
                </button>
              </span>
            ))}
          </nav>
          <div className="scene-actions">
            {level === 'machine' && (
              <button type="button" onClick={() => go('cpu')}>
                进入 CPU
              </button>
            )}
            {level === 'cpu' && (
              <button type="button" onClick={() => go('alu')}>
                进入 ALU
              </button>
            )}
            {level === 'alu' && (
              <button type="button" onClick={() => { setBit(0); go('bit'); }}>
                进入全加器
              </button>
            )}
            {level === 'bit' && (
              <button type="button" onClick={() => go('cmos')}>
                看晶体管
              </button>
            )}
            <button type="button" onClick={() => parent && go(parent)} disabled={!parent}>
              返回上一级
            </button>
            <button
              type="button"
              onClick={() => {
                setLevel('machine');
                setHomeToken((value) => value + 1);
              }}
            >
              回到整机
            </button>
          </div>
        </div>
      </div>
      <aside className="arch-caption" aria-live="polite">
        <strong>{step?.title ?? text.title}</strong>
        <p>{step?.explanation ?? text.body}</p>
      </aside>
    </div>
  );
}

const DIE_FOCUS: Record<string, [number, number, number]> = {
  control: [-1.2, 0.3, 0.55],
  alu: [0.2, 0.3, 0.55],
  regs: [1.25, 0.3, 0],
  bus: [0, 0.3, 1.15],
};

function Flight({
  level,
  homeToken,
  follow,
  step,
}: {
  level: LevelId;
  homeToken: number;
  follow: boolean;
  step: StepInfo | null;
}) {
  const camera = useThree((state) => state.camera);
  const controls = useThree((state) => state.controls) as
    | { target: THREE.Vector3; update: () => void; addEventListener: (t: string, fn: () => void) => void; removeEventListener: (t: string, fn: () => void) => void }
    | null;
  const until = useRef(0);
  const dragging = useRef(false);
  const pose = POSES[level];
  const from = useMemo(() => new THREE.Vector3(), []);
  const to = useMemo(() => new THREE.Vector3(), []);
  const aim = useMemo(() => new THREE.Vector3(), []);

  useEffect(() => {
    if (!controls) return;
    aim.set(...pose.target);
    to.set(...pose.position);
    const intro = level === 'machine' && homeToken === 0;
    from.copy(to).lerp(aim, intro ? -0.95 : -0.22);
    camera.position.copy(from);
    controls.target.copy(aim);
    controls.update();
    until.current = performance.now() + (intro ? 1700 : 650);
  }, [aim, camera, controls, from, homeToken, level, pose.position, pose.target, to]);

  useEffect(() => {
    if (!controls) return;
    const start = () => {
      dragging.current = true;
      until.current = 0;
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

  useFrame(() => {
    if (!controls || dragging.current || performance.now() > until.current) {
      if (controls && follow && level === 'cpu' && !dragging.current) {
        const key = dieFocus(step);
        const point = key ? DIE_FOCUS[key] : null;
        if (point) controls.target.lerp(new THREE.Vector3(...point), 0.04);
      }
      return;
    }
    const blend = 0.12;
    camera.position.lerp(to, blend);
    controls.target.lerp(aim, blend);
    controls.update();
  });

  return null;
}
