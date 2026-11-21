/* Konan Tech: a casa descrita em 3D.
   O visitante escreve a casa ("3 quartos, 2 banheiros, sala, cozinha, 120 m²"), a casa é montada na tela
   (planta 2D, paredes subindo, móveis cômodo por cômodo) e, no fim, pode ser vista em modo realista,
   por fora e por dentro. O giro é só do mouse ou do dedo. Tudo é gerado por código, sem modelos de terceiros.
   Gere de novo o arquivo servido com: sh scripts/build-casa3d.sh */
import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import { RoomEnvironment } from 'three/examples/jsm/environments/RoomEnvironment.js';
import { RoundedBoxGeometry } from 'three/examples/jsm/geometries/RoundedBoxGeometry.js';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { EffectComposer } from 'three/examples/jsm/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/examples/jsm/postprocessing/RenderPass.js';
import { GTAOPass } from 'three/examples/jsm/postprocessing/GTAOPass.js';
import { OutputPass } from 'three/examples/jsm/postprocessing/OutputPass.js';
import { FullScreenQuad } from 'three/examples/jsm/postprocessing/Pass.js';
import { WebGLPathTracer, DenoiseMaterial } from 'three-gpu-pathtracer';
import { parse } from '../../js/listen.js';
import { obraFrase, obraSig, obraFromSig, obraTemComodos, waLink } from '../../js/content.js';
import { formatArea, renderPlan, renderRooms } from './plan-view.js';

const $ = (s) => document.querySelector(s);
const clamp = (v, a = 0, b = 1) => Math.max(a, Math.min(b, v));
const lerp = (a, b, t) => a + (b - a) * t;
const easeOut = (t) => 1 - Math.pow(1 - t, 3);
const easeInOut = (t) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2);
const easeBack = (t) => { const c1 = 1.5, c3 = c1 + 1; return 1 + c3 * Math.pow(t - 1, 3) + c1 * Math.pow(t - 1, 2); };
const REDUCED = matchMedia('(prefers-reduced-motion: reduce)').matches;
const COARSE = matchMedia('(pointer: coarse)').matches;
const OPP = { T: 'B', B: 'T', L: 'R', R: 'L' };

/* ---------- 1. a planta: de uma descrição para cômodos, paredes e aberturas ---------- */
const NOMINAL = { sala: 18, cozinha: 10, varanda: 8, garagem: 15, servico: 5, suite: 13, quarto: 10, banheiro: 4.6, lavabo: 3.4 };
const LABEL = { sala: 'Sala', cozinha: 'Cozinha', varanda: 'Varanda', garagem: 'Garagem', servico: 'Área de serviço', suite: 'Suíte', quarto: 'Quarto', banheiro: 'Banheiro', lavabo: 'Lavabo' };
const MIN_W = { banheiro: 1.5, lavabo: 1.3, servico: 1.6 };
const DEFAULT_OBRA = { quarto: 2, banheiro: 1, sala: 1, cozinha: 1, area: 0, suite: 0, lavabo: 0, garagem: 0, varanda: 0, servico: 0 };
const T_OUT = 0.22, T_IN = 0.13;

function planHouse(o) {
  const list = [];
  const add = (k, n) => { for (let i = 1; i <= n; i++) list.push({ k, name: LABEL[k] + (n > 1 ? ' ' + i : ''), nom: NOMINAL[k] }); };
  const soc = [], beds = [], baths = [];
  const take = (arr, k) => { const before = list.length; add(k, o[k] || 0); arr.push(...list.splice(before)); };
  ['sala', 'cozinha', 'varanda', 'garagem', 'servico'].forEach((k) => take(soc, k));
  ['suite', 'quarto'].forEach((k) => take(beds, k));
  ['banheiro', 'lavabo'].forEach((k) => take(baths, k));
  /* quartos e banheiros intercalados, como numa planta de verdade */
  const priv = [];
  while (beds.length || baths.length) { if (beds.length) priv.push(beds.shift()); if (baths.length) priv.push(baths.shift()); }
  const all = soc.concat(priv);
  const nomTotal = all.reduce((a, r) => a + r.nom, 0);
  const target = o.area || nomTotal * 1.1;
  const s = clamp(target / nomTotal, 0.55, 3.4);
  all.forEach((r) => { r.area = r.nom * s; });
  const total = all.reduce((a, r) => a + r.area, 0);

  const W = Math.sqrt(total * 1.4);
  const split = (arr, rowDepth) => {
    if (!arr.length) return [];
    const a = arr.reduce((t, r) => t + r.area, 0);
    const n = clamp(Math.round(a / (W * rowDepth)), 1, arr.length);
    const out = [];
    let acc = 0, cur = [], k = 1;
    arr.forEach((r, i) => {
      cur.push(r); acc += r.area;
      const left = arr.length - i - 1, groupsLeft = n - k;
      if (k < n && (acc >= (a * k) / n - r.area * 0.35 || left === groupsLeft)) { out.push(cur); cur = []; k++; }
    });
    if (cur.length) out.push(cur);
    return out;
  };
  const rows = split(soc, 3.8).concat(split(priv, 3.2));
  const D = total / W;
  let z = -D / 2;
  const rooms = [];
  rows.forEach((row, ri) => {
    const rowArea = row.reduce((a, r) => a + r.area, 0);
    const depth = rowArea / W;
    const minimums = row.map((r) => MIN_W[r.k] || 1.9);
    const minimumTotal = minimums.reduce((sum, width) => sum + width, 0);
    const floors = minimums.map((width) => width * Math.min(1, W / minimumTotal));
    const weights = row.map((r, i) => Math.max(0, r.area / depth - floors[i]));
    const weightTotal = weights.reduce((sum, weight) => sum + weight, 0);
    const available = Math.max(0, W - minimumTotal);
    const ws = floors.map((floor, i) => floor + (weightTotal ? available * weights[i] / weightTotal : 0));
    let x = -W / 2;
    row.forEach((r, ci) => {
      const w = ws[ci];
      rooms.push({ ...r, x0: x, z0: z, w, d: depth, cx: x + w / 2, cz: z + depth / 2, row: ri, col: ci, last: ci === row.length - 1, lastRow: ri === rows.length - 1, prev: ci > 0 ? row[ci - 1] : null, idx: rooms.length });
      x += w;
    });
    z += depth;
  });

  /* portas, janelas e portão; cada cômodo é dono da parede de cima e da esquerda, e das de fora */
  rooms.forEach((r) => {
    r.door = r.row === 0 ? 'L' : 'T';
    r.ext = { T: r.row === 0, L: r.col === 0, R: r.last, B: r.lastRow };
    r.ins = { T: (r.row === 0 ? T_OUT : T_IN) / 2, L: (r.col === 0 ? T_OUT : T_IN) / 2, R: (r.last ? T_OUT : T_IN) / 2, B: (r.lastRow ? T_OUT : T_IN) / 2 };
    r.ops = { T: [], L: [], R: [], B: [] };
    const len = (s) => (s === 'T' || s === 'B' ? r.w : r.d);
    if (r.door === 'T') r.ops.T.push({ c: r.w / 2 + (r.col % 2 ? 0.15 : -0.15) * Math.min(1, r.w / 3), w: 0.9, kind: 'door' });
    else if (r.col === 0) r.ops.L.push({ c: r.d / 2, w: 1.0, kind: 'door', entry: true });
    else if (r.k === 'cozinha' && r.prev && r.prev.k === 'sala') r.ops.L.push({ c: r.d / 2, w: Math.min(2.4, r.d * 0.7), kind: 'pass' });
    else if (r.k === 'varanda') r.ops.L.push({ c: r.d / 2, w: Math.min(2.0, r.d * 0.6), kind: 'pass' });
    else r.ops.L.push({ c: r.d / 2, w: 0.9, kind: 'door' });
    const pref = r.row === 0 ? ['T', 'L', 'R', 'B'] : ['B', 'L', 'R', 'T'];
    const extSide = pref.find((sd) => r.ext[sd] && sd !== r.door && !(sd === 'L' && r.ops.L.length)) || null;
    r.win = null; r.gate = null;
    if (extSide) {
      const L = len(extSide);
      if (r.k === 'garagem') { r.gate = extSide; r.ops[extSide].push({ c: L / 2, w: Math.min(2.8, L - 0.5), kind: 'gate' }); }
      else if (r.k === 'banheiro' || r.k === 'lavabo') { r.win = extSide; r.ops[extSide].push({ c: L / 2, w: 0.6, kind: 'high' }); }
      else if (r.k !== 'varanda') {
        const ww = { sala: Math.min(2.2, L * 0.55), quarto: Math.min(1.5, L * 0.5), suite: Math.min(1.6, L * 0.5), cozinha: Math.min(1.2, L * 0.45), servico: Math.min(0.9, L * 0.45) }[r.k] || 1.2;
        r.win = extSide; r.ops[extSide].push({ c: L / 2, w: ww, kind: 'win' });
      }
    }
  });
  const segs = [];
  rooms.forEach((r) => {
    segs.push({ r, side: 'T', horiz: true, x0: r.x0, z0: r.z0, len: r.w, ext: r.ext.T, thick: r.ext.T ? T_OUT : T_IN, inS: 1, ops: r.ops.T });
    segs.push({ r, side: 'L', horiz: false, x0: r.x0, z0: r.z0, len: r.d, ext: r.ext.L, thick: r.ext.L ? T_OUT : T_IN, inS: 1, ops: r.ops.L });
    if (r.last) segs.push({ r, side: 'R', horiz: false, x0: r.x0 + r.w, z0: r.z0, len: r.d, ext: true, thick: T_OUT, inS: -1, ops: r.ops.R });
    if (r.lastRow) segs.push({ r, side: 'B', horiz: true, x0: r.x0, z0: r.z0 + r.d, len: r.w, ext: true, thick: T_OUT, inS: -1, ops: r.ops.B });
  });
  /* aberturas vistas de dentro de cada cômodo, em coordenadas do próprio cômodo */
  rooms.forEach((r) => {
    const res = { T: [], B: [], L: [], R: [] };
    segs.forEach((sg) => sg.ops.forEach((op) => {
      const a = op.c - op.w / 2, b = op.c + op.w / 2;
      if (sg.horiz) {
        const xa = sg.x0 + a, xb = sg.x0 + b;
        [['T', r.z0], ['B', r.z0 + r.d]].forEach(([sd, zz]) => { if (Math.abs(sg.z0 - zz) < 1e-4 && xb > r.x0 + 1e-4 && xa < r.x0 + r.w - 1e-4) res[sd].push({ a: xa - r.cx, b: xb - r.cx, kind: op.kind, own: sg.r === r }); });
      } else {
        const za = sg.z0 + a, zb = sg.z0 + b;
        [['L', r.x0], ['R', r.x0 + r.w]].forEach(([sd, xx]) => { if (Math.abs(sg.x0 - xx) < 1e-4 && zb > r.z0 + 1e-4 && za < r.z0 + r.d - 1e-4) res[sd].push({ a: za - r.cz, b: zb - r.cz, kind: op.kind, own: sg.r === r }); });
      }
    }));
    r.opens = res;
    r.X0 = -r.w / 2 + r.ins.L; r.X1 = r.w / 2 - r.ins.R; r.Z0 = -r.d / 2 + r.ins.T; r.Z1 = r.d / 2 - r.ins.B;
    r.iw = r.X1 - r.X0; r.id = r.Z1 - r.Z0;
  });
  return { rooms, segs, W, D, total };
}
const roomAt = (plan, x, z) => plan.rooms.find((r) => x >= r.x0 - 1e-4 && x <= r.x0 + r.w + 1e-4 && z >= r.z0 - 1e-4 && z <= r.z0 + r.d + 1e-4) || null;

function bindDescription(build) {
  const input = $('#txt');
  const hint = $('#hint');
  const presets = $('#house-presets');
  const options = [...presets.querySelectorAll('button')];
  const exampleSignatures = options.map((button) => obraSig(parse(button.dataset.house).obra));
  function showPreset(signature) {
    options.forEach((button, index) => {
      button.setAttribute('aria-pressed', String(exampleSignatures[index] === signature));
    });
  }
  let lastObra = null;
  let timer;
  const fromText = (text) => {
    const { obra } = parse(text || '');
    if (!obraTemComodos(obra)) {
      hint.textContent = 'Informe pelo menos um ambiente. Exemplo: casa de 2 quartos, 1 banheiro, sala e cozinha, 80 m².';
      hint.className = 'hint';
      showPreset('');
      if (!lastObra) build(DEFAULT_OBRA);
      return;
    }
    const signature = obraSig(obra);
    showPreset(signature);
    lastObra = obra;
    hint.textContent = 'Entendi: ' + obraFrase(obra) + '.';
    hint.className = 'hint ok';
    try { history.replaceState(null, '', '#' + signature); } catch { /* sem histórico */ }
    const message = `Olá, vim pelo site da Konan Tech. Descrevi esta casa: ${obraFrase(obra)}. Quero conversar sobre a minha obra.`;
    document.querySelectorAll('[data-wa]').forEach((link) => { link.href = waLink(message); });
    build(obra);
  };
  const submit = () => { clearTimeout(timer); fromText(input.value); };
  $('#build').addEventListener('click', submit);
  presets.addEventListener('click', (event) => {
    const button = event.target.closest('[data-house]');
    if (!button) return;
    input.value = button.dataset.house;
    submit();
  });
  presets.hidden = false;
  input.addEventListener('keydown', (event) => { if (event.key === 'Enter') { event.preventDefault(); submit(); } });
  input.addEventListener('input', () => { clearTimeout(timer); timer = setTimeout(submit, 900); });
  try {
    const initial = obraFromSig(decodeURIComponent(location.hash.slice(1)));
    if (obraTemComodos(initial)) input.value = obraFrase(initial);
  } catch { /* usa o exemplo já preenchido */ }
  submit();
  return fromText;
}

function showPlanInterface(visible, canReturn, real = false) {
  $('#plan-view').hidden = !visible;
  $('#cv').hidden = visible;
  $('#labels').hidden = visible;
  $('#drag').hidden = visible;
  $('#modo').hidden = visible;
  $('#whole').hidden = visible;
  $('#replay').hidden = visible || real;
  $('#facade').hidden = visible || !real;
  $('#lighting').hidden = visible || !real;
  $('#foto').hidden = visible || !real;
  $('#top').hidden = !canReturn;
  $('#top').textContent = visible ? 'Voltar ao 3D' : 'Planta 2D';
  $('#top').setAttribute('aria-pressed', String(visible));
}

function mountPlanOnly() {
  showPlanInterface(true, false);
  $('#graphics-status').textContent = 'O 3D está indisponível neste navegador. A planta 2D continua funcionando.';
  $('#rooms-hint').textContent = 'Escolha um ambiente para destacar na planta.';
  bindDescription((obra) => {
    const plan = planHouse(obra);
    const draw = (selected) => {
      renderPlan($('#plan-svg'), plan, selected);
      renderRooms(plan, selected, draw);
    };
    draw(-1);
  });
}

function createRenderer(canvas) {
  const options = { antialias: true, alpha: true };
  const context = canvas.getContext('webgl2', options);
  return context ? new THREE.WebGLRenderer({ canvas, context, ...options }) : null;
}

/* ---------- 2. a cena ---------- */
function mount3D(renderer) {
  const stage = $('#stage'), cv = $('#cv'), labelsEl = $('#labels');
  const LIGHT_GPU = COARSE || (navigator.deviceMemory ?? 8) <= 4;
  let PR = Math.min(devicePixelRatio || 1, LIGHT_GPU ? 1.35 : 1.75);
  renderer.setPixelRatio(PR);
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFShadowMap;
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.localClippingEnabled = true;
  /* corte das paredes na vista de fora do modo realista */
  const CUT_H = 1.55;
  const CUT = new THREE.Plane(new THREE.Vector3(0, -1, 0), 100);
  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(32, 1, 0.05, 600);
  const controls = new OrbitControls(camera, cv);
  controls.enableDamping = true;
  controls.dampingFactor = 0.08;
  controls.maxPolarAngle = Math.PI * 0.46;
  controls.zoomSpeed = 0.8;
  controls.autoRotate = false;

  const hemi = new THREE.HemisphereLight(0xffffff, 0xc9d6ea, 0.95);
  scene.add(hemi);
  const sun = new THREE.DirectionalLight(0xffead8, 1.35);
  sun.castShadow = true;
  sun.shadow.mapSize.setScalar(LIGHT_GPU ? 1024 : 2048);
  sun.shadow.autoUpdate = false;
  sun.shadow.bias = -0.0004;
  sun.shadow.normalBias = 0.025;
  sun.shadow.radius = 3;
  scene.add(sun, sun.target);
  const roomLight = new THREE.PointLight(0xfff1dc, 0, 0, 1.4);
  scene.add(roomLight);
  const eveningLamps = Array.from({ length: LIGHT_GPU ? 1 : 2 }, () => new THREE.PointLight(0xffbf86, 0, 0, 1.75));
  scene.add(...eveningLamps);
  const eveningHorizon = new THREE.Color('#3b557d');
  const SUN_DIR = new THREE.Vector3(-1.4, 1.3, 1.15).normalize();
  /* céu em alta faixa dinâmica: com sol para a foto realista, sem sol para o 3D (que já tem a luz do sol) */
  function skyEquirect(withSun, night = false) {
    const W = night ? 512 : 1024, H = W / 2, data = new Float32Array(W * H * 4);
    const zen = night ? [0.027, 0.059, 0.15] : [0.19, 0.37, 0.72];
    const hor = night ? [0.11, 0.19, 0.34] : [0.86, 0.9, 0.96];
    const gnd = night ? [0.025, 0.037, 0.055] : [0.29, 0.3, 0.25];
    const K = 0.48;
    const sunR = THREE.MathUtils.degToRad(1.6), sunCos = Math.cos(sunR), sunL = withSun ? 1650 : 0;
    for (let j = 0; j < H; j++) {
      const el = ((j + 0.5) / H - 0.5) * Math.PI, ce = Math.cos(el), se = Math.sin(el);
      for (let i = 0; i < W; i++) {
        const ph = ((i + 0.5) / W - 0.5) * 2 * Math.PI, dx = ce * Math.cos(ph), dz = ce * Math.sin(ph);
        let c;
        if (se >= 0) { const t = Math.pow(se, 0.45); c = [lerp(hor[0], zen[0], t), lerp(hor[1], zen[1], t), lerp(hor[2], zen[2], t)]; }
        else { const t = Math.min(1, -se * 5); c = [lerp(hor[0], gnd[0], t) * 0.6, lerp(hor[1], gnd[1], t) * 0.6, lerp(hor[2], gnd[2], t) * 0.6]; }
        const ca = dx * SUN_DIR.x + se * SUN_DIR.y + dz * SUN_DIR.z;
        let s = 0;
        if (withSun) { s = ca > sunCos ? sunL : Math.pow(Math.max(0, ca), 600) * 6 + Math.pow(Math.max(0, ca), 40) * 0.25; }
        const k = (j * W + i) * 4;
        data[k] = c[0] * K + s; data[k + 1] = c[1] * K + s * 0.93; data[k + 2] = c[2] * K + s * 0.82; data[k + 3] = 1;
      }
    }
    const t = new THREE.DataTexture(data, W, H, THREE.RGBAFormat, THREE.FloatType);
    t.mapping = THREE.EquirectangularReflectionMapping; t.magFilter = t.minFilter = THREE.LinearFilter; t.generateMipmaps = false; t.needsUpdate = true;
    return t;
  }

  const grid = new THREE.GridHelper(60, 60, 0xb9c8df, 0xdbe4f1);
  grid.position.y = -0.02;
  grid.material.transparent = true;
  grid.material.opacity = 0.7;
  scene.add(grid);

  /* céu e chão do modo realista */
  const HORIZON = new THREE.Color('#e5e9e8');
  const skyGeo = new THREE.SphereGeometry(300, 32, 16);
  {
    const pos = skyGeo.attributes.position, col = [];
    const zen = new THREE.Color('#79a9cf'), c = new THREE.Color();
    for (let i = 0; i < pos.count; i++) { const t = Math.pow(clamp(pos.getY(i) / 300), 0.55); c.copy(HORIZON).lerp(zen, t); col.push(c.r, c.g, c.b); }
    skyGeo.setAttribute('color', new THREE.Float32BufferAttribute(col, 3));
  }
  const sky = new THREE.Mesh(skyGeo, new THREE.MeshBasicMaterial({ vertexColors: true, side: THREE.BackSide, fog: false, depthWrite: false }));
  sky.userData.noAO = true;
  sky.visible = false;
  scene.add(sky);

  /* ---------- 3. texturas desenhadas por código ---------- */
  const rng = (seed) => { let s = seed >>> 0; return () => (s = (s * 1664525 + 1013904223) >>> 0) / 4294967296; };
  function canvasTex(draw, S, rep) {
    const c = document.createElement('canvas'); c.width = c.height = S;
    draw(c.getContext('2d'), S);
    const t = new THREE.CanvasTexture(c);
    t.wrapS = t.wrapT = THREE.RepeatWrapping; t.colorSpace = THREE.SRGBColorSpace;
    t.anisotropy = Math.min(renderer.capabilities.getMaxAnisotropy(), LIGHT_GPU ? 4 : 8);
    if (rep) t.repeat.set(rep, rep);
    return t;
  }
  function planks(g, S, rows, hue, sat, l0, l1, seed) {
    const R = rng(seed), h = S / rows;
    for (let i = 0; i < rows; i++) {
      let x = -R() * S * 0.5;
      while (x < S) {
        const w = S * (0.45 + R() * 0.35);
        g.fillStyle = `hsl(${hue + R() * 6},${sat + R() * 10}%,${l0 + R() * (l1 - l0)}%)`;
        g.fillRect(x, i * h, w, h);
        for (let k = 0; k < 18; k++) { g.strokeStyle = `rgba(60,34,16,${0.04 + R() * 0.08})`; g.lineWidth = 1; const y = i * h + R() * h; g.beginPath(); g.moveTo(x, y); g.bezierCurveTo(x + w * 0.3, y + (R() - 0.5) * 4, x + w * 0.6, y + (R() - 0.5) * 4, x + w, y + (R() - 0.5) * 3); g.stroke(); }
        g.fillStyle = 'rgba(35,22,10,0.5)'; g.fillRect(x, i * h, 2, h);
        x += w;
      }
      g.fillStyle = 'rgba(35,22,10,0.45)'; g.fillRect(0, i * h, S, 2);
    }
  }
  const noise = (g, S, n, seed, rgba) => { const R = rng(seed); for (let k = 0; k < n; k++) { g.fillStyle = rgba(R); g.fillRect(R() * S, R() * S, 1 + R() * 2, 1 + R() * 2); } };
  const TEXF = {
    /* pisos (UV em metros: repeat = 1 / tamanho do desenho) */
    wood: [(g, S) => planks(g, S, 10, 29, 24, 52, 60, 7), 1024, 1 / 2.4],
    deck: [(g, S) => planks(g, S, 8, 24, 32, 28, 40, 11), 512, 1 / 2.4],
    tile: [(g, S) => {
      const R = rng(3), t = S / 2;
      for (let i = 0; i < 2; i++) for (let j = 0; j < 2; j++) { g.fillStyle = `hsl(36,12%,${78 + R() * 7}%)`; g.fillRect(i * t, j * t, t, t); }
      noise(g, S, 6000, 4, (next) => `rgba(121,109,93,${next() * 0.13})`);
      g.fillStyle = '#aba498';
      for (let i = 0; i <= 2; i++) { g.fillRect(i * t - 1, 0, 2, S); g.fillRect(0, i * t - 1, S, 2); }
    }, 512, 1 / 1.2],
    conc: [(g, S) => { g.fillStyle = '#b4b6b8'; g.fillRect(0, 0, S, S); noise(g, S, 9000, 5, (R) => { const v = 120 + R() * 100; return `rgba(${v},${v},${v + 3},${0.08 + R() * 0.14})`; }); }, 512, 1 / 3],
    grass: [(g, S) => {
      const R = rng(9); g.fillStyle = '#8cb269'; g.fillRect(0, 0, S, S);
      for (let k = 0; k < 14000; k++) { g.fillStyle = `hsla(${82 + R() * 28},${32 + R() * 20}%,${34 + R() * 26}%,${0.22 + R() * 0.3})`; g.fillRect(R() * S, R() * S, 1 + R() * 1.5, 2 + R() * 4); }
    }, 512, 1 / 3],
    pave: [(g, S) => {
      const R = rng(21), n = 4, t = S / n;
      for (let i = 0; i < n; i++) for (let j = 0; j < n; j++) { g.fillStyle = `hsl(30,6%,${66 + R() * 10}%)`; g.fillRect(i * t, j * t, t, t); }
      noise(g, S, 6000, 22, (R) => `rgba(90,85,80,${R() * 0.12})`);
      g.fillStyle = 'rgba(80,76,70,0.7)'; for (let i = 0; i <= n; i++) { g.fillRect(i * t - 1.5, 0, 3, S); g.fillRect(0, i * t - 1.5, S, 3); }
    }, 512, 1 / 2],
    /* paredes */
    subway: [(g, S) => {
      const R = rng(13), rows = 16, cols = 4, h = S / rows, w = S / cols;
      g.fillStyle = '#c9cbcc'; g.fillRect(0, 0, S, S);
      for (let i = 0; i < rows; i++) for (let j = -1; j < cols; j++) { const x = j * w + (i % 2 ? w / 2 : 0); g.fillStyle = `hsl(200,6%,${93 + R() * 4}%)`; g.fillRect(x + 1.5, i * h + 1.5, w - 3, h - 3); }
    }, 512, 1 / 1.2],
    plaster: [(g, S) => { g.fillStyle = '#f4f1ec'; g.fillRect(0, 0, S, S); noise(g, S, 12000, 17, (R) => { const v = 200 + R() * 50; return `rgba(${v},${v - 4},${v - 10},${0.12 + R() * 0.12})`; }); }, 512, 1 / 2],
    /* móveis (UV de cada face vai de 0 a 1) */
    grain: [(g, S) => {
      const R = rng(31); g.fillStyle = '#d8d8d8'; g.fillRect(0, 0, S, S);
      for (let k = 0; k < 140; k++) { g.strokeStyle = `rgba(90,70,50,${0.05 + R() * 0.12})`; g.lineWidth = 0.5 + R() * 1.5; const y = R() * S; g.beginPath(); g.moveTo(0, y); g.bezierCurveTo(S * 0.3, y + (R() - 0.5) * 18, S * 0.7, y + (R() - 0.5) * 18, S, y + (R() - 0.5) * 6); g.stroke(); }
    }, 256, 0],
    fabric: [(g, S) => {
      g.fillStyle = '#e9e9e9'; g.fillRect(0, 0, S, S);
      for (let i = 0; i < S; i += 2) { g.fillStyle = `rgba(255,255,255,${i % 4 ? 0.16 : 0.05})`; g.fillRect(0, i, S, 1); g.fillStyle = `rgba(0,0,0,${i % 4 ? 0.05 : 0.09})`; g.fillRect(i, 0, 1, S); }
      noise(g, S, 4000, 41, (R) => `rgba(0,0,0,${R() * 0.07})`);
    }, 256, 3],
    marble: [(g, S) => {
      const R = rng(51); g.fillStyle = '#f1efec'; g.fillRect(0, 0, S, S);
      for (let k = 0; k < 26; k++) { g.strokeStyle = `rgba(120,118,115,${0.08 + R() * 0.2})`; g.lineWidth = 0.6 + R() * 2.2; let x = R() * S, y = R() * S; g.beginPath(); g.moveTo(x, y); for (let j = 0; j < 7; j++) { x += (R() - 0.3) * 90; y += (R() - 0.5) * 70; g.lineTo(x, y); } g.stroke(); }
    }, 512, 0],
    rugA: [(g, S) => {
      g.fillStyle = '#e7dfd2'; g.fillRect(0, 0, S, S);
      g.strokeStyle = '#c9bba5'; g.lineWidth = 10; g.strokeRect(22, 22, S - 44, S - 44);
      g.strokeStyle = '#7d8fa8'; g.lineWidth = 4; g.strokeRect(44, 44, S - 88, S - 88);
      noise(g, S, 9000, 61, (R) => `rgba(90,80,60,${R() * 0.08})`);
    }, 512, 0],
    rugB: [(g, S) => {
      const R = rng(71); g.fillStyle = '#d9d4cb'; g.fillRect(0, 0, S, S);
      for (let i = 0; i < 14; i++) { g.fillStyle = i % 3 === 0 ? '#5f7392' : i % 3 === 1 ? '#c7b79c' : '#ece7de'; g.fillRect(0, (i * S) / 14, S, S / 28); }
      noise(g, S, 9000, 72, () => `rgba(60,50,40,${R() * 0.08})`);
    }, 512, 0],
  };
  const ART = [
    (g, S) => { g.fillStyle = '#efe9df'; g.fillRect(0, 0, S, S); g.fillStyle = '#1b5fd9'; g.beginPath(); g.arc(S * 0.38, S * 0.45, S * 0.24, 0, Math.PI * 2); g.fill(); g.fillStyle = '#d9a441'; g.fillRect(S * 0.5, S * 0.35, S * 0.3, S * 0.42); g.fillStyle = '#2f3e4e'; g.fillRect(S * 0.15, S * 0.78, S * 0.7, S * 0.03); },
    (g, S) => { g.fillStyle = '#e8e3d9'; g.fillRect(0, 0, S, S); const c = ['#8fa58a', '#c96f4a', '#e3d3b4', '#3d4f63']; for (let i = 0; i < 4; i++) { g.fillStyle = c[i]; g.beginPath(); g.ellipse(S * (0.25 + i * 0.17), S * (0.62 - (i % 2) * 0.2), S * 0.16, S * 0.26, 0.3 * i, 0, Math.PI * 2); g.fill(); } },
    (g, S) => { g.fillStyle = '#f3efe8'; g.fillRect(0, 0, S, S); g.strokeStyle = '#2f3e4e'; g.lineWidth = S * 0.012; for (let i = 0; i < 9; i++) { g.beginPath(); g.arc(S * 0.5, S * 1.05, S * (0.18 + i * 0.07), Math.PI, 0); g.stroke(); } g.fillStyle = '#c96f4a'; g.beginPath(); g.arc(S * 0.7, S * 0.28, S * 0.09, 0, Math.PI * 2); g.fill(); },
  ];
  /* relevo (normal map) tirado do próprio desenho: rejunte, emenda de tábua, veio, trama */
  const NRM = { wood: 1.35, deck: 1.7, tile: 1.3, conc: 1.2, pave: 2.1, subway: 2.1, plaster: 0.65, grain: 0.7, fabric: 0.8, grass: 0.65 };
  function drawSurfaceData(key, g, size, rough) {
    const random = rng(93);
    const gray = (value) => `rgb(${value} ${value} ${value})`;
    g.fillStyle = gray(rough ? 226 : 130);
    g.fillRect(0, 0, size, size);
    if (key === 'tile') {
      for (let i = 0; i < 2; i++) for (let j = 0; j < 2; j++) {
        g.fillStyle = gray(rough ? 180 + Math.floor(random() * 30) : 159);
        g.fillRect(i * size / 2 + 1, j * size / 2 + 1, size / 2 - 2, size / 2 - 2);
      }
      return;
    }
    const pitch = key === 'wood' ? size / 10 : key === 'fabric' ? 4 : 20;
    for (let y = 0; y < size; y += pitch) {
      g.fillStyle = gray(rough ? 170 + Math.floor(random() * 60) : 115);
      g.fillRect(0, y, size, key === 'fabric' ? 1 : Math.max(1, pitch * 0.035));
      if (key === 'wood') {
        g.strokeStyle = rough ? 'rgba(128,128,128,.26)' : 'rgba(150,150,150,.44)';
        for (let i = 0; i < 12; i++) {
          const yy = y + 2 + random() * (pitch - 4);
          g.beginPath(); g.moveTo(0, yy);
          g.bezierCurveTo(size * 0.32, yy + 2, size * 0.65, yy - 2, size, yy);
          g.stroke();
        }
      }
    }
    if (key === 'fabric') {
      g.fillStyle = gray(rough ? 185 : 145);
      for (let x = 0; x < size; x += pitch) g.fillRect(x, 0, 1, size);
    }
  }
  const SURFACES = new Set(['wood', 'tile', 'fabric']);
  const ROUGHC = {};
  function surfaceData(key, rough) {
    const base = getTex(key);
    const texture = canvasTex((g, size) => drawSurfaceData(key, g, size, rough), Math.min(base.image.width, 512));
    texture.colorSpace = THREE.NoColorSpace;
    texture.repeat.copy(base.repeat);
    return texture;
  }
  const NRMC = {};
  function getNrm(k) {
    if (NRMC[k]) return NRMC[k];
    const height = SURFACES.has(k) ? surfaceData(k, false) : null;
    const src = (height || getTex(k)).image, S = src.width;
    const d = src.getContext('2d').getImageData(0, 0, S, S).data;
    if (height) height.dispose();
    const hgt = new Float32Array(S * S);
    for (let i = 0; i < S * S; i++) hgt[i] = (d[i * 4] * 0.3 + d[i * 4 + 1] * 0.59 + d[i * 4 + 2] * 0.11) / 255;
    const c = document.createElement('canvas'); c.width = c.height = S;
    const g = c.getContext('2d'), out = g.createImageData(S, S), o = out.data, k2 = NRM[k] * (S / 512);
    const at = (x, y) => hgt[((y + S) % S) * S + ((x + S) % S)];
    for (let y = 0; y < S; y++) for (let x = 0; x < S; x++) {
      const dx = (at(x + 1, y - 1) + 2 * at(x + 1, y) + at(x + 1, y + 1) - at(x - 1, y - 1) - 2 * at(x - 1, y) - at(x - 1, y + 1)) * k2;
      const dy = (at(x - 1, y + 1) + 2 * at(x, y + 1) + at(x + 1, y + 1) - at(x - 1, y - 1) - 2 * at(x, y - 1) - at(x + 1, y - 1)) * k2;
      const nx = -dx, ny = dy, nz = 1, l = Math.hypot(nx, ny, nz), i = (y * S + x) * 4;
      o[i] = (nx / l * 0.5 + 0.5) * 255; o[i + 1] = (ny / l * 0.5 + 0.5) * 255; o[i + 2] = (nz / l * 0.5 + 0.5) * 255; o[i + 3] = 255;
    }
    g.putImageData(out, 0, 0);
    const t = new THREE.CanvasTexture(c);
    t.wrapS = t.wrapT = THREE.RepeatWrapping; t.colorSpace = THREE.NoColorSpace;
    t.anisotropy = getTex(k).anisotropy;
    t.repeat.copy(getTex(k).repeat);
    return (NRMC[k] = t);
  }
  const TEXC = {};
  function getTex(k) {
    if (TEXC[k]) return TEXC[k];
    if (k.startsWith('art')) return (TEXC[k] = canvasTex(ART[+k.slice(3)], 512, 0));
    const [draw, S, rep] = TEXF[k];
    return (TEXC[k] = canvasTex(draw, LIGHT_GPU ? Math.min(512, S) : S, rep));
  }

  /* ---------- 4. materiais (compartilhados) ---------- */
  const MATS = new Map();
  function mat(color, o = {}) {
    const key = [color, o.r ?? 0.85, o.m ?? 0, o.tex || '', o.o ?? 1, o.e || '', o.ei ?? 1, o.ds ? 1 : 0, o.phys ? 1 : 0, o.clip ? 1 : 0].join('|');
    let m = MATS.get(key);
    if (!m) {
      m = new (o.phys ? THREE.MeshPhysicalMaterial : THREE.MeshStandardMaterial)({ color, roughness: o.r ?? 0.85, metalness: o.m ?? 0 });
      if (o.tex) {
        m.map = getTex(o.tex);
        if (NRM[o.tex]) m.normalMap = getNrm(o.tex);
        if (SURFACES.has(o.tex)) m.roughnessMap = ROUGHC[o.tex] ||= surfaceData(o.tex, true);
      }
      if ((o.o ?? 1) < 1) { m.transparent = true; m.opacity = o.o; m.depthWrite = false; }
      if (o.e) { m.emissive = new THREE.Color(o.e); m.emissiveIntensity = o.ei ?? 1; }
      if (o.ds) m.side = THREE.DoubleSide;
      if (o.clip) { m.clippingPlanes = [CUT]; m.clipShadows = true; }
      MATS.set(key, m);
    }
    return m;
  }
  const M = {
    oak: () => mat('#c79b6b', { tex: 'grain', r: 0.6 }),
    walnut: () => mat('#7a5539', { tex: 'grain', r: 0.55 }),
    white: () => mat('#f2f0ec', { r: 0.4 }),
    cab: () => mat('#eeebe5', { r: 0.42 }),
    gap: () => mat('#3a3631', { r: 0.9 }),
    dark: () => mat('#26292d', { r: 0.5, m: 0.4 }),
    steel: () => mat('#c3c8cd', { r: 0.3, m: 0.85 }),
    chrome: () => mat('#e4e7ea', { r: 0.12, m: 1 }),
    stone: () => mat('#ffffff', { tex: 'marble', r: 0.22 }),
    ceramic: () => mat('#f8f8f6', { r: 0.12 }),
    linen: () => mat('#f4f2ed', { tex: 'fabric', r: 0.97 }),
    duvet: () => mat('#e9ecef', { tex: 'fabric', r: 0.97 }),
    shade: () => mat('#f6efe2', { r: 0.9, e: '#ffd9a3', ei: 0.35 }),
    bulb: () => mat('#ffffff', { e: '#fff1d6', ei: 1.4, r: 0.5 }),
    warmStrip: () => mat('#ffe5c1', { e: '#ffbd78', ei: 2.8, r: 0.6 }),
    screen: () => mat('#0c0f13', { r: 0.12, m: 0.3 }),
    glass: () => mat('#d8ebf5', { r: 0.04, m: 0.1, o: 0.22, ds: true }),
    mirror: () => mat('#dfe5ea', { r: 0.03, m: 1 }),
    leaf: () => mat('#3f7a45', { r: 0.7, ds: true }),
    leaf2: () => mat('#56924f', { r: 0.7, ds: true }),
    pot: () => mat('#e9e4dc', { r: 0.6 }),
    terracota: () => mat('#b86a45', { r: 0.8 }),
    soil: () => mat('#4a3628', { r: 1 }),
    basin: () => mat('#9aa3ab', { r: 0.25, m: 0.8 }),
  };
  const ACCENT = ['#5576a8', '#8fa58a', '#c99a3c', '#b8725a', '#6d8f9c'];

  /* ---------- 5. geometria ---------- */
  function meterUV(g, sx, sy, sz) {
    const uv = g.attributes.uv, dims = [[sz, sy], [sz, sy], [sx, sz], [sx, sz], [sx, sy], [sx, sy]];
    for (let f = 0; f < 6; f++) for (let k = 0; k < 4; k++) { const i = f * 4 + k; uv.setXY(i, uv.getX(i) * dims[f][0], uv.getY(i) * dims[f][1]); }
    return g;
  }
  const G = () => new THREE.Group();
  /* caixa (arredondada quando há raio); y é a base */
  function rb(p, w, h, d, m, x, y, z, rad = 0.02, meter = false) {
    const r = Math.min(rad, w / 2 - 0.001, h / 2 - 0.001, d / 2 - 0.001);
    const geo = r > 0.004 ? new RoundedBoxGeometry(w, h, d, LIGHT_GPU ? 1 : 2, r) : (meter ? meterUV(new THREE.BoxGeometry(w, h, d), w, h, d) : new THREE.BoxGeometry(w, h, d));
    const mesh = new THREE.Mesh(geo, m);
    mesh.position.set(x, y + h / 2, z);
    p.add(mesh);
    return mesh;
  }
  function cy(p, rt, rbot, h, m, x, y, z, seg = 24) {
    const mesh = new THREE.Mesh(new THREE.CylinderGeometry(rt, rbot, h, seg), m);
    mesh.position.set(x, y + h / 2, z);
    p.add(mesh);
    return mesh;
  }
  function sp(p, r, m, x, y, z, sx = 1, sy = 1, sz = 1, ws = 18, hs = 12) {
    const mesh = new THREE.Mesh(new THREE.SphereGeometry(r, ws, hs), m);
    mesh.position.set(x, y, z); mesh.scale.set(sx, sy, sz);
    p.add(mesh);
    return mesh;
  }
  /* junta as peças de um móvel por material: menos chamadas de desenho */
  function bake(g) {
    g.updateMatrixWorld(true);
    const inv = new THREE.Matrix4().copy(g.matrixWorld).invert();
    const by = new Map(), kill = [];
    g.traverse((o) => {
      if (!o.isMesh) return;
      const key = o.material.uuid + (o.geometry.index ? ':indexed' : ':plain');
      if (!by.has(key)) by.set(key, { material: o.material, list: [] });
      const geo = o.geometry.clone();
      geo.applyMatrix4(new THREE.Matrix4().multiplyMatrices(inv, o.matrixWorld));
      by.get(key).list.push(geo); kill.push(o);
    });
    kill.forEach((o) => { o.parent.remove(o); o.geometry.dispose(); });
    [...g.children].forEach((c) => { if (c.isGroup && !c.children.length) g.remove(c); });
    by.forEach(({ list, material: m }) => {
      const merged = mergeGeometries(list, false);
      list.forEach((x) => x.dispose());
      if (!merged) return;
      const mesh = new THREE.Mesh(merged, m);
      mesh.castShadow = !m.transparent && !(m.emissive && m.emissiveIntensity > 1);
      mesh.receiveShadow = true;
      g.add(mesh);
    });
    g.traverse((o) => { if (o.isMesh && !o.material.transparent) { o.castShadow = true; o.receiveShadow = true; } });
    return g;
  }

  /* ---------- 6. móveis: cada um tem o fundo em z negativo e a frente em z positivo ---------- */
  let REAL = false, NIGHT = false, WALL_H = 1.6;
  const tallCap = (h) => (REAL ? h : Math.min(h, 1.42));

  function lamp(g, x, z, y) {
    cy(g, 0.06, 0.08, 0.04, M.ceramic(), x, y, z);
    cy(g, 0.012, 0.012, 0.22, M.dark(), x, y + 0.04, z, 8);
    cy(g, 0.1, 0.14, 0.18, M.shade(), x, y + 0.22, z);
  }
  function bedSet(o) {
    const g = G(), bw = o.single ? 0.95 : 1.6, L = bw + 0.12, D = 2.12;
    const fab = mat(o.head, { tex: 'fabric', r: 0.96 }), acc = mat(o.accent, { tex: 'fabric', r: 0.96 });
    [[-1, -1], [1, -1], [-1, 1], [1, 1]].forEach(([a, b]) => cy(g, 0.025, 0.02, 0.1, M.dark(), a * (L / 2 - 0.08), 0, b * (D / 2 - 0.14) + 0.04, 10));
    rb(g, L, 0.26, D - 0.1, fab, 0, 0.1, 0.05, 0.03);
    rb(g, bw, 0.24, 1.98, M.linen(), 0, 0.34, 0.06, 0.07);
    rb(g, bw + 0.08, 0.09, 1.42, M.duvet(), 0, 0.52, 0.35, 0.045);
    rb(g, bw + 0.1, 0.05, 0.5, acc, 0, 0.6, 0.78, 0.025);
    const np = o.single ? 1 : 2, pw = o.single ? 0.62 : 0.66;
    for (let i = 0; i < np; i++) { const p = rb(g, pw, 0.16, 0.4, M.linen(), np === 1 ? 0 : (i ? 1 : -1) * (pw / 2 + 0.03), 0.55, -0.7, 0.075); p.rotation.x = -0.38; }
    const cu = rb(g, 0.42, 0.34, 0.12, acc, 0, 0.58, -0.46, 0.055); cu.rotation.x = -0.32;
    rb(g, L + 0.1, 1.08, 0.09, fab, 0, 0.02, -D / 2 + 0.045, 0.035);
    let LL = L;
    if (o.stands) {
      [-1, 1].forEach((sd) => {
        const x = sd * (L / 2 + 0.06 + 0.22);
        rb(g, 0.44, 0.46, 0.4, M.oak(), x, 0.1, -D / 2 + 0.22, 0.015);
        rb(g, 0.38, 0.006, 0.006, M.gap(), x, 0.36, -D / 2 + 0.42, 0);
        [-1, 1].forEach((a) => [-1, 1].forEach((b) => cy(g, 0.012, 0.012, 0.1, M.dark(), x + a * 0.18, 0, -D / 2 + 0.22 + b * 0.15, 6)));
        lamp(g, x, -D / 2 + 0.2, 0.56);
      });
      LL = L + 2 * 0.56;
    }
    return { g: bake(g), L: LL, D, h: 1.1 };
  }
  function wardrobe(L) {
    const g = G(), D = 0.6, H = tallCap(2.2);
    rb(g, L - 0.04, 0.08, D - 0.08, M.gap(), 0, 0, -0.02, 0);
    rb(g, L, H - 0.08, D - 0.02, M.cab(), 0, 0.08, -0.01, 0.01);
    const n = Math.max(2, Math.round(L / 0.5)), pw = L / n;
    for (let i = 1; i < n; i++) rb(g, 0.006, H - 0.16, 0.004, M.gap(), -L / 2 + i * pw, 0.12, D / 2 - 0.018, 0);
    for (let i = 0; i < n; i++) { const x = -L / 2 + (i + 0.5) * pw + (i % 2 ? -1 : 1) * (pw / 2 - 0.06); rb(g, 0.014, 0.34, 0.02, M.steel(), x, Math.min(0.95, H * 0.45), D / 2 - 0.01, 0.005); }
    return { g: bake(g), L, D, h: H };
  }
  function sofa(L, color, accent) {
    const g = G(), D = 0.92, f = mat(color, { tex: 'fabric', r: 0.97 }), a = mat(accent, { tex: 'fabric', r: 0.97 }), arm = 0.17;
    [[-1, -1], [1, -1], [-1, 1], [1, 1]].forEach(([x, z]) => cy(g, 0.02, 0.015, 0.1, M.dark(), x * (L / 2 - 0.1), 0, z * (D / 2 - 0.1), 8));
    rb(g, L, 0.22, D, f, 0, 0.1, 0, 0.04);
    [-1, 1].forEach((s) => rb(g, arm, 0.36, D, f, s * (L / 2 - arm / 2), 0.28, 0, 0.065));
    rb(g, L - 2 * arm + 0.02, 0.44, 0.22, f, 0, 0.28, -D / 2 + 0.13, 0.06);
    const n = L > 2 ? 3 : 2, cw = (L - 2 * arm) / n;
    for (let i = 0; i < n; i++) {
      const x = -L / 2 + arm + (i + 0.5) * cw;
      rb(g, cw - 0.012, 0.15, 0.64, f, x, 0.32, 0.1, 0.06);
      const b = rb(g, cw - 0.02, 0.42, 0.18, f, x, 0.43, -D / 2 + 0.25, 0.075); b.rotation.x = -0.14;
    }
    [-1, 1].forEach((s) => { const p = rb(g, 0.4, 0.4, 0.11, a, s * (L / 2 - arm - 0.24), 0.45, -D / 2 + 0.4, 0.05); p.rotation.x = -0.3; p.rotation.z = s * 0.12; });
    return { g: bake(g), L, D, h: 0.82 };
  }
  function armchair(color) {
    const g = G(), L = 0.82, D = 0.82, f = mat(color, { tex: 'fabric', r: 0.97 });
    [[-1, -1], [1, -1], [-1, 1], [1, 1]].forEach(([x, z]) => cy(g, 0.02, 0.014, 0.16, M.walnut(), x * (L / 2 - 0.08), 0, z * (D / 2 - 0.08), 8));
    rb(g, L, 0.2, D, f, 0, 0.16, 0, 0.05);
    rb(g, L - 0.12, 0.13, 0.6, f, 0, 0.35, 0.08, 0.055);
    const b = rb(g, L, 0.5, 0.16, f, 0, 0.32, -D / 2 + 0.08, 0.07); b.rotation.x = -0.12;
    [-1, 1].forEach((s) => rb(g, 0.1, 0.24, D - 0.1, f, s * (L / 2 - 0.05), 0.34, 0.03, 0.045));
    return { g: bake(g), L, D, h: 0.82 };
  }
  function coffeeTable() {
    const g = G();
    cy(g, 0.44, 0.44, 0.035, M.oak(), 0, 0.38, 0, 40);
    cy(g, 0.05, 0.07, 0.36, M.walnut(), 0, 0.02, 0, 16);
    cy(g, 0.22, 0.24, 0.02, M.walnut(), 0, 0, 0, 30);
    rb(g, 0.26, 0.035, 0.19, mat('#2f3e4e', { r: 0.8 }), -0.12, 0.415, 0.04, 0.006);
    rb(g, 0.22, 0.03, 0.17, mat('#c9b79c', { r: 0.8 }), -0.11, 0.45, 0.03, 0.006);
    cy(g, 0.045, 0.06, 0.16, M.ceramic(), 0.17, 0.415, -0.06, 18);
    return { g: bake(g), L: 0.9, D: 0.9, h: 0.45 };
  }
  function tvUnit(L) {
    const g = G(), D = 0.44;
    [[-1, -1], [1, -1], [-1, 1], [1, 1]].forEach(([x, z]) => cy(g, 0.015, 0.012, 0.12, M.dark(), x * (L / 2 - 0.06), 0, z * (D / 2 - 0.08), 8));
    rb(g, L, 0.42, D - 0.02, M.walnut(), 0, 0.12, 0.01, 0.012);
    for (let i = 1; i < 3; i++) rb(g, 0.006, 0.36, 0.004, M.gap(), -L / 2 + (i * L) / 3, 0.15, D / 2, 0);
    const tw = Math.min(1.4, L - 0.2), ty = REAL ? 0.98 : 0.6;
    rb(g, tw, 0.8, 0.04, M.screen(), 0, ty, -D / 2 + (REAL ? 0.03 : 0.12), 0.01);
    rb(g, 0.62, 0.06, 0.08, M.dark(), 0, 0.54, 0.04, 0.02);
    cy(g, 0.05, 0.04, 0.14, M.terracota(), L / 2 - 0.16, 0.54, 0.02, 16);
    return { g: bake(g), L, D, h: REAL ? 1.8 : 1.4 };
  }
  function floorLamp() {
    const g = G();
    cy(g, 0.16, 0.17, 0.025, M.dark(), 0, 0, 0, 24);
    cy(g, 0.012, 0.012, tallCap(1.42), M.dark(), 0, 0.025, 0, 8);
    cy(g, 0.17, 0.22, 0.3, M.shade(), 0, tallCap(1.42) - 0.15, 0, 28);
    return { g: bake(g), L: 0.4, D: 0.4, h: 1.6 };
  }
  function plant(s = 1, pot = 'pot') {
    const g = G(), R = rng(Math.floor(s * 1000) + (pot === 'pot' ? 3 : 7));
    cy(g, 0.17 * s, 0.12 * s, 0.34 * s, M[pot](), 0, 0, 0, 22);
    cy(g, 0.155 * s, 0.155 * s, 0.01, M.soil(), 0, 0.32 * s, 0, 18);
    const n = 11;
    for (let i = 0; i < n; i++) {
      const a = (i / n) * Math.PI * 2 + R() * 0.4, tilt = -0.45 - R() * 0.75, len = (0.24 + R() * 0.12) * s;
      const leaf = sp(g, 1, i % 3 ? M.leaf() : M.leaf2(), 0, 0, 0, 0.085 * s, 0.012 * s, len, 14, 8);
      leaf.rotation.order = 'YXZ'; leaf.rotation.set(tilt, a, 0);
      const dir = new THREE.Vector3(0, 0, 1).applyEuler(leaf.rotation);
      leaf.position.set(dir.x * len * 0.85, (0.42 + R() * 0.3) * s + dir.y * len * 0.85, dir.z * len * 0.85);
      cy(g, 0.006 * s, 0.006 * s, leaf.position.y - 0.3 * s, M.leaf(), dir.x * len * 0.2, 0.3 * s, dir.z * len * 0.2, 5);
    }
    return { g: bake(g), L: 0.45 * s, D: 0.45 * s, h: 1.0 * s };
  }
  function bookshelf(L) {
    const g = G(), D = 0.32, H = tallCap(1.9), R = rng(Math.round(L * 100));
    rb(g, 0.025, H, D, M.oak(), -L / 2 + 0.0125, 0, 0, 0);
    rb(g, 0.025, H, D, M.oak(), L / 2 - 0.0125, 0, 0, 0);
    rb(g, L, 0.012, D - 0.02, M.cab(), 0, 0, -D / 2 + 0.01, 0);
    rb(g, L - 0.04, H - 0.04, 0.01, M.cab(), 0, 0.02, -D / 2 + 0.006, 0);
    const shelves = Math.max(3, Math.round(H / 0.38)), sh = H / shelves;
    const pal = ['#2f3e4e', '#c96f4a', '#8fa58a', '#d9a441', '#e8e1d4', '#5576a8', '#7a5539'];
    for (let i = 0; i <= shelves; i++) {
      const y = Math.min(i * sh, H - 0.025);
      rb(g, L - 0.05, 0.025, D - 0.02, M.oak(), 0, y, 0.01, 0);
      if (i === shelves) continue;
      let x = -L / 2 + 0.06;
      const stop = L / 2 - 0.06 - R() * 0.25;
      while (x < stop - 0.03) {
        const bw = 0.025 + R() * 0.03, bh = Math.min(sh - 0.06, 0.17 + R() * 0.11);
        rb(g, bw, bh, 0.18 + R() * 0.06, mat(pal[Math.floor(R() * pal.length)], { r: 0.75 }), x + bw / 2, y + 0.025, 0.0, 0);
        x += bw + 0.003;
      }
    }
    return { g: bake(g), L, D, h: H };
  }
  function painting(w, h, art) {
    const g = G();
    rb(g, w, h, 0.03, mat('#2a2622', { r: 0.6 }), 0, 0, 0, 0.004);
    rb(g, w - 0.06, h - 0.06, 0.006, mat('#ffffff', { tex: 'art' + art, r: 0.9 }), 0, 0.03, 0.016, 0);
    return { g: bake(g), L: w, D: 0.035, h };
  }
  function rug(w, d, tex) {
    const g = G();
    rb(g, w, 0.012, d, mat('#ffffff', { tex, r: 1 }), 0, 0, 0, 0);
    const m = g.children[0]; m.castShadow = false; m.receiveShadow = true;
    return g;
  }
  function chair(fabric) {
    const g = G();
    [[-1, -1], [1, -1], [-1, 1], [1, 1]].forEach(([x, z]) => cy(g, 0.016, 0.013, 0.44, M.walnut(), x * 0.18, 0, z * 0.18, 8));
    rb(g, 0.44, 0.05, 0.44, mat(fabric, { tex: 'fabric', r: 0.97 }), 0, 0.44, 0, 0.02);
    rb(g, 0.42, 0.36, 0.035, M.oak(), 0, 0.52, -0.2, 0.012);
    return g;
  }
  function diningSet(L, D) {
    const g = G(), tD = D;
    rb(g, L, 0.04, tD, M.oak(), 0, 0.72, 0, 0.012);
    [[-1, -1], [1, -1], [-1, 1], [1, 1]].forEach(([x, z]) => rb(g, 0.05, 0.72, 0.05, M.walnut(), x * (L / 2 - 0.08), 0, z * (tD / 2 - 0.08), 0.006));
    const per = L >= 1.55 ? 3 : 2;
    for (let i = 0; i < per; i++) {
      const x = -L / 2 + (i + 0.5) * (L / per);
      [-1, 1].forEach((s) => { const c = chair('#d9cfbf'); c.position.set(x, 0, s * (tD / 2 + 0.1)); c.rotation.y = s > 0 ? Math.PI : 0; g.add(c); });
    }
    cy(g, 0.06, 0.05, 0.14, M.ceramic(), 0.1, 0.76, 0.02, 16);
    return { g: bake(g), L: L + 0.1, D: tD + 1.0, h: 0.8 };
  }
  function livingRings() {
    const group = G();
    for (const [x, z, radius, y] of [[-0.22, 0.08, 0.29, -0.29], [0.2, -0.08, 0.2, -0.39]]) {
      cy(group, 0.0035, 0.0035, -y, M.dark(), x, y, z, 6);
      const mainRing = new THREE.Mesh(new THREE.TorusGeometry(radius, 0.018, 8, 40), M.dark());
      const diffuser = new THREE.Mesh(new THREE.TorusGeometry(radius, 0.009, 6, 40), M.warmStrip());
      mainRing.rotation.x = diffuser.rotation.x = Math.PI / 2;
      mainRing.position.set(x, y, z);
      diffuser.position.set(x, y - 0.017, z);
      group.add(mainRing, diffuser);
    }
    return bake(group);
  }
  function pendant(drop) {
    const g = G();
    cy(g, 0.004, 0.004, drop, M.dark(), 0, -drop, 0, 6);
    cy(g, 0.04, 0.2, 0.18, mat('#2a2f35', { r: 0.4, m: 0.6 }), 0, -drop - 0.16, 0, 28);
    cy(g, 0.17, 0.17, 0.006, M.bulb(), 0, -drop - 0.165, 0, 24);
    return bake(g);
  }
  function counter(L, o) {
    const g = G(), D = 0.62;
    rb(g, L - 0.02, 0.1, 0.5, M.gap(), 0, 0, -0.04, 0);
    rb(g, L, 0.78, 0.58, M.cab(), 0, 0.1, -0.02, 0.008);
    const n = Math.max(1, Math.round(L / 0.6)), pw = L / n;
    for (let i = 1; i < n; i++) rb(g, 0.006, 0.74, 0.004, M.gap(), -L / 2 + i * pw, 0.12, 0.272, 0);
    for (let i = 0; i < n; i++) rb(g, 0.16, 0.014, 0.02, M.steel(), -L / 2 + (i + 0.5) * pw, 0.8, 0.28, 0.005);
    rb(g, L + 0.02, 0.035, D, M.stone(), 0, 0.88, 0, 0.004);
    if (o.sinkX !== null) {
      rb(g, 0.56, 0.008, 0.4, M.basin(), o.sinkX, 0.912, 0.03, 0);
      cy(g, 0.016, 0.018, 0.3, M.chrome(), o.sinkX, 0.915, -0.2, 12);
      const arm = cy(g, 0.012, 0.012, 0.18, M.chrome(), o.sinkX, 1.15, -0.13, 10); arm.rotation.x = Math.PI / 2; arm.position.y = 1.2;
    }
    if (o.cookX !== null) {
      rb(g, 0.6, 0.008, 0.5, mat('#121417', { r: 0.08, m: 0.2 }), o.cookX, 0.915, 0.02, 0.003);
      [[-0.14, -0.1], [0.14, -0.1], [-0.14, 0.12], [0.14, 0.12]].forEach(([dx, dz]) => cy(g, 0.075, 0.075, 0.004, mat('#3a3f45', { r: 0.4, m: 0.5 }), o.cookX + dx, 0.923, 0.02 + dz, 24));
      rb(g, 0.58, 0.48, 0.008, mat('#14171a', { r: 0.1, m: 0.3 }), o.cookX, 0.22, 0.29, 0.01);
      rb(g, 0.42, 0.02, 0.03, M.steel(), o.cookX, 0.66, 0.3, 0.008);
    }
    if (REAL) {
      const cuts = (base, holes) => holes.reduce((acc, [a, b]) => acc.flatMap(([x, y]) => (b <= x || a >= y ? [[x, y]] : [[x, a], [b, y]].filter(([p, q]) => q - p > 0.05))), [base]);
      const free = cuts([-L / 2, L / 2], o.wins);
      free.forEach(([a, b]) => { if (b - a > 0.25) rb(g, b - a, 0.58, 0.012, mat('#ffffff', { tex: 'subway', r: 0.3 }), (a + b) / 2, 0.915, -D / 2 + 0.006, 0, true); });
      const up = cuts([-L / 2, L / 2], o.wins.concat(o.cookX !== null ? [[o.cookX - 0.36, o.cookX + 0.36]] : []));
      up.forEach(([a, b]) => {
        if (b - a < 0.3) return;
        rb(g, b - a, 0.72, 0.34, M.cab(), (a + b) / 2, 1.5, -D / 2 + 0.17, 0.008);
        const k = Math.max(1, Math.round((b - a) / 0.5));
        for (let i = 1; i < k; i++) rb(g, 0.006, 0.68, 0.004, M.gap(), a + (i * (b - a)) / k, 1.52, -D / 2 + 0.342, 0);
        rb(g, b - a - 0.04, 0.012, 0.02, M.bulb(), (a + b) / 2, 1.49, -D / 2 + 0.28, 0);
      });
      if (o.cookX !== null) {
        rb(g, 0.62, 0.1, 0.46, M.steel(), o.cookX, 1.6, -D / 2 + 0.23, 0.01);
        rb(g, 0.28, WALL_H - 1.7, 0.26, M.steel(), o.cookX, 1.7, -D / 2 + 0.13, 0.005);
      }
    }
    return { g: bake(g), L, D, h: 0.93 };
  }
  function fridge() {
    const g = G(), H = tallCap(1.85);
    rb(g, 0.72, H, 0.68, mat('#c9ced3', { r: 0.28, m: 0.75 }), 0, 0, 0, 0.03);
    rb(g, 0.7, 0.008, 0.004, M.gap(), 0, H * 0.32, 0.341, 0);
    rb(g, 0.02, H * 0.25, 0.03, M.dark(), 0.28, H * 0.05, 0.35, 0.008);
    rb(g, 0.02, H * 0.36, 0.03, M.dark(), 0.28, H * 0.42, 0.35, 0.008);
    return { g: bake(g), L: 0.74, D: 0.7, h: H };
  }
  function vanity(L) {
    const g = G(), D = 0.48;
    rb(g, L, 0.48, D - 0.02, M.walnut(), 0, 0.32, -0.01, 0.01);
    rb(g, L - 0.04, 0.006, 0.004, M.gap(), 0, 0.56, D / 2 - 0.02, 0);
    rb(g, L + 0.02, 0.03, D, M.stone(), 0, 0.8, 0, 0.004);
    const bowl = cy(g, 0.2, 0.15, 0.13, M.ceramic(), 0, 0.83, 0.03, 32); bowl.scale.x = 1.2;
    cy(g, 0.15, 0.15, 0.004, M.basin(), 0, 0.957, 0.03, 24).scale.x = 1.2;
    cy(g, 0.014, 0.016, 0.26, M.chrome(), 0, 0.83, -0.17, 12);
    const arm = cy(g, 0.01, 0.01, 0.14, M.chrome(), 0, 1.06, -0.11, 10); arm.rotation.x = Math.PI / 2; arm.position.y = 1.08;
    if (REAL) {
      rb(g, Math.min(0.75, L - 0.04), 0.78, 0.02, M.mirror(), 0, 1.12, -D / 2 + 0.012, 0.01);
      rb(g, Math.min(0.6, L - 0.1), 0.03, 0.04, M.bulb(), 0, 1.95, -D / 2 + 0.03, 0.01);
    }
    return { g: bake(g), L, D, h: REAL ? 2.0 : 0.95 };
  }
  function toilet() {
    const g = G(), c = M.ceramic();
    rb(g, 0.4, 0.36, 0.17, c, 0, 0.4, -0.26, 0.04);
    rb(g, 0.06, 0.012, 0.03, M.chrome(), 0.08, 0.76, -0.26, 0.005);
    const b = cy(g, 0.19, 0.15, 0.39, c, 0, 0, 0.04, 28); b.scale.z = 1.3;
    const s = cy(g, 0.195, 0.195, 0.025, c, 0, 0.39, 0.05, 28); s.scale.z = 1.3;
    rb(g, 0.3, 0.2, 0.1, c, 0, 0, -0.16, 0.03);
    return { g: bake(g), L: 0.44, D: 0.72, h: 0.8 };
  }
  function shower(w, d, sideGlass) {
    const g = G(), H = tallCap(1.95);
    rb(g, w, 0.035, d, mat('#d7dbde', { tex: 'tile', r: 0.35 }), 0, 0, 0, 0.004);
    cy(g, 0.04, 0.04, 0.004, M.chrome(), 0, 0.036, 0.1, 16);
    const pw = w > 1.2 ? w * 0.55 : w * 0.62;
    rb(g, pw, H, 0.01, M.glass(), -w / 2 + pw / 2, 0.04, d / 2 - 0.02, 0);
    rb(g, pw, 0.02, 0.025, M.chrome(), -w / 2 + pw / 2, 0.04 + H, d / 2 - 0.02, 0.005);
    if (sideGlass) {
      const x = sideGlass * (w / 2 - 0.01);
      rb(g, 0.01, H, d - 0.04, M.glass(), x, 0.04, 0, 0);
      rb(g, 0.025, 0.02, d - 0.04, M.chrome(), x, 0.04 + H, 0, 0.005);
    }
    if (REAL) {
      cy(g, 0.012, 0.012, 0.9, M.chrome(), 0, 1.15, -d / 2 + 0.03, 10);
      const arm = cy(g, 0.01, 0.01, 0.3, M.chrome(), 0, 2.05, -d / 2 + 0.17, 10); arm.rotation.x = Math.PI / 2; arm.position.y = 2.05;
      cy(g, 0.11, 0.11, 0.015, M.chrome(), 0, 2.03, -d / 2 + 0.32, 28);
      rb(g, 0.2, 0.06, 0.08, M.chrome(), 0, 1.0, -d / 2 + 0.04, 0.01);
    }
    return { g: bake(g), L: w, D: d, h: H };
  }
  function towel(color) {
    const g = G();
    rb(g, 0.55, 0.02, 0.05, M.chrome(), 0, 1.1, -0.025, 0.008);
    rb(g, 0.46, 0.62, 0.035, mat(color, { tex: 'fabric', r: 1 }), 0, 0.5, 0.0, 0.015);
    return { g: bake(g), L: 0.6, D: 0.07, h: 1.15 };
  }
  function car(color) {
    const g = G(), body = mat(color, { r: 0.28, m: 0.55 }), dark = mat('#1d242d', { r: 0.08, m: 0.4 });
    rb(g, 1.8, 0.52, 4.25, body, 0, 0.26, 0, 0.14);
    rb(g, 1.56, 0.46, 2.2, dark, 0, 0.7, -0.2, 0.2);
    rb(g, 1.5, 0.06, 1.7, body, 0, 1.12, -0.25, 0.03);
    [[-0.84, 1.32], [0.84, 1.32], [-0.84, -1.38], [0.84, -1.38]].forEach(([x, z]) => {
      const w = cy(g, 0.34, 0.34, 0.24, mat('#16191c', { r: 0.9 }), x, 0.34, z, 28); w.rotation.z = Math.PI / 2; w.position.y = 0.34;
      const h = cy(g, 0.21, 0.21, 0.25, M.steel(), x, 0.34, z, 20); h.rotation.z = Math.PI / 2; h.position.y = 0.34;
    });
    [-0.6, 0.6].forEach((x) => { rb(g, 0.34, 0.08, 0.04, M.bulb(), x, 0.6, 2.12, 0.02); rb(g, 0.36, 0.07, 0.04, mat('#c3202f', { e: '#9a1020', ei: 0.6 }), x, 0.62, -2.12, 0.02); });
    [-1, 1].forEach((s) => rb(g, 0.1, 0.07, 0.16, body, s * 0.95, 0.86, 0.75, 0.02));
    return { g: bake(g), L: 1.95, D: 4.4, h: 1.2 };
  }
  function shelfUnit(L) {
    const g = G(), D = 0.42, H = tallCap(1.8), R = rng(91);
    [-1, 1].forEach((s) => [-1, 1].forEach((t) => rb(g, 0.035, H, 0.035, M.dark(), s * (L / 2 - 0.02), 0, t * (D / 2 - 0.02), 0)));
    for (let i = 0; i < 4; i++) {
      const y = 0.1 + (i * (H - 0.15)) / 3;
      rb(g, L, 0.02, D, M.steel(), 0, y, 0, 0);
      let x = -L / 2 + 0.08;
      while (x < L / 2 - 0.3) { const bw = 0.25 + R() * 0.2; if (i < 3) rb(g, bw, 0.18 + R() * 0.12, 0.3, mat(R() > 0.5 ? '#c7a77d' : '#8e9aa6', { r: 0.9 }), x + bw / 2, y + 0.02, 0, 0.01); x += bw + 0.08; }
    }
    return { g: bake(g), L, D, h: H };
  }
  function outdoorSet() {
    const g = G();
    cy(g, 0.42, 0.42, 0.03, M.oak(), 0, 0.7, 0, 32);
    cy(g, 0.04, 0.05, 0.7, M.dark(), 0, 0, 0, 12);
    cy(g, 0.25, 0.25, 0.015, M.dark(), 0, 0, 0, 24);
    [-1, 1].forEach((s) => { const c = chair('#e8dfcf'); c.position.set(s * 0.72, 0, 0); c.rotation.y = s * -Math.PI / 2; g.add(c); });
    return { g: bake(g), L: 1.9, D: 1.0, h: 0.8 };
  }
  function lounger() {
    const g = G(), f = mat('#e2d6c2', { tex: 'fabric', r: 1 });
    rb(g, 0.7, 0.08, 1.8, M.oak(), 0, 0.22, 0, 0.02);
    [[-1, -1], [1, -1], [-1, 1], [1, 1]].forEach(([x, z]) => rb(g, 0.05, 0.22, 0.05, M.walnut(), x * 0.3, 0, z * 0.82, 0));
    rb(g, 0.66, 0.08, 1.2, f, 0, 0.3, 0.27, 0.035);
    const b = rb(g, 0.66, 0.08, 0.62, f, 0, 0.42, -0.58, 0.035); b.rotation.x = 0.85; b.position.y = 0.52;
    return { g: bake(g), L: 0.7, D: 1.8, h: 0.75 };
  }
  function washer() {
    const g = G();
    rb(g, 0.6, 0.85, 0.6, M.white(), 0, 0, 0, 0.03);
    const ring = new THREE.Mesh(new THREE.TorusGeometry(0.19, 0.025, 12, 40), M.steel()); ring.position.set(0, 0.42, 0.3); g.add(ring);
    cy(g, 0.17, 0.17, 0.01, mat('#2b3540', { r: 0.05, m: 0.2 }), 0, 0.415, 0.3).rotation.x = Math.PI / 2;
    rb(g, 0.56, 0.08, 0.01, mat('#d9dde1', { r: 0.4 }), 0, 0.74, 0.3, 0.004);
    return { g: bake(g), L: 0.62, D: 0.62, h: 0.86 };
  }
  function tank() {
    const g = G();
    rb(g, 0.6, 0.86, 0.52, M.white(), 0, 0, 0, 0.02);
    rb(g, 0.48, 0.01, 0.36, M.basin(), 0, 0.861, 0.03, 0);
    cy(g, 0.014, 0.016, 0.25, M.chrome(), 0, 0.86, -0.22, 10);
    return { g: bake(g), L: 0.62, D: 0.54, h: 0.88 };
  }
  function desk() {
    const g = G();
    rb(g, 1.1, 0.03, 0.55, M.oak(), 0, 0.73, 0, 0.008);
    [[-1, -1], [1, -1], [-1, 1], [1, 1]].forEach(([x, z]) => rb(g, 0.035, 0.73, 0.035, M.dark(), x * 0.52, 0, z * 0.24, 0));
    rb(g, 0.36, 0.24, 0.02, M.screen(), -0.12, 0.8, -0.14, 0.006);
    lamp(g, 0.4, -0.15, 0.76);
    return { g: bake(g), L: 1.1, D: 0.55, h: 0.88 };
  }
  function tree(s, seed) {
    const g = G(), R = rng(seed);
    cy(g, 0.11 * s, 0.17 * s, 1.9 * s, mat('#6b4f3a', { r: 0.95 }), 0, 0, 0, 10);
    const greens = ['#4d7d3f', '#5d8f47', '#3f6d37'];
    for (let i = 0; i < 6; i++) {
      const a = R() * Math.PI * 2, rr = R() * 0.7 * s;
      const m = new THREE.Mesh(new THREE.IcosahedronGeometry((0.85 + R() * 0.5) * s, LIGHT_GPU ? 1 : 2), mat(greens[i % 3], { r: 0.9 }));
      m.position.set(Math.cos(a) * rr, (2.2 + R() * 1.1) * s, Math.sin(a) * rr);
      g.add(m);
    }
    return bake(g);
  }
  function bush(s, seed) {
    const g = G(), R = rng(seed);
    for (let i = 0; i < 4; i++) sp(g, (0.32 + R() * 0.18) * s, mat(i % 2 ? '#4f8442' : '#5f9550', { r: 0.95 }), (R() - 0.5) * 0.6 * s, 0.25 * s, (R() - 0.5) * 0.4 * s, 1, 0.8, 1, 10, 8);
    return bake(g);
  }

  /* ---------- 7. distribuir os móveis sem bloquear portas nem janelas ---------- */
  const overlap = (a, b) => a.x0 < b.x1 - 1e-4 && a.x1 > b.x0 + 1e-4 && a.z0 < b.z1 - 1e-4 && a.z1 > b.z0 + 1e-4;
  function sideLen(r, s) { return s === 'T' || s === 'B' ? r.iw : r.id; }
  function sideSpan(r, s) { return s === 'T' || s === 'B' ? [r.X0, r.X1] : [r.Z0, r.Z1]; }
  function rectOn(r, s, c, L, D) {
    if (s === 'T') return { x0: c - L / 2, x1: c + L / 2, z0: r.Z0, z1: r.Z0 + D };
    if (s === 'B') return { x0: c - L / 2, x1: c + L / 2, z0: r.Z1 - D, z1: r.Z1 };
    if (s === 'L') return { x0: r.X0, x1: r.X0 + D, z0: c - L / 2, z1: c + L / 2 };
    return { x0: r.X1 - D, x1: r.X1, z0: c - L / 2, z1: c + L / 2 };
  }
  function fitWall(r, s, L, D, o = {}) {
    const [lo0, hi0] = sideSpan(r, s), gap = o.gap ?? 0.03, lo = lo0 + gap, hi = hi0 - gap;
    if (hi - lo < L || D > (s === 'T' || s === 'B' ? r.id : r.iw) - 0.1) return null;
    const h = o.h ?? 1;
    const blocks = r.opens[s].filter((op) => op.kind === 'door' || op.kind === 'pass' || op.kind === 'gate' || (op.kind === 'win' && h > 0.93) || (op.kind === 'high' && h > 1.5));
    const pref = clamp(o.prefer ?? 0, lo + L / 2, hi - L / 2);
    for (let step = 0; step < 600; step++) {
      const off = Math.ceil(step / 2) * 0.05 * (step % 2 ? 1 : -1);
      if (Math.abs(off) > hi - lo + 0.1) break;
      const c = pref + off;
      if (c - L / 2 < lo - 1e-6 || c + L / 2 > hi + 1e-6) continue;
      if (blocks.some((b) => c + L / 2 > b.a - 0.06 && c - L / 2 < b.b + 0.06)) continue;
      const rect = rectOn(r, s, c, L, D);
      if (r.occ.some((q) => overlap(q, rect))) continue;
      return { c, rect: { ...rect, h } };
    }
    return null;
  }
  function fitFree(r, rect) {
    if (rect.x0 < r.X0 + 0.02 || rect.x1 > r.X1 - 0.02 || rect.z0 < r.Z0 + 0.02 || rect.z1 > r.Z1 - 0.02) return false;
    return !r.occ.some((q) => overlap(q, rect));
  }
  const ROT = { T: 0, B: Math.PI, L: Math.PI / 2, R: -Math.PI / 2 };
  function putWall(r, it, s, c, y = 0) {
    const D = it.D;
    if (s === 'T') it.g.position.set(c, y, r.Z0 + D / 2);
    if (s === 'B') it.g.position.set(c, y, r.Z1 - D / 2);
    if (s === 'L') it.g.position.set(r.X0 + D / 2, y, c);
    if (s === 'R') it.g.position.set(r.X1 - D / 2, y, c);
    it.g.rotation.y = ROT[s];
    r.holder.add(it.g); r.items.push(it.g);
  }
  function putFree(r, g, x, z, ry) { g.position.set(x, 0, z); g.rotation.y = ry; r.holder.add(g); r.items.push(g); }
  const toLocalX = (s, along, c) => (s === 'T' || s === 'R' ? along - c : c - along);
  function tryWall(r, build, sides, o = {}) {
    for (const s of sides) {
      const it = build(s);
      if (!it) continue;
      const f = fitWall(r, s, it.L, it.D, { ...o, h: it.h, prefer: typeof o.prefer === 'function' ? o.prefer(s) : o.prefer });
      if (f) { putWall(r, it, s, f.c, o.y || 0); r.occ.push(f.rect); return { s, c: f.c, it, rect: f.rect }; }
    }
    return null;
  }
  function corners(r, size) {
    const m = 0.04;
    return [[r.X0 + m, r.Z0 + m], [r.X1 - m - size, r.Z0 + m], [r.X0 + m, r.Z1 - m - size], [r.X1 - m - size, r.Z1 - m - size]].map(([x, z]) => ({ x0: x, x1: x + size, z0: z, z1: z + size, h: 1 }));
  }
  function addPlant(r, s = 1, pot = 'pot') {
    const size = 0.48 * s;
    const c = corners(r, size).find((q) => fitFree(r, q));
    if (!c) return;
    const it = plant(s, pot);
    putFree(r, it.g, (c.x0 + c.x1) / 2, (c.z0 + c.z1) / 2, r.idx);
    r.occ.push(c);
  }
  function addArt(r, sides, w, h, art) {
    if (!REAL) return;
    for (const s of sides) {
      const [lo, hi] = sideSpan(r, s);
      if (hi - lo < w + 0.3) continue;
      const blocks = r.opens[s];
      const tall = r.occ.filter((q) => q.h > 1.25);
      for (let step = 0; step < 80; step++) {
        const c = Math.ceil(step / 2) * 0.1 * (step % 2 ? 1 : -1);
        if (c - w / 2 < lo + 0.15 || c + w / 2 > hi - 0.15) continue;
        if (blocks.some((b) => c + w / 2 > b.a - 0.1 && c - w / 2 < b.b + 0.1)) continue;
        const rect = rectOn(r, s, c, w, 0.3);
        if (tall.some((q) => overlap(q, rect))) continue;
        const it = painting(w, h, art);
        putWall(r, it, s, c, 1.62 - h / 2);
        return true;
      }
    }
    return false;
  }

  function furnish(r) {
    r.occ = []; r.items = [];
    /* espaço livre na frente de cada porta */
    ['T', 'B', 'L', 'R'].forEach((s) => r.opens[s].forEach((op) => {
      if (op.kind === 'win' || op.kind === 'high' || op.kind === 'gate') return;
      const L = op.b - op.a + 0.16, c = (op.a + op.b) / 2;
      const rect = rectOn(r, s, c, L, op.kind === 'pass' ? 0.6 : 0.82);
      r.occ.push({ ...rect, h: 3, door: true });
    }));
    const k = r.k, acc = ACCENT[r.idx % ACCENT.length];
    const others = (first) => [first, 'R', 'L', 'B', 'T'].filter((s, i, a) => s && a.indexOf(s) === i && s !== r.door);
    if (k === 'quarto' || k === 'suite') {
      const head = k === 'suite' ? '#a99c8b' : '#c4b9a9';
      const single = Math.min(r.iw, r.id) < 2.75;
      let bed = null;
      for (const [sg, st] of [[single, true], [single, false], [true, false]]) {
        bed = tryWall(r, (s) => ((s === 'T' || s === 'B' ? r.id : r.iw) >= 2.12 + 0.75 ? bedSet({ single: sg, stands: st, accent: acc, head }) : null), others(OPP[r.door]), { prefer: 0 });
        if (bed) break;
      }
      if (bed) {
        const rg = rug(Math.min(bed.it.L + 0.3, 2.6), 1.7, 'rugA');
        const n = { T: [0, 1], B: [0, -1], L: [1, 0], R: [-1, 0] }[bed.s], off = bed.it.D * 0.68;
        const base = bed.s === 'T' ? r.Z0 : bed.s === 'B' ? r.Z1 : bed.s === 'L' ? r.X0 : r.X1;
        if (bed.s === 'T' || bed.s === 'B') putFree(r, rg, bed.c, base + n[1] * off, ROT[bed.s]); else putFree(r, rg, base + n[0] * off, bed.c, ROT[bed.s]);
        addArt(r, [bed.s], Math.min(1.1, bed.it.L - 0.9 > 0.6 ? bed.it.L - 0.9 : 0.8), 0.62, r.idx % 3);
      }
      const perp = bed ? (bed.s === 'T' || bed.s === 'B' ? ['L', 'R'] : ['T', 'B']) : [];
      const wsides = perp.concat(bed ? [OPP[bed.s]] : ['L', 'R', 'B', 'T']).filter((s) => s !== r.door);
      for (const L of [2.0, 1.8, 1.6, 1.4, 1.2, 1.0]) { if (tryWall(r, () => wardrobe(L), wsides, { prefer: (s) => sideSpan(r, s)[1] })) break; }
      if (k === 'suite' || r.iw * r.id > 11) tryWall(r, () => armchair(acc), others(r.win), { prefer: 0 });
      if (r.win) {
        const d = tryWall(r, () => desk(), [r.win], { prefer: 0 });
        if (d) { const c = chair('#d9cfbf'); const n = { T: [0, 1], B: [0, -1], L: [1, 0], R: [-1, 0] }[d.s]; const cx = d.s === 'T' || d.s === 'B' ? d.c : d.rect.x0 + (d.rect.x1 - d.rect.x0) / 2 + n[0] * 0.45; const cz = d.s === 'T' || d.s === 'B' ? (d.rect.z0 + d.rect.z1) / 2 + n[1] * 0.45 : d.c; putFree(r, bake(c), cx, cz, ROT[d.s] + Math.PI); }
      }
      addPlant(r, 1.15);
    } else if (k === 'sala') {
      const sides = ['T', 'B', 'L', 'R'].sort((a, b) => sideLen(r, b) - sideLen(r, a));
      const tv = tryWall(r, () => tvUnit(Math.min(1.9, Math.max(1.2, Math.min(r.iw, r.id) - 0.6))), sides, { prefer: 0 });
      if (tv) {
        const n = { T: [0, 1], B: [0, -1], L: [1, 0], R: [-1, 0] }[tv.s];
        const perp = tv.s === 'T' || tv.s === 'B' ? r.id : r.iw;
        const base = tv.s === 'T' ? r.Z0 : tv.s === 'B' ? r.Z1 : tv.s === 'L' ? r.X0 : r.X1;
        let placed = null;
        for (const sl of [2.25, 2.0, 1.8, 1.6]) {
          for (const dist of [2.8, 2.5, 2.2, 2.0, 1.8]) {
            const dd = Math.min(dist, perp - tv.it.D - 0.95);
            if (dd < 1.5) continue;
            const along = clamp(tv.c, (tv.s === 'T' || tv.s === 'B' ? r.X0 : r.Z0) + sl / 2 + 0.05, (tv.s === 'T' || tv.s === 'B' ? r.X1 : r.Z1) - sl / 2 - 0.05);
            const m = tv.it.D + dd + 0.46;
            const cx = tv.s === 'T' || tv.s === 'B' ? along : base + n[0] * m, cz = tv.s === 'T' || tv.s === 'B' ? base + n[1] * m : along;
            const hl = sl / 2, hd = 0.46;
            const rect = tv.s === 'T' || tv.s === 'B' ? { x0: cx - hl, x1: cx + hl, z0: cz - hd, z1: cz + hd, h: 0.9 } : { x0: cx - hd, x1: cx + hd, z0: cz - hl, z1: cz + hl, h: 0.9 };
            if (fitFree(r, rect)) { placed = { cx, cz, rect, sl, m, along }; break; }
          }
          if (placed) break;
        }
        if (placed) {
          const so = sofa(placed.sl, REAL ? '#a59e94' : '#7f8c99', acc);
          putFree(r, so.g, placed.cx, placed.cz, ROT[tv.s] + Math.PI);
          r.occ.push(placed.rect);
          const mid = tv.it.D + (placed.m - tv.it.D) * 0.5;
          const tx = tv.s === 'T' || tv.s === 'B' ? placed.along : base + n[0] * mid, tz = tv.s === 'T' || tv.s === 'B' ? base + n[1] * mid : placed.along;
          const rl = Math.min(placed.sl + 0.5, 2.8), rd = Math.max(1.6, placed.m - tv.it.D - 0.1);
          putFree(r, rug(rl, rd, 'rugB'), tx, tz, ROT[tv.s]);
          const ct = coffeeTable();
          putFree(r, ct.g, tx, tz, 0);
          r.occ.push({ x0: tx - 0.45, x1: tx + 0.45, z0: tz - 0.45, z1: tz + 0.45, h: 0.45 });
          /* poltrona de lado, virada para a mesa de centro */
          for (const sd of [1, -1]) {
            const off = placed.sl / 2 + 0.75;
            const ax = tv.s === 'T' || tv.s === 'B' ? tx + sd * off : tx, az = tv.s === 'T' || tv.s === 'B' ? tz : tz + sd * off;
            const rect = { x0: ax - 0.42, x1: ax + 0.42, z0: az - 0.42, z1: az + 0.42, h: 0.85 };
            if (fitFree(r, rect)) { const a = armchair('#c98f62'); putFree(r, a.g, ax, az, Math.atan2(tx - ax, tz - az)); r.occ.push(rect); break; }
          }
          /* luminária de pé na ponta do sofá */
          for (const sd of [-1, 1]) {
            const off = placed.sl / 2 + 0.28;
            const lx = tv.s === 'T' || tv.s === 'B' ? placed.cx + sd * off : placed.cx, lz = tv.s === 'T' || tv.s === 'B' ? placed.cz : placed.cz + sd * off;
            const rect = { x0: lx - 0.2, x1: lx + 0.2, z0: lz - 0.2, z1: lz + 0.2, h: 1.6 };
            if (fitFree(r, rect)) { putFree(r, floorLamp().g, lx, lz, 0); r.occ.push(rect); break; }
          }
        }
        addArt(r, [OPP[tv.s], ...['T', 'B', 'L', 'R'].filter((s) => s !== tv.s && s !== OPP[tv.s])], 1.2, 0.8, 0);
      }
      tryWall(r, () => bookshelf(0.9), ['T', 'B', 'L', 'R'], { prefer: (s) => sideSpan(r, s)[0] + 0.6 });
      addPlant(r, 1.35);
      addPlant(r, 0.9, 'terracota');
    } else if (k === 'cozinha') {
      const sides = ['T', 'B', 'L', 'R'].sort((a, b) => (a === r.win ? -1 : b === r.win ? 1 : sideLen(r, b) - sideLen(r, a)));
      let ct = null;
      for (const s of sides) {
        const win = r.opens[s].find((op) => op.kind === 'win');
        const wc = win ? (win.a + win.b) / 2 : null;
        for (let L = Math.min(3.4, sideLen(r, s) - 0.1); L >= 1.4; L -= 0.2) {
          const f = fitWall(r, s, L, 0.62, { h: 0.93, prefer: wc ?? 0 });
          if (!f) continue;
          const wins = r.opens[s].filter((op) => op.kind === 'win').map((op) => [toLocalX(s, op.a, f.c), toLocalX(s, op.b, f.c)].sort((a, b) => a - b).map((v) => v + 0));
          const wins2 = wins.map(([a, b]) => [a - 0.08, b + 0.08]);
          const sinkX = wc !== null ? clamp(toLocalX(s, wc, f.c), -L / 2 + 0.35, L / 2 - 0.35) : -L / 4;
          let cookX = sinkX > 0 ? sinkX - 1.0 : sinkX + 1.0;
          if (Math.abs(cookX) > L / 2 - 0.33) cookX = sinkX > 0 ? -L / 2 + 0.35 : L / 2 - 0.35;
          if (Math.abs(cookX - sinkX) < 0.62) cookX = null;
          const it = counter(L, { sinkX, cookX, wins: wins2 });
          putWall(r, it, s, f.c); r.occ.push({ ...f.rect, h: 0.93 });
          ct = { s, c: f.c, L };
          break;
        }
        if (ct) break;
      }
      tryWall(r, () => fridge(), ct ? [ct.s, ...['T', 'B', 'L', 'R'].filter((s) => s !== ct.s)] : ['T', 'B', 'L', 'R'], { prefer: ct ? (s) => (s === ct.s ? ct.c + ct.L / 2 + 0.45 : 0) : 0 });
      let table = null;
      for (const [tl, td] of [[1.5, 0.85], [1.2, 0.8], [0.9, 0.8]]) {
        for (const rot of [0, Math.PI / 2]) {
          const it = diningSet(tl, td);
          const hx = (rot ? it.D : it.L) / 2, hz = (rot ? it.L : it.D) / 2;
          const cands = [[0, 0], [0, r.id * 0.12], [0, -r.id * 0.12], [r.iw * 0.12, 0], [-r.iw * 0.12, 0]];
          for (const [x, z] of cands) {
            const rect = { x0: x - hx, x1: x + hx, z0: z - hz, z1: z + hz, h: 0.8 };
            if (fitFree(r, rect)) { putFree(r, it.g, x, z, rot); r.occ.push(rect); table = { x, z }; break; }
          }
          if (table) break;
        }
        if (table) break;
      }
      if (table) r.pend = table;
      addPlant(r, 0.8);
    } else if (k === 'banheiro' || k === 'lavabo') {
      const far = OPP[r.door];
      if (k === 'banheiro') {
        const span = sideLen(r, far);
        const full = span < 1.8;
        const sw = full ? span - 0.06 : 0.95, sd = clamp(Math.min(1.0, (far === 'T' || far === 'B' ? r.id : r.iw) * 0.3), 0.8, 1.0);
        const f = fitWall(r, far, sw, sd, { h: 1.2, prefer: full ? 0 : (sideSpan(r, far)[1] - sw / 2) });
        if (f) {
          const lc = toLocalX(far, 0, f.c);
          const it = shower(sw, sd, full ? 0 : (lc > 0 ? 1 : -1));
          putWall(r, it, far, f.c); r.occ.push({ ...f.rect, h: 2 });
        }
      }
      const sides = ['L', 'R', 'T', 'B'].filter((s) => s !== r.door && (k === 'lavabo' || s !== far));
      tryWall(r, () => vanity(sideLen(r, sides[0]) > 1.6 ? 0.8 : 0.6), sides, { prefer: 0 });
      tryWall(r, () => toilet(), sides.concat([far]), { prefer: (s) => (sideSpan(r, s)[1] - 0.6) });
      tryWall(r, () => towel(acc), ['T', 'B', 'L', 'R'], { prefer: 0, gap: 0.1 });
      putFree(r, rug(0.6, 0.4, 'rugA'), (r.X0 + r.X1) / 2, (r.Z0 + r.Z1) / 2, 0);
    } else if (k === 'garagem') {
      const it = car('#2c4f86');
      const front = r.gate ? { T: 0, B: Math.PI, L: Math.PI / 2, R: -Math.PI / 2 }[r.gate] : (r.id >= r.iw ? 0 : Math.PI / 2);
      const along = Math.abs(Math.sin(front)) < 0.5;
      const sc = clamp(Math.min(((along ? r.id : r.iw) - 0.4) / it.D, ((along ? r.iw : r.id) - 0.3) / it.L), 0.5, 1);
      it.g.scale.setScalar(sc); it.g.userData.base = sc;
      putFree(r, it.g, (r.X0 + r.X1) / 2, (r.Z0 + r.Z1) / 2, front);
      const hx = ((along ? it.L : it.D) * sc) / 2, hz = ((along ? it.D : it.L) * sc) / 2;
      const mx = (r.X0 + r.X1) / 2, mz = (r.Z0 + r.Z1) / 2;
      r.occ.push({ x0: mx - hx - 0.3, x1: mx + hx + 0.3, z0: mz - hz, z1: mz + hz, h: 1.3 });
      tryWall(r, () => shelfUnit(1.2), ['L', 'R', 'B', 'T'], { prefer: 0 });
    } else if (k === 'varanda') {
      const os = outdoorSet();
      const rect = { x0: -os.L / 2, x1: os.L / 2, z0: -os.D / 2, z1: os.D / 2, h: 0.8 };
      if (fitFree(r, rect)) { putFree(r, os.g, 0, 0, 0); r.occ.push(rect); }
      tryWall(r, () => lounger(), ['B', 'T', 'R', 'L'], { prefer: 0 });
      addPlant(r, 1.3, 'terracota'); addPlant(r, 1.0, 'terracota'); addPlant(r, 1.15);
    } else if (k === 'servico') {
      const sides = ['T', 'B', 'L', 'R'].sort((a, b) => (a === r.win ? -1 : b === r.win ? 1 : 0));
      tryWall(r, () => washer(), sides, { prefer: 0 });
      tryWall(r, () => tank(), sides, { prefer: 0 });
      tryWall(r, () => shelfUnit(0.9), sides, { prefer: 0 });
    }
  }

  /* ---------- 8. paredes ---------- */
  const BLUEPRINT = new THREE.Color('#eaf1fd');
  const FLOOR_FLAT = { sala: '#d8c3a0', quarto: '#d8c3a0', suite: '#d8c3a0', cozinha: '#e3e7ec', banheiro: '#c9dcf0', lavabo: '#c9dcf0', varanda: '#b99c72', garagem: '#aeb5bd', servico: '#dfe5ea' };
  const FLOOR_TEX = { sala: 'wood', quarto: 'wood', suite: 'wood', cozinha: 'tile', banheiro: 'tile', lavabo: 'tile', servico: 'tile', varanda: 'deck', garagem: 'conc' };
  const WET = new Set(['banheiro', 'lavabo', 'servico']);
  const W_MAT = {
    paint: () => mat('#f3f0ea', { r: 0.92, clip: true }),
    tile: () => mat('#ffffff', { tex: 'subway', r: 0.3, clip: true }),
    facade: () => mat('#eee9de', { tex: 'plaster', r: 0.92, clip: true }),
    cap: () => mat('#cdc7be', { r: 0.9, clip: true }),
    band: () => mat('#8c877f', { tex: 'conc', r: 0.9 }),
    trim: () => mat('#f7f5f1', { r: 0.45, clip: true }),
    door: () => mat('#efe9df', { tex: 'grain', r: 0.5, clip: true }),
    curtain: () => mat('#ece5d8', { tex: 'fabric', r: 1, ds: true, clip: true }),
    sill: () => mat('#d8d2c9', { r: 0.6 }),
    glass: () => mat('#d8ebf5', { r: 0.04, m: 0.1, o: 0.22, ds: true, clip: true }),
    metal: () => mat('#2a2d31', { r: 0.5, m: 0.4, clip: true }),
    windowFrame: () => mat('#3e4547', { r: 0.48, m: 0.35, clip: true }),
    handle: () => mat('#e4e7ea', { r: 0.13, m: 1, clip: true }),
    cut: () => mat('#2b3440', { r: 0.8 }),
  };
  let MONTAR_MATS = null;
  function wallMaterialsMontar() {
    if (!MONTAR_MATS) { const side = mat('#ffffff', { r: 0.95 }); MONTAR_MATS = [side, side, mat('#1f2b38', { r: 0.6 }), side, side, side]; }
    return MONTAR_MATS;
  }
  function pleated(w, h) {
    const g = new THREE.BoxGeometry(w, h, 0.03, 18, 1, 1), p = g.attributes.position;
    for (let i = 0; i < p.count; i++) p.setZ(i, p.getZ(i) + Math.sin((p.getX(i) / w) * Math.PI * 9) * 0.028);
    g.computeVertexNormals();
    return g;
  }

  function buildWall(plan, root, sg, caps) {
    const { horiz, x0, z0, len, thick } = sg;
    const owner = sg.r.own;
    const varandaExt = REAL && sg.ext && sg.r.k === 'varanda';
    const H = varandaExt ? 1.05 : WALL_H;
    const ops = sg.ops.filter((op) => REAL || !(op.kind === 'win' || op.kind === 'high')).sort((a, b) => a.c - b.c);
    let cur = 0;
    const pieces = [];
    ops.forEach(({ c, w }) => { const a = clamp(c - w / 2, 0, len), b = clamp(c + w / 2, 0, len); if (a > cur) pieces.push([cur, a]); cur = Math.max(cur, b); });
    if (cur < len) pieces.push([cur, len]);
    /* lado de dentro e de fora de cada trecho */
    const n = horiz ? [0, 1] : [1, 0];
    const sideMats = (along) => {
      const px = horiz ? x0 + along : x0, pz = horiz ? z0 : z0 + along;
      const look = (sgn) => { const rr = roomAt(plan, px + n[0] * sgn * 0.3, pz + n[1] * sgn * 0.3); return rr ? (WET.has(rr.k) ? W_MAT.tile() : W_MAT.paint()) : W_MAT.facade(); };
      const plus = look(1), minus = look(-1), paint = W_MAT.paint(), cap = W_MAT.cap();
      return horiz ? [paint, paint, cap, cap, plus, minus] : [plus, minus, cap, cap, paint, paint];
    };
    const put = (geo, material, along, cast = true) => {
      const m = new THREE.Mesh(geo, material);
      m.position.set(horiz ? x0 + along : x0, 0.04, horiz ? z0 : z0 + along);
      m.castShadow = cast; m.receiveShadow = true;
      m.scale.y = 0.001;
      root.add(m); owner.walls.push(m);
      return m;
    };
    const box = (lw, h, th, y, off = 0, offN = 0) => {
      const sx = horiz ? lw : th, sz = horiz ? th : lw;
      const g = meterUV(new THREE.BoxGeometry(sx, h, sz), sx, h, sz);
      g.translate(horiz ? off : offN, y + h / 2, horiz ? offN : off);
      return g;
    };
    /* trechos cheios */
    const corner = (x) => horiz && Math.abs(Math.abs(x) - plan.W / 2) < 0.0001;
    pieces.forEach(([a, b]) => {
      const ext = thick / 2;
      const inset = Math.min(ext, (b - a) / 4);
      let start = a, end = b;
      if (a <= 0.001 && corner(x0)) start -= ext;
      if (b >= len - 0.001 && corner(x0 + len)) end += ext;
      if (sg.ext && !horiz) {
        if (a <= 0.001 && Math.abs(z0 + plan.D / 2) < 0.0001) start += inset;
        if (b >= len - 0.001 && Math.abs(z0 + len - plan.D / 2) < 0.0001) end -= inset;
      }
      const L = end - start;
      const mid = (start + end) / 2;
      if (!REAL) { put(box(L, WALL_H, thick, 0), wallMaterialsMontar(), mid); return; }
      put(box(L, H, thick, 0), sideMats(mid), mid);
      finishes(L, mid, 0, H);
      if (H > CUT_H + 0.1) { const cm = put(box(L, 0.012, thick + 0.004, CUT_H - 0.006), W_MAT.cut(), mid, false); cm.userData.cap = true; caps.push(cm); }
    });
    /* rodapé por dentro, faixa de pedra por fora */
    function finishes(L, mid, y0, yTop) {
      if (!REAL) return;
      const px = horiz ? x0 + mid : x0, pz = horiz ? z0 : z0 + mid;
      [1, -1].forEach((sgn) => {
        const rr = roomAt(plan, px + n[0] * sgn * 0.3, pz + n[1] * sgn * 0.3);
        const offN = sgn * (thick / 2 + 0.007);
        if (!rr) { if (y0 < 0.01) put(box(L, Math.min(0.42, yTop), 0.014, 0, 0, offN), W_MAT.band(), mid); }
        else if (!WET.has(rr.k) && y0 < 0.01) put(box(Math.max(0.02, L - thick), 0.08, 0.012, 0, 0, sgn * (thick / 2 + 0.006)), W_MAT.trim(), mid);
      });
    }
    if (!REAL || H < 2.3) return;
    ops.forEach((op) => {
      const { c, w, kind } = op;
      const head = (y) => { put(box(w, H - y, thick, y), sideMats(c), c); };
      if (kind === 'win' || kind === 'high') {
        const y0 = kind === 'high' ? 1.6 : 0.9, y1 = kind === 'high' ? 2.1 : 2.1;
        put(box(w, y0, thick, 0), sideMats(c), c);
        finishes(w, c, 0, y0);
        head(y1);
        put(box(w - 0.06, y1 - y0 - 0.06, 0.02, y0 + 0.03), W_MAT.glass(), c, false);
        const fr = [box(0.05, y1 - y0, 0.07, y0, -(w / 2 - 0.025)), box(0.05, y1 - y0, 0.07, y0, w / 2 - 0.025), box(w, 0.05, 0.07, y0), box(w, 0.05, 0.07, y1 - 0.05)];
        if (kind === 'win') fr.push(box(0.04, y1 - y0, 0.06, y0, 0));
        const frameGeometry = mergeGeometries(fr);
        fr.forEach((part) => part.dispose());
        put(frameGeometry, sg.ext ? W_MAT.windowFrame() : W_MAT.trim(), c);
        if (sg.ext) put(box(w + 0.12, 0.035, 0.07, y0 - 0.035, 0, -sg.inS * (thick / 2 + 0.03)), W_MAT.sill(), c);
        if (kind === 'win') {
          /* cortinas por dentro */
          const offN = sg.inS * (thick / 2 + 0.09);
          [-1, 1].forEach((sd) => {
            const g = pleated(0.42, H - 0.3);
            if (!horiz) g.rotateY(Math.PI / 2);
            g.translate(horiz ? sd * (w / 2 + 0.16) : offN, (H - 0.3) / 2 + 0.05, horiz ? offN : sd * (w / 2 + 0.16));
            put(g, W_MAT.curtain(), c);
          });
          const rg = new THREE.CylinderGeometry(0.012, 0.012, w + 0.8, 8); rg.rotateZ(Math.PI / 2); if (!horiz) rg.rotateY(Math.PI / 2);
          rg.translate(horiz ? 0 : offN, H - 0.2, horiz ? offN : 0);
          put(rg, W_MAT.metal(), c);
        }
      } else {
        const top = kind === 'gate' ? 2.4 : 2.1;
        head(top);
        const jamb = [box(0.045, top, thick + 0.02, 0, -(w / 2 - 0.022)), box(0.045, top, thick + 0.02, 0, w / 2 - 0.022), box(w, 0.045, thick + 0.02, top - 0.045)];
        const jambGeometry = mergeGeometries(jamb);
        jamb.forEach((part) => part.dispose());
        put(jambGeometry, sg.ext ? W_MAT.windowFrame() : W_MAT.trim(), c);
        if (kind === 'door') {
          /* folha da porta, aberta para dentro do cômodo dono da parede */
          const lw = w - 0.09;
          const leaf = new THREE.BoxGeometry(horiz ? lw : 0.04, 2.04, horiz ? 0.04 : lw);
          leaf.translate(horiz ? lw / 2 : 0, 1.02, horiz ? 0 : lw / 2);
          const handle = new THREE.CylinderGeometry(0.018, 0.018, 0.14, 10); if (horiz) handle.rotateX(Math.PI / 2); else handle.rotateZ(Math.PI / 2);
          handle.translate(horiz ? lw - 0.08 : 0.04, 1.02, horiz ? 0.04 : lw - 0.08);
          const hinge = c - w / 2 + 0.045;
          const ang = horiz ? -1.75 * sg.inS : 1.75 * sg.inS;
          const lm = put(leaf, W_MAT.door(), hinge); lm.rotation.y = ang;
          const hm = put(handle, W_MAT.handle(), hinge); hm.rotation.y = ang;
        }
      }
    });
  }

  /* ---------- 9. a casa ---------- */
  let house = null, T = 0, userTouched = false, tween = null, focusIdx = -1;
  let facade = false, planVisible = false, contextLost = false;
  let currentObra, activePlan, planSelection = -1, rebuildPending = false;
  const disposables = [];
  function disposeHouse() {
    if (!house) return;
    scene.remove(house.root);
    house.root.traverse((o) => { if (o.geometry) o.geometry.dispose(); });
    house.labels.forEach((l) => l.el.remove());
    disposables.splice(0).forEach((m) => m.dispose());
    house = null;
  }

  function buildYard(plan, root) {
    const yard = new THREE.Group();
    root.add(yard);
    const { W, D } = plan;
    const R = rng(Math.round(W * 100 + D));
    /* calçada da entrada e garagem */
    const entry = plan.rooms.find((r) => r.ops.L.some((op) => op.entry));
    if (entry) {
      const z = entry.z0 + entry.d / 2;
      for (let i = 0; i < 6; i++) {
        const stone = rb(yard, 0.65, 0.08, 1.5, mat('#d8d0c2', { tex: 'conc', r: 0.88 }), -W / 2 - 0.82 - i * 0.74, -0.1, z, 0);
        stone.receiveShadow = true;
      }
      for (const direction of [-1, 1]) {
        const planter = rb(yard, 0.4, 0.27, 0.8, mat('#89857e', { tex: 'conc', r: 0.9 }), -W / 2 - 0.6, -0.08, z + direction * 1.24, 0.024);
        planter.castShadow = true; planter.receiveShadow = true;
        const shrub = bush(0.75, 101 + direction);
        shrub.position.set(planter.position.x, 0.16, planter.position.z);
        yard.add(shrub);
      }
    }
    const gar = plan.rooms.find((r) => r.gate);
    if (gar) {
      const op = gar.ops[gar.gate][0];
      const len = 6, gw = op.w + 0.6;
      const horizontal = gar.gate === 'T' || gar.gate === 'B';
      const width = horizontal ? gw : len, depth = horizontal ? len : gw;
      const g = meterUV(new THREE.BoxGeometry(width, 0.1, depth), width, 0.1, depth);
      const m = new THREE.Mesh(g, mat('#ffffff', { tex: 'conc', r: 0.9 }));
      if (gar.gate === 'T') m.position.set(gar.x0 + op.c, -0.05, -D / 2 - 0.5 - len / 2);
      else if (gar.gate === 'B') m.position.set(gar.x0 + op.c, -0.05, D / 2 + 0.5 + len / 2);
      else if (gar.gate === 'L') m.position.set(-W / 2 - 0.5 - len / 2, -0.05, gar.z0 + op.c);
      else m.position.set(W / 2 + 0.5 + len / 2, -0.05, gar.z0 + op.c);
      m.receiveShadow = true; yard.add(m);
    }
    /* árvores e arbustos */
    const spots = [[-W / 2 - 2.4, -D / 2 - 2.4, 1.1], [W / 2 + 3.4, D / 2 + 2.2, 1.0], [W / 2 + 4.6, -D * 0.1, 1.25], [W / 2 + 3.2, -D / 2 - 3.4, 0.9], [W * 0.15, D / 2 + 5.5, 1.3], [-W * 0.3, D / 2 + 6.5, 1.1]];
    spots.forEach(([x, z, s], i) => { const t = tree(s, 100 + i); t.position.set(x, -0.1, z); t.rotation.y = R() * 6; yard.add(t); });
    for (let x = -W / 2 + 0.6; x < W / 2 - 0.4; x += 1.5 + R() * 0.6) { const b = bush(0.8 + R() * 0.4, Math.round(x * 10) + 7); b.position.set(x, -0.1, D / 2 + 0.95); yard.add(b); }
    for (let z = -D / 2 + 0.8; z < D / 2 - 0.5; z += 1.7 + R() * 0.6) {
      const near = entry && Math.abs(z - (entry.z0 + entry.d / 2)) < 1.4;
      if (!near) { const b = bush(0.75 + R() * 0.3, Math.round(z * 10) + 31); b.position.set(-W / 2 - 0.95, -0.1, z); yard.add(b); }
    }
    return yard;
  }

  function buildRoof(plan, root) {
    const roof = G();
    const { W, D } = plan;
    const trim = mat('#4b5052', { r: 0.62, m: 0.15 });
    const slab = mat('#646762', { tex: 'conc', r: 0.88 });
    const wood = mat('#b99164', { tex: 'grain', r: 0.63 });
    const base = WALL_H + 0.04;
    const pieces = [
      rb(roof, W + 1.0, 0.11, D + 1.0, wood, 0, base, 0, 0),
      rb(roof, W + 1.04, 0.17, D + 1.04, trim, 0, base + 0.11, 0, 0),
      rb(roof, W + 0.38, 0.02, D + 0.38, slab, 0, base + 0.282, 0, 0, true),
    ];
    const rim = 0.11, rimHeight = 0.18;
    for (const side of [-1, 1]) {
      pieces.push(
        rb(roof, W + 0.42, rimHeight, rim, trim, 0, base + 0.28, side * (D / 2 + 0.17), 0),
        rb(roof, rim, rimHeight, D + 0.23, trim, side * (W / 2 + 0.15), base + 0.28, 0, 0),
      );
    }
    for (const wall of plan.segs.filter((segment) => segment.ext && segment.r.k === 'varanda')) {
      for (const along of [0.13, wall.len - 0.13]) {
        const x = wall.x0 + (wall.horiz ? along : 0);
        const z = wall.z0 + (wall.horiz ? 0 : along);
        pieces.push(rb(roof, 0.13, WALL_H - 1.05, 0.13, trim, x, 1.09, z, 0));
      }
    }
    pieces.forEach((piece) => { piece.castShadow = true; piece.receiveShadow = true; });
    roof.visible = facade;
    root.add(roof);
    return roof;
  }

  function buildHouse(obra) {
    if (PH.on) endPhoto();
    disposeHouse();
    const plan = planHouse(obra);
    const root = new THREE.Group();
    scene.add(root);
    const ceils = [];
    const slab = new THREE.Mesh(meterUV(new THREE.BoxGeometry(plan.W + 1.0, 0.1, plan.D + 1.0), plan.W + 1, 0.1, plan.D + 1), REAL ? mat('#ffffff', { tex: 'pave', r: 0.9 }) : mat('#f2f5fa', { r: 1 }));
    slab.position.y = -0.05; slab.receiveShadow = true;
    root.add(slab);
    const edgeMat = new THREE.LineBasicMaterial({ color: 0x1b5fd9, transparent: true, opacity: 0 });
    disposables.push(edgeMat);
    const edgePts = [];
    plan.rooms.forEach((r) => {
      const own = { walls: [], items: [], floor: null };
      r.own = own;
      const fg = meterUV(new THREE.BoxGeometry(r.w, 0.04, r.d), r.w, 0.04, r.d);
      let fm;
      if (REAL) fm = mat('#ffffff', { tex: FLOOR_TEX[r.k] || 'conc', r: { wood: 0.5, deck: 0.8, tile: 0.28, conc: 0.85 }[FLOOR_TEX[r.k] || 'conc'] });
      else { fm = new THREE.MeshStandardMaterial({ color: '#eaf1fd', roughness: 0.9 }); disposables.push(fm); }
      const fl = new THREE.Mesh(fg, fm);
      fl.position.set(r.cx, 0.02, r.cz); fl.receiveShadow = true;
      root.add(fl);
      own.floor = fl; own.color = new THREE.Color(REAL ? '#ffffff' : FLOOR_FLAT[r.k] || '#e6e6e6');
      const y = 0.06;
      edgePts.push(r.x0, y, r.z0, r.x0 + r.w, y, r.z0, r.x0 + r.w, y, r.z0, r.x0 + r.w, y, r.z0 + r.d, r.x0 + r.w, y, r.z0 + r.d, r.x0, y, r.z0 + r.d, r.x0, y, r.z0 + r.d, r.x0, y, r.z0);
      if (REAL) {
        const ce = new THREE.Mesh(new THREE.BoxGeometry(r.w, 0.06, r.d), mat('#fbfaf7', { r: 0.95 }));
        ce.position.set(r.cx, WALL_H + 0.07, r.cz); ce.receiveShadow = true; ce.castShadow = true; ce.visible = false;
        root.add(ce); ceils.push(ce);
        if (r.k === 'sala' && r.w > 2.1 && r.d > 1.9) {
          const trim = G();
          for (const side of [-1, 1]) {
            rb(trim, r.w - .42, .06, .09, M.walnut(), 0, 0, side * (r.d / 2 - .2), 0);
            rb(trim, r.w - .48, .018, .021, M.warmStrip(), 0, -.018, side * (r.d / 2 - .255), 0);
          }
          const ceilingTrim = bake(trim);
          ceilingTrim.position.set(r.cx, WALL_H - .08, r.cz);
          ceilingTrim.visible = false;
          root.add(ceilingTrim); ceils.push(ceilingTrim);
          const rings = livingRings();
          rings.position.set(r.cx, WALL_H + .04, r.cz);
          rings.visible = false;
          root.add(rings); ceils.push(rings);
        }
        const lampG = new THREE.Mesh(new THREE.CylinderGeometry(0.2, 0.2, 0.03, 28), M.bulb());
        lampG.position.set(r.cx, WALL_H + 0.025, r.cz); lampG.visible = false; root.add(lampG); ceils.push(lampG);
      }
      /* móveis */
      const holder = new THREE.Group();
      holder.position.set(r.cx, 0.04, r.cz);
      root.add(holder);
      r.holder = holder;
      furnish(r);
      if (REAL && r.k !== 'sala' && r.pend) { const p = pendant(WALL_H - 1.65 - 0.2); p.position.set(r.cx + r.pend.x, WALL_H + 0.04, r.cz + r.pend.z); p.visible = false; root.add(p); ceils.push(p); }
      r.items.forEach((g) => { g.userData.base = g.userData.base || g.scale.x; g.scale.setScalar(0.0001); own.items.push(g); });
    });
    const caps = [];
    plan.segs.forEach((sg) => buildWall(plan, root, sg, caps));
    if (REAL) buildYard(plan, root);
    const roof = REAL ? buildRoof(plan, root) : null;
    const litRooms = plan.rooms.filter((r) => r.k === 'sala' || r.k === 'cozinha' || r.k === 'varanda');
    eveningLamps.forEach((lamp, i) => {
      const r = litRooms[i] || plan.rooms[i];
      if (r) lamp.position.set(r.cx, WALL_H - .38, r.cz);
      lamp.userData.hasRoom = Boolean(r);
    });
    const eg = new THREE.BufferGeometry();
    eg.setAttribute('position', new THREE.Float32BufferAttribute(edgePts, 3));
    const lines = new THREE.LineSegments(eg, edgeMat);
    root.add(lines);

    const labels = plan.rooms.map((r) => {
      const el = document.createElement('button');
      el.className = 'lab'; el.type = 'button';
      el.innerHTML = `<b>${r.name}</b><span>${formatArea(r.area)}</span>`;
      el.setAttribute('aria-label', (REAL ? 'Entrar em ' : 'Ver de perto: ') + r.name);
      el.addEventListener('click', () => focusRoom(r.idx));
      labelsEl.append(el);
      return { el, r };
    });

    const R = Math.hypot(plan.W, plan.D) / 2;
    aimSun(0, 0, R * (REAL ? 1.9 : 1.25), R);
    house = { root, plan, lines, labels, R, ceils, caps, roof, done: 2.7 + plan.rooms.length * 0.42 + 1.2, cue: false };
    activePlan = plan;
    planSelection = -1;
    rebuildPending = false;
    focusIdx = -1;
    T = 0; userTouched = false; tween = null;
    controls.target.set(0, 0, 0);
    restoreOrbit();
    placeCamera(0.05, R * 3.5 * fitK(), 0.55);
    const instant = REDUCED || REAL;
    applyTime(instant ? 999 : 0);
    if (instant) {
      T = house.done;
      const az = facade ? -0.95 : REAL ? Math.PI + 0.7 : 0.55;
      placeCamera(facade ? 1.16 : 0.9, R * (REAL ? 3.0 : 3.1) * fitK(), az);
      userTouched = true;
    }
    updatePlan();
    requestDraw();
  }

  /* sombra do sol enquadrada: a casa toda por fora, só o cômodo por dentro (fica mais nítida) */
  function aimSun(x, z, ext, R) {
    sun.target.position.set(x, 0, z);
    sun.position.copy(SUN_DIR).multiplyScalar(R * 2.6).add(sun.target.position);
    const sc = sun.shadow.camera;
    sc.left = -ext; sc.right = ext; sc.top = ext; sc.bottom = -ext; sc.near = 0.5; sc.far = R * 6; sc.updateProjectionMatrix();
    sun.shadow.needsUpdate = true;
  }

  /* ---------- 10. a linha do tempo da construção ---------- */
  function applyTime(t) {
    if (!house) return;
    house.lines.material.opacity = easeOut(clamp(t / 0.8)) * (1 - easeOut(clamp((t - 2.4) / 1.2)));
    house.plan.rooms.forEach((r, i) => {
      const w0 = 1.3 + i * 0.26;
      r.own.walls.forEach((w) => {
        const u = clamp((t - w0) / 0.9);
        w.scale.y = Math.max(0.001, easeOut(u));
        w.visible = u > 0 && (!w.userData.cap || (REAL && CUT.constant < CUT_H + 0.05));
      });
      if (!REAL) { const fu = clamp((t - (1.7 + i * 0.26)) / 0.7); r.own.floor.material.color.copy(BLUEPRINT).lerp(r.own.color, easeOut(fu)); }
      const m0 = 2.7 + i * 0.42;
      r.own.items.forEach((g, j) => { const u = clamp((t - m0 - j * 0.08) / 0.55); g.scale.setScalar(Math.max(0.0001, easeBack(u) * g.userData.base)); g.visible = u > 0; });
      house.labels[i].op = clamp((t - (m0 + 0.2)) / 0.5);
    });
    sun.shadow.needsUpdate = true;
  }

  /* ---------- 11. câmera ---------- */
  const fitK = () => Math.max(1, (REAL ? 1.32 : 1.18) / camera.aspect);
  function placeCamera(polar, dist, az) {
    const t = controls.target;
    camera.position.set(t.x + dist * Math.sin(polar) * Math.sin(az), t.y + dist * Math.cos(polar), t.z + dist * Math.sin(polar) * Math.cos(az));
    camera.lookAt(t);
    controls.update();
  }
  function flyTo(target, polar, dist, dur = 1.1, opts = {}) {
    const t0 = controls.target.clone(), p0 = camera.position.clone();
    const off = p0.clone().sub(t0);
    const az = opts.az ?? Math.atan2(off.x, off.z);
    const tp = target.clone().add(new THREE.Vector3(dist * Math.sin(polar) * Math.sin(az), dist * Math.cos(polar), dist * Math.sin(polar) * Math.cos(az)));
    tween = { t0, p0, t1: target.clone(), p1: tp, s: performance.now(), dur: REDUCED ? 1 : dur * 1000, f0: camera.fov, f1: opts.fov || 32, end: opts.end, c0: CUT.constant, c1: opts.cut ?? null };
    requestDraw();
  }
  function flyEye(eye, look, r, dur = 1.4) {
    const dir = look.clone().sub(eye).normalize();
    tween = {
      t0: controls.target.clone(), p0: camera.position.clone(), t1: eye.clone().add(dir.multiplyScalar(0.01)), p1: eye.clone(), s: performance.now(), dur: REDUCED ? 1 : dur * 1000, f0: camera.fov, f1: 61, c0: CUT.constant, c1: 3.4,
      end: () => {
        setCut(100);
        house.ceils.forEach((ceiling) => { ceiling.visible = true; });
        roomLight.position.set(r.cx, WALL_H - 0.32, r.cz);
        applyLight(true);
        aimSun(r.cx, r.cz, Math.hypot(r.w, r.d) / 2 + 2.5, house.R);
        setEnv('room');
      },
    };
    requestDraw();
  }
  function restoreOrbit() {
    controls.enableZoom = true; controls.enablePan = true; controls.rotateSpeed = 1;
    controls.minPolarAngle = 0; controls.maxPolarAngle = Math.PI * 0.46;
    if (house) { controls.minDistance = Math.max(2.5, house.R * 0.5); controls.maxDistance = house.R * 9; }
    camera.fov = 32; camera.updateProjectionMatrix();
    if (house) house.ceils.forEach((c) => { c.visible = false; });
    applyLight(false);
    setCut(REAL && !facade ? CUT_H : 100);
    if (house) aimSun(0, 0, house.R * (REAL ? 1.9 : 1.25), house.R);
    if (REAL) setEnv('sky');
    setDrag(); showNav();
  }
  function setCut(v) {
    if (v !== CUT.constant) sun.shadow.needsUpdate = true;
    CUT.constant = v;
    if (house) house.caps.forEach((c) => { c.visible = REAL && v < CUT_H + 0.05; });
  }
  function setDrag() {
    $('#drag').textContent = REAL && focusIdx >= 0 ? 'Arraste para olhar em volta.' : 'Arraste para girar. Role para aproximar.';
  }
  function setFacade(active) {
    facade = active;
    $('#facade').setAttribute('aria-pressed', String(active));
    if (house?.roof) house.roof.visible = active;
    sun.shadow.needsUpdate = true;
  }
  function enterRoom(i) {
    if (PH.on) endPhoto();
    setFacade(false);
    const r = house.plan.rooms[i];
    focusIdx = i; userTouched = true;
    controls.enableZoom = false; controls.enablePan = false; controls.rotateSpeed = -0.42;
    controls.minDistance = 0.005; controls.maxDistance = 80; controls.minPolarAngle = 0.15; controls.maxPolarAngle = Math.PI - 0.15;
    /* como numa foto de imóvel: de um canto livre perto da porta, olhando para o canto oposto */
    const op = r.opens[r.door].find((o) => o.own && (o.kind === 'door' || o.kind === 'pass')) || r.opens[r.door][0];
    const along = op ? (op.a + op.b) / 2 : 0;
    const dp = r.door === 'T' ? [along, r.Z0] : [r.X0, along];
    const ix = Math.min(0.32, r.iw * 0.12), iz = Math.min(0.32, r.id * 0.12);
    const cs = [[r.X0 + ix, r.Z0 + iz, r.X1, r.Z1], [r.X1 - ix, r.Z0 + iz, r.X0, r.Z1], [r.X0 + ix, r.Z1 - iz, r.X1, r.Z0], [r.X1 - ix, r.Z1 - iz, r.X0, r.Z0]];
    const blocked = (x, z) => r.occ.some((q) => !q.door && x > q.x0 - 0.12 && x < q.x1 + 0.12 && z > q.z0 - 0.12 && z < q.z1 + 0.12);
    const free = cs.filter(([x, z]) => !blocked(x, z)).sort((A, B) => Math.hypot(A[0] - dp[0], A[1] - dp[1]) - Math.hypot(B[0] - dp[0], B[1] - dp[1]));
    let e, l;
    const gate = r.gate && r.opens[r.gate].find((o) => o.kind === 'gate');
    if (gate) {
      /* garagem: do lado de fora, olhando pelo portão */
      const g0 = (gate.a + gate.b) / 2;
      e = { T: [g0, r.Z0 - 2.4], B: [g0, r.Z1 + 2.4], L: [r.X0 - 2.4, g0], R: [r.X1 + 2.4, g0] }[r.gate];
      l = { T: [g0 * 0.4, r.Z1 * 0.35], B: [g0 * 0.4, r.Z0 * 0.35], L: [r.X1 * 0.35, g0 * 0.4], R: [r.X0 * 0.35, g0 * 0.4] }[r.gate];
    } else if (free.length) { const [x, z, ox, oz] = free[0]; e = [x, z]; l = [ox * 0.45, oz * 0.45]; }
    else if (r.door === 'T') { e = [clamp(along, r.X0 + 0.35, r.X1 - 0.35), r.Z0 + Math.min(0.45, r.id * 0.15)]; l = [-along * 0.4, r.Z1 - r.id * 0.3]; }
    else { e = [r.X0 + Math.min(0.45, r.iw * 0.15), clamp(along, r.Z0 + 0.35, r.Z1 - 0.35)]; l = [r.X1 - r.iw * 0.3, -along * 0.4]; }
    if (r.k === 'sala' && r.win) {
      const side = r.win;
      const window = r.opens[side].find((opening) => opening.kind === 'win');
      if (window) {
        const center = (window.a + window.b) / 2;
        const target = { T: [center, r.Z0], B: [center, r.Z1], L: [r.X0, center], R: [r.X1, center] }[side];
        l = [lerp(l[0], target[0], 0.3), lerp(l[1], target[1], 0.3)];
      }
    }
    const eyeY = r.k === 'garagem' ? 1.75 : 1.55;
    flyEye(new THREE.Vector3(r.cx + e[0], eyeY, r.cz + e[1]), new THREE.Vector3(r.cx + l[0], r.k === 'sala' ? 1.22 : 1.0, r.cz + l[1]), r);
    setDrag(); renderList(); showNav();
  }
  function focusRoom(i) {
    if (!house) return;
    if (PH.on) endPhoto();
    if (REAL) return enterRoom(i);
    const r = house.plan.rooms[i];
    focusIdx = i; userTouched = true;
    flyTo(new THREE.Vector3(r.cx, 0.4, r.cz), 0.82, Math.max(r.w, r.d) * 1.7 + 3.4);
    renderList();
  }
  function overview(resetFacadeAngle = false) {
    if (!house) return;
    if (PH.on) endPhoto();
    focusIdx = -1; userTouched = true;
    house.ceils.forEach((c) => { c.visible = false; });
    applyLight(false);
    if (REAL) {
      if (facade) setCut(100);
      else if (CUT.constant > 3.4) setCut(3.4);
      setEnv('sky');
      aimSun(0, 0, house.R * 1.9, house.R);
    }
    const target = new THREE.Vector3(0, facade ? 1.05 : 0, 0);
    const az = facade && resetFacadeAngle ? -0.95 : undefined;
    flyTo(target, facade ? 1.18 : 0.9, house.R * 3.0 * fitK(), 0.9, { az, cut: REAL && !facade ? CUT_H : null, end: restoreOrbit });
    renderList(); showNav();
  }

  /* ---------- 12. modo montar e modo realista ---------- */
  let envTex = null, envSky = null, ground = null, composer = null, aoPass = null, aoOn = false;
  function setEnv(kind) {
    if (!REAL || !envTex) return;
    scene.environment = kind === 'room' ? envTex : envSky;
    scene.environmentIntensity = NIGHT ? (kind === 'room' ? .32 : .30) : (kind === 'room' ? .83 : 1.64);
  }
  function applyLight(inside) {
    const night = REAL && NIGHT;
    renderer.toneMappingExposure = night ? 1.12 : 1;
    hemi.intensity = REAL ? (night ? .52 : .37) : .95;
    hemi.color.set(night ? '#80a9ff' : REAL ? '#dfebf7' : '#ffffff');
    hemi.groundColor.set(night ? '#37416b' : REAL ? '#b7a68e' : '#c9d6ea');
    sun.color.set(night ? '#91b9ff' : '#ffead8');
    sun.intensity = REAL ? (night ? .48 : 2.72) : 1.35;
    sky.material.color.set(night ? '#475d94' : '#ffffff');
    scene.fog = REAL ? new THREE.Fog(night ? eveningHorizon : HORIZON, 70, 260) : null;
    roomLight.color.set(night ? '#ffc58e' : '#fff1dc');
    const room = inside && house?.plan.rooms[focusIdx];
    roomLight.intensity = room ? (night ? 20 : room.win ? 3.2 : 5) : 0;
    eveningLamps.forEach((lamp) => {
      lamp.intensity = night && !inside && lamp.userData.hasRoom ? 17 : 0;
    });
    setEnv(inside ? 'room' : 'sky');
    stage.classList.toggle('night', night);
    $('#lighting').setAttribute('aria-pressed', String(night));
    requestDraw();
  }

  function toggleNight() {
    if (!REAL || planVisible || contextLost) return;
    if (PH.on) endPhoto();
    NIGHT = !NIGHT;
    applyLight(focusIdx >= 0 && !tween);
  }

  const perf = { n: 0, sum: 0, done: true };
  function makeComposer() {
    const w = stage.clientWidth, h = stage.clientHeight;
    const rt = new THREE.WebGLRenderTarget(w, h, { type: THREE.HalfFloatType, samples: 2 });
    composer = new EffectComposer(renderer, rt);
    composer.setPixelRatio(PR);
    composer.setSize(w, h);
    composer.addPass(new RenderPass(scene, camera));
    aoPass = new GTAOPass(scene, camera, w, h);
    aoPass.updateGtaoMaterial({ radius: 0.48, distanceExponent: 1.4, thickness: 1.0, scale: 1.1, samples: 16, distanceFallOff: 1 });
    aoPass.updatePdMaterial({ lumaPhi: 10, depthPhi: 2, normalPhi: 3, radius: 6, rings: 2, samples: 16 });
    aoPass.blendIntensity = 0.84;
    aoPass.normalMaterial.clippingPlanes = [CUT];
    const base = aoPass._overrideVisibility.bind(aoPass);
    aoPass._overrideVisibility = function () {
      base();
      const cache = this._visibilityCache;
      this.scene.traverse((o) => { if (o.isMesh && o.visible && (o.userData.noAO || (!Array.isArray(o.material) && o.material.transparent))) { o.visible = false; cache.push(o); } });
    };
    composer.addPass(aoPass);
    composer.addPass(new OutputPass());
  }
  function setMode(real) {
    if (PH.on) endPhoto();
    REAL = real; WALL_H = real ? 2.7 : 1.6;
    setFacade(false);
    renderer.toneMapping = real ? THREE.NeutralToneMapping : THREE.NoToneMapping;
    if (real && !envTex) {
      const pm = new THREE.PMREMGenerator(renderer);
      const room = new RoomEnvironment();
      const skyTexture = skyEquirect(false);
      envTex = pm.fromScene(room, 0.04).texture;
      envSky = pm.fromEquirectangular(skyTexture).texture;
      room.dispose();
      skyTexture.dispose();
      pm.dispose();
    }
    scene.environment = real ? envSky : null;
    grid.visible = !real;
    sky.visible = real;
    if (real && !ground) {
      const g = new THREE.CircleGeometry(300, 64);
      const uv = g.attributes.uv; for (let i = 0; i < uv.count; i++) uv.setXY(i, uv.getX(i) * 600, uv.getY(i) * 600);
      ground = new THREE.Mesh(g, mat('#ffffff', { tex: 'grass', r: 1 }));
      ground.rotation.x = -Math.PI / 2; ground.position.y = -0.1; ground.receiveShadow = true; scene.add(ground);
    }
    if (ground) ground.visible = real;
    stage.classList.toggle('real', real);
    if (real && !LIGHT_GPU && !composer && renderer.extensions.has('EXT_color_buffer_float')) makeComposer();
    aoOn = real && !!composer;
    if (real) { perf.n = 0; perf.sum = 0; perf.done = false; }
    $('#modo').textContent = real ? 'Voltar a montar' : 'Ver em modo realista';
    $('#modo').classList.toggle('tool-main', !real);
    showPlanInterface(planVisible, !contextLost, real);
    $('#modo').classList.toggle('on', real);
    $('#modo').classList.remove('cue');
    tween = null; focusIdx = -1;
    buildHouse(currentObra || DEFAULT_OBRA);
    applyLight(false);
  }


  /* ---------- foto realista: a luz calculada raio por raio, no próprio navegador ---------- */
  const PH = { on: false, ready: false, done: false, stop: false, pt: null, target: 0, skyPT: null, nightPT: null, saved: null, area: null, dq: null, url: null, pct: -1, token: 0 };
  const nextFrame = () => new Promise((res) => requestAnimationFrame(() => res()));
  /* na vista de fora a foto também mostra as paredes cortadas: o corte vira geometria */
  function cutGeometry(on) {
    house.root.traverse((o) => {
      if (!o.isMesh) return;
      const ms = Array.isArray(o.material) ? o.material : [o.material];
      if (!ms.some((m) => m.clippingPlanes && m.clippingPlanes.length)) return;
      const pos = o.geometry.attributes.position;
      if (on) {
        const lim = CUT_H - o.position.y;
        let minY = Infinity;
        for (let i = 0; i < pos.count; i++) minY = Math.min(minY, pos.getY(i));
        if (minY >= lim - 1e-4) { if (o.visible) { o.visible = false; o.userData.cutHidden = true; } return; }
        o.userData.pos0 = pos.array.slice();
        for (let i = 0; i < pos.count; i++) if (pos.getY(i) > lim) pos.setY(i, lim);
      } else {
        if (o.userData.cutHidden) { o.visible = true; o.userData.cutHidden = false; }
        if (!o.userData.pos0) return;
        pos.array.set(o.userData.pos0); o.userData.pos0 = null;
      }
      pos.needsUpdate = true; o.geometry.computeBoundingBox(); o.geometry.computeBoundingSphere();
    });
  }
  /* o cálculo da foto entende um material por objeto: as paredes (tinta de um lado, reboco do outro) viram uma peça por material */
  function splitMulti(on) {
    if (on) {
      PH.split = [];
      house.root.traverse((o) => { if (o.isMesh && o.visible && Array.isArray(o.material) && o.geometry.index) PH.split.push(o); });
      PH.split.forEach((o) => {
        const g = o.geometry, idx = g.index.array, by = new Map();
        g.groups.forEach((gr) => {
          const m = o.material[gr.materialIndex];
          if (!m) return;
          if (!by.has(m)) by.set(m, []);
          const arr = by.get(m);
          for (let k = gr.start; k < gr.start + gr.count; k++) arr.push(idx[k]);
        });
        const kids = [];
        by.forEach((ids, m) => {
          const ng = new THREE.BufferGeometry();
          Object.entries(g.attributes).forEach(([n, a]) => ng.setAttribute(n, a));
          ng.setIndex(ids);
          const k = new THREE.Mesh(ng, m);
          k.position.copy(o.position); k.quaternion.copy(o.quaternion); k.scale.copy(o.scale);
          o.parent.add(k); kids.push(k);
        });
        o.userData.ptKids = kids; o.visible = false;
      });
    } else {
      (PH.split || []).forEach((o) => {
        o.userData.ptKids.forEach((k) => { k.removeFromParent(); k.geometry.dispose(); });
        o.userData.ptKids = null; o.visible = true;
      });
      PH.split = null;
    }
  }
  function photoUI(state, pct = 0) {
    const box = $('#photo'), msg = $('#photo-msg');
    stage.classList.toggle('shot', state !== 'off');
    box.hidden = state === 'off';
    $('#photo-img').hidden = state !== 'done';
    $('#photo-stop').hidden = state !== 'run';
    $('#photo-dl').hidden = state !== 'done';
    $('#photo-prog').style.width = (state === 'done' ? 100 : Math.round(pct * 100)) + '%';
    $('#photo-prog').parentElement.hidden = state === 'done' || state === 'fail';
    if (state === 'prep') msg.textContent = 'Preparando a foto realista. Pode levar alguns segundos.';
    if (state === 'run') msg.textContent = `Calculando a luz: ${Math.round(pct * 100)}%`;
    if (state === 'done') msg.textContent = 'Foto pronta. A luz do céu, as sombras e os reflexos foram calculados de verdade.';
    if (state === 'fail') msg.textContent = 'Este aparelho não conseguiu gerar a foto. O 3D continua funcionando normalmente.';
    showNav();
  }
  async function startPhoto() {
    if (!REAL || !house || PH.on || planVisible || contextLost) return;
    if (tween) { advanceTween(tween.s + tween.dur); controls.update(); }
    PH.on = true; PH.ready = false; PH.done = false; PH.stop = false; PH.pct = -1;
    const token = ++PH.token;
    controls.enabled = false;
    labelsEl.style.visibility = 'hidden';
    photoUI('prep');
    await nextFrame(); await nextFrame();
    if (!PH.on || PH.token !== token) return;
    try {
      if (!PH.pt) {
        const pt = new WebGLPathTracer(renderer);
        pt.tiles.set(COARSE ? 3 : 2, COARSE ? 3 : 2);
        pt.bounces = COARSE ? 4 : 6;
        pt.transmissiveBounces = 3;
        pt.filterGlossyFactor = 0.6;
        pt.minSamples = 1; pt.renderDelay = 0; pt.fadeDuration = 0;
        pt.rasterizeScene = false; pt.dynamicLowRes = false;
        pt.textureSize.set(COARSE ? 512 : 1024, COARSE ? 512 : 1024);
        PH.pt = pt;
        PH.skyPT = skyEquirect(true);
        PH.dq = new FullScreenQuad(new DenoiseMaterial({ blending: THREE.NoBlending, premultipliedAlpha: renderer.getContextAttributes().premultipliedAlpha }));
      }
      const inside = focusIdx >= 0;
      PH.saved = { env: scene.environment, envI: scene.environmentIntensity, bg: scene.background, exp: renderer.toneMappingExposure, fog: scene.fog, sky: sky.visible };
      sky.visible = false; sun.visible = false; roomLight.visible = false; scene.fog = null;
      if (NIGHT && !PH.nightPT) PH.nightPT = skyEquirect(false, true);
      const photoSky = NIGHT ? PH.nightPT : PH.skyPT;
      scene.environment = photoSky; scene.background = photoSky; scene.environmentIntensity = 1; scene.backgroundIntensity = 1;
      renderer.toneMappingExposure = NIGHT ? (inside ? 1.85 : 1.55) : (inside ? 1.55 : 1.0);
      if (inside) {
        const r = house.plan.rooms[focusIdx];
        PH.area = new THREE.RectAreaLight(NIGHT ? 0xffc489 : 0xfff6ec, NIGHT ? 48 : 30, Math.min(1.0, r.w * 0.32), Math.min(1.0, r.d * 0.32));
        PH.area.position.set(r.cx, WALL_H + 0.02, r.cz); PH.area.lookAt(r.cx, 0, r.cz);
        scene.add(PH.area);
      } else if (!facade) cutGeometry(true);
      splitMulti(true);
      const db = new THREE.Vector2(); renderer.getDrawingBufferSize(db);
      PH.pt.renderScale = Math.min(1, (COARSE ? 760 : 1600) / db.x);
      PH.target = PH.override || (COARSE ? 96 : 320);
      PH.pt.setScene(scene, camera);
      PH.ready = true;
      photoUI('run', 0);
      requestDraw();
    } catch (err) {
      console.error(err);
      endPhoto();
      PH.on = true; photoUI('fail');
    }
  }
  function photoFrame() {
    if (!PH.ready || PH.done) return;
    PH.pt.renderSample();
    const f = clamp(PH.pt.samples / PH.target);
    const pct = Math.floor(f * 20) / 20;
    if (pct !== PH.pct) { PH.pct = pct; photoUI('run', pct); }
    if (f >= 1 || (PH.stop && PH.pt.samples >= 2)) finishPhoto();
  }
  function finishPhoto() {
    /* um último passe tira o granulado que sobra, sem borrar as bordas */
    const m = PH.dq.material, spp = PH.pt.samples;
    m.uniforms.map.value = PH.pt.target.texture;
    m.uniforms.sigma.value = spp > 200 ? 1.6 : spp > 60 ? 2.6 : 4.0;
    m.uniforms.kSigma.value = 1.4;
    m.uniforms.threshold.value = spp > 200 ? 0.05 : spp > 60 ? 0.1 : 0.28;
    if (PH.dn) { m.uniforms.sigma.value = PH.dn[0]; m.uniforms.threshold.value = PH.dn[1]; }
    renderer.setRenderTarget(null);
    PH.dq.render(renderer);
    const c2 = document.createElement('canvas'); c2.width = cv.width; c2.height = cv.height;
    const g = c2.getContext('2d');
    g.drawImage(cv, 0, 0);
    const fs = Math.max(11, Math.round(c2.width / 70)), label = 'Konan Tech, exemplo ilustrativo';
    g.font = `600 ${fs}px Archivo, system-ui, sans-serif`;
    const tw = g.measureText(label).width, pad = fs * 0.6;
    g.fillStyle = 'rgba(255,255,255,0.82)';
    g.fillRect(pad, c2.height - fs * 2.2 - pad, tw + pad * 2, fs * 2.2);
    g.fillStyle = '#1f2b38'; g.fillText(label, pad * 2, c2.height - pad - fs * 0.72);
    PH.url = c2.toDataURL('image/jpeg', 0.92);
    $('#photo-img').src = PH.url;
    $('#photo-dl').href = PH.url;
    PH.done = true;
    photoUI('done');
  }
  function endPhoto() {
    if (!PH.on) return;
    if (PH.saved) {
      scene.environment = PH.saved.env; scene.environmentIntensity = PH.saved.envI; scene.background = PH.saved.bg;
      renderer.toneMappingExposure = PH.saved.exp; scene.fog = PH.saved.fog; sky.visible = PH.saved.sky;
    }
    sun.visible = true; roomLight.visible = true;
    if (PH.area) { scene.remove(PH.area); PH.area.dispose(); PH.area = null; }
    if (house && PH.split) splitMulti(false);
    if (house) cutGeometry(false);
    PH.on = false; PH.ready = false; PH.done = false; PH.stop = false; PH.saved = null;
    controls.enabled = true;
    labelsEl.style.visibility = '';
    $('#photo-img').removeAttribute('src');
    photoUI('off');
    requestDraw();
  }
  function showNav() {
    const inRoom = REAL && house && focusIdx >= 0 && !PH.on && !planVisible;
    $('#roomnav').hidden = !inRoom;
    if (inRoom) $('#rn-name').textContent = house.plan.rooms[focusIdx].name;
    $('#tip').hidden = !(REAL && house && focusIdx === -1 && !PH.on && !tween && !facade && !planVisible);
  }
  function stepRoom(d) { if (!house) return; const n = house.plan.rooms.length; enterRoom((focusIdx + d + n) % n); }

  /* ---------- 13. painel, link e texto ---------- */
  function renderList() {
    if (!activePlan) return;
    $('#rooms-hint').textContent = planVisible ? 'Escolha um ambiente para destacar na planta.' : REAL ? 'Toque em um ambiente para entrar nele.' : 'Toque em um ambiente para ver de perto.';
    renderRooms(activePlan, planVisible ? planSelection : focusIdx, (index) => {
      if (planVisible) { planSelection = index; updatePlan(); }
      else focusRoom(index);
      const bounds = stage.getBoundingClientRect();
      if (bounds.top < 0 || bounds.bottom > innerHeight) stage.scrollIntoView({ behavior: REDUCED ? 'auto' : 'smooth', block: 'start' });
    });
  }

  function updatePlan() {
    if (planVisible && activePlan) renderPlan($('#plan-svg'), activePlan, planSelection);
    renderList();
  }
  function setPlanVisible(visible) {
    if (!visible && contextLost) return;
    if (PH.on) endPhoto();
    planVisible = visible;
    controls.enabled = !visible;
    showPlanInterface(visible, !contextLost, REAL);
    if (!visible && rebuildPending) buildHouse(currentObra);
    else updatePlan();
    if (!visible) $('#graphics-status').textContent = '';
    showNav();
    requestDraw();
  }

  $('#modo').addEventListener('click', () => setMode(!REAL));
  $('#lighting').addEventListener('click', toggleNight);
  $('#facade').addEventListener('click', () => { setFacade(!facade); overview(true); });
  $('#replay').addEventListener('click', () => {
    if (REAL) { setMode(false); return; }
    if (!house) return;
    T = 0; userTouched = false; tween = null; focusIdx = -1; house.cue = false;
    controls.target.set(0, 0, 0); restoreOrbit(); placeCamera(0.05, house.R * 3.5 * fitK(), 0.55); renderList();
    if (REDUCED) { T = house.done; userTouched = true; applyTime(T); }
    requestDraw();
  });
  $('#whole').addEventListener('click', () => overview());
  $('#foto').addEventListener('click', () => startPhoto());
  $('#photo-stop').addEventListener('click', () => { PH.stop = true; });
  $('#photo-close').addEventListener('click', () => endPhoto());
  $('#rn-prev').addEventListener('click', () => stepRoom(-1));
  $('#rn-next').addEventListener('click', () => stepRoom(1));
  cv.addEventListener('pointerdown', () => { if (PH.on) endPhoto(); });
  cv.addEventListener('webglcontextlost', (event) => {
    event.preventDefault();
    contextLost = true;
    if (PH.on) endPhoto();
    PH.pt?.dispose();
    PH.skyPT?.dispose();
    PH.nightPT?.dispose();
    PH.dq?.material.dispose();
    PH.dq?.dispose();
    PH.pt = PH.skyPT = PH.nightPT = PH.dq = null;
    $('#graphics-status').textContent = 'O 3D foi interrompido. A planta 2D continua funcionando.';
    setPlanVisible(true);
    if (stage.contains(document.activeElement)) $('#build').focus();
  });
  cv.addEventListener('webglcontextrestored', () => {
    contextLost = false;
    sun.shadow.needsUpdate = true;
    composer?.reset();
    if (envTex) { envTex.dispose(); envSky.dispose(); envTex = envSky = null; }
    const wasReal = REAL;
    setMode(wasReal);
    $('#graphics-status').textContent = 'O 3D está disponível novamente.';
  });
  $('#top').addEventListener('click', () => setPlanVisible(!planVisible));
  controls.addEventListener('change', requestDraw);
  controls.addEventListener('start', () => {
    userTouched = true;
    if (tween && tween.end) advanceTween(tween.s + tween.dur);
    tween = null;
    requestDraw();
  });

  /* ---------- 14. laço de desenho ---------- */
  function resize() {
    const w = Math.max(1, stage.clientWidth), h = Math.max(1, stage.clientHeight);
    renderer.setSize(w, h, false);
    camera.aspect = w / h;
    camera.updateProjectionMatrix();
    if (composer) { composer.setPixelRatio(PR); composer.setSize(w, h); }
    requestDraw();
  }
  let frameId = null, previousFrame = null;
  const v3 = new THREE.Vector3();
  function requestDraw() {
    if (frameId === null && !planVisible && !contextLost) frameId = requestAnimationFrame(frame);
  }
  function advanceTween(now) {
    if (!tween) return;
    const u = easeInOut(clamp((now - tween.s) / tween.dur));
    controls.target.lerpVectors(tween.t0, tween.t1, u);
    camera.position.lerpVectors(tween.p0, tween.p1, u);
    const fov = lerp(tween.f0, tween.f1, u);
    if (fov !== camera.fov) { camera.fov = fov; camera.updateProjectionMatrix(); }
    if (tween.c1 != null) setCut(lerp(tween.c0, tween.c1, u));
    if (u >= 1) {
      const end = tween.end;
      tween = null;
      end?.();
      showNav();
    }
  }
  function frame(now) {
    frameId = null;
    if (planVisible || contextLost) { previousFrame = null; return; }
    const raw = previousFrame === null ? 0 : (now - previousFrame) / 1000;
    const dt = Math.min(raw, 0.08);
    previousFrame = now;
    if (house) {
      if (T < house.done) {
        T = Math.min(T + dt, house.done);
        applyTime(T);
        if (!house.cue && T === house.done) { house.cue = true; if (!REAL && !REDUCED) $('#modo').classList.add('cue'); }
      }
      if (!userTouched && !tween) {
        const u = easeInOut(clamp((T - 1.0) / 1.7));
        controls.target.set(0, 0, 0);
        placeCamera(lerp(0.05, 0.9, u), house.R * lerp(3.5, 3.1, u) * fitK(), 0.55);
        if (T > 2.8) userTouched = true;
      }
      advanceTween(now);
      controls.update();
      const w = stage.clientWidth, h = stage.clientHeight;
      house.labels.forEach((l) => {
        v3.set(l.r.cx, REAL ? CUT_H + 0.55 : WALL_H + 0.3, l.r.cz).project(camera);
        const vis = (!REAL || (focusIdx === -1 && !tween && !PH.on && !facade)) && v3.z < 1 && Math.abs(v3.x) < 1.1 && Math.abs(v3.y) < 1.1;
        l.el.style.opacity = vis ? String((REAL ? 1 : l.op || 0) * (focusIdx === -1 || focusIdx === l.r.idx ? 1 : 0.55)) : '0';
        const interactive = vis && (REAL || (l.op || 0) > 0.5);
        l.el.style.pointerEvents = interactive ? 'auto' : 'none';
        l.el.tabIndex = interactive ? 0 : -1;
        l.el.style.transform = `translate(${(v3.x * 0.5 + 0.5) * w}px, ${(-v3.y * 0.5 + 0.5) * h}px) translate(-50%, -50%)`;
      });
    }
    /* se o aparelho não aguentar, a sombra de contato sai primeiro */
    if (REAL && !perf.done && raw > 0 && raw < 1) {
      perf.n++; perf.sum += raw;
      if (perf.n >= 22) {
        const avg = perf.sum / perf.n; perf.done = true;
        if (avg > 0.045) aoOn = false;
        if (avg > 0.07 && PR > 1) { PR = 1; renderer.setPixelRatio(1); resize(); }
      }
    }
    if (PH.on) {
      try { photoFrame(); }
      catch (error) { console.error(error); endPhoto(); PH.on = true; photoUI('fail'); }
    } else if (REAL && aoOn) composer.render();
    else renderer.render(scene, camera);
    if (tween || (house && T < house.done) || (PH.ready && !PH.done)) requestDraw();
    if (frameId === null) previousFrame = null;
  }

  /* ---------- 15. começo ---------- */
  new ResizeObserver(resize).observe(stage);
  resize();
  const fromText = bindDescription((obra) => {
    currentObra = obra;
    if (!planVisible) { buildHouse(obra); return; }
    activePlan = planHouse(obra);
    planSelection = -1;
    rebuildPending = true;
    updatePlan();
  });
  window.__casa = {
    get photo() { return { on: PH.on, done: PH.done, samples: PH.pt?.samples || 0, target: PH.target }; },
    startPhoto, endPhoto, stepRoom,
    setPhotoTarget: (n) => { PH.override = n; },
    setDenoise: (a, b) => { PH.dn = [a, b]; },
    tone: (t, e) => { renderer.toneMapping = t; renderer.toneMappingExposure = e; requestDraw(); },
    get house() { return house; }, get T() { return T; }, get real() { return REAL; }, get ao() { return aoOn; },
    camera, controls, focusRoom, overview, fromText, setMode,
    setT: (t) => { T = t; applyTime(t); userTouched = true; requestDraw(); },
  };
}

let renderer;
try { renderer = createRenderer($('#cv')); } catch { /* WebGL indisponível */ }
if (renderer) mount3D(renderer);
else mountPlanOnly();
