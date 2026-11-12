import { Html } from '@react-three/drei';
import { useFrame, useThree } from '@react-three/fiber';
import { useEffect, useMemo, useRef, type ReactNode } from 'react';
import * as THREE from 'three';

export function Sign({
  text,
  position,
  factor = 8,
}: {
  text: string;
  position: [number, number, number];
  factor?: number;
}) {
  return (
    <Html
      center
      position={position}
      distanceFactor={factor > 12 ? 5.5 : factor}
      zIndexRange={[2, 0]}
      style={{ pointerEvents: 'none' }}
    >
      <div className="die-tag">
        <b>{text}</b>
      </div>
    </Html>
  );
}

export function Clickable({ onClick, children }: { onClick?: () => void; children: ReactNode }) {
  const gl = useThree((state) => state.gl);
  if (!onClick) return <group>{children}</group>;
  return (
    <group
      onClick={(event) => {
        event.stopPropagation();
        onClick();
      }}
      onPointerOver={(event) => {
        event.stopPropagation();
        gl.domElement.style.cursor = 'pointer';
      }}
      onPointerOut={() => {
        gl.domElement.style.cursor = 'auto';
      }}
    >
      {children}
    </group>
  );
}

export function PcbTrace({
  from,
  to,
  y = 0.16,
  color,
  hot,
}: {
  from: [number, number];
  to: [number, number];
  y?: number;
  color: string;
  hot: boolean;
}) {
  const dx = to[0] - from[0];
  const dz = to[1] - from[1];
  const length = Math.hypot(dx, dz) || 0.001;
  const angle = Math.atan2(dz, dx);
  return (
    <mesh position={[(from[0] + to[0]) / 2, y, (from[1] + to[1]) / 2]} rotation={[0, -angle, 0]}>
      <boxGeometry args={[length, 0.02, hot ? 0.07 : 0.04]} />
      <meshStandardMaterial color={color} emissive={color} emissiveIntensity={hot ? 1.15 : 0.22} toneMapped={!hot} />
    </mesh>
  );
}

export function Wire({
  a,
  b,
  on,
  radius = 0.03,
}: {
  a: [number, number, number];
  b: [number, number, number];
  on: boolean;
  radius?: number;
}) {
  const geometry = useMemo(() => {
    const curve = new THREE.CatmullRomCurve3([
      new THREE.Vector3(...a),
      new THREE.Vector3((a[0] + b[0]) / 2, (a[1] + b[1]) / 2 + 0.04, (a[2] + b[2]) / 2),
      new THREE.Vector3(...b),
    ]);
    return new THREE.TubeGeometry(curve, 8, radius, 6, false);
  }, [a, b, radius]);
  useEffect(() => () => geometry.dispose(), [geometry]);
  const spark = useRef<THREE.Mesh>(null);
  useFrame(({ clock }) => {
    if (!spark.current) return;
    const t = on ? (clock.elapsedTime * 0.8) % 1 : 0;
    spark.current.position.set(
      a[0] + (b[0] - a[0]) * t,
      a[1] + (b[1] - a[1]) * t,
      a[2] + (b[2] - a[2]) * t,
    );
    spark.current.visible = on;
  });
  return (
    <group>
      <mesh geometry={geometry}>
        <meshStandardMaterial
          color={on ? '#ffe08a' : '#8b949e'}
          metalness={0.65}
          roughness={0.28}
          emissive={on ? '#ffb020' : '#000'}
          emissiveIntensity={on ? 0.7 : 0}
        />
      </mesh>
      <mesh position={a}>
        <sphereGeometry args={[radius * 2.1, 10, 10]} />
        <meshStandardMaterial color="#d5dbe3" metalness={0.85} roughness={0.2} />
      </mesh>
      <mesh position={b}>
        <sphereGeometry args={[radius * 2.1, 10, 10]} />
        <meshStandardMaterial color="#d5dbe3" metalness={0.85} roughness={0.2} />
      </mesh>
      <mesh ref={spark}>
        <sphereGeometry args={[radius * 1.6, 8, 8]} />
        <meshStandardMaterial color="#fff4d2" emissive="#ffb020" emissiveIntensity={2} toneMapped={false} />
      </mesh>
    </group>
  );
}

const gateCache = new Map<string, THREE.BufferGeometry>();

function shapeFor(kind: 'AND' | 'OR' | 'XOR' | 'NOT'): THREE.Shape {
  const shape = new THREE.Shape();
  if (kind === 'AND') {
    shape.moveTo(-0.32, -0.26);
    shape.lineTo(0.02, -0.26);
    shape.absarc(0.02, 0, 0.26, -Math.PI / 2, Math.PI / 2, false);
    shape.lineTo(-0.32, 0.26);
    shape.closePath();
    return shape;
  }
  if (kind === 'NOT') {
    shape.moveTo(-0.28, -0.24);
    shape.lineTo(0.22, 0);
    shape.lineTo(-0.28, 0.24);
    shape.closePath();
    return shape;
  }
  shape.moveTo(-0.34, -0.26);
  shape.quadraticCurveTo(0.05, -0.26, 0.32, 0);
  shape.quadraticCurveTo(0.05, 0.26, -0.34, 0.26);
  shape.quadraticCurveTo(-0.08, 0, -0.34, -0.26);
  return shape;
}

export function gateGeometry(kind: 'AND' | 'OR' | 'XOR' | 'NOT'): THREE.BufferGeometry {
  const cached = gateCache.get(kind);
  if (cached) return cached;
  const geometry = new THREE.ExtrudeGeometry(shapeFor(kind), {
    depth: 0.14,
    bevelEnabled: true,
    bevelThickness: 0.025,
    bevelSize: 0.02,
    bevelSegments: 2,
  });
  geometry.center();
  gateCache.set(kind, geometry);
  return geometry;
}

export function Packet({
  from,
  to,
  color,
  token,
  animMs,
}: {
  from: [number, number, number];
  to: [number, number, number];
  color: string;
  token: number;
  animMs: number;
}) {
  const mesh = useRef<THREE.Mesh>(null);
  const started = useRef(performance.now());
  const curve = useMemo(
    () =>
      new THREE.CatmullRomCurve3([
        new THREE.Vector3(...from),
        new THREE.Vector3((from[0] + to[0]) / 2, Math.max(from[1], to[1]) + 0.35, (from[2] + to[2]) / 2),
        new THREE.Vector3(...to),
      ]),
    [from, to],
  );
  useEffect(() => {
    started.current = performance.now();
  }, [token, from, to]);
  useFrame(() => {
    const t = Math.min(1, (performance.now() - started.current) / Math.max(animMs, 90));
    const eased = t < 0.5 ? 2 * t * t : 1 - ((-2 * t + 2) ** 2) / 2;
    mesh.current?.position.copy(curve.getPoint(eased));
  });
  return (
    <mesh ref={mesh}>
      <sphereGeometry args={[0.07, 14, 14]} />
      <meshStandardMaterial color={color} emissive={color} emissiveIntensity={2.2} toneMapped={false} />
    </mesh>
  );
}
