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
    <Html transform sprite distanceFactor={factor} center position={position} style={{ pointerEvents: 'none' }}>
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
    const curve = new THREE.LineCurve3(new THREE.Vector3(...a), new THREE.Vector3(...b));
    return new THREE.TubeGeometry(curve, 1, radius, 5, false);
  }, [a, b, radius]);
  useEffect(() => () => geometry.dispose(), [geometry]);
  return (
    <mesh geometry={geometry}>
      <meshStandardMaterial color={on ? '#ffe08a' : '#66707a'} emissive={on ? '#ffb020' : '#000'} emissiveIntensity={on ? 0.95 : 0} />
    </mesh>
  );
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
