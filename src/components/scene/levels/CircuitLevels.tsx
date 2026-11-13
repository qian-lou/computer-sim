import { useFrame } from '@react-three/fiber';
import { useLayoutEffect, useRef } from 'react';
import * as THREE from 'three';
import { Clickable, Sign, Wire, gateGeometry } from '../parts';
import { cmosNand, fullAdderSignals, rippleAdd, type Bit } from '../logic';

export function AluLevel({
  acc,
  b,
  onOpenBit,
}: {
  acc: number;
  b: number;
  onOpenBit: (index: number) => void;
}) {
  const added = rippleAdd(acc, b);
  return (
    <group>
      <mesh position={[0, -0.05, 0]} receiveShadow>
        <boxGeometry args={[8.2, 0.08, 2.4]} />
        <meshStandardMaterial color="#243044" metalness={0.3} roughness={0.5} />
      </mesh>
      <Sign text={`${acc} + ${b} = ${added.sum}`} position={[0, 1.15, -0.85]} factor={6} />
      {added.bits.map((bit) => {
        const x = (bit.index - 3.5) * 0.86;
        return (
          <group key={bit.index}>
            <Clickable onClick={() => onOpenBit(bit.index)}>
              <mesh position={[x, 0.32, 0]} castShadow>
                <boxGeometry args={[0.62, 0.42, 0.62]} />
                <meshStandardMaterial
                  color={bit.cout ? '#e7c27a' : '#35586e'}
                  metalness={0.35}
                  roughness={0.4}
                  emissive={bit.cout ? '#f0b429' : '#000'}
                  emissiveIntensity={bit.cout ? 0.45 : 0}
                />
              </mesh>
              <mesh position={[x, 0.54, 0.32]}>
                <sphereGeometry args={[0.05, 10, 10]} />
                <meshStandardMaterial color={bit.sum ? '#ffe08a' : '#667'} emissive={bit.sum ? '#ffb020' : '#000'} emissiveIntensity={bit.sum ? 1 : 0} />
              </mesh>
              <Sign text={`FA${bit.index}  A${bit.a} B${bit.b} S${bit.sum}`} position={[x, 0.82, 0]} factor={5.2} />
            </Clickable>
            {bit.index < 7 && (
              <Wire
                a={[x + 0.32, 0.4, 0]}
                b={[x + 0.54, 0.4, 0]}
                on={bit.cout === 1}
              />
            )}
          </group>
        );
      })}
      <Ripple bits={added.bits} />
      <CarryPins />
      <Sign text="低位 → 高位，进位沿黄线传递" position={[0, 0.15, 1.15]} factor={14} />
    </group>
  );
}

export function AdderLevel({
  acc,
  b,
  bitIndex,
  onOpenCmos,
}: {
  acc: number;
  b: number;
  bitIndex: number;
  onOpenCmos: () => void;
}) {
  const added = rippleAdd(acc, b);
  const signals = fullAdderSignals(added.bits[bitIndex].a, added.bits[bitIndex].b, added.bits[bitIndex].cin);
  return (
    <group>
      <mesh position={[0, -0.02, 0]} receiveShadow>
        <boxGeometry args={[6.4, 0.06, 3.4]} />
        <meshStandardMaterial color="#1c2430" />
      </mesh>
      <Lamp label={`A ${signals.a}`} at={[-2.6, 0.3, 0.7]} on={signals.a === 1} />
      <Lamp label={`B ${signals.b}`} at={[-2.6, 0.3, -0.2]} on={signals.b === 1} />
      <Lamp label={`Cin ${signals.cin}`} at={[-2.6, 0.3, -1.1]} on={signals.cin === 1} />
      <Gate name="XOR" title="异或" at={[-1.3, 0.35, 0.35]} on={signals.xor1 === 1} />
      <Gate name="XOR" title="异或" at={[0.2, 0.35, 0.15]} on={signals.sum === 1} />
      <Clickable onClick={onOpenCmos}>
        <Gate name="AND" title="与 · 点击" at={[-1.3, 0.35, -0.85]} on={signals.and1 === 1} />
      </Clickable>
      <Gate name="AND" title="与" at={[0.15, 0.35, -0.85]} on={signals.and2 === 1} />
      <Gate name="OR" title="或" at={[1.45, 0.35, -0.85]} on={signals.cout === 1} />
      <Lamp label={`S ${signals.sum}`} at={[2.3, 0.35, 0.2]} on={signals.sum === 1} />
      <Lamp label={`Cout ${signals.cout}`} at={[2.5, 0.35, -0.85]} on={signals.cout === 1} />
      <Wire a={[-2.2, 0.35, 0.7]} b={[-1.65, 0.35, 0.45]} on={signals.a === 1} />
      <Wire a={[-2.2, 0.35, -0.2]} b={[-1.65, 0.35, 0.25]} on={signals.b === 1} />
      <Wire a={[-0.95, 0.35, 0.35]} b={[-0.15, 0.35, 0.2]} on={signals.xor1 === 1} />
      <Wire a={[-2.2, 0.35, -1.1]} b={[-0.15, 0.35, 0.05]} on={signals.cin === 1} />
      <Wire a={[-2.2, 0.35, 0.7]} b={[-1.65, 0.35, -0.75]} on={signals.a === 1} />
      <Wire a={[-2.2, 0.35, -0.2]} b={[-1.65, 0.35, -0.95]} on={signals.b === 1} />
      <Wire a={[-0.95, 0.35, -0.85]} b={[1.1, 0.35, -0.85]} on={signals.and1 === 1} />
      <Wire a={[-0.95, 0.35, 0.2]} b={[-0.2, 0.35, -0.75]} on={signals.xor1 === 1} />
      <Wire a={[-0.2, 0.35, -0.85]} b={[1.1, 0.35, -0.85]} on={signals.and2 === 1} />
      <Wire a={[0.55, 0.35, 0.15]} b={[1.95, 0.35, 0.2]} on={signals.sum === 1} />
      <Wire a={[1.8, 0.35, -0.85]} b={[2.15, 0.35, -0.85]} on={signals.cout === 1} />
      <Sign text={`第 ${bitIndex} 位`} position={[0, 1.35, -1.45]} factor={14} />
    </group>
  );
}

function Ripple({ bits }: { bits: Array<{ cout: 0 | 1 }> }) {
  const mesh = useRef<THREE.Mesh>(null);
  const material = useRef<THREE.MeshStandardMaterial>(null);
  useFrame(({ clock }) => {
    const travel = (clock.elapsedTime * 0.9) % 8;
    const index = Math.floor(travel);
    const along = travel - index;
    const from = (Math.min(index, 6) - 3.5) * 0.86;
    if (mesh.current) mesh.current.position.set(from + along * 0.86, 0.52, 0.05);
    if (material.current) material.current.emissiveIntensity = bits[index]?.cout === 1 ? 2.6 : 0.2;
  });
  return (
    <mesh ref={mesh}>
      <sphereGeometry args={[0.055, 12, 12]} />
      <meshStandardMaterial ref={material} color="#fff4d2" emissive="#ffb020" emissiveIntensity={1} toneMapped={false} />
    </mesh>
  );
}

function CarryPins() {
  const ref = useRef<THREE.InstancedMesh>(null);
  useLayoutEffect(() => {
    const mesh = ref.current;
    if (!mesh) return;
    const dummy = new THREE.Object3D();
    let index = 0;
    for (let bit = 0; bit < 8; bit += 1) {
      const x = (bit - 3.5) * 0.86;
      for (const side of [-1, 1]) {
        for (let pin = 0; pin < 4; pin += 1) {
          dummy.position.set(x - 0.18 + pin * 0.12, 0.14, side * 0.36);
          dummy.rotation.set(0, 0, 0);
          dummy.scale.set(1, 1, 1);
          dummy.updateMatrix();
          mesh.setMatrixAt(index, dummy.matrix);
          index += 1;
        }
      }
    }
    mesh.instanceMatrix.needsUpdate = true;
  }, []);
  return (
    <instancedMesh ref={ref} args={[undefined, undefined, 64]}>
      <boxGeometry args={[0.035, 0.16, 0.035]} />
      <meshStandardMaterial color="#e0c36a" metalness={0.9} roughness={0.22} />
    </instancedMesh>
  );
}

function Lamp({ label, at, on }: { label: string; at: [number, number, number]; on: boolean }) {
  return (
    <group position={at}>
      <mesh>
        <sphereGeometry args={[0.12, 14, 14]} />
        <meshStandardMaterial color={on ? '#ffe08a' : '#66707a'} emissive={on ? '#ffb020' : '#000'} emissiveIntensity={on ? 1.1 : 0} />
      </mesh>
      <Sign text={label} position={[0, 0.32, 0]} factor={4} />
    </group>
  );
}

function Gate({ name, title, at, on }: { name: 'AND' | 'OR' | 'XOR'; title: string; at: [number, number, number]; on: boolean }) {
  const color = name === 'AND' ? '#2f8f57' : name === 'OR' ? '#2f6f92' : '#6d4f96';
  return (
    <group position={at}>
      <mesh geometry={gateGeometry(name)} rotation={[Math.PI / 2, 0, 0]}>
        <meshStandardMaterial color={color} metalness={0.25} roughness={0.38} emissive={on ? '#f0b429' : '#000'} emissiveIntensity={on ? 0.4 : 0} />
      </mesh>
      {name === 'XOR' && (
        <mesh position={[-0.28, 0, 0.02]} rotation={[Math.PI / 2, 0, 0]}>
          <torusGeometry args={[0.16, 0.015, 6, 12, Math.PI]} />
          <meshStandardMaterial color="#efe8ff" />
        </mesh>
      )}
      <Sign text={title} position={[0, 0.42, 0]} factor={4.4} />
    </group>
  );
}

export function CmosLevel({ a, b }: { a: Bit; b: Bit }) {
  const gate = cmosNand(a, b);
  const pullUp = gate.pmosA || gate.pmosB;
  const pullDown = gate.nmosA && gate.nmosB;
  return (
    <group>
      <mesh position={[0, 0.1, -0.12]}>
        <boxGeometry args={[3.4, 2.5, 0.28]} />
        <meshStandardMaterial color="#c9a3ab" roughness={0.72} />
      </mesh>
      <mesh position={[0, 0.7, -0.02]}>
        <boxGeometry args={[3.1, 0.7, 0.22]} />
        <meshStandardMaterial color="#e4d2bc" roughness={0.6} />
      </mesh>
      {[-1.15, 0, 1.15].map((x) => (
        <mesh key={x} position={[x, 0.15, 0.02]}>
          <boxGeometry args={[0.12, 2.15, 0.16]} />
          <meshStandardMaterial color="#d9c7a4" roughness={0.55} />
        </mesh>
      ))}
      <mesh position={[0, 0.15, 0.2]}>
        <boxGeometry args={[3.2, 2.35, 0.35]} />
        <meshStandardMaterial color="#9eb4c8" transparent opacity={0.16} roughness={0.15} metalness={0.05} depthWrite={false} />
      </mesh>
      <Doped x={-0.7} y={0.85} on={gate.pmosA} color="#a33b48" label="P+" />
      <Doped x={0.7} y={0.85} on={gate.pmosB} color="#a33b48" label="P+" />
      <Poly x={-0.7} y={0.95} on={gate.pmosA} name="PMOS A" />
      <Poly x={0.7} y={0.95} on={gate.pmosB} name="PMOS B" />
      <Doped x={0} y={-0.15} on={gate.nmosA} color="#2f7a45" label="N+" />
      <Doped x={0} y={-0.7} on={gate.nmosB} color="#2f7a45" label="N+" />
      <Poly x={0} y={-0.05} on={gate.nmosA} name="NMOS A" />
      <Poly x={0} y={-0.6} on={gate.nmosB} name="NMOS B" />
      {pullUp && <Channel x={gate.pmosA ? -0.7 : 0.7} y={0.85} />}
      {pullDown && (
        <>
          <Channel x={0} y={-0.15} />
          <Channel x={0} y={-0.7} />
        </>
      )}
      <mesh position={[0, 1.45, 0.08]}>
        <boxGeometry args={[2.8, 0.08, 0.08]} />
        <meshStandardMaterial color="#d0d5dc" metalness={0.9} roughness={0.2} emissive="#c45c4a" emissiveIntensity={0.25} />
      </mesh>
      {[-0.92, -0.48, 0.48, 0.92].map((x) => (
        <mesh key={x} position={[x, 1.15, 0.16]}>
          <cylinderGeometry args={[0.035, 0.035, 0.52, 10]} />
          <meshStandardMaterial color="#d5dbe3" metalness={0.92} roughness={0.18} />
        </mesh>
      ))}
      <mesh position={[0, -0.95, 0.16]}>
        <cylinderGeometry args={[0.035, 0.035, 0.5, 10]} />
        <meshStandardMaterial color="#d5dbe3" metalness={0.92} roughness={0.18} />
      </mesh>
      <mesh position={[0, -1.25, 0.08]}>
        <boxGeometry args={[2.8, 0.08, 0.08]} />
        <meshStandardMaterial color="#22262c" metalness={0.7} roughness={0.3} />
      </mesh>
      <Sign text="Vdd" position={[1.7, 1.45, 0.1]} factor={5} />
      <Sign text="GND" position={[1.7, -1.25, 0.1]} factor={5} />
      <Sign text={`A = ${a}`} position={[-1.7, 0.9, 0.2]} factor={5} />
      <Sign text={`B = ${b}`} position={[-1.7, -0.4, 0.2]} factor={5} />
      <Sign text={`输出 ${gate.output}`} position={[1.55, 0.15, 0.25]} factor={4.8} />
      <Sign text="衬底剖面 · 与非门" position={[0, 1.9, 0]} factor={6} />
      <Sign text="STI" position={[-1.15, 0.15, 0.28]} factor={6} />
      <Sign text="介质层" position={[1.35, 0.15, 0.35]} factor={6} />
      <Carriers pullUp={pullUp} pullDown={pullDown} />
    </group>
  );
}

function Carriers({ pullUp, pullDown }: { pullUp: boolean; pullDown: boolean }) {
  const holes = useRef<THREE.InstancedMesh>(null);
  const electrons = useRef<THREE.InstancedMesh>(null);
  const dummy = useMemoCarrier();
  useFrame(({ clock }) => {
    const place = (mesh: THREE.InstancedMesh | null, active: boolean, upward: boolean) => {
      if (!mesh) return;
      for (let i = 0; i < 6; i += 1) {
        const t = (clock.elapsedTime * 0.45 + i / 6) % 1;
        const y = upward ? 0.65 + t * 0.75 : 0.1 - t * 1.05;
        const x = upward ? (i % 2 === 0 ? -0.7 : 0.7) : (i % 2) * 0.08 - 0.04;
        dummy.position.set(x, y, 0.22);
        dummy.scale.setScalar(active ? 1 : 0.01);
        dummy.updateMatrix();
        mesh.setMatrixAt(i, dummy.matrix);
      }
      mesh.instanceMatrix.needsUpdate = true;
    };
    place(holes.current, pullUp, true);
    place(electrons.current, pullDown, false);
  });
  return (
    <group>
      <instancedMesh ref={holes} args={[undefined, undefined, 6]} frustumCulled={false}>
        <sphereGeometry args={[0.04, 8, 8]} />
        <meshStandardMaterial color="#ffd0d8" emissive="#ff5a78" emissiveIntensity={1.7} toneMapped={false} />
      </instancedMesh>
      <instancedMesh ref={electrons} args={[undefined, undefined, 6]} frustumCulled={false}>
        <sphereGeometry args={[0.035, 8, 8]} />
        <meshStandardMaterial color="#d7ecff" emissive="#7eb6ff" emissiveIntensity={1.8} toneMapped={false} />
      </instancedMesh>
    </group>
  );
}

function useMemoCarrier() {
  const dummy = useRef(new THREE.Object3D());
  return dummy.current;
}

function Doped({ x, y, on, color, label }: { x: number; y: number; on: boolean; color: string; label: string }) {
  return (
    <group position={[x, y, 0.08]}>
      <mesh position={[-0.22, 0, 0]}>
        <boxGeometry args={[0.18, 0.16, 0.08]} />
        <meshStandardMaterial color={color} emissive={on ? color : '#000'} emissiveIntensity={on ? 0.35 : 0} />
      </mesh>
      <mesh position={[0.22, 0, 0]}>
        <boxGeometry args={[0.18, 0.16, 0.08]} />
        <meshStandardMaterial color={color} emissive={on ? color : '#000'} emissiveIntensity={on ? 0.35 : 0} />
      </mesh>
      <mesh position={[0, 0.07, 0.02]}>
        <boxGeometry args={[0.62, 0.02, 0.04]} />
        <meshStandardMaterial color="#d9dde2" metalness={0.85} roughness={0.2} />
      </mesh>
      <Sign text={label} position={[0.55, 0, 0]} factor={6} />
    </group>
  );
}

function Poly({ x, y, on, name }: { x: number; y: number; on: boolean; name: string }) {
  return (
    <group position={[x, y, 0.16]}>
      <mesh>
        <boxGeometry args={[0.5, 0.05, 0.06]} />
        <meshStandardMaterial color="#6a5a42" metalness={0.2} roughness={0.45} />
      </mesh>
      <mesh position={[0, -0.04, 0]}>
        <boxGeometry args={[0.16, 0.02, 0.05]} />
        <meshStandardMaterial color="#d7e7ff" transparent opacity={0.8} />
      </mesh>
      <mesh position={[-0.18, -0.02, 0]}>
        <boxGeometry args={[0.05, 0.08, 0.05]} />
        <meshStandardMaterial color="#efe6d4" roughness={0.4} />
      </mesh>
      <mesh position={[0.18, -0.02, 0]}>
        <boxGeometry args={[0.05, 0.08, 0.05]} />
        <meshStandardMaterial color="#efe6d4" roughness={0.4} />
      </mesh>
      <Sign text={`${name} ${on ? '导通' : '截止'}`} position={[0, 0.22, 0]} factor={4.8} />
    </group>
  );
}

function Channel({ x, y }: { x: number; y: number }) {
  return (
    <mesh position={[x, y, 0.1]}>
      <boxGeometry args={[0.28, 0.04, 0.02]} />
      <meshStandardMaterial color="#fff1c2" emissive="#ffb020" emissiveIntensity={1.6} toneMapped={false} />
    </mesh>
  );
}

