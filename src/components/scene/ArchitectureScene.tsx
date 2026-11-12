import { ContactShadows, Environment, Lightformer, OrbitControls } from '@react-three/drei';
import { Canvas, useFrame, useThree } from '@react-three/fiber';
import { Bloom, EffectComposer, SMAA, SSAO, Vignette } from '@react-three/postprocessing';
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
  const [tier, setTier] = useState<'high' | 'low'>('high');
  useEffect(() => {
    const narrow = window.matchMedia('(max-width: 800px), (pointer: coarse)').matches;
    const weak = navigator.hardwareConcurrency > 0 && navigator.hardwareConcurrency <= 4;
    setTier(narrow || weak ? 'low' : 'high');
  }, []);
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
          dpr={tier === 'high' ? [1, 1.75] : [1, 1.1]}
          gl={{
            antialias: tier === 'high',
            powerPreference: 'high-performance',
            alpha: false,
            toneMapping: THREE.ACESFilmicToneMapping,
            toneMappingExposure: 1.05,
          }}
          performance={{ min: 0.5 }}
        >
          <color attach="background" args={['#1a212b']} />
          <hemisphereLight args={['#f7f4ee', '#2a3340', 0.45]} />
          <ambientLight intensity={0.18} />
          <directionalLight
            castShadow={tier === 'high'}
            position={[6, 9, 5]}
            intensity={1.65}
            shadow-mapSize={tier === 'high' ? [2048, 2048] : [512, 512]}
            shadow-camera-near={1}
            shadow-camera-far={30}
            shadow-camera-left={-8}
            shadow-camera-right={8}
            shadow-camera-top={8}
            shadow-camera-bottom={-8}
            shadow-bias={-0.0004}
          />
          <Environment resolution={128} environmentIntensity={0.65}>
            <Lightformer form="rect" intensity={3} position={[0, 5, 1]} scale={[10, 4, 1]} color="#fff6ea" />
            <Lightformer form="rect" intensity={1.2} position={[-5, 2, 2]} scale={[4, 3, 1]} color="#d5e2ff" />
            <Lightformer form="rect" intensity={0.8} position={[5, 1.5, -2]} scale={[3, 2, 1]} color="#ffd2a8" />
          </Environment>
          {tier === 'high' && level === 'machine' && (
            <ContactShadows position={[0.5, -0.02, 0.15]} opacity={0.45} scale={14} blur={2.4} far={4} frames={1} />
          )}
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
          />
          <Flight level={level} homeToken={homeToken} follow={follow} step={step} />
          {tier === 'high' ? (
            <EffectComposer multisampling={0} enableNormalPass>
              <SMAA />
              <SSAO radius={0.08} intensity={4} luminanceInfluence={0.4} />
              <Bloom intensity={0.35} luminanceThreshold={0.72} mipmapBlur />
              <Vignette eskil={false} offset={0.2} darkness={0.5} />
            </EffectComposer>
          ) : (
            <EffectComposer multisampling={0}>
              <Bloom intensity={0.2} luminanceThreshold={0.85} mipmapBlur />
            </EffectComposer>
          )}
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
  const started = useRef(0);
  const duration = useRef(800);
  const dragging = useRef(false);
  const pose = POSES[level];
  const from = useMemo(() => new THREE.Vector3(), []);
  const to = useMemo(() => new THREE.Vector3(), []);
  const aimFrom = useMemo(() => new THREE.Vector3(), []);
  const aim = useMemo(() => new THREE.Vector3(), []);

  useEffect(() => {
    if (!controls) return;
    aimFrom.copy(controls.target);
    aim.set(...pose.target);
    to.set(...pose.position);
    const intro = level === 'machine' && homeToken === 0;
    from.copy(intro ? to.clone().lerp(aim, -0.9) : camera.position);
    duration.current = intro ? 1800 : 900;
    started.current = performance.now();
    until.current = started.current + duration.current;
  }, [aim, aimFrom, camera, controls, from, homeToken, level, pose.position, pose.target, to]);

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
    if (!controls || dragging.current) return;
    if (performance.now() >= until.current) {
      if (until.current > 0) {
        camera.position.copy(to);
        controls.target.copy(aim);
        controls.update();
        until.current = 0;
      } else if (follow && level === 'cpu') {
        const key = dieFocus(step);
        const point = key ? DIE_FOCUS[key] : null;
        if (point) controls.target.lerp(new THREE.Vector3(...point), 0.04);
      }
      return;
    }
    const t = Math.min(1, (performance.now() - started.current) / duration.current);
    const eased = 1 - (1 - t) ** 3;
    camera.position.lerpVectors(from, to, eased);
    controls.target.lerpVectors(aimFrom, aim, eased);
    controls.update();
  });

  return null;
}
