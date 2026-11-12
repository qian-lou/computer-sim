import type { CpuView, StepInfo } from '../../../cpu/cpu';
import { systemFlow } from '../logic';
import { Clickable, Packet, PcbTrace, Sign } from '../parts';

export function MachineLevel({
  view,
  step,
  animMs,
  onOpenCpu,
}: {
  view: CpuView;
  step: StepInfo | null;
  animMs: number;
  onOpenCpu: () => void;
}) {
  const flow = systemFlow(step);
  const memoryHot = flow === 'ram-to-cpu' || flow === 'cpu-to-ram';
  const screenHot = flow === 'cpu-to-screen';
  const latest = view.output[view.output.length - 1];
  return (
    <group>
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0.4, -0.02, 0.2]} receiveShadow>
        <circleGeometry args={[9, 40]} />
        <meshStandardMaterial color="#1a1f27" />
      </mesh>
      <Case />
      <Motherboard />
      <PcbTrace from={[-1.05, -0.35]} to={[-0.15, -0.95]} color="#7eb6ff" hot={memoryHot} />
      <PcbTrace from={[-0.7, -0.15]} to={[0.25, 0.25]} color="#f0b429" hot={Boolean(step?.activeBus)} />
      <PcbTrace from={[0.25, 0.25]} to={[0.95, 0.55]} color="#f0b429" hot={false} />
      <PcbTrace from={[0.15, 0.15]} to={[-1.2, 0.75]} color="#5ee0b5" hot={false} />
      <Clickable onClick={onOpenCpu}>
        <CpuPackage />
        <Sign text="CPU · 点击进入" position={[-1.05, 0.95, -0.35]} factor={7} />
      </Clickable>
      <RamSticks />
      <Sign text="内存" position={[-0.15, 0.72, -1.15]} factor={8} />
      <Ssd />
      <Sign text="硬盘" position={[-1.25, 0.4, 0.85]} factor={9} />
      <Gpu />
      <Sign text="显卡" position={[1.05, 0.85, 0.55]} factor={8} />
      <Psu />
      <Sign text="电源" position={[1.55, 0.85, -1.05]} factor={9} />
      <Chipset />
      <Monitor value={latest} hot={screenHot} />
      <Keyboard />
      {flow === 'ram-to-cpu' && (
        <Packet from={[-0.15, 0.45, -0.95]} to={[-1.05, 0.55, -0.35]} color="#8eb6ff" token={view.cycles} animMs={animMs} />
      )}
      {flow === 'cpu-to-ram' && (
        <Packet from={[-1.05, 0.55, -0.35]} to={[-0.15, 0.45, -0.95]} color="#f0b429" token={view.cycles} animMs={animMs} />
      )}
      {flow === 'cpu-to-screen' && (
        <Packet from={[-0.4, 0.7, 0.2]} to={[3.5, 1.05, 0]} color="#5ee0b5" token={view.cycles} animMs={animMs} />
      )}
    </group>
  );
}

function Case() {
  const metal = { color: '#2c323a', metalness: 0.72, roughness: 0.32 };
  return (
    <group>
      <mesh position={[0, 0.05, 0]} receiveShadow>
        <boxGeometry args={[4.5, 0.08, 3.7]} />
        <meshStandardMaterial {...metal} />
      </mesh>
      <mesh position={[0, 0.72, -1.8]} castShadow>
        <boxGeometry args={[4.5, 1.3, 0.08]} />
        <meshStandardMaterial {...metal} />
      </mesh>
      <mesh position={[-2.2, 0.72, 0]} castShadow>
        <boxGeometry args={[0.08, 1.3, 3.7]} />
        <meshStandardMaterial {...metal} />
      </mesh>
      <mesh position={[0, 0.18, 1.8]}>
        <boxGeometry args={[4.5, 0.22, 0.08]} />
        <meshStandardMaterial {...metal} />
      </mesh>
      <mesh position={[0, 1.32, -1.8]}>
        <boxGeometry args={[4.5, 0.06, 0.08]} />
        <meshStandardMaterial {...metal} />
      </mesh>
      <mesh position={[0, 1.32, 1.8]}>
        <boxGeometry args={[4.5, 0.06, 0.08]} />
        <meshStandardMaterial {...metal} />
      </mesh>
      <mesh position={[2.2, 0.72, 0]} raycast={() => null}>
        <boxGeometry args={[0.04, 1.15, 3.3]} />
        <meshStandardMaterial color="#c5ddff" transparent opacity={0.18} roughness={0.05} metalness={0.15} depthWrite={false} />
      </mesh>
    </group>
  );
}

function Motherboard() {
  return (
    <mesh position={[0, 0.12, 0]} receiveShadow>
      <boxGeometry args={[3.8, 0.05, 3.05]} />
      <meshStandardMaterial color="#1f7a46" roughness={0.62} metalness={0.12} />
    </mesh>
  );
}

function CpuPackage() {
  return (
    <group position={[-1.05, 0.22, -0.35]}>
      <mesh castShadow>
        <boxGeometry args={[0.85, 0.08, 0.85]} />
        <meshStandardMaterial color="#c0c6ce" metalness={0.85} roughness={0.25} />
      </mesh>
      <mesh position={[0, 0.1, 0]}>
        <boxGeometry args={[0.62, 0.12, 0.62]} />
        <meshStandardMaterial color="#8d939b" metalness={0.7} roughness={0.3} />
      </mesh>
      {Array.from({ length: 6 }, (_, index) => (
        <mesh key={index} position={[0, 0.22 + index * 0.035, 0]}>
          <boxGeometry args={[0.7, 0.02, 0.7]} />
          <meshStandardMaterial color="#d5dbe2" metalness={0.8} roughness={0.22} />
        </mesh>
      ))}
    </group>
  );
}

function RamSticks() {
  return (
    <group position={[-0.15, 0.28, -0.95]}>
      {[0, 0.22].map((offset) => (
        <group key={offset} position={[offset, 0, 0]}>
          <mesh castShadow>
            <boxGeometry args={[0.12, 0.55, 1.15]} />
            <meshStandardMaterial color="#1b1f24" roughness={0.45} metalness={0.35} />
          </mesh>
          <mesh position={[0.07, -0.05, 0]}>
            <boxGeometry args={[0.02, 0.18, 0.9]} />
            <meshStandardMaterial color="#d7b15a" metalness={0.8} roughness={0.3} />
          </mesh>
        </group>
      ))}
    </group>
  );
}

function Ssd() {
  return (
    <group position={[-1.25, 0.18, 0.75]}>
      <mesh>
        <boxGeometry args={[0.7, 0.06, 0.28]} />
        <meshStandardMaterial color="#d8dee6" metalness={0.65} roughness={0.28} />
      </mesh>
      <mesh position={[0.22, 0.04, 0]}>
        <boxGeometry args={[0.16, 0.02, 0.16]} />
        <meshStandardMaterial color="#222" />
      </mesh>
    </group>
  );
}

function Gpu() {
  return (
    <group position={[0.95, 0.32, 0.45]}>
      <mesh castShadow>
        <boxGeometry args={[1.15, 0.28, 0.42]} />
        <meshStandardMaterial color="#14181d" metalness={0.5} roughness={0.4} />
      </mesh>
      <mesh position={[0.28, 0.16, 0]}>
        <cylinderGeometry args={[0.12, 0.12, 0.04, 16]} />
        <meshStandardMaterial color="#2a3138" metalness={0.6} roughness={0.35} />
      </mesh>
    </group>
  );
}

function Psu() {
  return (
    <group position={[1.55, 0.38, -1.05]}>
      <mesh castShadow>
        <boxGeometry args={[0.7, 0.55, 0.85]} />
        <meshStandardMaterial color="#3a414a" metalness={0.55} roughness={0.4} />
      </mesh>
      <mesh position={[0, 0, 0.44]} rotation={[Math.PI / 2, 0, 0]}>
        <torusGeometry args={[0.16, 0.02, 8, 16]} />
        <meshStandardMaterial color="#111" />
      </mesh>
    </group>
  );
}

function Chipset() {
  return (
    <mesh position={[0.25, 0.18, 0.2]}>
      <boxGeometry args={[0.28, 0.08, 0.28]} />
      <meshStandardMaterial color="#22262c" metalness={0.4} roughness={0.45} />
    </mesh>
  );
}

function Monitor({ value, hot }: { value: number | undefined; hot: boolean }) {
  return (
    <group position={[3.55, 0.85, -0.15]}>
      <mesh position={[0, -0.7, 0]}>
        <boxGeometry args={[0.35, 0.2, 0.35]} />
        <meshStandardMaterial color="#2a2f36" metalness={0.4} roughness={0.4} />
      </mesh>
      <mesh position={[0, -0.35, 0]}>
        <boxGeometry args={[0.08, 0.55, 0.08]} />
        <meshStandardMaterial color="#3a414a" metalness={0.5} roughness={0.35} />
      </mesh>
      <mesh castShadow>
        <boxGeometry args={[1.7, 1.05, 0.08]} />
        <meshStandardMaterial color="#1b2026" metalness={0.4} roughness={0.35} />
      </mesh>
      <mesh position={[0, 0, 0.05]}>
        <planeGeometry args={[1.45, 0.82]} />
        <meshStandardMaterial color={hot ? '#112233' : '#071018'} emissive={hot ? '#3d8f86' : '#102033'} emissiveIntensity={0.7} />
      </mesh>
      <Sign text={value === undefined ? '—' : String(value)} position={[0, 0.02, 0.08]} factor={4.2} />
    </group>
  );
}

function Keyboard() {
  return (
    <group position={[3.15, 0.08, 1.25]}>
      <mesh receiveShadow>
        <boxGeometry args={[1.8, 0.08, 0.62]} />
        <meshStandardMaterial color="#2a3038" roughness={0.55} metalness={0.25} />
      </mesh>
      {[0.12, 0, -0.12].map((z) => (
        <mesh key={z} position={[0, 0.05, z]}>
          <boxGeometry args={[1.5, 0.03, 0.08]} />
          <meshStandardMaterial color="#3e4650" />
        </mesh>
      ))}
    </group>
  );
}
