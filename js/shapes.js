/* Konan Tech v2: formas 3D das partículas.
   Cada função recebe a quantidade de partículas (n) e devolve:
   { pos: Float32Array(n*3), col: Float32Array(n*3), links?: Float32Array, opts }
   As cores são hexadecimais da paleta; o palco converte para o espaço de cor correto.
   Para criar uma forma nova: escreva uma função aqui e registre em SHAPES no fim do arquivo. */

export const PAL = {
  white: 0xf4f8fc,
  silver: 0xc9d1db,
  steel: 0x7d8794,
  ion: 0x3ea6ff,
  plasma: 0xa8e6ff,
  deep: 0x0d4f8f
};

/* gerador pseudoaleatório com semente, para as formas serem sempre iguais */
function rng(seed) {
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

function hexRgb(h) {
  return [((h >> 16) & 255) / 255, ((h >> 8) & 255) / 255, (h & 255) / 255];
}

function mixHex(a, b, t) {
  const A = hexRgb(a), B = hexRgb(b);
  return [A[0] + (B[0] - A[0]) * t, A[1] + (B[1] - A[1]) * t, A[2] + (B[2] - A[2]) * t];
}

/* utilitário para preencher os arrays */
function makeBuf(n) {
  const pos = new Float32Array(n * 3);
  const col = new Float32Array(n * 3);
  let i = 0;
  return {
    pos, col,
    get i() { return i; },
    push(x, y, z, c, k) {
      if (i >= n) return false;
      pos[i * 3] = x; pos[i * 3 + 1] = y; pos[i * 3 + 2] = z;
      const m = k === undefined ? 1 : k;
      col[i * 3] = c[0] * m; col[i * 3 + 1] = c[1] * m; col[i * 3 + 2] = c[2] * m;
      i++;
      return true;
    },
    full() { return i >= n; }
  };
}

/* pontos ao longo das 12 arestas de uma caixa */
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

/* pontos no contorno de um retângulo no plano xy */
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
/* 1. Logomarca, amostrada do PNG oficial (preenchida pelo palco com os pixels) */
export function logo(n, px) {
  const r = rng(11);
  const b = makeBuf(n);
  if (!px || !px.length) return { ...sphere(n), opts: { face: true } };
  const W = 6.6;
  const cnt = px.length / 4;
  while (!b.full()) {
    const k = Math.floor(r() * cnt) * 4;
    const x = (px[k] - 0.5) * W, y = px[k + 1] * W, lum = px[k + 2], blue = px[k + 3] > 0.5;
    const z = (r() - 0.5) * 0.12;
    const c = blue ? mixHex(PAL.ion, PAL.plasma, r() * 0.5) : mixHex(PAL.steel, PAL.white, Math.min(1, lum * 1.15));
    b.push(x + (r() - 0.5) * 0.006, y + (r() - 0.5) * 0.006, z, c, blue ? 1.25 : 1);
  }
  return { pos: b.pos, col: b.col, opts: { face: true, fit: 7.2, gain: 0.27 } };
}

/* 2. Rede neural em camadas, com ligações que pulsam */
export function network(n) {
  const r = rng(21);
  const b = makeBuf(n);
  const layers = [5, 8, 11, 8, 5];
  const nodes = [];
  layers.forEach((cnt, li) => {
    const x = -3 + li * 1.5;
    const rad = 0.7 + Math.sin((li / (layers.length - 1)) * Math.PI) * 1.25;
    const arr = [];
    for (let j = 0; j < cnt; j++) {
      const a = (j / cnt) * Math.PI * 2 + li * 0.35;
      arr.push([x + (r() - 0.5) * 0.25, Math.cos(a) * rad, Math.sin(a) * rad * 0.8]);
    }
    nodes.push(arr);
  });
  const edges = [];
  for (let li = 0; li < nodes.length - 1; li++) {
    for (const A of nodes[li]) for (const B of nodes[li + 1]) if (r() < 0.62) edges.push([A, B]);
  }
  const flat = nodes.flat();
  const cNode = hexRgb(PAL.white), cEdge = hexRgb(PAL.ion);
  const nNodes = Math.floor(n * 0.3);
  for (let k = 0; k < nNodes; k++) {
    const N = flat[k % flat.length];
    const s = 0.04 + 0.05 * r();
    b.push(N[0] + gauss(r) * s, N[1] + gauss(r) * s, N[2] + gauss(r) * s, r() < 0.5 ? cNode : mixHex(PAL.plasma, PAL.white, 0.5));
  }
  while (!b.full()) {
    const E = edges[Math.floor(r() * edges.length)];
    const t = r();
    b.push(E[0][0] + (E[1][0] - E[0][0]) * t + gauss(r) * 0.012, E[0][1] + (E[1][1] - E[0][1]) * t + gauss(r) * 0.012, E[0][2] + (E[1][2] - E[0][2]) * t + gauss(r) * 0.012, cEdge, 0.55);
  }
  const links = new Float32Array(edges.length * 6);
  edges.forEach((E, k) => links.set([...E[0], ...E[1]], k * 6));
  return { pos: b.pos, col: b.col, links, opts: { spin: 0.14, tiltX: 0.18, gain: 0.42 } };
}

/* 3. Cérebro digital: dois hemisférios com sulcos, cerebelo e sinapses */
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
  const total = n;
  while (b.i < total * 0.78) {
    const side = r() < 0.5 ? -1 : 1;
    const p = hemi(side);
    surf.push(p);
    const t = (p[1] + 1.2) / 2.6;
    b.push(p[0], p[1], p[2], mixHex(PAL.ion, PAL.plasma, Math.min(1, Math.max(0, t))), 0.85 + r() * 0.35);
  }
  while (b.i < total * 0.88) {
    const a = r() * Math.PI * 2, u = r() * 2 - 1, s = Math.sqrt(1 - u * u);
    b.push(Math.cos(a) * s * 0.85, -0.78 + u * 0.32, -1.05 + Math.sin(a) * s * 0.55, hexRgb(PAL.ion), 0.9);
  }
  while (b.i < total * 0.91) {
    const t = r();
    b.push(gauss(r) * 0.09, -0.75 - t * 0.75, -0.45 - t * 0.3 + gauss(r) * 0.06, hexRgb(PAL.deep), 1.1);
  }
  while (!b.full()) {
    const p = surf[Math.floor(r() * surf.length)];
    const k = 0.3 + r() * 0.6;
    const cx = p[0] > 0 ? 0.6 : -0.6, cy = 0.15;
    b.push(cx + (p[0] - cx) * k, cy + (p[1] - cy) * k, p[2] * k, hexRgb(PAL.white), 0.7);
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
  return { pos: b.pos, col: b.col, links: new Float32Array(L), opts: { spin: 0.16, tiltX: 0.12, gain: 0.5 } };
}

/* 4. Fluxos de dados: fitas de luz que ondulam (a ondulação é animada no shader) */
export function streams(n) {
  const r = rng(41);
  const b = makeBuf(n);
  const K = 16;
  const S = [];
  for (let k = 0; k < K; k++) {
    S.push({ a: 0.25 + r() * 0.9, f: 0.35 + r() * 0.6, ph: r() * 6.28, yo: (k / (K - 1) - 0.5) * 2.6, zo: (r() - 0.5) * 2.2, g: 0.3 + r() * 0.5, c: k % 3 === 0 ? PAL.white : k % 3 === 1 ? PAL.ion : PAL.plasma });
  }
  while (!b.full()) {
    const s = S[Math.floor(r() * K)];
    const x = -4.2 + r() * 8.4;
    const pinch = Math.cos((x / 4.2) * Math.PI * 0.5);
    const y = (s.yo * pinch) + Math.sin(x * s.f + s.ph) * s.a * pinch;
    const z = s.zo * pinch + Math.cos(x * s.g + s.ph) * 0.5;
    const edge = 1 - Math.abs(x) / 4.2;
    b.push(x, y + gauss(r) * 0.025, z + gauss(r) * 0.025, hexRgb(s.c), 0.45 + edge * 0.8);
  }
  return { pos: b.pos, col: b.col, opts: { wave: 1, spin: 0, tiltX: 0.25, rotY: -0.35, gain: 0.34 } };
}

/* 5. Painel de indicadores em 3D: barras, linha de tendência, anel e piso */
export function dashboard(n) {
  const r = rng(51);
  const b = makeBuf(n);
  const H = [1.1, 1.6, 1.35, 2.1, 1.8, 2.6, 2.3, 3.0, 2.75];
  const bx = (i) => -3 + i * 0.62;
  const base = -1.5;
  while (b.i < n * 0.5) {
    const i = Math.floor(r() * H.length);
    const p = boxEdgePoint(r, bx(i), base + H[i] / 2, 0, 0.34, H[i], 0.34);
    b.push(p[0], p[1], p[2], mixHex(PAL.ion, PAL.plasma, H[i] / 3), 0.95);
  }
  while (b.i < n * 0.6) {
    const i = Math.floor(r() * H.length);
    b.push(bx(i) + (r() - 0.5) * 0.3, base + r() * H[i], (r() - 0.5) * 0.3, hexRgb(PAL.deep), 1.4);
  }
  while (b.i < n * 0.72) {
    const t = r() * (H.length - 1);
    const i = Math.floor(t), f = t - i;
    const y = base + H[i] + (H[Math.min(i + 1, H.length - 1)] - H[i]) * f + 0.45;
    b.push(bx(0) + t * 0.62, y + gauss(r) * 0.015, 0.6, hexRgb(PAL.white), 1.1);
  }
  while (b.i < n * 0.84) {
    const a = r() * Math.PI * 2;
    const frac = a / (Math.PI * 2);
    const rr = 0.85 + gauss(r) * 0.04;
    b.push(3.1 + Math.cos(a) * rr * 0.2, 1.2 + Math.sin(a) * rr, -0.4 + Math.cos(a) * rr, frac < 0.68 ? hexRgb(PAL.ion) : hexRgb(PAL.steel), frac < 0.68 ? 1.1 : 0.6);
  }
  while (!b.full()) {
    const gx = Math.round((r() * 8 - 4) * 2.5) / 2.5, gz = Math.round((r() * 4 - 2) * 2.5) / 2.5;
    const along = r() < 0.5;
    b.push(along ? r() * 8 - 4 : gx, base - 0.02, along ? gz : r() * 4 - 2, hexRgb(PAL.steel), 0.45);
  }
  return { pos: b.pos, col: b.col, opts: { spin: 0, rotY: -0.45, swing: 0.35, tiltX: 0.22, gain: 0.55 } };
}

/* 6. Cidade digital: torres em grade, arestas iluminadas e janelas */
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
    b.push(p[0], p[1], p[2], mixHex(PAL.silver, PAL.ion, r() * 0.6), 0.9);
  }
  while (b.i < n * 0.82) {
    const t = T[Math.floor(r() * T.length)];
    const face = Math.floor(r() * 4);
    const fy = base + Math.floor(r() * (t.h / 0.16)) * 0.16 + 0.08;
    const off = (Math.floor(r() * 3) - 1) * t.w * 0.28;
    const hw = t.w / 2;
    const pts = [[t.x + off, fy, t.z + hw], [t.x + off, fy, t.z - hw], [t.x + hw, fy, t.z + off], [t.x - hw, fy, t.z + off]];
    const p = pts[face];
    b.push(p[0], p[1], p[2], r() < 0.2 ? hexRgb(PAL.plasma) : hexRgb(PAL.ion), r() < 0.2 ? 1.4 : 0.7);
  }
  while (!b.full()) {
    const a = r() * Math.PI * 2, rr = Math.sqrt(r()) * 3.6;
    const ring = Math.abs(Math.sin(rr * 3)) > 0.92;
    b.push(Math.cos(a) * rr, base, Math.sin(a) * rr, ring ? hexRgb(PAL.ion) : hexRgb(PAL.steel), ring ? 0.9 : 0.35);
  }
  return { pos: b.pos, col: b.col, opts: { spin: 0.11, tiltX: 0.32, gain: 0.6 } };
}

/* 7. Globo de operação: esfera de Fibonacci com órbitas */
export function sphere(n) {
  const r = rng(71);
  const b = makeBuf(n);
  const R = 2.05;
  const ns = Math.floor(n * 0.66);
  const ga = Math.PI * (3 - Math.sqrt(5));
  for (let k = 0; k < ns; k++) {
    const y = 1 - (k / (ns - 1)) * 2, rad = Math.sqrt(1 - y * y), th = ga * k;
    const lat = Math.abs(Math.sin(y * 9)) > 0.96;
    b.push(Math.cos(th) * rad * R, y * R, Math.sin(th) * rad * R, lat ? hexRgb(PAL.ion) : mixHex(PAL.steel, PAL.silver, r()), lat ? 1.1 : 0.55);
  }
  const orbits = [[0.35, 0.2, 2.75], [-0.6, 0.9, 3.05], [1.1, -0.4, 2.5]];
  while (b.i < n * 0.96) {
    const o = orbits[Math.floor(r() * 3)];
    const a = r() * Math.PI * 2;
    let x = Math.cos(a) * o[2], y = 0, z = Math.sin(a) * o[2];
    const cy = Math.cos(o[0]), sy = Math.sin(o[0]);
    [y, z] = [y * cy - z * sy, y * sy + z * cy];
    const cz = Math.cos(o[1]), sz = Math.sin(o[1]);
    [x, y] = [x * cz - y * sz, x * sz + y * cz];
    b.push(x, y, z, mixHex(PAL.ion, PAL.plasma, r()), 0.8);
  }
  while (!b.full()) {
    const u = r() * 2 - 1, a = r() * Math.PI * 2, s = Math.sqrt(1 - u * u), rr = Math.pow(r(), 2) * 0.55;
    b.push(Math.cos(a) * s * rr * 1.6, u * rr * 1.6, Math.sin(a) * s * rr * 1.6, hexRgb(PAL.plasma), 0.32);
  }
  return { pos: b.pos, col: b.col, opts: { spin: 0.1, tiltX: 0.25, gain: 0.5 } };
}

/* 8. Hélice dupla: o método, etapa por etapa */
export function helix(n) {
  const r = rng(81);
  const b = makeBuf(n);
  const turns = 3.2, Hh = 6, R = 1.05;
  while (b.i < n * 0.58) {
    const t = r();
    const s = r() < 0.5 ? 0 : Math.PI;
    const a = t * turns * Math.PI * 2 + s;
    b.push(Math.cos(a) * R + gauss(r) * 0.03, (t - 0.5) * Hh, Math.sin(a) * R + gauss(r) * 0.03, s ? hexRgb(PAL.ion) : hexRgb(PAL.silver), 1);
  }
  const rungs = 34;
  while (b.i < n * 0.9) {
    const k = Math.floor(r() * rungs);
    const t = (k + 0.5) / rungs;
    const a = t * turns * Math.PI * 2;
    const f = r() * 2 - 1;
    b.push(Math.cos(a) * R * f, (t - 0.5) * Hh, Math.sin(a) * R * f, mixHex(PAL.deep, PAL.plasma, Math.abs(f)), 0.75);
  }
  while (!b.full()) {
    const t = r(), a = r() * Math.PI * 2, rr = 1.4 + r() * 1.2;
    b.push(Math.cos(a) * rr, (t - 0.5) * Hh * 1.1, Math.sin(a) * rr, hexRgb(PAL.steel), 0.35);
  }
  return { pos: b.pos, col: b.col, opts: { spin: 0.28, tiltX: 0.12, tiltZ: -0.22, gain: 0.5 } };
}

/* 9. Portal: galáxia em espiral com anel central */
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
    b.push(Math.cos(a) * rr, y, Math.sin(a) * rr, mixHex(PAL.plasma, PAL.deep, t), 0.75 - t * 0.3);
  }
  while (b.i < n * 0.93) {
    const a = r() * Math.PI * 2, rr = 0.82 + gauss(r) * 0.03;
    b.push(Math.cos(a) * rr, gauss(r) * 0.02, Math.sin(a) * rr, hexRgb(PAL.white), 0.8);
  }
  while (!b.full()) {
    const a = r() * Math.PI * 2, rr = r() * 4.6;
    b.push(Math.cos(a) * rr, gauss(r) * 0.25, Math.sin(a) * rr, hexRgb(PAL.steel), 0.3);
  }
  return { pos: b.pos, col: b.col, opts: { spin: 0.22, tiltX: 1.05, gain: 0.42 } };
}

/* 10. Poeira: campo calmo para leitura */
export function dust(n) {
  const r = rng(101);
  const b = makeBuf(n);
  while (!b.full()) {
    b.push((r() - 0.5) * 16, (r() - 0.5) * 9, (r() - 0.5) * 9 - 1, r() < 0.15 ? hexRgb(PAL.ion) : hexRgb(PAL.steel), 0.35 + r() * 0.5);
  }
  return { pos: b.pos, col: b.col, opts: { spin: 0.02, gain: 0.6 } };
}

/* 11. Caos: papéis, planilhas e mensagens soltas no espaço */
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
    b.push(q[0], q[1], q[2], d.kind === 2 ? mixHex(PAL.steel, PAL.ion, 0.35) : hexRgb(PAL.steel), 0.55 + r() * 0.3);
  }
  while (!b.full()) {
    b.push((r() - 0.5) * 9, (r() - 0.5) * 5, (r() - 0.5) * 4, hexRgb(PAL.steel), 0.3);
  }
  return { pos: b.pos, col: b.col, opts: { spin: 0.03, gain: 0.55 } };
}

/* 12. Ordem: o mesmo volume de dados organizado num painel único */
export function panel(n) {
  const r = rng(121);
  const b = makeBuf(n);
  const W = 7, H = 3.9;
  while (b.i < n * 0.14) { const e = rectEdgePoint(r, 0, 0, W, H); b.push(e[0], e[1], 0, hexRgb(PAL.silver), 0.8); }
  while (b.i < n * 0.2) { b.push(-W / 2 + 0.2 + r() * 1.1, H / 2 - 0.3, 0, hexRgb(PAL.white), 1.1); }
  const kx = [-2.55, -0.85, 0.85, 2.55];
  while (b.i < n * 0.42) {
    const k = Math.floor(r() * 4);
    if (r() < 0.6) { const e = rectEdgePoint(r, kx[k], 1.05, 1.5, 0.85); b.push(e[0], e[1], 0, hexRgb(PAL.steel), 0.7); }
    else { b.push(kx[k] - 0.55 + r() * (0.5 + k * 0.12), 1.0 + (r() < 0.5 ? 0.12 : -0.12) * Math.floor(r() * 2), 0.02, k === 1 ? hexRgb(PAL.ion) : hexRgb(PAL.white), 1.2); }
  }
  const bars = [0.55, 0.8, 0.7, 1.05, 0.95, 1.3, 1.2, 1.6];
  while (b.i < n * 0.7) {
    const i = Math.floor(r() * bars.length);
    const x = -3.05 + i * 0.5 + (r() - 0.5) * 0.28, y = -1.75 + r() * bars[i] * 1.25;
    b.push(x, y, 0.02, i === bars.length - 1 ? hexRgb(PAL.plasma) : hexRgb(PAL.ion), 1);
  }
  while (b.i < n * 0.86) {
    const t = r();
    const x = 0.45 + t * 2.9;
    const y = -1.6 + t * 1.6 + Math.sin(t * 9) * 0.18;
    b.push(x, y + gauss(r) * 0.012, 0.02, hexRgb(PAL.white), 0.85);
  }
  while (!b.full()) {
    const row = Math.floor(r() * 5);
    b.push(-3.25 + r() * 6.6, -1.75 + row * 0.42, -0.01, hexRgb(PAL.steel), 0.28);
  }
  return { pos: b.pos, col: b.col, opts: { face: true, gain: 0.4 } };
}

/* 13. Piso de dados: malha ondulante sob os projetos */
export function terrain(n) {
  const r = rng(131);
  const b = makeBuf(n);
  const cols = Math.ceil(Math.sqrt(n * 1.8));
  const rows = Math.ceil(n / cols);
  for (let j = 0; j < rows && !b.full(); j++) for (let i = 0; i < cols && !b.full(); i++) {
    const x = (i / (cols - 1) - 0.5) * 18, z = -9 + (j / (rows - 1)) * 12;
    const fade = Math.min(1, (z + 9) / 4);
    b.push(x + (r() - 0.5) * 0.02, 0, z, (i % 9 === 0 || j % 9 === 0) ? hexRgb(PAL.ion) : hexRgb(PAL.steel), (i % 9 === 0 || j % 9 === 0 ? 0.9 : 0.45) * fade);
  }
  return { pos: b.pos, col: b.col, opts: { wave: 2.4, face: true, gain: 0.7 } };
}

/* 14. Telas flutuantes: notebook, tablet e celular com interfaces em montagem */
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
    b.push(p[0], p[1], p[2], hexRgb(PAL.silver), 0.9);
  }
  while (b.i < n * 0.36) {
    const d = dev[0];
    const t = r();
    const p = place(d, (r() - 0.5) * d.w * 1.08, -d.h / 2 - 0.05 - t * 0.12, t * 1.1);
    b.push(p[0], p[1], p[2], hexRgb(PAL.steel), 0.6);
  }
  while (!b.full()) {
    const d = dev[Math.floor(r() * 3)];
    const u = r();
    let px, py, c = hexRgb(PAL.ion), k = 0.9;
    if (u < 0.12) { px = (r() - 0.5) * d.w * 0.9; py = d.h / 2 - 0.12; c = hexRgb(PAL.steel); }
    else if (u < 0.45) { px = (r() - 0.5) * d.w * 0.8; py = d.h * 0.12 + (r() - 0.5) * d.h * 0.28; c = mixHex(PAL.deep, PAL.ion, r()); k = 1.2; }
    else if (u < 0.75) { const row = Math.floor(r() * 4); px = -d.w * 0.4 + r() * d.w * (0.5 + (row % 2) * 0.25); py = -d.h * 0.12 - row * d.h * 0.08; c = hexRgb(PAL.steel); k = 0.6; }
    else { px = -d.w * 0.4 + r() * d.w * 0.32; py = -d.h * 0.42; c = hexRgb(PAL.plasma); k = 1.3; }
    const p = place(d, px, py, 0.02);
    b.push(p[0], p[1], p[2], c, k);
  }
  return { pos: b.pos, col: b.col, opts: { swing: 0.25, tiltX: 0.08, gain: 0.45 } };
}

/* 15. Módulos: blocos de um sistema sendo montados */
export function blocks(n) {
  const r = rng(151);
  const b = makeBuf(n);
  const C = [];
  for (let i = -1; i <= 1; i++) for (let j = -1; j <= 1; j++) for (let k = -1; k <= 1; k++) {
    if (r() < 0.82) C.push([i * 1.05, j * 1.05, k * 1.05, r() < 0.2]);
  }
  while (b.i < n * 0.7) {
    const c = C[Math.floor(r() * C.length)];
    const p = boxEdgePoint(r, c[0], c[1], c[2], 0.82, 0.82, 0.82);
    b.push(p[0], p[1], p[2], c[3] ? hexRgb(PAL.plasma) : mixHex(PAL.silver, PAL.ion, 0.45), c[3] ? 1.3 : 0.9);
  }
  while (!b.full()) {
    const c = C[Math.floor(r() * C.length)];
    const f = Math.floor(r() * 6), u = (r() - 0.5) * 0.7, v = (r() - 0.5) * 0.7, h = 0.41;
    const p = [[h, u, v], [-h, u, v], [u, h, v], [u, -h, v], [u, v, h], [u, v, -h]][f];
    b.push(c[0] + p[0], c[1] + p[1], c[2] + p[2], c[3] ? hexRgb(PAL.ion) : hexRgb(PAL.deep), c[3] ? 0.9 : 0.75);
  }
  return { pos: b.pos, col: b.col, opts: { spin: 0.2, tiltX: 0.55, tiltZ: 0.2, gain: 0.48 } };
}

/* singularidade: todas as partículas num ponto, para a abertura */
export function seed(n) {
  const r = rng(161);
  const b = makeBuf(n);
  while (!b.full()) {
    const a = r() * Math.PI * 2, u = r() * 2 - 1, s = Math.sqrt(1 - u * u), rr = Math.pow(r(), 3) * 0.12;
    b.push(Math.cos(a) * s * rr, u * rr, Math.sin(a) * s * rr, hexRgb(PAL.white), 1.6);
  }
  return { pos: b.pos, col: b.col, opts: { gain: 0.3 } };
}

export const SHAPES = { logo, network, brain, streams, dashboard, city, sphere, helix, vortex, dust, chaos, panel, terrain, screens, blocks, seed };
