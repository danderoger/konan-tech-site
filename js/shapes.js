/* Konan Tech 3.0: formas da "matéria inteligente".
   Cada função recebe a quantidade de partículas (n) e devolve:
   { pos: Float32Array(n*3), col: Float32Array(n*4), links?: Float32Array, opts }
   col guarda r, g, b e a força de cada ponto. No ambiente claro a força vira tinta;
   no escuro vira brilho. Cores pouco saturadas (tinta) viram prata no escuro.
   opts: spin, rotY, tiltX, tiltZ, swing, face, gain, noise (deriva orgânica), crisp (nitidez ao final),
         sweep (formação em varredura da esquerda para a direita), arc (curva no caminho da morfose).
   Para criar uma forma nova: escreva a função aqui e registre em SHAPES no fim do arquivo. */

export const PAL = {
  ink: 0x0b1f36,
  slate: 0x34506e,
  steel: 0xa6b8cc,
  ion: 0x258cf8,
  volt: 0x1f6fff,
  cyan: 0x2ccbf2,
  violet: 0x6a55f5
};

/* gerador pseudoaleatório com semente: as formas são sempre iguais */
export function rng(seed) {
  let s = seed >>> 0;
  return () => {
    s += 0x6d2b79f5;
    let t = s;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function gauss(r) {
  let u = 0, v = 0;
  while (u === 0) u = r();
  while (v === 0) v = r();
  return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v);
}

export function hexRgb(h) {
  return [((h >> 16) & 255) / 255, ((h >> 8) & 255) / 255, (h & 255) / 255];
}

export function mixHex(a, b, t) {
  const A = hexRgb(a), B = hexRgb(b);
  return [A[0] + (B[0] - A[0]) * t, A[1] + (B[1] - A[1]) * t, A[2] + (B[2] - A[2]) * t];
}

const C = Object.fromEntries(Object.entries(PAL).map(([k, v]) => [k, hexRgb(v)]));

export function makeBuf(n) {
  const pos = new Float32Array(n * 3);
  const col = new Float32Array(n * 4);
  let i = 0;
  return {
    pos, col,
    get i() { return i; },
    push(x, y, z, c, k) {
      if (i >= n) return false;
      pos[i * 3] = x; pos[i * 3 + 1] = y; pos[i * 3 + 2] = z;
      col[i * 4] = c[0]; col[i * 4 + 1] = c[1]; col[i * 4 + 2] = c[2]; col[i * 4 + 3] = k === undefined ? 1 : k;
      i++;
      return true;
    },
    full() { return i >= n; }
  };
}

function boxEdgePoint(r, cx, cy, cz, w, h, d) {
  const e = Math.floor(r() * 12), t = r();
  const x0 = cx - w / 2, x1 = cx + w / 2, y0 = cy - h / 2, y1 = cy + h / 2, z0 = cz - d / 2, z1 = cz + d / 2;
  const lx = x0 + (x1 - x0) * t, ly = y0 + (y1 - y0) * t, lz = z0 + (z1 - z0) * t;
  switch (e) {
    case 0: return [lx, y0, z0]; case 1: return [lx, y1, z0]; case 2: return [lx, y0, z1]; case 3: return [lx, y1, z1];
    case 4: return [x0, ly, z0]; case 5: return [x1, ly, z0]; case 6: return [x0, ly, z1]; case 7: return [x1, ly, z1];
    case 8: return [x0, y0, lz]; case 9: return [x1, y0, lz]; case 10: return [x0, y1, lz]; default: return [x1, y1, lz];
  }
}

function rectEdgePoint(r, cx, cy, w, h) {
  const per = 2 * (w + h);
  let d = r() * per;
  if (d < w) return [cx - w / 2 + d, cy + h / 2];
  d -= w;
  if (d < h) return [cx + w / 2, cy + h / 2 - d];
  d -= h;
  if (d < w) return [cx + w / 2 - d, cy - h / 2];
  d -= w;
  return [cx - w / 2, cy - h / 2 + d];
}

/* -------------------------------------------------------------------------- */
/* Logomarca oficial: uma partícula por pixel da arte, em ordem de pontilhado (Bayer),
   para a cobertura ficar uniforme mesmo com menos partículas. As partículas que sobram
   viram a espessura da marca (extrusão para trás), o que dá volume quando ela gira. */
const BAYER = [0, 8, 2, 10, 12, 4, 14, 6, 3, 11, 1, 9, 15, 7, 13, 5];
export const LOGO_W = 6.6;

export function logo(n, px) {
  if (!px || !px.data || !px.data.length) return { ...globe(n), opts: { face: true, gain: 0.55 } };
  const r = rng(11);
  const b = makeBuf(n);
  const d = px.data, cnt = d.length / 6;
  const key = new Float32Array(cnt);
  const idx = new Uint32Array(cnt);
  for (let k = 0; k < cnt; k++) { idx[k] = k; key[k] = BAYER[(d[k * 6 + 5] % 4) * 4 + (d[k * 6 + 4] % 4)] + r() * 0.95; }
  idx.sort((a, z) => key[a] - key[z]);
  const W = LOGO_W, cell = W / px.w;
  for (let k = 0; k < n; k++) {
    const j = idx[k % cnt] * 6;
    const layer = Math.floor(k / cnt);
    const x = (d[j] - 0.5) * W + (r() - 0.5) * cell * 0.9;
    const y = d[j + 1] * W + (r() - 0.5) * cell * 0.9;
    const z = layer === 0 ? (r() - 0.5) * 0.012 : -0.035 * layer - r() * 0.03;
    const lum = d[j + 2], blue = d[j + 3];
    let c;
    if (blue > 0.5) c = mixHex(PAL.volt, PAL.cyan, Math.min(1, Math.max(0, (lum - 0.35) * 1.4)));
    else c = mixHex(PAL.slate, PAL.ink, Math.min(1, Math.max(0, (lum - 0.42) / 0.5)));
    b.push(x, y, z, c, layer === 0 ? 1 : 0.5);
  }
  return { pos: b.pos, col: b.col, opts: { face: true, gain: 0.62, crisp: 1, sweep: 1, arc: 0.7 } };
}

/* Cena 1: dados soltos, nuvem sem ordem que flutua */
export function dust(n) {
  const r = rng(101);
  const b = makeBuf(n);
  while (!b.full()) {
    const u = r();
    const near = r() < 0.025;
    const z = near ? 2.4 + r() * 2.6 : gauss(r) * 1.5 - 0.3;
    b.push(gauss(r) * (near ? 2.6 : 2.2), gauss(r) * (near ? 1.6 : 1.3), z,
      u < 0.16 ? C.ion : u < 0.5 ? C.slate : C.steel, near ? 0.5 : 0.3 + r() * 0.65);
  }
  return { pos: b.pos, col: b.col, opts: { spin: 0.035, gain: 0.55, noise: 0.22, arc: 1.2 } };
}

/* Cena 2: rede neural tridimensional: neurônios brilhantes, conexões finas e sinais correndo */
export function neural(n) {
  const r = rng(201);
  const b = makeBuf(n);
  const K = 64;
  const N = [];
  for (let k = 0; k < K; k++) {
    let x, y, z;
    do { x = r() * 2 - 1; y = r() * 2 - 1; z = r() * 2 - 1; } while (x * x + y * y + z * z > 1);
    N.push([x * 3.3, y * 1.9, z * 1.7, 0.7 + r() * 0.9]);
  }
  const dist = (a, c) => Math.hypot(a[0] - c[0], a[1] - c[1], a[2] - c[2]);
  const E = [];
  const seen = new Set();
  for (let i = 0; i < K; i++) {
    const near = [];
    for (let j = 0; j < K; j++) if (j !== i) near.push([j, dist(N[i], N[j])]);
    near.sort((a, c) => a[1] - c[1]);
    const m = 2 + (r() < 0.45 ? 1 : 0);
    for (let q = 0; q < m; q++) {
      const j = near[q][0];
      const key = i < j ? i * 1000 + j : j * 1000 + i;
      if (!seen.has(key)) { seen.add(key); E.push([i, j, (r() - 0.5) * 0.45, (r() - 0.5) * 0.45]); }
    }
  }
  const curve = (e, t) => {
    const A = N[e[0]], B = N[e[1]];
    const s = Math.sin(t * Math.PI);
    return [A[0] + (B[0] - A[0]) * t, A[1] + (B[1] - A[1]) * t + s * e[2], A[2] + (B[2] - A[2]) * t + s * e[3]];
  };
  /* núcleos: pequenas esferas densas */
  while (b.i < n * 0.3) {
    const q = N[Math.floor(r() * K)];
    const s = 0.045 * q[3] + 0.03;
    const u = r() * 2 - 1, a = r() * Math.PI * 2, rr = Math.cbrt(r()) * s * 1.8, ss = Math.sqrt(1 - u * u);
    b.push(q[0] + Math.cos(a) * ss * rr, q[1] + u * rr, q[2] + Math.sin(a) * ss * rr, r() < 0.6 ? C.volt : C.cyan, 1.2);
  }
  /* conexões: linhas finas de pontos */
  while (b.i < n * 0.72) {
    const e = E[Math.floor(r() * E.length)];
    const p = curve(e, 0.06 + r() * 0.88);
    b.push(p[0] + gauss(r) * 0.006, p[1] + gauss(r) * 0.006, p[2] + gauss(r) * 0.006, r() < 0.82 ? C.ion : C.violet, 0.62);
  }
  /* dendritos: poeira fina em volta de cada neurônio */
  while (!b.full()) {
    const q = N[Math.floor(r() * K)];
    const a = r() * Math.PI * 2, u = r() * 2 - 1, s = Math.sqrt(1 - u * u), rr = 0.1 + Math.pow(r(), 1.6) * 0.42;
    b.push(q[0] + Math.cos(a) * s * rr, q[1] + u * rr, q[2] + Math.sin(a) * s * rr, r() < 0.5 ? C.steel : C.slate, 0.3);
  }
  const L = [];
  E.forEach((e) => { for (let k = 0; k < 6; k++) L.push(...curve(e, k / 6), ...curve(e, (k + 1) / 6)); });
  return { pos: b.pos, col: b.col, links: new Float32Array(L), opts: { spin: 0.09, tiltX: 0.14, gain: 0.55, noise: 0.02 } };
}

/* Cena 3: circuito, a rede vira trilhas organizadas por onde a informação corre */
export function circuit(n) {
  const r = rng(301);
  const b = makeBuf(n);
  const chips = [
    { x: -1.6, z: -0.2, w: 1.4, d: 1.0 },
    { x: 1.7, z: 0.5, w: 1.1, d: 1.1 },
    { x: 0.3, z: -1.5, w: 0.9, d: 0.6 }
  ];
  const traces = [];
  const snap = (v) => Math.round(v * 5) / 5;
  for (let k = 0; k < 34; k++) {
    const c = chips[k % 3];
    const side = Math.floor(r() * 4);
    const t = r() - 0.5;
    let x = c.x, z = c.z, dx = 0, dz = 0;
    if (side === 0) { x = c.x + t * c.w * 0.85; z = c.z - c.d / 2; dz = -1; }
    else if (side === 1) { x = c.x + t * c.w * 0.85; z = c.z + c.d / 2; dz = 1; }
    else if (side === 2) { x = c.x - c.w / 2; z = c.z + t * c.d * 0.85; dx = -1; }
    else { x = c.x + c.w / 2; z = c.z + t * c.d * 0.85; dx = 1; }
    x = snap(x); z = snap(z);
    const pts = [[x, z]];
    const l1 = 0.4 + r() * 1.2;
    x += dx * l1; z += dz * l1; pts.push([x, z]);
    const turn = r() < 0.5 ? 1 : -1;
    const ch = 0.3 + r() * 0.3;
    if (dx) { x += dx * ch; z += turn * ch; } else { z += dz * ch; x += turn * ch; }
    pts.push([x, z]);
    const l2 = 0.5 + r() * 1.8;
    if (dx) z += turn * l2; else x += turn * l2;
    x = Math.max(-4.3, Math.min(4.3, x)); z = Math.max(-2.4, Math.min(2.4, z));
    pts.push([x, z]);
    traces.push(pts);
  }
  const segs = [];
  traces.forEach((pts) => { for (let k = 0; k < pts.length - 1; k++) segs.push([pts[k], pts[k + 1], Math.hypot(pts[k + 1][0] - pts[k][0], pts[k + 1][1] - pts[k][1])]); });
  const total = segs.reduce((a, s) => a + s[2], 0);
  const pickSeg = () => { let v = r() * total; for (const s of segs) { v -= s[2]; if (v <= 0) return s; } return segs[0]; };
  while (b.i < n * 0.46) {
    const s = pickSeg(), t = r();
    b.push(s[0][0] + (s[1][0] - s[0][0]) * t + gauss(r) * 0.008, gauss(r) * 0.006, s[0][1] + (s[1][1] - s[0][1]) * t + gauss(r) * 0.008, r() < 0.7 ? C.ion : C.cyan, 0.85);
  }
  while (b.i < n * 0.58) {
    const pts = traces[Math.floor(r() * traces.length)];
    const p = pts[pts.length - 1];
    b.push(p[0] + (r() - 0.5) * 0.12, 0.01, p[1] + (r() - 0.5) * 0.12, C.ink, 1);
  }
  while (b.i < n * 0.8) {
    const c = chips[Math.floor(r() * 3)];
    if (r() < 0.5) {
      const p = boxEdgePoint(r, c.x, 0.06, c.z, c.w, 0.12, c.d);
      b.push(p[0], p[1], p[2], C.ink, 1.05);
    } else {
      const gx = Math.floor(r() * 6), gz = Math.floor(r() * 4);
      b.push(c.x - c.w * 0.35 + gx * c.w * 0.14 + (r() - 0.5) * 0.03, 0.125, c.z - c.d * 0.3 + gz * c.d * 0.2 + (r() - 0.5) * 0.03, r() < 0.3 ? C.violet : C.slate, 0.8);
    }
  }
  while (!b.full()) {
    const along = r() < 0.5;
    const gx = Math.round((r() * 8.6 - 4.3) * 2.5) / 2.5, gz = Math.round((r() * 4.8 - 2.4) * 2.5) / 2.5;
    b.push(along ? r() * 8.6 - 4.3 : gx, -0.02, along ? gz : r() * 4.8 - 2.4, C.steel, 0.28);
  }
  const L = [];
  segs.forEach((s) => L.push(s[0][0], 0, s[0][1], s[1][0], 0, s[1][1]));
  return { pos: b.pos, col: b.col, links: new Float32Array(L), opts: { tiltX: 0.95, rotY: 0.3, swing: 0.14, gain: 0.55, noise: 0.01 } };
}

/* Cena 4: interface em camadas, com indicadores, gráficos e cartões flutuando em profundidade */
export function iface(n) {
  const r = rng(401);
  const b = makeBuf(n);
  const W = 6.2, H = 3.7;
  const zM = 0;
  while (b.i < n * 0.12) { const e = rectEdgePoint(r, 0, 0, W, H); b.push(e[0], e[1], zM, C.ink, 1); }
  while (b.i < n * 0.15) { b.push(-W / 2 + r() * W, H / 2 - 0.34, zM, C.steel, 0.7); }
  while (b.i < n * 0.2) {
    const k = Math.floor(r() * 5);
    b.push(-W / 2 + 0.25 + r() * 0.62, H / 2 - 0.7 - k * 0.4, zM, k === 0 ? C.ion : C.slate, k === 0 ? 1.1 : 0.7);
  }
  const kx = [-1.45, -0.05, 1.35, 2.5];
  while (b.i < n * 0.36) {
    const k = Math.floor(r() * 4);
    if (r() < 0.55) { const e = rectEdgePoint(r, kx[k], 0.95, 1.15, 0.72); b.push(e[0], e[1], zM, C.slate, 0.75); }
    else { b.push(kx[k] - 0.42 + r() * (0.35 + k * 0.1), 1.02 + (r() < 0.55 ? 0.08 : -0.12), zM + 0.01, k === 1 ? C.ion : C.ink, 1.15); }
  }
  while (b.i < n * 0.5) {
    const t = r();
    const x = -2.0 + t * 2.6;
    const y = -1.45 + t * 1.25 + Math.sin(t * 8.5) * 0.16;
    if (r() < 0.75) b.push(x, y + gauss(r) * 0.01, zM + 0.01, C.volt, 1.1);
    else b.push(x, -1.45 + r() * (y + 1.45), zM, C.cyan, 0.32);
  }
  const bars = [0.5, 0.75, 0.62, 0.95, 0.85, 1.2, 1.05];
  while (b.i < n * 0.64) {
    const i = Math.floor(r() * bars.length);
    b.push(1.05 + i * 0.27 + (r() - 0.5) * 0.15, -1.5 + r() * bars[i], zM + 0.01, i === bars.length - 2 ? C.cyan : C.ion, 1);
  }
  /* cartão da frente: anel de meta */
  while (b.i < n * 0.76) {
    const zf = 1.05;
    if (r() < 0.35) { const e = rectEdgePoint(r, 2.55, -0.6, 1.3, 1.45); b.push(e[0], e[1], zf, C.ink, 0.9); }
    else {
      const a = r() * Math.PI * 2, frac = a / (Math.PI * 2), rr = 0.42 + gauss(r) * 0.018;
      b.push(2.55 + Math.cos(a) * rr, -0.55 + Math.sin(a) * rr, zf, frac < 0.72 ? C.volt : C.steel, frac < 0.72 ? 1.15 : 0.5);
    }
  }
  /* cartão da frente: aviso */
  while (b.i < n * 0.84) {
    const zf = 0.75;
    if (r() < 0.45) { const e = rectEdgePoint(r, -2.4, -1.35, 1.7, 0.62); b.push(e[0], e[1], zf, C.ink, 0.9); }
    else { const row = Math.floor(r() * 2); b.push(-3.0 + r() * (1.1 - row * 0.4), -1.25 - row * 0.2, zf, row ? C.slate : C.violet, 1); }
  }
  /* cartão de trás: tabela */
  while (b.i < n * 0.94) {
    const zb = -1.1;
    if (r() < 0.3) { const e = rectEdgePoint(r, -1.9, 1.75, 2.6, 1.3); b.push(e[0], e[1], zb, C.slate, 0.6); }
    else { const row = Math.floor(r() * 5); b.push(-3.0 + r() * 2.2, 2.2 - row * 0.22, zb, C.steel, 0.55); }
  }
  while (!b.full()) {
    const a = r() * Math.PI * 2, rr = 3.6 + r() * 1.2;
    b.push(Math.cos(a) * rr, Math.sin(a) * rr * 0.62, (r() - 0.5) * 2, C.steel, 0.22);
  }
  return { pos: b.pos, col: b.col, opts: { rotY: -0.36, tiltX: 0.1, swing: 0.2, gain: 0.55, noise: 0.012 } };
}

/* Cérebro: inteligência artificial */
export function brain(n) {
  const r = rng(31);
  const b = makeBuf(n);
  const surf = [];
  const hemi = (side) => {
    for (let tries = 0; tries < 40; tries++) {
      const u = r() * 2 - 1, th = r() * Math.PI * 2;
      const s = Math.sqrt(1 - u * u);
      const dx = s * Math.cos(th), dy = u, dz = s * Math.sin(th);
      const fold = 1 + 0.085 * Math.sin(9 * dz + 4 * dy) * Math.cos(7 * dy + 3 * dx) + 0.04 * Math.sin(17 * dx + 11 * dz);
      const x = side * 0.6 + dx * 0.98 * fold;
      let y = dy * 1.18 * fold;
      const z = dz * 1.68 * fold;
      if (x * side < 0.07) continue;
      if (y < -0.55) y = -0.55 + (y + 0.55) * 0.35;
      return [x, y + 0.15, z];
    }
    return [side * 0.9, 0.15, 0];
  };
  while (b.i < n * 0.78) {
    const side = r() < 0.5 ? -1 : 1;
    const p = hemi(side);
    surf.push(p);
    const t = (p[1] + 1.2) / 2.6;
    b.push(p[0], p[1], p[2], mixHex(PAL.ion, PAL.cyan, Math.min(1, Math.max(0, t))), 0.85 + r() * 0.35);
  }
  while (b.i < n * 0.88) {
    const a = r() * Math.PI * 2, u = r() * 2 - 1, s = Math.sqrt(1 - u * u);
    b.push(Math.cos(a) * s * 0.85, -0.78 + u * 0.32, -1.05 + Math.sin(a) * s * 0.55, C.ion, 0.9);
  }
  while (b.i < n * 0.91) {
    const t = r();
    b.push(gauss(r) * 0.09, -0.75 - t * 0.75, -0.45 - t * 0.3 + gauss(r) * 0.06, C.violet, 1.1);
  }
  while (!b.full()) {
    const p = surf[Math.floor(r() * surf.length)];
    const k = 0.3 + r() * 0.6;
    const cx = p[0] > 0 ? 0.6 : -0.6, cy = 0.15;
    b.push(cx + (p[0] - cx) * k, cy + (p[1] - cy) * k, p[2] * k, C.ink, 0.7);
  }
  const L = [];
  for (let k = 0; k < 520 && surf.length; k++) {
    const A = surf[Math.floor(r() * surf.length)];
    let best = null, bd = 9;
    for (let j = 0; j < 14; j++) {
      const B = surf[Math.floor(r() * surf.length)];
      const d = Math.hypot(A[0] - B[0], A[1] - B[1], A[2] - B[2]);
      if (d > 0.25 && d < bd && Math.sign(A[0]) === Math.sign(B[0])) { bd = d; best = B; }
    }
    if (best && bd < 0.95) L.push(...A, ...best);
  }
  return { pos: b.pos, col: b.col, links: new Float32Array(L), opts: { spin: 0.16, tiltX: 0.12, gain: 0.5, noise: 0.015 } };
}

/* Ondas: fitas de luz (no portfólio, a acústica da Caça Ruídos) */
export function streams(n) {
  const r = rng(41);
  const b = makeBuf(n);
  const K = 16;
  const S = [];
  for (let k = 0; k < K; k++) {
    S.push({ a: 0.25 + r() * 0.9, f: 0.35 + r() * 0.6, ph: r() * 6.28, yo: (k / (K - 1) - 0.5) * 2.6, zo: (r() - 0.5) * 2.2, g: 0.3 + r() * 0.5, c: k % 3 === 0 ? C.ink : k % 3 === 1 ? C.ion : C.cyan });
  }
  while (!b.full()) {
    const s = S[Math.floor(r() * K)];
    const x = -4.2 + r() * 8.4;
    const pinch = Math.cos((x / 4.2) * Math.PI * 0.5);
    const y = (s.yo * pinch) + Math.sin(x * s.f + s.ph) * s.a * pinch;
    const z = s.zo * pinch + Math.cos(x * s.g + s.ph) * 0.5;
    const edge = 1 - Math.abs(x) / 4.2;
    b.push(x, y + gauss(r) * 0.025, z + gauss(r) * 0.025, s.c, 0.45 + edge * 0.8);
  }
  return { pos: b.pos, col: b.col, opts: { wave: 1, tiltX: 0.25, rotY: -0.35, gain: 0.5 } };
}

/* Painel 3D: barras, linha de tendência, anel e piso */
export function dashboard(n) {
  const r = rng(51);
  const b = makeBuf(n);
  const H = [1.1, 1.6, 1.35, 2.1, 1.8, 2.6, 2.3, 3.0, 2.75];
  const bx = (i) => -3 + i * 0.62;
  const base = -1.5;
  while (b.i < n * 0.5) {
    const i = Math.floor(r() * H.length);
    const p = boxEdgePoint(r, bx(i), base + H[i] / 2, 0, 0.34, H[i], 0.34);
    b.push(p[0], p[1], p[2], mixHex(PAL.ion, PAL.cyan, H[i] / 3), 0.95);
  }
  while (b.i < n * 0.6) {
    const i = Math.floor(r() * H.length);
    b.push(bx(i) + (r() - 0.5) * 0.3, base + r() * H[i], (r() - 0.5) * 0.3, C.violet, 1.2);
  }
  while (b.i < n * 0.72) {
    const t = r() * (H.length - 1);
    const i = Math.floor(t), f = t - i;
    const y = base + H[i] + (H[Math.min(i + 1, H.length - 1)] - H[i]) * f + 0.45;
    b.push(bx(0) + t * 0.62, y + gauss(r) * 0.015, 0.6, C.ink, 1.1);
  }
  while (b.i < n * 0.84) {
    const a = r() * Math.PI * 2;
    const frac = a / (Math.PI * 2);
    const rr = 0.85 + gauss(r) * 0.04;
    b.push(3.1 + Math.cos(a) * rr * 0.2, 1.2 + Math.sin(a) * rr, -0.4 + Math.cos(a) * rr, frac < 0.68 ? C.ion : C.steel, frac < 0.68 ? 1.1 : 0.6);
  }
  while (!b.full()) {
    const gx = Math.round((r() * 8 - 4) * 2.5) / 2.5, gz = Math.round((r() * 4 - 2) * 2.5) / 2.5;
    const along = r() < 0.5;
    b.push(along ? r() * 8 - 4 : gx, base - 0.02, along ? gz : r() * 4 - 2, C.steel, 0.45);
  }
  return { pos: b.pos, col: b.col, opts: { rotY: -0.45, swing: 0.35, tiltX: 0.22, gain: 0.55 } };
}

/* Cidade digital: torres em grade (no portfólio, as obras) */
export function city(n) {
  const r = rng(61);
  const b = makeBuf(n);
  const T = [];
  const G = 7;
  for (let i = 0; i < G; i++) for (let j = 0; j < G; j++) {
    const x = (i - (G - 1) / 2) * 0.72, z = (j - (G - 1) / 2) * 0.72;
    const d = Math.hypot(x, z);
    const h = Math.max(0.35, 3.4 * Math.exp(-d * d / 4.5) * (0.55 + r() * 0.7));
    if (r() < 0.86) T.push({ x, z, h, w: 0.28 + r() * 0.16 });
  }
  const base = -1.7;
  while (b.i < n * 0.62) {
    const t = T[Math.floor(r() * T.length)];
    const p = boxEdgePoint(r, t.x, base + t.h / 2, t.z, t.w, t.h, t.w);
    b.push(p[0], p[1], p[2], mixHex(PAL.slate, PAL.ion, r() * 0.6), 0.9);
  }
  while (b.i < n * 0.82) {
    const t = T[Math.floor(r() * T.length)];
    const face = Math.floor(r() * 4);
    const fy = base + Math.floor(r() * (t.h / 0.16)) * 0.16 + 0.08;
    const off = (Math.floor(r() * 3) - 1) * t.w * 0.28;
    const hw = t.w / 2;
    const pts = [[t.x + off, fy, t.z + hw], [t.x + off, fy, t.z - hw], [t.x + hw, fy, t.z + off], [t.x - hw, fy, t.z + off]];
    const p = pts[face];
    b.push(p[0], p[1], p[2], r() < 0.2 ? C.cyan : C.ion, r() < 0.2 ? 1.3 : 0.7);
  }
  while (!b.full()) {
    const a = r() * Math.PI * 2, rr = Math.sqrt(r()) * 3.6;
    const ring = Math.abs(Math.sin(rr * 3)) > 0.92;
    b.push(Math.cos(a) * rr, base, Math.sin(a) * rr, ring ? C.ion : C.steel, ring ? 0.9 : 0.35);
  }
  return { pos: b.pos, col: b.col, opts: { spin: 0.11, tiltX: 0.32, gain: 0.6 } };
}

/* Globo: presença digital, com meridianos, órbitas e pontos de acesso */
export function globe(n) {
  const r = rng(71);
  const b = makeBuf(n);
  const R = 2.0;
  const ns = Math.floor(n * 0.6);
  const ga = Math.PI * (3 - Math.sqrt(5));
  for (let k = 0; k < ns; k++) {
    const y = 1 - (k / (ns - 1)) * 2, rad = Math.sqrt(1 - y * y), th = ga * k;
    const lat = Math.abs(Math.sin(y * 9)) > 0.965;
    const lon = Math.abs(Math.sin(Math.atan2(Math.sin(th), Math.cos(th)) * 6)) > 0.985;
    b.push(Math.cos(th) * rad * R, y * R, Math.sin(th) * rad * R, lat || lon ? C.ion : mixHex(PAL.steel, PAL.slate, r() * 0.6), lat || lon ? 1.05 : 0.5);
  }
  const pins = [];
  for (let k = 0; k < 9; k++) { const u = r() * 1.6 - 0.8, a = r() * Math.PI * 2, s = Math.sqrt(1 - u * u); pins.push([Math.cos(a) * s * R, u * R, Math.sin(a) * s * R]); }
  while (b.i < n * 0.68) {
    const p = pins[Math.floor(r() * pins.length)];
    const s = 0.05;
    b.push(p[0] * 1.02 + gauss(r) * s, p[1] * 1.02 + gauss(r) * s, p[2] * 1.02 + gauss(r) * s, C.violet, 1.3);
  }
  const orbits = [[0.35, 0.2, 2.75], [-0.6, 0.9, 3.05], [1.1, -0.4, 2.5]];
  while (b.i < n * 0.95) {
    const o = orbits[Math.floor(r() * 3)];
    const a = r() * Math.PI * 2;
    let x = Math.cos(a) * o[2], y = 0, z = Math.sin(a) * o[2];
    const cy = Math.cos(o[0]), sy = Math.sin(o[0]);
    [y, z] = [y * cy - z * sy, y * sy + z * cy];
    const cz = Math.cos(o[1]), sz = Math.sin(o[1]);
    [x, y] = [x * cz - y * sz, x * sz + y * cz];
    b.push(x, y, z, mixHex(PAL.ion, PAL.cyan, r()), 0.8);
  }
  while (!b.full()) {
    const u = r() * 2 - 1, a = r() * Math.PI * 2, s = Math.sqrt(1 - u * u), rr = Math.pow(r(), 2) * 0.55;
    b.push(Math.cos(a) * s * rr * 1.6, u * rr * 1.6, Math.sin(a) * s * rr * 1.6, C.cyan, 0.32);
  }
  return { pos: b.pos, col: b.col, opts: { spin: 0.1, tiltX: 0.25, gain: 0.5 } };
}

/* Hélice dupla: o método, etapa por etapa */
export function helix(n) {
  const r = rng(81);
  const b = makeBuf(n);
  const turns = 3.2, Hh = 6, R = 1.05;
  while (b.i < n * 0.58) {
    const t = r();
    const s = r() < 0.5 ? 0 : Math.PI;
    const a = t * turns * Math.PI * 2 + s;
    b.push(Math.cos(a) * R + gauss(r) * 0.03, (t - 0.5) * Hh, Math.sin(a) * R + gauss(r) * 0.03, s ? C.ion : C.slate, 1);
  }
  const rungs = 34;
  while (b.i < n * 0.9) {
    const k = Math.floor(r() * rungs);
    const t = (k + 0.5) / rungs;
    const a = t * turns * Math.PI * 2;
    const f = r() * 2 - 1;
    b.push(Math.cos(a) * R * f, (t - 0.5) * Hh, Math.sin(a) * R * f, mixHex(PAL.violet, PAL.cyan, Math.abs(f)), 0.75);
  }
  while (!b.full()) {
    const t = r(), a = r() * Math.PI * 2, rr = 1.4 + r() * 1.2;
    b.push(Math.cos(a) * rr, (t - 0.5) * Hh * 1.1, Math.sin(a) * rr, C.steel, 0.35);
  }
  return { pos: b.pos, col: b.col, opts: { spin: 0.28, tiltX: 0.12, tiltZ: -0.22, gain: 0.5 } };
}

/* Redemoinho: os dados giram cada vez mais rápido antes de virar marca */
export function vortex(n) {
  const r = rng(91);
  const b = makeBuf(n);
  const arms = 3;
  while (b.i < n * 0.78) {
    const rr = 0.9 + Math.pow(r(), 1.6) * 3.6;
    const arm = Math.floor(r() * arms);
    const a = arm * (Math.PI * 2 / arms) + rr * 1.15 + gauss(r) * 0.22 * (rr / 3);
    const y = gauss(r) * 0.06 * (4.5 - rr) * 0.4;
    const t = (rr - 0.9) / 3.6;
    b.push(Math.cos(a) * rr, y, Math.sin(a) * rr, mixHex(PAL.cyan, PAL.violet, t), 0.75 - t * 0.3);
  }
  while (b.i < n * 0.93) {
    const a = r() * Math.PI * 2, rr = 0.82 + gauss(r) * 0.03;
    b.push(Math.cos(a) * rr, gauss(r) * 0.02, Math.sin(a) * rr, C.ink, 0.8);
  }
  while (!b.full()) {
    const a = r() * Math.PI * 2, rr = r() * 4.6;
    b.push(Math.cos(a) * rr, gauss(r) * 0.25, Math.sin(a) * rr, C.steel, 0.3);
  }
  return { pos: b.pos, col: b.col, opts: { spin: 0.22, tiltX: 1.05, gain: 0.5, arc: 1.4 } };
}

/* Caos: papéis, planilhas e mensagens soltas no espaço */
export function chaos(n) {
  const r = rng(111);
  const b = makeBuf(n);
  const D = [];
  for (let k = 0; k < 14; k++) {
    D.push({ x: (r() - 0.5) * 8, y: (r() - 0.5) * 4.2, z: (r() - 0.5) * 3, w: 0.6 + r() * 0.9, h: 0.8 + r() * 0.8, ax: (r() - 0.5) * 1.3, ay: (r() - 0.5) * 1.5, kind: k % 3 });
  }
  const rot = (p, d) => {
    let [x, y, z] = p;
    const ca = Math.cos(d.ax), sa = Math.sin(d.ax);
    [y, z] = [y * ca - z * sa, y * sa + z * ca];
    const cb = Math.cos(d.ay), sb = Math.sin(d.ay);
    [x, z] = [x * cb + z * sb, -x * sb + z * cb];
    return [x + d.x, y + d.y, z + d.z];
  };
  while (b.i < n * 0.86) {
    const d = D[Math.floor(r() * D.length)];
    let p;
    if (r() < 0.45) { const e = rectEdgePoint(r, 0, 0, d.w, d.h); p = [e[0], e[1], 0]; }
    else if (d.kind === 0) { const row = Math.floor(r() * 7); p = [(r() - 0.5) * d.w * 0.8, d.h / 2 - 0.15 - row * (d.h / 8), 0]; }
    else if (d.kind === 1) { const cx = Math.floor(r() * 4), cy = Math.floor(r() * 5); p = [-d.w / 2 + (cx + 0.5) * d.w / 4 + (r() - 0.5) * 0.03, -d.h / 2 + (cy + r()) * d.h / 5, 0]; }
    else { p = [(r() - 0.5) * d.w * 0.7, (r() - 0.5) * d.h * 0.7, 0]; }
    const q = rot(p, d);
    b.push(q[0], q[1], q[2], d.kind === 2 ? mixHex(PAL.steel, PAL.ion, 0.35) : C.steel, 0.55 + r() * 0.3);
  }
  while (!b.full()) b.push((r() - 0.5) * 9, (r() - 0.5) * 5, (r() - 0.5) * 4, C.steel, 0.3);
  return { pos: b.pos, col: b.col, opts: { spin: 0.03, gain: 0.55, noise: 0.06 } };
}

/* Ordem: o mesmo volume de dados organizado num painel único */
export function panel(n) {
  const r = rng(121);
  const b = makeBuf(n);
  const W = 7, H = 3.9;
  while (b.i < n * 0.14) { const e = rectEdgePoint(r, 0, 0, W, H); b.push(e[0], e[1], 0, C.slate, 0.8); }
  while (b.i < n * 0.2) b.push(-W / 2 + 0.2 + r() * 1.1, H / 2 - 0.3, 0, C.ink, 1.1);
  const kx = [-2.55, -0.85, 0.85, 2.55];
  while (b.i < n * 0.42) {
    const k = Math.floor(r() * 4);
    if (r() < 0.6) { const e = rectEdgePoint(r, kx[k], 1.05, 1.5, 0.85); b.push(e[0], e[1], 0, C.steel, 0.7); }
    else b.push(kx[k] - 0.55 + r() * (0.5 + k * 0.12), 1.0 + (r() < 0.5 ? 0.12 : -0.12) * Math.floor(r() * 2), 0.02, k === 1 ? C.ion : C.ink, 1.2);
  }
  const bars = [0.55, 0.8, 0.7, 1.05, 0.95, 1.3, 1.2, 1.6];
  while (b.i < n * 0.7) {
    const i = Math.floor(r() * bars.length);
    b.push(-3.05 + i * 0.5 + (r() - 0.5) * 0.28, -1.75 + r() * bars[i] * 1.25, 0.02, i === bars.length - 1 ? C.cyan : C.ion, 1);
  }
  while (b.i < n * 0.86) {
    const t = r();
    b.push(0.45 + t * 2.9, -1.6 + t * 1.6 + Math.sin(t * 9) * 0.18 + gauss(r) * 0.012, 0.02, C.ink, 0.85);
  }
  while (!b.full()) {
    const row = Math.floor(r() * 5);
    b.push(-3.25 + r() * 6.6, -1.75 + row * 0.42, -0.01, C.steel, 0.28);
  }
  return { pos: b.pos, col: b.col, opts: { face: true, gain: 0.6 } };
}

/* Piso de dados: malha ondulante */
export function terrain(n) {
  const r = rng(131);
  const b = makeBuf(n);
  const cols = Math.ceil(Math.sqrt(n * 1.8));
  const rows = Math.ceil(n / cols);
  for (let j = 0; j < rows && !b.full(); j++) for (let i = 0; i < cols && !b.full(); i++) {
    const x = (i / (cols - 1) - 0.5) * 18, z = -9 + (j / (rows - 1)) * 12;
    const fade = Math.min(1, (z + 9) / 4);
    const line = i % 9 === 0 || j % 9 === 0;
    b.push(x + (r() - 0.5) * 0.02, 0, z, line ? C.ion : C.steel, (line ? 0.9 : 0.45) * fade);
  }
  return { pos: b.pos, col: b.col, opts: { wave: 2.4, face: true, gain: 0.7 } };
}

/* Telas: notebook, tablet e celular com interfaces em montagem */
export function screens(n) {
  const r = rng(141);
  const b = makeBuf(n);
  const dev = [
    { x: -0.6, y: 0.25, z: -0.6, w: 3.6, h: 2.25, ry: 0.28 },
    { x: 2.15, y: -0.35, z: 0.6, w: 1.45, h: 1.95, ry: -0.35 },
    { x: -2.75, y: -0.6, z: 0.9, w: 0.9, h: 1.8, ry: 0.5 }
  ];
  const place = (d, px, py, pz) => {
    const c = Math.cos(d.ry), s = Math.sin(d.ry);
    return [d.x + px * c + pz * s, d.y + py, d.z - px * s + pz * c];
  };
  while (b.i < n * 0.3) {
    const d = dev[Math.floor(r() * 3)];
    const e = rectEdgePoint(r, 0, 0, d.w, d.h);
    const p = place(d, e[0], e[1], 0);
    b.push(p[0], p[1], p[2], C.slate, 0.9);
  }
  while (b.i < n * 0.36) {
    const d = dev[0];
    const t = r();
    const p = place(d, (r() - 0.5) * d.w * 1.08, -d.h / 2 - 0.05 - t * 0.12, t * 1.1);
    b.push(p[0], p[1], p[2], C.steel, 0.6);
  }
  while (!b.full()) {
    const d = dev[Math.floor(r() * 3)];
    const u = r();
    let px, py, c = C.ion, k = 0.9;
    if (u < 0.12) { px = (r() - 0.5) * d.w * 0.9; py = d.h / 2 - 0.12; c = C.steel; }
    else if (u < 0.45) { px = (r() - 0.5) * d.w * 0.8; py = d.h * 0.12 + (r() - 0.5) * d.h * 0.28; c = mixHex(PAL.violet, PAL.ion, r()); k = 1.2; }
    else if (u < 0.75) { const row = Math.floor(r() * 4); px = -d.w * 0.4 + r() * d.w * (0.5 + (row % 2) * 0.25); py = -d.h * 0.12 - row * d.h * 0.08; c = C.steel; k = 0.6; }
    else { px = -d.w * 0.4 + r() * d.w * 0.32; py = -d.h * 0.42; c = C.cyan; k = 1.3; }
    const p = place(d, px, py, 0.02);
    b.push(p[0], p[1], p[2], c, k);
  }
  return { pos: b.pos, col: b.col, opts: { swing: 0.25, tiltX: 0.08, gain: 0.45 } };
}

/* Módulos: blocos de um sistema sendo montados */
export function blocks(n) {
  const r = rng(151);
  const b = makeBuf(n);
  const Cc = [];
  for (let i = -1; i <= 1; i++) for (let j = -1; j <= 1; j++) for (let k = -1; k <= 1; k++) {
    if (r() < 0.82) Cc.push([i * 1.05, j * 1.05, k * 1.05, r() < 0.2]);
  }
  while (b.i < n * 0.7) {
    const c = Cc[Math.floor(r() * Cc.length)];
    const p = boxEdgePoint(r, c[0], c[1], c[2], 0.82, 0.82, 0.82);
    b.push(p[0], p[1], p[2], c[3] ? C.cyan : mixHex(PAL.slate, PAL.ion, 0.45), c[3] ? 1.25 : 0.9);
  }
  while (!b.full()) {
    const c = Cc[Math.floor(r() * Cc.length)];
    const f = Math.floor(r() * 6), u = (r() - 0.5) * 0.7, v = (r() - 0.5) * 0.7, h = 0.41;
    const p = [[h, u, v], [-h, u, v], [u, h, v], [u, -h, v], [u, v, h], [u, v, -h]][f];
    b.push(c[0] + p[0], c[1] + p[1], c[2] + p[2], c[3] ? C.ion : C.violet, c[3] ? 0.9 : 0.7);
  }
  return { pos: b.pos, col: b.col, opts: { spin: 0.2, tiltX: 0.55, tiltZ: 0.2, gain: 0.48 } };
}

/* Singularidade: todas as partículas num ponto, antes da abertura */
export function seed(n) {
  const r = rng(161);
  const b = makeBuf(n);
  while (!b.full()) {
    const a = r() * Math.PI * 2, u = r() * 2 - 1, s = Math.sqrt(1 - u * u), rr = Math.pow(r(), 3) * 0.12;
    b.push(Math.cos(a) * s * rr, u * rr, Math.sin(a) * s * rr, C.ink, 1.6);
  }
  return { pos: b.pos, col: b.col, opts: { gain: 0.3 } };
}

/* Fluxo de automação: etapas ligadas por canais, com pulsos correndo entre elas */
export function flow(n) {
  const r = rng(181);
  const b = makeBuf(n);
  const K = 7;
  const N = [];
  for (let i = 0; i < K; i++) {
    const t = i / (K - 1);
    N.push([-4 + t * 8, Math.sin(t * Math.PI * 1.6 + 0.4) * 1.05, Math.cos(t * Math.PI * 1.3) * 0.9]);
  }
  const E = [];
  for (let i = 0; i < K - 1; i++) E.push([N[i], N[i + 1], 1]);
  E.push([N[1], N[3], 0.5], [N[2], N[5], 0.5], [N[3], N[6], 0.4]);
  const f = (e, t) => [e[0][0] + (e[1][0] - e[0][0]) * t, e[0][1] + (e[1][1] - e[0][1]) * t + Math.sin(t * Math.PI) * 0.22 * (e[2] < 1 ? -1.8 : 1), e[0][2] + (e[1][2] - e[0][2]) * t];
  while (b.i < n * 0.36) {
    const k = Math.floor(r() * K), P = N[k];
    if (r() < 0.62) { const e = rectEdgePoint(r, 0, 0, 0.78, 0.56); b.push(P[0] + e[0], P[1] + e[1], P[2] + gauss(r) * 0.01, k === K - 1 ? C.ion : C.ink, 0.95); }
    else { const row = Math.floor(r() * 3); b.push(P[0] - 0.28 + r() * (0.56 - row * 0.14), P[1] + 0.12 - row * 0.12, P[2], row ? C.steel : C.ion, row ? 0.8 : 1.1); }
  }
  while (b.i < n * 0.86) {
    const e = E[Math.floor(r() * E.length)];
    const p = f(e, r());
    b.push(p[0] + gauss(r) * 0.018, p[1] + gauss(r) * 0.018, p[2] + gauss(r) * 0.018, e[2] < 1 ? C.violet : mixHex(PAL.ion, PAL.cyan, r()), e[2] < 1 ? 0.5 : 0.75);
  }
  while (!b.full()) {
    const P = N[Math.floor(r() * K)];
    const a = r() * Math.PI * 2, rr = 0.55 + r() * 0.5;
    b.push(P[0] + Math.cos(a) * rr * 0.9, P[1] + Math.sin(a) * rr * 0.7, P[2] + (r() - 0.5) * 0.3, C.steel, 0.4);
  }
  const L = [];
  E.forEach((e) => { for (let k = 0; k < 6; k++) L.push(...f(e, k / 6), ...f(e, (k + 1) / 6)); });
  return { pos: b.pos, col: b.col, links: new Float32Array(L), opts: { swing: 0.22, tiltX: 0.18, gain: 0.6 } };
}

/* Caos alinhado ao painel: cada ponto fica perto da sua posição horizontal no painel,
   por isso o comparador consegue dividir o mundo numa linha. */
export function chaosA(n, P) {
  if (!P) return chaos(n);
  const r = rng(171);
  const pos = new Float32Array(n * 3), col = new Float32Array(n * 4);
  const CX = 8, CY = 4, W = 7.6, H = 4.4;
  const cells = [];
  for (let k = 0; k < CX * CY; k++) cells.push({ ax: (r() - 0.5) * 1.7, ay: (r() - 0.5) * 1.9, az: (r() - 0.5) * 1.1, dx: (r() - 0.5) * 0.5, dy: (r() - 0.5) * 1.5, dz: (r() - 0.5) * 2.8, s: 0.8 + r() * 0.55, kind: Math.floor(r() * 4) });
  for (let i = 0; i < n; i++) {
    const x = P[i * 3], y = P[i * 3 + 1], z = P[i * 3 + 2];
    const cx = Math.min(CX - 1, Math.max(0, Math.floor(((x + W / 2) / W) * CX)));
    const cy = Math.min(CY - 1, Math.max(0, Math.floor(((y + H / 2) / H) * CY)));
    const Cl = cells[cy * CX + cx];
    const ccx = -W / 2 + (cx + 0.5) * (W / CX), ccy = -H / 2 + (cy + 0.5) * (H / CY);
    let X, Y, Z;
    if (r() < 0.09) { X = x + (r() - 0.5) * 0.7; Y = (r() - 0.5) * 3.8; Z = (r() - 0.5) * 4; }
    else {
      let lx = (x - ccx) * Cl.s, ly = (y - ccy) * Cl.s, lz = z;
      let c1 = Math.cos(Cl.ax), s1 = Math.sin(Cl.ax);
      [ly, lz] = [ly * c1 - lz * s1, ly * s1 + lz * c1];
      c1 = Math.cos(Cl.ay); s1 = Math.sin(Cl.ay);
      [lx, lz] = [lx * c1 + lz * s1, -lx * s1 + lz * c1];
      c1 = Math.cos(Cl.az); s1 = Math.sin(Cl.az);
      [lx, ly] = [lx * c1 - ly * s1, lx * s1 + ly * c1];
      X = ccx + Cl.dx + lx; Y = ccy * 1.05 + Cl.dy * 0.7 + ly; Z = Cl.dz + lz;
    }
    pos[i * 3] = X; pos[i * 3 + 1] = Y; pos[i * 3 + 2] = Z;
    const c = Cl.kind === 3 ? mixHex(PAL.slate, PAL.violet, 0.5) : Cl.kind === 2 ? C.steel : mixHex(PAL.slate, PAL.steel, r() * 0.6);
    col[i * 4] = c[0]; col[i * 4 + 1] = c[1]; col[i * 4 + 2] = c[2]; col[i * 4 + 3] = 0.5 + r() * 0.35;
  }
  return { pos, col, opts: { face: true, gain: 0.62, noise: 0.03 } };
}

/* -------------------------------------------------------------------------- */
/* Formas montadas na hora, a partir de retângulos da página (em unidades do mundo 3D) */

/* Moldura: os dados cercam e sustentam um painel da página */
export function frame(n, R) {
  const r = rng(501);
  const b = makeBuf(n);
  const cx = (R.x0 + R.x1) / 2, cy = (R.y0 + R.y1) / 2, w = R.x1 - R.x0, h = R.y1 - R.y0;
  while (b.i < n * 0.26) { const e = rectEdgePoint(r, cx, cy, w, h); b.push(e[0] + gauss(r) * 0.006, e[1] + gauss(r) * 0.006, gauss(r) * 0.01, C.ion, 1); }
  const L = Math.min(w, h) * 0.12;
  while (b.i < n * 0.36) {
    const k = Math.floor(r() * 4), sx = k % 2 ? 1 : -1, sy = k < 2 ? 1 : -1;
    const along = r() < 0.5, t = r() * L;
    const x = cx + sx * (w / 2 + 0.06) - (along ? sx * t : 0), y = cy + sy * (h / 2 + 0.06) - (along ? 0 : sy * t);
    b.push(x, y, 0.02, C.cyan, 1.3);
  }
  const step = Math.max(w, h) / 18;
  while (b.i < n * 0.68) {
    const vert = r() < 0.5;
    const x = vert ? R.x0 + Math.round((r() * w) / step) * step : R.x0 + r() * w;
    const y = vert ? R.y0 + r() * h : R.y0 + Math.round((r() * h) / step) * step;
    b.push(Math.min(R.x1, x), Math.min(R.y1, y), -0.15, C.steel, 0.32);
  }
  while (!b.full()) {
    const a = r() * Math.PI * 2;
    const rx = w / 2 + 0.35 + Math.abs(gauss(r)) * 0.5, ry = h / 2 + 0.3 + Math.abs(gauss(r)) * 0.4;
    const k = Math.max(Math.abs(Math.cos(a)), Math.abs(Math.sin(a)));
    b.push(cx + (Math.cos(a) / k) * rx * (0.92 + r() * 0.1), cy + (Math.sin(a) / k) * ry * (0.92 + r() * 0.1), (r() - 0.5) * 1.2, r() < 0.7 ? C.steel : C.ion, 0.3);
  }
  return { pos: b.pos, col: b.col, opts: { face: true, gain: 0.6, noise: 0.012, arc: 1 } };
}

/* Fragmentos: as partículas nascem dentro dos cartões de dados do final */
export function fragments(n, rects) {
  const r = rng(601);
  const b = makeBuf(n);
  const area = rects.reduce((a, q) => a + (q.x1 - q.x0) * (q.y1 - q.y0), 0) || 1;
  const pick = () => { let v = r() * area; for (const q of rects) { v -= (q.x1 - q.x0) * (q.y1 - q.y0); if (v <= 0) return q; } return rects[0]; };
  while (!b.full()) {
    const q = pick();
    const w = q.x1 - q.x0, h = q.y1 - q.y0;
    let x, y;
    if (r() < 0.4) { const e = rectEdgePoint(r, (q.x0 + q.x1) / 2, (q.y0 + q.y1) / 2, w, h); x = e[0]; y = e[1]; }
    else { const row = Math.floor(r() * 2); x = q.x0 + w * 0.12 + r() * w * (row ? 0.5 : 0.76); y = q.y0 + h * (row ? 0.32 : 0.64) + gauss(r) * h * 0.04; }
    b.push(x, y, (r() - 0.5) * 0.08, q.accent ? C.cyan : r() < 0.5 ? C.ion : C.ink, 1);
  }
  return { pos: b.pos, col: b.col, opts: { face: true, gain: 0.6, noise: 0.02 } };
}

export const SHAPES = { logo, dust, neural, circuit, iface, brain, streams, dashboard, city, globe, helix, vortex, chaos, panel, terrain, screens, blocks, seed, flow, chaosA };
