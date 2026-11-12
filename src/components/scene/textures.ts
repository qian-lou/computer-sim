import * as THREE from 'three';

function rng(seed: number) {
  return () => {
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Solder mask, copper, vias and silkscreen. Generated locally so it never depends on a network. */
export function makePcbTexture(): THREE.CanvasTexture {
  const canvas = document.createElement('canvas');
  canvas.width = 1024;
  canvas.height = 1024;
  const g = canvas.getContext('2d');
  if (!g) return new THREE.CanvasTexture(canvas);
  g.fillStyle = '#14683a';
  g.fillRect(0, 0, 1024, 1024);
  g.fillStyle = '#18743f';
  for (let y = 0; y < 1024; y += 8) g.fillRect(0, y, 1024, 3);

  const random = rng(42);
  g.strokeStyle = '#c9863a';
  g.lineWidth = 10;
  g.lineCap = 'square';
  g.globalAlpha = 0.95;
  for (let i = 0; i < 46; i += 1) {
    const x = 40 + random() * 940;
    const y = 40 + random() * 940;
    const dx = (random() > 0.5 ? 1 : -1) * (80 + random() * 220);
    const dy = (random() > 0.5 ? 1 : -1) * (60 + random() * 160);
    g.beginPath();
    g.moveTo(x, y);
    g.lineTo(x + dx, y);
    g.lineTo(x + dx, y + dy);
    g.stroke();
  }
  g.globalAlpha = 1;
  g.strokeStyle = '#f0d48a';
  g.lineWidth = 3;
  for (let i = 0; i < 70; i += 1) {
    const x = 20 + random() * 980;
    const y = 20 + random() * 980;
    g.beginPath();
    g.arc(x, y, 4.5, 0, Math.PI * 2);
    g.stroke();
    g.fillStyle = '#1a1a1a';
    g.beginPath();
    g.arc(x, y, 1.6, 0, Math.PI * 2);
    g.fill();
  }
  g.fillStyle = 'rgba(255,255,255,0.82)';
  g.font = 'bold 28px sans-serif';
  g.fillText('COMPUTER-SIM', 48, 70);
  g.font = '18px sans-serif';
  g.fillText('U1  CPU', 80, 220);
  g.fillText('DIMM', 430, 160);
  g.fillText('PCIe x16', 700, 520);
  g.fillText('VRM', 80, 820);
  g.fillText('J_ATX', 760, 900);

  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.anisotropy = 8;
  texture.needsUpdate = true;
  return texture;
}

/** Repeating cells and metal routes, in the style of a microscope photo of a die. */
export function makeDieTexture(): THREE.CanvasTexture {
  const canvas = document.createElement('canvas');
  canvas.width = 1024;
  canvas.height = 768;
  const g = canvas.getContext('2d');
  if (!g) return new THREE.CanvasTexture(canvas);
  g.fillStyle = '#10182a';
  g.fillRect(0, 0, 1024, 768);

  const cell = (x: number, y: number, w: number, h: number, step: number, color: string) => {
    g.fillStyle = color;
    for (let iy = y; iy < y + h; iy += step) {
      for (let ix = x; ix < x + w; ix += step) g.fillRect(ix, iy, step - 1, step - 1);
    }
  };
  cell(40, 40, 280, 220, 6, '#1d4d86');
  cell(360, 30, 300, 250, 5, '#8a5a32');
  cell(700, 40, 270, 200, 4, '#2a6b4a');
  cell(60, 340, 620, 360, 7, '#243044');
  cell(720, 300, 250, 400, 4, '#3a2a55');

  g.strokeStyle = 'rgba(210, 216, 224, 0.55)';
  g.lineWidth = 2;
  for (let y = 80; y < 700; y += 28) {
    g.beginPath();
    g.moveTo(30, y);
    g.lineTo(990, y + ((y / 28) % 2) * 10);
    g.stroke();
  }
  g.strokeStyle = 'rgba(212, 168, 74, 0.45)';
  for (let x = 60; x < 980; x += 36) {
    g.beginPath();
    g.moveTo(x, 20);
    g.lineTo(x + 8, 740);
    g.stroke();
  }

  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.anisotropy = 8;
  texture.needsUpdate = true;
  return texture;
}
