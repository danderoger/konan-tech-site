/* Konan Tech 5.0: a planta viva.
   Desenha a operação do visitante como uma planta de arquitetura, em SVG:
   cada área da empresa é um cômodo, o que trava hoje ganha nuvem de revisão em vermelho,
   a proposta entra em azul (módulos com hachura) e os dados correm pelos fluxos em ciano.
   Com um toque, as paredes sobem em 3D (CSS 3D, sem WebGL) e dá para girar arrastando.
   API:
     const plan = new Plan(folha, { reduced, onDetail })
     plan.set({ ramo, dores, equipe, nome, example })   redesenha só o que mudou
     plan.set3D(true | false, { orbit })                 levanta ou abaixa a maquete
     plan.snapshot('land' | 'port', estado)              cópia estática (usada no final e no PDF)
     plan.relayout()                                      depois de mudar o tamanho da tela */

import { RAMOS, DOR, DORES, MODULOS, MOD_ORDER, DET_N, EQUIPES_CURTO } from './content.js';

const NS = 'http://www.w3.org/2000/svg';
const ROOM_KEYS = ['fin', 'mgmt', 'in', 'ops', 'sup'];
const EASE = 'cubic-bezier(.22,.75,.12,1)';
const EQ_FRASE = ['Equipe de até 5 pessoas', 'Equipe de 6 a 20 pessoas', 'Equipe de 21 a 50 pessoas', 'Equipe de mais de 50 pessoas'];

function S(tag, attrs, parent) {
  const e = document.createElementNS(NS, tag);
  if (attrs) for (const k in attrs) if (attrs[k] !== undefined && attrs[k] !== null) e.setAttribute(k, attrs[k]);
  if (parent) parent.appendChild(e);
  return e;
}
const f1 = (v) => Math.round(v * 10) / 10;
/* minúscula só na primeira letra: "Leitura de notas com IA" vira "leitura de notas com IA" */
export const lc1 = (t) => t.charAt(0).toLowerCase() + t.slice(1);

/* ---------- geometria das duas folhas: paisagem (computador) e retrato (celular) ---------- */
const GEO = {
  land: {
    vb: [1000, 620],
    outer: [12, 12, 988, 608], inner: [20, 20, 980, 600],
    bld: [86, 82, 620, 456],
    rooms: { fin: [86, 82, 353, 236], mgmt: [353, 82, 620, 236], in: [86, 274, 264, 456], ops: [264, 274, 442, 456], sup: [442, 274, 620, 456] },
    cor: [86, 236, 620, 274],
    walk: [40, 456, 660, 492], road: [40, 492, 660, 540],
    ext: [690, 82, 960, 318],
    extPath: [[690, 200], [655, 200], [655, 255], [620, 255]], extSide: 'L',
    cdoor: { fin: 300, mgmt: 560, in: 220, ops: 400, sup: 578 },
    entrance: [175, 456],
    sign: [196, 464, 340, 486], streetCloud: [104, 461, 352, 489], streetNote: [374, 481],
    bubX: [86, 264, 442, 620], bubY: 44, bubR: 12, bubRows: [82, 255, 456], bubRowX: 50,
    dim: [86, 620, 68],
    north: [935, 46, 13],
    scale: [86, 568, 160], note: [272, 586],
    car: [690, 344, 968, 588], carMode: 'tall',
    walls: {
      E: [
        [86, 82, 620, 82, [[219, 64, 'w'], [486, 64, 'w']]],
        [620, 82, 620, 456, [[159, 50, 'w'], [255, 30, 'd', -1, 'a'], [365, 50, 'w']]],
        [86, 456, 620, 456, [[175, 40, 'd', -1, 'a'], [353, 64, 'w'], [531, 64, 'w']]],
        [86, 82, 86, 456, [[159, 50, 'w'], [365, 50, 'w']]]
      ],
      I: [
        [86, 236, 620, 236, [[300, 34, 'd', -1, 'a'], [560, 34, 'd', -1, 'b']]],
        [86, 274, 620, 274, [[220, 34, 'd', 1, 'a'], [400, 34, 'd', 1, 'a'], [578, 34, 'd', 1, 'b']]],
        [353, 82, 353, 236, []],
        [264, 274, 264, 456, []],
        [442, 274, 442, 456, []]
      ]
    },
    t: { E: 8, I: 4.5 }, H: 62, cloudStep: 21,
    fs: { room: 19, note: 15, mod: 15, small: 12.5, bub: 13, lab: 11, val: 14.5, carT: 21, dot: 3.6 },
    pad: 14
  },
  port: {
    vb: [400, 580],
    outer: [6, 6, 394, 574], inner: [12, 12, 388, 568],
    bld: [28, 42, 372, 324],
    rooms: { fin: [28, 42, 200, 150], mgmt: [200, 42, 372, 150], in: [28, 174, 143, 324], ops: [143, 174, 258, 324], sup: [258, 174, 372, 324] },
    cor: [28, 150, 372, 174],
    walk: [12, 324, 388, 348], road: [12, 348, 388, 374],
    ext: [158, 388, 372, 474],
    extPath: [[372, 431], [381, 431], [381, 162], [372, 162]], extSide: 'R',
    cdoor: { fin: 160, mgmt: 330, in: 110, ops: 222, sup: 336 },
    entrance: [85, 324],
    sign: [100, 329, 214, 344], streetCloud: [38, 327, 222, 346], streetNote: [240, 340],
    bubX: [28, 143, 258, 372], bubY: 25, bubR: 8, bubRows: null,
    dim: null,
    north: [46, 406, 11],
    scale: [28, 456, 100], note: null,
    car: [12, 486, 388, 568], carMode: 'wide',
    walls: {
      E: [
        [28, 42, 372, 42, [[114, 56, 'w'], [286, 56, 'w']]],
        [372, 42, 372, 324, [[96, 40, 'w'], [162, 22, 'd', -1, 'a'], [249, 46, 'w']]],
        [28, 324, 372, 324, [[85, 30, 'd', -1, 'a'], [200, 50, 'w'], [315, 50, 'w']]],
        [28, 42, 28, 324, [[96, 40, 'w'], [249, 46, 'w']]]
      ],
      I: [
        [28, 150, 372, 150, [[160, 26, 'd', -1, 'a'], [330, 26, 'd', -1, 'b']]],
        [28, 174, 372, 174, [[110, 26, 'd', 1, 'a'], [222, 26, 'd', 1, 'a'], [336, 26, 'd', 1, 'b']]],
        [200, 42, 200, 150, []],
        [143, 174, 143, 324, []],
        [258, 174, 258, 324, []]
      ]
    },
    t: { E: 6, I: 3.5 }, H: 44, cloudStep: 14,
    fs: { room: 15, note: 12.5, mod: 12.5, small: 10.5, bub: 10, lab: 9.5, val: 12, carT: 15, dot: 2.8 },
    pad: 9
  }
};

/* ---------- utilidades de desenho ---------- */
function cloudPath(x0, y0, x1, y1, step) {
  let d = `M${f1(x0)},${f1(y0)}`;
  const edge = (ax, ay, bx, by) => {
    const len = Math.hypot(bx - ax, by - ay);
    const n = Math.max(2, Math.round(len / step));
    const r = f1((len / n) * 0.64);
    for (let i = 1; i <= n; i++) d += ` A${r},${r} 0 0 1 ${f1(ax + ((bx - ax) * i) / n)},${f1(ay + ((by - ay) * i) / n)}`;
  };
  edge(x0, y0, x1, y0); edge(x1, y0, x1, y1); edge(x1, y1, x0, y1); edge(x0, y1, x0, y0);
  return d;
}

/* paredes: trechos cheios entre portas e janelas, mais os símbolos de cada abertura */
function wallParts(geo) {
  const solids = [], doors = [], wins = [];
  ['E', 'I'].forEach((kind) => geo.walls[kind].forEach(([x1, y1, x2, y2, ops]) => {
    const t = geo.t[kind];
    const horiz = y1 === y2;
    const a0 = horiz ? Math.min(x1, x2) : Math.min(y1, y2), a1 = horiz ? Math.max(x1, x2) : Math.max(y1, y2);
    const fixed = horiz ? y1 : x1;
    const gaps = ops.map(([c, w, k, sw, hinge]) => ({ a: c - w / 2, b: c + w / 2, c, w, k, sw, hinge })).sort((p, q) => p.a - q.a);
    let s = a0, first = true;
    const push = (from, to, extA, extB) => {
      if (to - from < 0.5) return;
      const lo = from - (extA ? t / 2 : 0), hi = to + (extB ? t / 2 : 0);
      solids.push(horiz ? { x: lo, y: fixed - t / 2, w: hi - lo, h: t, kind, horiz, a: lo, b: hi, fixed, t } : { x: fixed - t / 2, y: lo, w: t, h: hi - lo, kind, horiz, a: lo, b: hi, fixed, t });
    };
    gaps.forEach((g) => { push(s, g.a, first, false); first = false; s = g.b; if (g.k === 'd') doors.push({ ...g, horiz, fixed, t }); else wins.push({ ...g, horiz, fixed, t }); });
    push(s, a1, first, true);
  }));
  return { solids, doors, wins };
}

function doorSymbol(d) {
  const hingeA = d.hinge !== 'b';
  const h = hingeA ? d.a : d.b, o = hingeA ? d.b : d.a;
  if (d.horiz) {
    const Y = d.fixed, ly = Y + d.sw * d.w;
    const a1 = Math.atan2(ly - Y, 0), a2 = Math.atan2(0, o - h);
    let dl = a2 - a1; while (dl > Math.PI) dl -= 2 * Math.PI; while (dl <= -Math.PI) dl += 2 * Math.PI;
    return { leaf: `M${f1(h)},${f1(Y)} L${f1(h)},${f1(ly)}`, arc: `M${f1(h)},${f1(ly)} A${d.w},${d.w} 0 0 ${dl > 0 ? 1 : 0} ${f1(o)},${f1(Y)}` };
  }
  const X = d.fixed, lx = X + d.sw * d.w;
  const a1 = Math.atan2(0, lx - X), a2 = Math.atan2(o - h, 0);
  let dl = a2 - a1; while (dl > Math.PI) dl -= 2 * Math.PI; while (dl <= -Math.PI) dl += 2 * Math.PI;
  return { leaf: `M${f1(X)},${f1(h)} L${f1(lx)},${f1(h)}`, arc: `M${f1(lx)},${f1(h)} A${d.w},${d.w} 0 0 ${dl > 0 ? 1 : 0} ${f1(X)},${f1(o)}` };
}

/* estado derivado: áreas marcadas, notas e módulos na ordem certa */
export function derive(st) {
  const dores = DORES.filter((d) => st.dores && st.dores.includes(d.k));
  const marks = {};
  dores.forEach((d) => d.rooms.forEach((r) => { (marks[r] = marks[r] || []).push(d); }));
  const modSet = new Set();
  dores.forEach((d) => d.mods.forEach((m) => modSet.add(m)));
  const mods = MOD_ORDER.filter((m) => modSet.has(m));
  const any = !!(st.ramo || dores.length || st.equipe !== null && st.equipe !== undefined);
  return { dores, marks, mods, any, ramo: st.ramo || (any ? 'outro' : null) };
}

const today = () => { const d = new Date(); return `${String(d.getDate()).padStart(2, '0')}/${String(d.getMonth() + 1).padStart(2, '0')}/${d.getFullYear()}`; };

/* ---------- o pintor: escreve a planta dentro de um <svg> ---------- */
class Painter {
  constructor(svg, orient, o = {}) {
    this.svg = svg;
    this.orient = orient;
    this.geo = GEO[orient];
    this.anim = !!o.animate;
    this.sfx = o.suffix || '';
    this.logo = o.logo || 'assets/konan-logo-dark.png';
    this.dots = o.dots !== false;
    this.links = o.links !== false;
    this.items = new Map();
    this.bldOn = false;
    this.revAt = {};
    const [w, h] = this.geo.vb;
    svg.setAttribute('viewBox', `0 0 ${w} ${h}`);
    svg.classList.add('plan', 'pl-' + orient);
    svg.innerHTML = '';
    this.parts = wallParts(this.geo);
    this._defs();
    const L = (c) => S('g', { class: c }, svg);
    this.gFrame = L('l-frame');
    this.gEmpty = L('l-empty');
    this.gStreet = L('l-street');
    this.gBld = L('l-bld');
    this.gExt = L('l-ext');
    this.gFlows = L('l-flows');
    this.gBase = L('l-base');
    this.gMods = L('l-mods');
    this.gMarks = L('l-marks');
    this.gCar = L('l-car');
    this.gStamp = L('l-stamp');
    this._frame();
    this._empty();
    this._carimbo();
    this._building();
  }

  a(el, kf, o) { if (!this.anim || !el.animate) return null; return el.animate(kf, Object.assign({ easing: EASE, fill: 'backwards' }, o)); }
  draw(el, dur, delay) {
    if (!this.anim) return;
    el.setAttribute('pathLength', '1');
    el.style.strokeDasharray = '1';
    const an = el.animate([{ strokeDashoffset: 1 }, { strokeDashoffset: 0 }], { duration: dur, delay: delay || 0, easing: 'cubic-bezier(.45,.05,.25,1)', fill: 'backwards' });
    an.onfinish = () => { el.style.strokeDasharray = ''; el.removeAttribute('pathLength'); };
  }
  fadeIn(el, delay, dur) { this.a(el, [{ opacity: 0 }, { opacity: 1 }], { duration: dur || 420, delay: delay || 0 }); }

  _defs() {
    const d = S('defs', null, this.svg);
    const p = S('pattern', { id: 'hatch' + this.sfx, patternUnits: 'userSpaceOnUse', width: 7, height: 7, patternTransform: 'rotate(45)' }, d);
    S('rect', { width: 7, height: 7, fill: '#f1f6fe' }, p);
    S('line', { x1: 0, y1: 0, x2: 0, y2: 7, stroke: '#1b5fd9', 'stroke-width': 1.1, 'stroke-opacity': 0.32 }, p);
    const q = S('pattern', { id: 'poche' + this.sfx, patternUnits: 'userSpaceOnUse', width: 5, height: 5, patternTransform: 'rotate(45)' }, d);
    S('rect', { width: 5, height: 5, fill: '#fff' }, q);
    S('line', { x1: 0, y1: 0, x2: 0, y2: 5, stroke: '#1f2b38', 'stroke-width': 0.9, 'stroke-opacity': 0.5 }, q);
  }

  _frame() {
    const g = this.geo, F = this.gFrame;
    const [ox0, oy0, ox1, oy1] = g.outer, [ix0, iy0, ix1, iy1] = g.inner;
    S('rect', { x: ox0, y: oy0, width: ox1 - ox0, height: oy1 - oy0, class: 'fr-o' }, F);
    S('rect', { x: ix0, y: iy0, width: ix1 - ix0, height: iy1 - iy0, class: 'fr-i' }, F);
    const [bx0, by0, bx1, by1] = g.bld;
    g.bubX.forEach((x, i) => {
      S('line', { x1: x, y1: g.bubY + g.bubR, x2: x, y2: by0 - 6, class: 'axis' }, F);
      S('circle', { cx: x, cy: g.bubY, r: g.bubR, class: 'bub' }, F);
      const t = S('text', { x, y: g.bubY + g.fs.bub * 0.36, class: 'bub-t', 'font-size': g.fs.bub, 'text-anchor': 'middle' }, F);
      t.textContent = 'ABCD'[i];
    });
    if (g.bubRows) g.bubRows.forEach((y, i) => {
      S('line', { x1: g.bubRowX + g.bubR, y1: y, x2: bx0 - 6, y2: y, class: 'axis' }, F);
      S('circle', { cx: g.bubRowX, cy: y, r: g.bubR, class: 'bub' }, F);
      const t = S('text', { x: g.bubRowX, y: y + g.fs.bub * 0.36, class: 'bub-t', 'font-size': g.fs.bub, 'text-anchor': 'middle' }, F);
      t.textContent = String(i + 1);
    });
    if (g.dim) {
      const [x0, x1, y] = g.dim;
      S('path', { d: `M${x0},${y} H${x1} M${x0},${y - 7} V${y + 7} M${x1},${y - 7} V${y + 7} M${x0 - 5},${y + 5} L${x0 + 5},${y - 5} M${x1 - 5},${y + 5} L${x1 + 5},${y - 5}`, class: 'dim' }, F);
      this.dimT = S('text', { x: (x0 + x1) / 2, y: y - 6, class: 'dim-t', 'font-size': g.fs.small + 0.5, 'text-anchor': 'middle' }, F);
      this.dimT.textContent = 'Equipe: a definir';
    }
    const [nx, ny, nr] = g.north;
    S('circle', { cx: nx, cy: ny, r: nr, class: 'bub' }, F);
    S('path', { d: `M${nx},${ny - nr + 3} L${nx + nr * 0.42},${ny + nr * 0.5} L${nx},${ny + nr * 0.22} L${nx - nr * 0.42},${ny + nr * 0.5} Z`, class: 'north' }, F);
    const nt = S('text', { x: nx, y: ny - nr - 4, class: 'bub-t', 'font-size': g.fs.small, 'text-anchor': 'middle' }, F);
    nt.textContent = 'N';
    const [sx, sy, sl] = g.scale;
    for (let i = 0; i < 4; i++) S('rect', { x: sx + (sl / 4) * i, y: sy - 4, width: sl / 4, height: 6, class: i % 2 ? 'sc-w' : 'sc-b' }, F);
    const st = S('text', { x: sx + sl + 8, y: sy + 2, class: 'small', 'font-size': g.fs.small }, F);
    st.textContent = 'Sem escala';
    if (g.note) {
      const nt2 = S('text', { x: g.note[0], y: g.note[1], class: 'small', 'font-size': g.fs.small - 0.5 }, F);
      nt2.textContent = 'Planta ilustrativa, desenhada a partir do que você contou.';
    }
  }

  _empty() {
    const g = this.geo, E = this.gEmpty;
    const [x0, y0, x1, y1] = g.bld;
    S('rect', { x: x0, y: y0, width: x1 - x0, height: y1 - y0, class: 'empty-r' }, E);
    const lines = this.orient === 'land' ? ['A planta aparece aqui', 'enquanto você conta.'] : ['A planta aparece', 'aqui enquanto', 'você conta.'];
    lines.forEach((l, i) => {
      const t = S('text', { x: (x0 + x1) / 2, y: (y0 + y1) / 2 - ((lines.length - 1) * g.fs.room * 1.2) / 2 + i * g.fs.room * 1.2 + g.fs.room * 0.35, class: 'empty-t', 'font-size': g.fs.room + 2, 'text-anchor': 'middle' }, E);
      t.textContent = l;
    });
  }

  _carimbo() {
    const g = this.geo, C = this.gCar, fs = g.fs;
    const [x0, y0, x1, y1] = g.car;
    S('rect', { x: x0, y: y0, width: x1 - x0, height: y1 - y0, class: 'car' }, C);
    const ln = (ax, ay, bx, by) => S('line', { x1: ax, y1: ay, x2: bx, y2: by, class: 'car-l' }, C);
    const cell = (x, y, label) => {
      const l = S('text', { x: x + 8, y: y + fs.lab + 3, class: 'car-lab', 'font-size': fs.lab }, C);
      l.textContent = label;
      return S('text', { x: x + 8, y: y + fs.lab + fs.val + 6, class: 'car-val', 'font-size': fs.val }, C);
    };
    this.car = {};
    if (g.carMode === 'tall') {
      const W = x1 - x0, mid = x0 + W / 2;
      const rows = [y0 + 66, y0 + 100, y0 + 134, y0 + 168, y0 + 202];
      rows.forEach((y) => ln(x0, y, x1, y));
      ln(mid, rows[2], mid, rows[4]);
      const tt = S('text', { x: x0 + 12, y: y0 + 30, class: 'car-title', 'font-size': fs.carT }, C);
      tt.textContent = 'Planta do sistema';
      this.car.nome = S('text', { x: x0 + 12, y: y0 + 52, class: 'car-name', 'font-size': fs.val }, C);
      this.car.ramo = cell(x0, rows[0], 'Ramo');
      this.car.eq = cell(x0, rows[1], 'Equipe');
      this.car.atr = cell(x0, rows[2], 'Atritos marcados');
      this.car.prop = cell(mid, rows[2], 'Proposta');
      this.car.data = cell(x0, rows[3], 'Data');
      this.car.rev = cell(mid, rows[3], 'Revisão');
      const dl = S('text', { x: x0 + 8, y: rows[4] + fs.lab + 3, class: 'car-lab', 'font-size': fs.lab }, C);
      dl.textContent = 'Desenho';
      S('image', { href: this.logo, x: x0 + 10, y: rows[4] + 19, width: 132, height: 21, preserveAspectRatio: 'xMinYMid meet' }, C);
    } else {
      const r1 = y0 + 36;
      ln(x0, r1, x1, r1);
      const tt = S('text', { x: x0 + 8, y: y0 + 16, class: 'car-title', 'font-size': fs.carT }, C);
      tt.textContent = 'Planta do sistema';
      this.car.nome = S('text', { x: x0 + 8, y: y0 + 30, class: 'car-name', 'font-size': fs.lab + 1 }, C);
      S('image', { href: this.logo, x: x1 - 104, y: y0 + 9, width: 96, height: 16, preserveAspectRatio: 'xMaxYMid meet' }, C);
      const cols = [x0, x0 + 128, x0 + 204, x0 + 262, x0 + 318];
      cols.slice(1).forEach((x) => ln(x, r1, x, y1));
      this.car.ramo = cell(cols[0], r1, 'Ramo');
      this.car.eq = cell(cols[1], r1, 'Equipe');
      this.car.atr = cell(cols[2], r1, 'Atritos');
      this.car.prop = cell(cols[3], r1, 'Proposta');
      this.car.rev = cell(cols[4], r1, 'Revisão');
      this.car.data = null;
    }
    if (this.car.data) this.car.data.textContent = today();
    this.car.nome.textContent = 'Sua empresa';
    this.car.ramo.textContent = 'A definir';
    this.car.eq.textContent = 'A definir';
    this.car.atr.textContent = '0';
    this.car.prop.textContent = '0';
    this.car.rev.textContent = 'Rev. 0';
    /* carimbo de exemplo: na sobra da linha "Desenho" (paisagem) ou entre o título e a logo (retrato) */
    const [sx, sy] = g.carMode === 'tall' ? [x1 - 58, y0 + 222] : [x0 + 206, y0 + 18];
    const sg = S('g', { class: 'stamp', transform: `rotate(-7 ${sx} ${sy})` }, this.gStamp);
    const sw = g.carMode === 'tall' ? 104 : 96, sh = g.carMode === 'tall' ? 24 : 20;
    S('rect', { x: sx - sw / 2, y: sy - sh / 2, width: sw, height: sh, rx: 3 }, sg);
    const stt = S('text', { x: sx, y: sy + (g.carMode === 'tall' ? 4.4 : 3.8), 'text-anchor': 'middle', 'font-size': g.carMode === 'tall' ? 12.5 : 10.5 }, sg);
    stt.textContent = 'Exemplo fictício';
    this.gStamp.style.display = 'none';
  }

  _building() {
    const g = this.geo, B = this.gBld, fs = g.fs;
    this.solidEls = this.parts.solids.map((s) => S('rect', { x: f1(s.x), y: f1(s.y), width: f1(s.w), height: f1(s.h), class: 'wall w-' + s.kind }, B));
    this.winEls = this.parts.wins.map((w) => {
      const gg = S('g', { class: 'win' }, B);
      if (w.horiz) {
        S('rect', { x: w.a, y: w.fixed - w.t / 2, width: w.w, height: w.t, class: 'win-r' }, gg);
        S('line', { x1: w.a, y1: w.fixed, x2: w.b, y2: w.fixed, class: 'win-l' }, gg);
      } else {
        S('rect', { x: w.fixed - w.t / 2, y: w.a, width: w.t, height: w.w, class: 'win-r' }, gg);
        S('line', { x1: w.fixed, y1: w.a, x2: w.fixed, y2: w.b, class: 'win-l' }, gg);
      }
      return gg;
    });
    this.doorEls = this.parts.doors.map((d) => {
      const sym = doorSymbol(d);
      const gg = S('g', { class: 'door' }, B);
      return { g: gg, leaf: S('path', { d: sym.leaf, class: 'door-leaf' }, gg), arc: S('path', { d: sym.arc, class: 'door-arc' }, gg) };
    });
    /* nomes das áreas */
    this.roomT = {};
    ROOM_KEYS.forEach((k) => {
      const [x0, y0] = g.rooms[k];
      this.roomT[k] = S('text', { x: x0 + g.pad, y: y0 + g.pad + fs.room * 0.82, class: 'room-t', 'font-size': fs.room }, B);
    });
    const [cx0, cy0, cx1, cy1] = g.cor;
    /* o nome do corredor fica na metade de cima; os fluxos de dados correm na metade de baixo */
    this.corT = S('text', { x: (cx0 + cx1) / 2, y: cy0 + (cy1 - cy0) * 0.3 + fs.small * 0.36, class: 'cor-t', 'font-size': fs.small, 'text-anchor': 'middle' }, B);
    this.corT.textContent = 'Circulação';
    /* rua */
    const R = this.gStreet;
    const [wx0, , wx1, wy1] = g.walk, [rx0, , rx1, ry1] = g.road;
    this.streetEls = [
      S('path', { d: `M${wx0},${wy1} H${wx1}`, class: 'curb' }, R),
      S('path', { d: `M${rx0},${ry1} H${rx1}`, class: 'curb' }, R),
      S('path', { d: `M${rx0},${(wy1 + ry1) / 2} H${rx1}`, class: 'lane' }, R)
    ];
    const rt = S('text', { x: rx1 - 4, y: (wy1 + ry1) / 2 - 5, class: 'small', 'font-size': fs.small, 'text-anchor': 'end' }, R);
    rt.textContent = 'Rua';
    this.streetEls.push(rt);
    /* área de fora e caminho até ela */
    const X = this.gExt, [ex0, ey0, ex1, ey1] = g.ext;
    this.extR = S('rect', { x: ex0, y: ey0, width: ex1 - ex0, height: ey1 - ey0, class: 'ext-r' }, X);
    this.extP = S('path', { d: 'M' + g.extPath.map((p) => p.join(',')).join(' L'), class: 'ext-p' }, X);
    this.extT = S('text', { x: ex0 + g.pad, y: ey0 + g.pad + fs.room * 0.82, class: 'room-t', 'font-size': fs.room }, X);
    this.people = S('g', { class: 'people' }, X);
    const pc = this.orient === 'land' ? [[ex1 - 74, ey0 + 98], [ex1 - 50, ey0 + 108], [ex1 - 26, ey0 + 96]] : [[ex1 - 56, ey0 + 32], [ex1 - 38, ey0 + 38], [ex1 - 20, ey0 + 30]];
    const k = this.orient === 'land' ? 1 : 0.75;
    pc.forEach(([x, y]) => {
      S('circle', { cx: x, cy: y, r: 3.4 * k }, this.people);
      S('path', { d: `M${f1(x - 6 * k)},${f1(y + 14 * k)} C${f1(x - 6 * k)},${f1(y + 6 * k)} ${f1(x + 6 * k)},${f1(y + 6 * k)} ${f1(x + 6 * k)},${f1(y + 14 * k)}` }, this.people);
    });
    [this.gBld, this.gStreet, this.gExt].forEach((G) => { G.style.display = 'none'; });
  }

  showBuilding(on) {
    if (on === this.bldOn) return;
    this.bldOn = on;
    const groups = [this.gBld, this.gStreet, this.gExt];
    if (!on) {
      groups.forEach((G) => { if (this.anim && G.animate) { const an = G.animate([{ opacity: 1 }, { opacity: 0 }], { duration: 320, easing: 'ease-out' }); an.onfinish = () => { if (!this.bldOn) G.style.display = 'none'; }; } else G.style.display = 'none'; });
      this.gEmpty.style.display = '';
      this.fadeIn(this.gEmpty, 200);
      return;
    }
    groups.forEach((G) => { G.style.display = ''; });
    this.gEmpty.style.display = 'none';
    if (!this.anim) return;
    /* a planta é traçada: paredes externas, internas, aberturas, nomes */
    this.solidEls.forEach((el, i) => {
      const s = this.parts.solids[i];
      el.style.transformBox = 'fill-box';
      el.style.transformOrigin = s.horiz ? '0 50%' : '50% 0';
      el.animate([{ transform: s.horiz ? 'scaleX(0)' : 'scaleY(0)' }, { transform: 'none' }], { duration: s.kind === 'E' ? 620 : 460, delay: (s.kind === 'E' ? 0 : 520) + i * 34, easing: 'cubic-bezier(.5,0,.2,1)', fill: 'backwards' });
    });
    this.winEls.forEach((el, i) => this.fadeIn(el, 900 + i * 40, 360));
    this.doorEls.forEach((d, i) => { this.fadeIn(d.leaf, 1000 + i * 50, 300); this.draw(d.arc, 520, 1040 + i * 50); });
    Object.values(this.roomT).forEach((t, i) => this.fadeIn(t, 1150 + i * 70, 500));
    this.fadeIn(this.corT, 1300, 500);
    /* linhas tracejadas aparecem por opacidade (o traçado animado apagaria o tracejado) */
    this.streetEls.forEach((el, i) => { if (el.tagName === 'path' && !el.classList.contains('lane')) this.draw(el, 800, 300 + i * 120); else this.fadeIn(el, 700, 600); });
    this.fadeIn(this.extR, 700, 700);
    this.fadeIn(this.extP, 1100, 500);
    this.fadeIn(this.extT, 1300, 500);
    this.fadeIn(this.people, 1450, 600);
  }

  /* mede o texto com a fonte de verdade (a quebra de linha fica certa em qualquer tela) */
  measure(text, size, cls) {
    if (!this.mEl || !this.mEl.isConnected) { this.mEl = S('text', { x: -9999, y: -9999, class: 'meas', 'aria-hidden': 'true' }, this.svg); this.mEl.style.visibility = 'hidden'; }
    this.mEl.setAttribute('class', cls);
    this.mEl.setAttribute('font-size', size);
    this.mEl.textContent = text;
    let w = 0;
    try { w = this.mEl.getComputedTextLength(); } catch (e) { w = 0; }
    this.mEl.setAttribute('class', 'meas');
    return w || text.length * size * 0.5;
  }
  wrap(text, maxW, size, cls) {
    const fits = (t) => this.measure(t, size, cls) <= maxW;
    if (fits(text)) return [text];
    let best = null;
    for (let i = 1; i < text.length - 1; i++) {
      if (text[i] !== ' ') continue;
      const a = text.slice(0, i), b = text.slice(i + 1);
      const wa = this.measure(a, size, cls), wb = this.measure(b, size, cls);
      if (wa <= maxW && wb <= maxW) { const sc = Math.max(wa, wb); if (!best || sc < best[0]) best = [sc, a, b]; }
    }
    if (best) return [best[1], best[2]];
    const words = text.split(' '), lines = [];
    let cur = '';
    words.forEach((w) => { if (!cur) cur = w; else if (fits(cur + ' ' + w)) cur += ' ' + w; else { lines.push(cur); cur = w; } });
    if (cur) lines.push(cur);
    return lines;
  }

  setText(el, v) {
    if (!el || el.textContent === v) return;
    el.textContent = v;
    this.a(el, [{ opacity: 0.15 }, { opacity: 1 }], { duration: 480 });
  }

  /* posição de notas e módulos em cada área */
  layout(D) {
    const g = this.geo, fs = g.fs, pad = g.pad, out = { notes: {}, mods: {} };
    const areaRect = (r) => (r === 'ext' ? g.ext : g.rooms[r]);
    const rooms = ['fin', 'mgmt', 'in', 'ops', 'sup', 'ext'];
    rooms.forEach((r) => {
      const [x0, y0, x1, y1] = areaRect(r);
      const notes = D.marks[r] || [];
      const W = x1 - x0 - pad * 2;
      let ny = y0 + pad + fs.room + fs.note * 0.95 + 4;
      notes.forEach((d) => {
        const lines = this.wrap(d.nota, W - 4, fs.note, 'note-t');
        out.notes[d.k] = { x: x0 + pad, y: ny, r, lines };
        ny += lines.length * fs.note * 1.12 + fs.note * 0.18;
      });
      const notesBottom = notes.length ? ny - fs.note * 0.9 : y0 + pad + fs.room + 4;
      const mods = D.mods.filter((m) => MODULOS[m].room === r);
      if (!mods.length) return;
      const lh = fs.mod * 1.16, mp = fs.mod * 0.55, mr = fs.mod * 0.62;
      const lineW = (w) => w - mp * 2 - mr * 2 - 4;
      const stack = () => {
        let y = y1 - pad;
        const res = [];
        for (let i = mods.length - 1; i >= 0; i--) {
          const lines = this.wrap(MODULOS[mods[i]].nome, lineW(W), fs.mod, 'mod-t');
          const h = lines.length * lh + mp * 1.5;
          y -= h;
          res[i] = { x: x0 + pad, y, w: W, h, lines };
          y -= fs.mod * 0.4;
        }
        return res;
      };
      let res = stack();
      if (mods.length > 1 && res[0].y < notesBottom + 2) {
        const gap = fs.mod * 0.5, w = (W - gap * (mods.length - 1)) / mods.length;
        const ls = mods.map((m) => this.wrap(MODULOS[m].nome, lineW(w), fs.mod, 'mod-t'));
        const h = Math.max(...ls.map((l) => l.length)) * lh + mp * 1.5;
        res = mods.map((m, i) => ({ x: x0 + pad + i * (w + gap), y: y1 - pad - h, w, h, lines: ls[i] }));
      }
      mods.forEach((m, i) => { out.mods[m] = res[i]; });
    });
    if (D.mods.includes('site')) {
      const [sx0, sy0, sx1, sy1] = g.sign;
      out.mods.site = { x: sx0, y: sy0, w: sx1 - sx0, h: sy1 - sy0, lines: [MODULOS.site.nome], sign: true };
    }
    if (D.marks.street) out.notes.presenca = { x: g.streetNote[0], y: g.streetNote[1], r: 'street', street: true, lines: [DOR.presenca.nota] };
    return out;
  }

  flowPath(m, box) {
    const g = this.geo;
    const r = MODULOS[m].room;
    const [, cy0, , cy1] = g.cor;
    const corY = cy0 + (cy1 - cy0) * 0.72, mDoor = g.cdoor.mgmt, hubY = g.rooms.mgmt[3] - (this.orient === 'land' ? 30 : 20);
    const tail = ` V${f1(corY)} H${f1(mDoor)} V${f1(hubY)}`;
    const cx = box.x + box.w / 2;
    if (r === 'in' || r === 'ops' || r === 'sup') return `M${f1(cx)},${f1(box.y)} V${f1(cy1 + 12)} H${g.cdoor[r]}` + tail;
    if (r === 'fin') return `M${f1(cx)},${f1(box.y + box.h)} V${f1(cy0 - 12)} H${g.cdoor.fin}` + tail;
    if (r === 'ext') {
      const sx = g.extSide === 'L' ? box.x : box.x + box.w, cy = box.y + box.h / 2;
      const [ax, ay] = g.extPath[0];
      return `M${f1(sx)},${f1(cy)} H${ax} V${ay} ` + g.extPath.slice(1).map((p) => `L${p[0]},${p[1]}`).join(' ') + ` V${f1(corY)} H${f1(mDoor)} V${f1(hubY)}`;
    }
    if (r === 'street') {
      const [ex] = g.entrance;
      return `M${f1(box.x)},${f1(box.y + box.h / 2)} H${ex} V${f1(cy1 + 12)} H${g.cdoor.in}` + tail;
    }
    return null;
  }

  /* reconcilia o desenho com o estado: entra o que é novo, sai o que deixou de existir */
  render(st, rev) {
    const g = this.geo, fs = g.fs;
    const D = derive(st);
    this.showBuilding(D.any);
    const R = RAMOS[D.ramo || 'outro'];
    if (D.any) {
      ROOM_KEYS.forEach((k) => this.setText(this.roomT[k], R.rooms[k]));
      this.setText(this.extT, R.ext);
      this.setText(this.corT, D.mods.includes('base') ? MODULOS.base.nome : 'Circulação');
      this.corT.classList.toggle('on', D.mods.includes('base'));
    }
    if (this.dimT) this.setText(this.dimT, st.equipe !== null && st.equipe !== undefined ? EQ_FRASE[st.equipe] : 'Equipe: a definir');
    /* carimbo */
    this.setText(this.car.nome, st.nome || (st.example ? 'Construtora Exemplo' : 'Sua empresa'));
    this.setText(this.car.ramo, st.ramo ? RAMOS[st.ramo].nome : 'A definir');
    this.setText(this.car.eq, st.equipe !== null && st.equipe !== undefined ? EQUIPES_CURTO[st.equipe] + (g.carMode === 'tall' ? ' pessoas' : '') : 'A definir');
    this.setText(this.car.atr, String(D.dores.length));
    this.setText(this.car.prop, D.mods.length + (g.carMode === 'tall' ? (D.mods.length === 1 ? ' módulo' : ' módulos') : ''));
    this.setText(this.car.rev, 'Rev. ' + rev);
    this.gStamp.style.display = st.example ? '' : 'none';

    const want = new Map();
    const L = this.layout(D);
    /* nuvens de revisão por área */
    Object.keys(D.marks).forEach((r) => {
      if (!this.revAt[r]) this.revAt[r] = rev;
      want.set('cloud:' + r, () => this._cloud(r, this.revAt[r]));
    });
    Object.keys(this.revAt).forEach((r) => { if (!D.marks[r]) delete this.revAt[r]; });
    D.dores.forEach((d) => { if (L.notes[d.k]) want.set('note:' + d.k, () => this._note(d, L.notes[d.k])); });
    D.mods.forEach((m) => {
      if (m === 'base') { want.set('base', () => this._base()); return; }
      const b = L.mods[m];
      if (!b) return;
      want.set('mod:' + m, () => this._mod(m, b));
      const fp = this.flowPath(m, b);
      if (fp) want.set('flow:' + m, () => this._flow(m, fp));
    });
    /* sai o que não está mais no estado */
    this.items.forEach((it, key) => {
      if (want.has(key)) return;
      this.items.delete(key);
      if (this.anim && it.g.animate) { const an = it.g.animate([{ opacity: 1 }, { opacity: 0 }], { duration: 260, easing: 'ease-out', fill: 'forwards' }); an.onfinish = () => it.g.remove(); } else it.g.remove();
    });
    /* entra o novo; o que já existe só muda de lugar */
    want.forEach((make, key) => {
      const it = this.items.get(key);
      if (!it) { this.items.set(key, make()); return; }
      if (key.startsWith('note:')) {
        const k = key.slice(5), p = L.notes[k];
        if (it.sig !== p.lines.join('|')) { it.g.remove(); this.items.set(key, this._note(DOR[k], p, true)); }
        else it.g.style.transform = `translate(${f1(p.x)}px, ${f1(p.y)}px)`;
      }
      else if (key.startsWith('mod:')) {
        const m = key.slice(4), b = L.mods[m];
        if (it.sig !== this._modSig(b)) { it.g.remove(); this.items.set(key, this._mod(m, b, true)); }
      } else if (key.startsWith('flow:')) {
        const m = key.slice(5), d = this.flowPath(m, L.mods[m]);
        if (it.d !== d) { it.g.remove(); this.items.set(key, this._flow(m, d, true)); }
      }
    });
    return D;
  }

  _cloud(r, revN) {
    const g = this.geo, fs = g.fs;
    const gg = S('g', { class: 'mk-cloud' }, this.gMarks);
    let rect;
    if (r === 'street') rect = g.streetCloud;
    else { const [x0, y0, x1, y1] = r === 'ext' ? g.ext : g.rooms[r]; const k = g.t.E * 0.5 + (this.orient === 'land' ? 7 : 6); rect = [x0 + k, y0 + k, x1 - k, y1 - k]; }
    const p = S('path', { d: cloudPath(rect[0], rect[1], rect[2], rect[3], r === 'street' ? g.cloudStep * 0.6 : g.cloudStep), class: 'cloud' }, gg);
    this.draw(p, 900, 0);
    if (r !== 'street') {
      const tx = rect[2] - fs.note * 1.1, ty = rect[1] + fs.note * 1.05, s = fs.note * 0.72;
      const tg = S('g', { class: 'rev-tag' }, gg);
      S('path', { d: `M${f1(tx)},${f1(ty - s)} L${f1(tx + s * 0.95)},${f1(ty + s * 0.62)} L${f1(tx - s * 0.95)},${f1(ty + s * 0.62)} Z` }, tg);
      const t = S('text', { x: f1(tx), y: f1(ty + s * 0.42), 'font-size': f1(fs.note * 0.68), 'text-anchor': 'middle' }, tg);
      t.textContent = String(revN);
      this.a(tg, [{ opacity: 0, transform: 'scale(.4)' }, { opacity: 1, transform: 'none' }], { duration: 420, delay: 700 });
      tg.style.transformBox = 'fill-box'; tg.style.transformOrigin = '50% 50%';
    }
    return { g: gg };
  }

  _note(d, p, quick) {
    const fs = this.geo.fs;
    const gg = S('g', { class: 'mk-note mv' }, this.gMarks);
    gg.style.transform = `translate(${f1(p.x)}px, ${f1(p.y)}px)`;
    const size = p.street ? fs.small + 0.5 : fs.note;
    p.lines.forEach((l, i) => {
      const t = S('text', { x: 0, y: f1(i * size * 1.12), 'font-size': size, class: 'note-t' }, gg);
      t.textContent = l;
      if (!quick) this.a(t, [{ opacity: 0, transform: 'translateX(-6px)' }, { opacity: 1, transform: 'none' }], { duration: 460, delay: 420 + i * 60 });
    });
    return { g: gg, sig: p.lines.join('|') };
  }

  _modSig(b) { return [b.x, b.y, b.w, b.h, b.lines.join('|')].map(String).join(';'); }

  _mod(m, b, quick) {
    const fs = this.geo.fs;
    const gg = S('g', { class: 'mk-mod' + (b.sign ? ' sign' : '') }, this.gMods);
    const lh = fs.mod * 1.16, mp = fs.mod * 0.55;
    const fsz = b.sign ? fs.small + 0.5 : fs.mod;
    const r = S('rect', { x: f1(b.x), y: f1(b.y), width: f1(b.w), height: f1(b.h), rx: 3, class: 'mod-r', fill: `url(#hatch${this.sfx})` }, gg);
    const tx = b.x + mp;
    b.lines.forEach((l, i) => {
      const t = S('text', { x: f1(tx), y: f1(b.sign ? b.y + b.h / 2 + fsz * 0.36 : b.y + mp * 0.75 + lh * (i + 0.78)), 'font-size': fsz, class: 'mod-t' }, gg);
      t.textContent = l;
    });
    const n = DET_N[MODULOS[m].det];
    const mr = b.sign ? fsz * 0.6 : fs.mod * 0.62;
    const mx = b.x + b.w + (b.sign ? mr + 4 : -mp - mr * 0.4), my = b.sign ? b.y + b.h / 2 : b.y + mp * 0.75 + mr;
    const a = this.links ? S('a', { href: '#detalhe-' + MODULOS[m].det, class: 'det-mk', 'data-det': MODULOS[m].det, 'aria-label': `Ver o detalhe ${n}: ${MODULOS[m].nome}` }, gg) : S('g', { class: 'det-mk' }, gg);
    S('circle', { cx: f1(mx), cy: f1(my), r: f1(mr) }, a);
    const nt = S('text', { x: f1(mx), y: f1(my + mr * 0.42), 'font-size': f1(mr * 1.2), 'text-anchor': 'middle' }, a);
    nt.textContent = String(n);
    if (!quick) {
      this.draw(r, 620, 200);
      gg.querySelectorAll('.mod-t').forEach((t) => this.fadeIn(t, 560, 420));
      this.a(a, [{ opacity: 0, transform: 'scale(.3)' }, { opacity: 1, transform: 'none' }], { duration: 420, delay: 760 });
      a.style.transformBox = 'fill-box'; a.style.transformOrigin = '50% 50%';
    } else this.fadeIn(gg, 0, 260);
    return { g: gg, sig: this._modSig(b) };
  }

  _flow(m, d, quick) {
    const fs = this.geo.fs;
    const gg = S('g', { class: 'mk-flow' }, this.gFlows);
    const p = S('path', { d, class: 'flow' }, gg);
    if (!quick) this.draw(p, 1000, 500); else this.fadeIn(p, 0, 300);
    if (this.dots) {
      const len = p.getTotalLength ? p.getTotalLength() : 400;
      const dur = Math.max(2.4, len / (this.orient === 'land' ? 95 : 60));
      [0, 0.5].forEach((off) => {
        const c = S('circle', { r: fs.dot, class: 'dot' }, gg);
        const am = S('animateMotion', { dur: f1(dur) + 's', repeatCount: 'indefinite', begin: f1(-dur * off) + 's', path: d, rotate: 'auto' }, c);
        am.setAttribute('calcMode', 'linear');
        this.fadeIn(c, quick ? 200 : 1400, 400);
      });
    }
    return { g: gg, d };
  }

  _base() {
    const g = this.geo;
    const gg = S('g', { class: 'mk-base' }, this.gBase);
    const [x0, y0, x1, y1] = g.bld, k = this.orient === 'land' ? 14 : 8;
    const env = S('rect', { x: x0 - k, y: y0 - k, width: x1 - x0 + k * 2, height: y1 - y0 + k * 2, rx: 6, class: 'base-env' }, gg);
    const [cx0, cy0, cx1, cy1] = g.cor, o = g.t.I / 2 + 1;
    const band = S('rect', { x: cx0 + o, y: cy0 + o, width: cx1 - cx0 - o * 2, height: cy1 - cy0 - o * 2, class: 'cor-band' }, gg);
    this.fadeIn(band, 0, 700);
    this.fadeIn(env, 300, 700);
    const mr = g.fs.mod * 0.62, mx = cx0 + 10 + mr + 4, my = (cy0 + cy1) / 2;
    const a = this.links ? S('a', { href: '#detalhe-painel', class: 'det-mk', 'data-det': 'painel', 'aria-label': `Ver o detalhe ${DET_N.painel}: ${MODULOS.base.nome}` }, gg) : S('g', { class: 'det-mk' }, gg);
    S('circle', { cx: f1(mx), cy: f1(my), r: f1(mr) }, a);
    const nt = S('text', { x: f1(mx), y: f1(my + mr * 0.42), 'font-size': f1(mr * 1.2), 'text-anchor': 'middle' }, a);
    nt.textContent = String(DET_N.painel);
    this.fadeIn(a, 800, 400);
    return { g: gg };
  }
}

/* ---------- a planta na página ---------- */
export class Plan {
  constructor(sheet, o = {}) {
    this.sheet = sheet;
    this.reduced = !!o.reduced;
    this.onChange = o.onChange || null;
    this.world = sheet.querySelector('.world');
    /* grupo (e não imagem): dentro da planta há links para os detalhes */
    this.svg = S('svg', { role: 'group', 'aria-labelledby': 'plan-title plan-desc', focusable: 'false' });
    this.world.prepend(this.svg);
    this.p3 = document.createElement('div');
    this.p3.className = 'p3';
    this.p3.setAttribute('aria-hidden', 'true');
    this.world.append(this.p3);
    this.state = { ramo: null, dores: [], equipe: null, nome: '', example: false };
    this.rev = 0;
    this.sig = '';
    this.d3 = { on: false, rise: 0, rx: 0, rz: 0, sc: 1, ty: 0 };
    this.orient = null;
    this._applyVars();
    this.relayout(true);
    this._drag();
  }

  orientation() { return this.forceOrient || (this.sheet.clientWidth < 600 ? 'port' : 'land'); }

  relayout(force) {
    const o = this.orientation();
    if (o !== this.orient || force) {
      this.orient = o;
      const keep = this.state;
      /* a folha nova nasce já desenhada (sem animação); as próximas mudanças animam */
      this.painter = new Painter(this.svg, o, { animate: false, dots: !this.reduced });
      this.painter.render(keep, this.rev);
      this.painter.anim = !this.reduced;
      this._title();
      this.sheet.classList.toggle('is-port', o === 'port');
    }
    this._build3D();
  }

  /* troca o estado; a revisão sobe a cada mudança real */
  set(st, o = {}) {
    const next = { ramo: st.ramo || null, dores: (st.dores || []).slice(), equipe: st.equipe === undefined ? null : st.equipe, nome: (st.nome || '').trim().slice(0, 40), example: !!st.example };
    const sig = [next.ramo, next.dores.slice().sort().join(','), next.equipe].join('|');
    const sigFull = sig + '|' + next.nome + '|' + next.example;
    if (sigFull === this.sigFull) return derive(next);
    if (sig !== this.sig) {
      const empty = !next.ramo && !next.dores.length && next.equipe === null;
      this.rev = empty ? 0 : (o.rev !== undefined ? o.rev : this.rev + 1);
      this.sig = sig;
    }
    this.sigFull = sigFull;
    this.state = next;
    const D = this.painter.render(next, this.rev);
    this._title(D);
    if (this.d3.on || this.d3.rise > 0) this._build3Dmods();
    if (this.onChange) this.onChange(next, D);
    return D;
  }

  derived() { return derive(this.state); }

  _title(D) {
    D = D || derive(this.state);
    let t = this.svg.querySelector('#plan-title'), d = this.svg.querySelector('#plan-desc');
    if (!t) { t = S('title', { id: 'plan-title' }); d = S('desc', { id: 'plan-desc' }); this.svg.prepend(t, d); }
    t.textContent = 'Planta do sistema' + (this.state.nome ? ', ' + this.state.nome : '');
    if (!D.any) { d.textContent = 'Planta em branco. Ela é desenhada enquanto você conta como a empresa funciona.'; return; }
    const st = this.state;
    const parts = [];
    parts.push(st.ramo ? RAMOS[st.ramo].nome : 'Ramo a definir');
    if (st.equipe !== null) parts.push(EQ_FRASE[st.equipe].toLowerCase());
    if (D.dores.length) parts.push('marcado em vermelho: ' + D.dores.map((x) => lc1(x.nota)).join(', '));
    if (D.mods.length) parts.push('proposta em azul: ' + D.mods.map((m) => lc1(MODULOS[m].nome)).join(', '));
    d.textContent = parts.join('. ') + '.';
  }

  pause(p) { try { if (p) this.svg.pauseAnimations(); else this.svg.unpauseAnimations(); } catch (e) { /* sem SMIL */ } }

  /* cópia estática para o final e para quem não tem JavaScript ligado no PDF */
  snapshot(orient, st, suffix, host) {
    const svg = S('svg', { 'aria-hidden': 'true', focusable: 'false' });
    if (host) host.append(svg);
    const P = new Painter(svg, orient || 'land', { animate: false, dots: false, links: false, suffix: suffix || '-s' });
    P.render(st || this.state, st ? Math.max(1, this.rev) : this.rev);
    return svg;
  }

  /* ---------- maquete 3D ---------- */
  _scale() { return this.svg.getBoundingClientRect().width / GEO[this.orient].vb[0] || 1; }

  _face(x1, y1, x2, y2, h, cls, s) {
    const el = document.createElement('i');
    const len = Math.hypot(x2 - x1, y2 - y1);
    const ang = Math.atan2(y2 - y1, x2 - x1) * 180 / Math.PI;
    el.className = cls;
    el.style.width = f1(len * s) + 'px';
    el.style.height = f1(h * s) + 'px';
    el.style.transform = `translate3d(${f1(x1 * s)}px, ${f1(y1 * s)}px, 0) rotateZ(${f1(ang)}deg) rotateX(90deg) scaleY(var(--rise))`;
    return el;
  }

  _cap(x, y, w, h, z, cls, s) {
    const el = document.createElement('i');
    el.className = cls;
    el.style.width = f1(w * s) + 'px';
    el.style.height = f1(h * s) + 'px';
    el.style.transform = `translate3d(${f1(x * s)}px, ${f1(y * s)}px, calc(${f1(z * s)}px * var(--rise)))`;
    return el;
  }

  _build3D() {
    const G = GEO[this.orient], s = this._scale();
    this.s3 = s;
    this.p3.innerHTML = '';
    const frag = document.createDocumentFragment();
    const P = this.painter.parts;
    P.solids.forEach((w) => {
      const cls = 'wf ' + (w.horiz ? 'h' : 'v') + (w.kind === 'I' ? ' i' : '');
      const H = w.kind === 'E' ? G.H : G.H * 0.86;
      if (w.horiz) frag.append(this._face(w.a, w.fixed, w.b, w.fixed, H, cls, s));
      else frag.append(this._face(w.fixed, w.a, w.fixed, w.b, H, cls, s));
      frag.append(this._cap(w.x, w.y, w.w, w.h, H, 'wc', s));
    });
    P.wins.forEach((w) => {
      if (w.horiz) frag.append(this._face(w.a, w.fixed, w.b, w.fixed, G.H, 'wg', s));
      else frag.append(this._face(w.fixed, w.a, w.fixed, w.b, G.H, 'wg', s));
    });
    this.p3walls = frag;
    this.p3.append(frag);
    this.p3mods = document.createElement('div');
    this.p3mods.className = 'p3m';
    this.p3.append(this.p3mods);
    this._build3Dmods();
  }

  _build3Dmods() {
    if (!this.p3mods) return;
    const G = GEO[this.orient], s = this.s3 || this._scale();
    const box = this.p3mods;
    box.innerHTML = '';
    const D = derive(this.state);
    const L = this.painter.layout(D);
    const hm = G.H * 0.3;
    D.mods.forEach((m) => {
      const b = L.mods[m];
      if (!b) return;
      const h = b.sign ? G.H * 0.5 : hm;
      box.append(this._cap(b.x, b.y, b.w, b.h, h, 'mt', s));
      box.append(this._face(b.x, b.y, b.x + b.w, b.y, h, 'mb', s));
      box.append(this._face(b.x, b.y + b.h, b.x + b.w, b.y + b.h, h, 'mb', s));
      box.append(this._face(b.x, b.y, b.x, b.y + b.h, h, 'mb', s));
      box.append(this._face(b.x + b.w, b.y, b.x + b.w, b.y + b.h, h, 'mb', s));
    });
    Object.keys(D.marks).forEach((r) => {
      let x, y;
      if (r === 'street') { x = G.streetCloud[0] + 10; y = (G.streetCloud[1] + G.streetCloud[3]) / 2; }
      else { const R = r === 'ext' ? G.ext : G.rooms[r]; x = R[2] - G.pad - 6; y = R[1] + G.pad + 10; }
      const hp = G.H * 1.35;
      const pole = document.createElement('i');
      pole.className = 'pole';
      pole.style.height = f1(hp * s) + 'px';
      pole.style.transform = `translate3d(${f1(x * s)}px, ${f1(y * s)}px, 0) rotateX(90deg) scaleY(var(--rise))`;
      const head = document.createElement('i');
      head.className = 'pin';
      head.textContent = '!';
      head.style.transform = `translate3d(${f1(x * s)}px, ${f1(y * s)}px, calc(${f1(hp * s)}px * var(--rise))) rotateZ(calc(-1 * var(--rz))) rotateX(calc(-1 * var(--rx))) translate(-50%, -100%)`;
      box.append(pole, head);
    });
  }

  _applyVars() {
    const d = this.d3, w = this.world.style;
    w.setProperty('--rise', d.rise.toFixed(4));
    w.setProperty('--rx', d.rx.toFixed(2) + 'deg');
    w.setProperty('--rz', d.rz.toFixed(2) + 'deg');
    w.setProperty('--sc', d.sc.toFixed(4));
    w.setProperty('--ty', d.ty.toFixed(1) + 'px');
  }

  set3D(on, o = {}) {
    const d = this.d3;
    if (on === d.on && !o.force && !o.instant) return;
    d.on = on;
    this.sheet.classList.toggle('d3', on);
    this.sheet.classList.add('d3-live');
    if (on) this._build3D();
    const port = this.orient === 'port';
    const to = on ? { rise: 1, rx: port ? 46 : 54, rz: port ? -20 : -24, sc: port ? 0.66 : 0.8, ty: port ? -this.sheet.clientHeight * 0.03 : -this.sheet.clientHeight * 0.04 } : { rise: 0, rx: 0, rz: 0, sc: 1, ty: 0 };
    this.orbit = !!o.orbit && on && !this.reduced;
    cancelAnimationFrame(this.raf);
    /* sem animação (movimento reduzido ou impressão): aplica na hora */
    if (this.reduced || o.instant) {
      Object.assign(d, to);
      this._applyVars();
      if (!on) this.sheet.classList.remove('d3-live');
      return;
    }
    const from = { ...d }, t0 = performance.now(), dur = on ? 1500 : 900;
    const ease = (t) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2);
    const tick = (now) => {
      const k = Math.min(1, (now - t0) / dur);
      const e = ease(k);
      /* no levantar, as paredes só começam a subir depois que a folha inclina */
      ['rise', 'rx', 'rz', 'sc', 'ty'].forEach((p) => { d[p] = from[p] + (to[p] - from[p]) * (p === 'rise' && on ? Math.max(0, (k - 0.25) / 0.75) ** 0.8 : e); });
      if (k >= 1 && this.orbit) d.rz += 0.06;
      this._applyVars();
      if (k < 1 || this.orbit) this.raf = requestAnimationFrame(tick);
      else if (!on) this.sheet.classList.remove('d3-live');
    };
    this.raf = requestAnimationFrame(tick);
  }

  stopOrbit() { this.orbit = false; }

  _drag() {
    let on = false, x0 = 0, y0 = 0, rz0 = 0, rx0 = 0;
    const el = this.sheet;
    el.addEventListener('pointerdown', (e) => {
      if (!this.d3.on || e.button > 0 || e.target.closest('a, button')) return;
      on = true; x0 = e.clientX; y0 = e.clientY; rz0 = this.d3.rz; rx0 = this.d3.rx;
      this.orbit = false;
      el.setPointerCapture(e.pointerId);
      el.classList.add('grab');
    });
    el.addEventListener('pointermove', (e) => {
      if (!on) return;
      this.d3.rz = rz0 + (e.clientX - x0) * 0.4;
      this.d3.rx = Math.max(18, Math.min(74, rx0 - (e.clientY - y0) * 0.3));
      this._applyVars();
    });
    const end = () => { on = false; el.classList.remove('grab'); };
    el.addEventListener('pointerup', end);
    el.addEventListener('pointercancel', end);
    el.addEventListener('keydown', (e) => {
      if (!this.d3.on) return;
      const k = { ArrowLeft: [-8, 0], ArrowRight: [8, 0], ArrowUp: [0, 5], ArrowDown: [0, -5] }[e.key];
      if (!k) return;
      e.preventDefault();
      this.orbit = false;
      this.d3.rz += k[0];
      this.d3.rx = Math.max(18, Math.min(74, this.d3.rx + k[1]));
      this._applyVars();
    });
  }
}

export { GEO };
