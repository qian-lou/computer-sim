import { Clickable, Sign, Wire } from '../parts';
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
        const x = (bit.index - 3.5) * 0.95;
        return (
          <group key={bit.index}>
            <Clickable onClick={() => onOpenBit(bit.index)}>
              <mesh position={[x, 0.28, 0]}>
                <boxGeometry args={[0.72, 0.5, 0.7]} />
                <meshStandardMaterial
                  color={bit.cout ? '#e7b15a' : '#3d6b8a'}
                  emissive={bit.cout ? '#f0b429' : '#000'}
                  emissiveIntensity={bit.cout ? 0.4 : 0}
                />
              </mesh>
              <Sign text={`FA${bit.index}  S${bit.sum}`} position={[x, 0.72, 0]} factor={4.2} />
            </Clickable>
            {bit.index < 7 && (
              <Wire
                a={[x + 0.36, 0.4, 0]}
                b={[x + 0.58, 0.4, 0]}
                on={bit.cout === 1}
              />
            )}
          </group>
        );
      })}
      <Sign text="低位 → 高位，进位沿黄线传递" position={[0, 0.2, 0.85]} factor={8} />
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
      <Sign text={`第 ${bitIndex} 位`} position={[0, 1.15, 1.2]} factor={6} />
    </group>
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

function Gate({ name, title, at, on }: { name: string; title: string; at: [number, number, number]; on: boolean }) {
  const color = name === 'AND' ? '#3d8f5a' : name === 'OR' ? '#3d6b8a' : '#7a5ea8';
  return (
    <group position={at}>
      <mesh>
        <boxGeometry args={[0.55, 0.42, 0.7]} />
        <meshStandardMaterial color={color} emissive={on ? '#f0b429' : '#000'} emissiveIntensity={on ? 0.35 : 0} />
      </mesh>
      {name === 'XOR' && (
        <mesh position={[-0.32, 0, 0]}>
          <boxGeometry args={[0.06, 0.36, 0.62]} />
          <meshStandardMaterial color="#efe6ff" />
        </mesh>
      )}
      <Sign text={title} position={[0, 0.4, 0]} factor={4.2} />
    </group>
  );
}

export function CmosLevel({ a, b }: { a: Bit; b: Bit }) {
  const gate = cmosNand(a, b);
  return (
    <group>
      <Rail y={1.7} label="Vdd" color="#c45c4a" />
      <Rail y={-1.45} label="GND" color="#22262c" />
      <Transistor kind="PMOS" on={gate.pmosA} position={[-0.55, 1.05, 0]} />
      <Transistor kind="PMOS" on={gate.pmosB} position={[0.55, 1.05, 0]} />
      <Transistor kind="NMOS" on={gate.nmosA} position={[0, 0.15, 0]} />
      <Transistor kind="NMOS" on={gate.nmosB} position={[0, -0.7, 0]} />
      <Wire a={[0, 1.7, 0]} b={[-0.55, 1.35, 0]} on={gate.pmosA} />
      <Wire a={[0, 1.7, 0]} b={[0.55, 1.35, 0]} on={gate.pmosB} />
      <Wire a={[-0.55, 0.75, 0]} b={[0, 0.45, 0]} on={gate.pmosA || gate.pmosB} />
      <Wire a={[0.55, 0.75, 0]} b={[0, 0.45, 0]} on={gate.pmosA || gate.pmosB} />
      <Wire a={[0, 0.45, 0]} b={[0, -0.05, 0]} on={gate.nmosA && gate.nmosB} />
      <Wire a={[0, -0.35, 0]} b={[0, -0.5, 0]} on={gate.nmosA && gate.nmosB} />
      <Wire a={[0, -1.0, 0]} b={[0, -1.45, 0]} on={gate.nmosA && gate.nmosB} />
      <LampOut value={gate.output} />
      <Sign text={`A = ${a}`} position={[-1.5, 0.7, 0]} factor={5} />
      <Sign text={`B = ${b}`} position={[-1.5, -0.2, 0]} factor={5} />
      <Sign text="与非门 · 输出在右边" position={[0, 2.15, 0]} factor={6} />
    </group>
  );
}

function Rail({ y, label, color }: { y: number; label: string; color: string }) {
  return (
    <group position={[0, y, 0]}>
      <mesh>
        <boxGeometry args={[2.4, 0.08, 0.16]} />
        <meshStandardMaterial color={color} emissive={color} emissiveIntensity={0.25} metalness={0.4} roughness={0.4} />
      </mesh>
      <Sign text={label} position={[1.45, 0, 0]} factor={5} />
    </group>
  );
}

function Transistor({ kind, on, position }: { kind: 'PMOS' | 'NMOS'; on: boolean; position: [number, number, number] }) {
  const body = kind === 'PMOS' ? '#6a4a78' : '#2f6b4a';
  return (
    <group position={position}>
      <mesh>
        <boxGeometry args={[0.55, 0.18, 0.45]} />
        <meshStandardMaterial color="#8d939b" metalness={0.55} roughness={0.35} />
      </mesh>
      <mesh position={[0, 0.12, 0]}>
        <boxGeometry args={[0.7, 0.06, 0.12]} />
        <meshStandardMaterial color={on ? '#ffe08a' : body} emissive={on ? '#ffb020' : '#000'} emissiveIntensity={on ? 0.9 : 0} />
      </mesh>
      <mesh position={[0, 0, 0.18]}>
        <boxGeometry args={[0.22, 0.1, 0.08]} />
        <meshStandardMaterial color={body} />
      </mesh>
      <Sign text={`${kind} ${on ? '导通' : '截止'}`} position={[0, 0.38, 0]} factor={4} />
    </group>
  );
}

function LampOut({ value }: { value: Bit }) {
  const on = value === 1;
  return (
    <group position={[1.55, 0.4, 0]}>
      <mesh>
        <sphereGeometry args={[0.16, 16, 16]} />
        <meshStandardMaterial color={on ? '#ffe08a' : '#66707a'} emissive={on ? '#ffb020' : '#000'} emissiveIntensity={on ? 1.2 : 0} />
      </mesh>
      <Sign text={`输出 ${value}`} position={[0, 0.4, 0]} factor={4.5} />
    </group>
  );
}
