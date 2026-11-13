import * as THREE from 'three';

function rng(seed: number) {
  return () => {
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function finish(canvas: HTMLCanvasElement, colorSpace: THREE.ColorSpace) {
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = colorSpace;
  texture.anisotropy = 8;
  texture.needsUpdate = true;
  return texture;
}

type TraceMode = 'color' | 'rough' | 'normal';

/** Same seeded routes painted three ways: albedo, roughness, and a bevel-like normal. */
function paintBoard(mode: TraceMode) {
  const size = 2048;
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const g = canvas.getContext('2d');
  if (!g) return canvas;
  const random = rng(11);
  if (mode === 'color') {
    g.fillStyle = '#0c6436';
    g.fillRect(0, 0, size, size);
    g.fillStyle = '#11743e';
    for (let y = 0; y < size; y += 5) g.fillRect(0, y, size, 2);
    g.globalAlpha = 0.28;
    g.fillStyle = '#083e22';
    g.fillRect(120, 160, 820, 640);
    g.fillRect(1080, 900, 760, 900);
    g.globalAlpha = 1;
  } else if (mode === 'rough') {
    g.fillStyle = '#b4b4b4';
    g.fillRect(0, 0, size, size);
  } else {
    g.fillStyle = '#8080ff';
    g.fillRect(0, 0, size, size);
  }

  const stroke = (color: string, width: number) => {
    g.strokeStyle = color;
    g.lineWidth = width;
    g.lineCap = 'square';
    g.lineJoin = 'miter';
  };

  for (let i = 0; i < 220; i += 1) {
    const x = random() * size;
    const y = random() * size;
    const len = 90 + random() * 520;
    const jog = (random() - 0.5) * 280;
    const pair = random() > 0.5;
    const horizontal = random() > 0.45;
    const copper = random() > 0.82;
    if (mode === 'color') stroke(copper ? '#e6c56a' : '#c47832', copper ? 7 : random() > 0.7 ? 5 : 3);
    else if (mode === 'rough') stroke('#2a2a2a', random() > 0.7 ? 6 : 4);
    else stroke(horizontal ? '#c878ff' : '#78b0ff', 5);
    g.beginPath();
    g.moveTo(x, y);
    if (horizontal) {
      g.lineTo(x + len, y);
      g.lineTo(x + len, y + jog);
    } else {
      g.lineTo(x, y + len);
      g.lineTo(x + jog, y + len);
    }
    g.stroke();
    if (pair) {
      const offset = 8;
      if (mode === 'normal') stroke('#ff9860', 3);
      g.beginPath();
      g.moveTo(x + (horizontal ? 0 : offset), y + (horizontal ? offset : 0));
      if (horizontal) {
        g.lineTo(x + len, y + offset);
        g.lineTo(x + len, y + jog + offset);
      } else {
        g.lineTo(x + offset, y + len);
        g.lineTo(x + jog + offset, y + len);
      }
      g.stroke();
    }
  }

  if (mode === 'color') stroke('#d4893c', 3);
  else if (mode === 'rough') stroke('#242424', 4);
  else stroke('#e0a0ff', 3);
  for (let s = 0; s < 10; s += 1) {
    const x0 = 160 + random() * 1600;
    const y0 = 180 + random() * 1600;
    g.beginPath();
    g.moveTo(x0, y0);
    for (let k = 0; k < 16; k += 1) {
      const dir = k % 2 === 0 ? 1 : -1;
      g.lineTo(x0 + dir * (50 + random() * 40), y0 + k * 16);
    }
    g.stroke();
  }

  for (let i = 0; i < 520; i += 1) {
    const x = 20 + random() * (size - 40);
    const y = 20 + random() * (size - 40);
    const radius = random() > 0.8 ? 9 : 6;
    if (mode === 'color') {
      g.strokeStyle = '#f2d48a';
      g.lineWidth = 2.5;
      g.beginPath();
      g.arc(x, y, radius, 0, Math.PI * 2);
      g.stroke();
      g.fillStyle = '#101010';
      g.beginPath();
      g.arc(x, y, 2.2, 0, Math.PI * 2);
      g.fill();
    } else if (mode === 'rough') {
      g.fillStyle = '#1a1a1a';
      g.beginPath();
      g.arc(x, y, radius, 0, Math.PI * 2);
      g.fill();
    } else {
      g.strokeStyle = '#ffffff';
      g.lineWidth = 2;
      g.beginPath();
      g.arc(x, y, radius, 0, Math.PI * 2);
      g.stroke();
    }
  }

  if (mode === 'color') {
    g.fillStyle = 'rgba(255,255,255,0.9)';
    g.font = 'bold 46px sans-serif';
    g.fillText('COMPUTER-SIM  REV B', 78, 96);
    g.font = '30px sans-serif';
    g.fillText('U1  LGA CPU', 150, 340);
    g.fillText('DIMM1', 1320, 280);
    g.fillText('DIMM2', 1320, 520);
    g.fillText('PCIe x16', 1180, 1280);
    g.fillText('VRM', 160, 1760);
    g.fillText('J_ATX', 1560, 1880);
    g.strokeStyle = 'rgba(255,255,255,0.75)';
    g.lineWidth = 4;
    g.strokeRect(36, 36, size - 72, size - 72);
  }
  return canvas;
}

export function makePcbMaps() {
  return {
    map: finish(paintBoard('color'), THREE.SRGBColorSpace),
    roughnessMap: finish(paintBoard('rough'), THREE.NoColorSpace),
    normalMap: finish(paintBoard('normal'), THREE.NoColorSpace),
  };
}

/** Interference-colored metal and SRAM, in the style of a microscope die photo. */
export function makeDieTexture() {
  const canvas = document.createElement('canvas');
  canvas.width = 2048;
  canvas.height = 1536;
  const g = canvas.getContext('2d');
  if (!g) return finish(canvas, THREE.SRGBColorSpace);
  g.fillStyle = '#070b14';
  g.fillRect(0, 0, 2048, 1536);

  const cells = (x: number, y: number, w: number, h: number, step: number, a: string, b: string) => {
    for (let iy = y; iy < y + h; iy += step) {
      for (let ix = x; ix < x + w; ix += step) {
        g.fillStyle = (ix / step + iy / step) % 2 === 0 ? a : b;
        g.fillRect(ix, iy, step - 1, step - 1);
      }
    }
  };
  cells(70, 70, 620, 480, 4, '#143e72', '#3a2158');
  cells(760, 60, 560, 520, 3, '#6a4020', '#24180e');
  cells(1400, 80, 540, 420, 4, '#1a5a40', '#102818');
  cells(80, 640, 900, 760, 5, '#1a2744', '#101828');
  cells(1060, 680, 860, 700, 3, '#4a3068', '#1a1428');

  g.globalAlpha = 0.85;
  g.strokeStyle = '#d7b15a';
  g.lineWidth = 2;
  for (let y = 40; y < 1500; y += 14) {
    g.beginPath();
    g.moveTo(24, y);
    g.lineTo(2020, y + ((y / 14) % 3) * 2);
    g.stroke();
  }
  g.strokeStyle = '#7ec8ff';
  for (let x = 30; x < 2020; x += 18) {
    g.beginPath();
    g.moveTo(x, 20);
    g.lineTo(x + 6, 1510);
    g.stroke();
  }
  g.strokeStyle = '#ff7aa2';
  g.lineWidth = 3;
  for (let i = 0; i < 28; i += 1) {
    const y = 80 + i * 50;
    g.beginPath();
    g.moveTo(40, y);
    g.lineTo(700, y);
    g.lineTo(700, y + 24);
    g.lineTo(1400, y + 24);
    g.stroke();
  }
  g.globalAlpha = 1;

  g.fillStyle = '#e6c56a';
  for (let i = 0; i < 46; i += 1) {
    g.fillRect(28 + i * 43, 18, 22, 16);
    g.fillRect(28 + i * 43, 1500, 22, 16);
  }
  for (let i = 0; i < 32; i += 1) {
    g.fillRect(18, 40 + i * 46, 16, 22);
    g.fillRect(2010, 40 + i * 46, 16, 22);
  }
  return finish(canvas, THREE.SRGBColorSpace);
}

export function makeWoodTexture() {
  const canvas = document.createElement('canvas');
  canvas.width = 1024;
  canvas.height = 1024;
  const g = canvas.getContext('2d');
  if (!g) return finish(canvas, THREE.SRGBColorSpace);
  g.fillStyle = '#5c4030';
  g.fillRect(0, 0, 1024, 1024);
  const random = rng(3);
  for (let x = 0; x < 1024; x += 2) {
    const shade = 70 + Math.floor(random() * 50);
    g.strokeStyle = `rgb(${shade + 40},${shade},${shade - 20})`;
    g.lineWidth = 2;
    g.beginPath();
    g.moveTo(x, 0);
    g.bezierCurveTo(x + 12, 300, x - 16, 700, x + 4, 1024);
    g.stroke();
  }
  return finish(canvas, THREE.SRGBColorSpace);
}

export function makeBackdropTexture() {
  const canvas = document.createElement('canvas');
  canvas.width = 16;
  canvas.height = 512;
  const g = canvas.getContext('2d');
  if (!g) return finish(canvas, THREE.SRGBColorSpace);
  const gradient = g.createLinearGradient(0, 0, 0, 512);
  gradient.addColorStop(0, '#6d7886');
  gradient.addColorStop(0.45, '#3c4654');
  gradient.addColorStop(1, '#1a1e26');
  g.fillStyle = gradient;
  g.fillRect(0, 0, 16, 512);
  return finish(canvas, THREE.SRGBColorSpace);
}

export function makeVentTexture() {
  const canvas = document.createElement('canvas');
  canvas.width = 512;
  canvas.height = 512;
  const g = canvas.getContext('2d');
  if (!g) return finish(canvas, THREE.SRGBColorSpace);
  g.fillStyle = '#ffffff';
  g.fillRect(0, 0, 512, 512);
  g.globalCompositeOperation = 'destination-out';
  g.fillStyle = '#000';
  for (let y = 16; y < 500; y += 22) {
    for (let x = 16; x < 500; x += 22) {
      g.beginPath();
      g.arc(x, y, 6, 0, Math.PI * 2);
      g.fill();
    }
  }
  const texture = finish(canvas, THREE.SRGBColorSpace);
  texture.wrapS = THREE.RepeatWrapping;
  texture.wrapT = THREE.RepeatWrapping;
  return texture;
}

export function drawScreen(texture: THREE.CanvasTexture, lines: string[]) {
  const canvas = texture.image as HTMLCanvasElement;
  const g = canvas.getContext('2d');
  if (!g) return;
  g.fillStyle = '#071018';
  g.fillRect(0, 0, canvas.width, canvas.height);
  g.fillStyle = '#123';
  g.fillRect(0, 0, canvas.width, 70);
  g.fillStyle = '#9ee0c2';
  g.font = 'bold 36px sans-serif';
  g.fillText('COMPUTER-SIM', 36, 48);
  g.font = '28px ui-monospace, monospace';
  g.fillStyle = '#d5e6dc';
  lines.forEach((line, index) => {
    g.fillStyle = index === 0 ? '#f0d48a' : '#d5e6dc';
    g.fillText(line, 36, 130 + index * 42);
  });
  texture.needsUpdate = true;
}

export function makeScreenTexture() {
  const canvas = document.createElement('canvas');
  canvas.width = 1024;
  canvas.height = 640;
  return finish(canvas, THREE.SRGBColorSpace);
}
