/* Konan Tech 5.0: comportamento da página.
   A planta viva é o centro: o visitante fala, escreve ou toca nas opções e a planta do sistema
   é desenhada na hora. O resto da página se adapta ao que ele contou.
   O 3D pesado (partículas) só carrega no final; sem WebGL, tudo funciona igual. */

import { WA_DEFAULT, waLink, waContext, RAMOS, RAMO_ORDER, DORES, MODULOS, DETALHES, EQUIPES, EQUIPES_CURTO, EXEMPLO, obraFrase, obraSig, obraFromSig, obraTemComodos } from './content.js';
import { Plan, derive, lc1 } from './plan.js';
import { parse, highlight, Voice, SR, typeOut } from './listen.js';
import { probeGL, pickTier, TIERS } from './perf.js';

const D = document, H = D.documentElement;
const REDUCED = H.classList.contains('rm');
const FINE = matchMedia('(pointer: fine)').matches;
const IS_FILE = location.protocol === 'file:';
const q = (s, r = D) => r.querySelector(s);
const qa = (s, r = D) => [...r.querySelectorAll(s)];
const narrow = () => innerWidth <= 760;

let lenis = null, stage, stagePromise = null;
const demos = {};

/* ---------- WhatsApp: todo link [data-wa] recebe a mensagem do contexto ---------- */
function setWa(a, frase) { if (a) a.href = waLink(frase ? waContext(frase) : WA_DEFAULT); }
function setWaRaw(a, msg) { if (a) a.href = waLink(msg); }
qa('[data-wa]').forEach((a) => setWa(a, a.dataset.msg));

/* ---------- cabeçalho e menu ---------- */
const hd = q('#hd');
const menuBtn = q('#menu-btn');
function setMenu(open) {
  hd.classList.toggle('open', open);
  menuBtn.setAttribute('aria-expanded', String(open));
  menuBtn.querySelector('.sr').textContent = open ? 'Fechar menu' : 'Abrir menu';
}
menuBtn.addEventListener('click', () => setMenu(!hd.classList.contains('open')));
D.addEventListener('keydown', (e) => { if (e.key === 'Escape' && hd.classList.contains('open')) { setMenu(false); menuBtn.focus(); } });

/* ---------- rolagem suave e âncoras ---------- */
if (!REDUCED && window.Lenis) {
  lenis = new window.Lenis({ lerp: 0.1, smoothWheel: true, wheelMultiplier: 0.95, prevent: (node) => !!(node && node.closest && node.closest('[data-lenis-prevent], dialog, textarea')) });
  const raf = (t) => { lenis.raf(t); requestAnimationFrame(raf); };
  requestAnimationFrame(raf);
}
function scrollToTarget(el, extra) {
  const off = -(hd.offsetHeight + (extra === undefined ? 10 : extra));
  /* o Lenis já desconta o scroll-padding-top do html (cabeçalho + 12px); aqui só entra a diferença */
  const pad = parseFloat(getComputedStyle(H).scrollPaddingTop) || 0;
  if (lenis) lenis.scrollTo(el, { offset: off + pad, duration: 1.2 });
  else window.scrollTo({ top: el.getBoundingClientRect().top + scrollY + off, behavior: REDUCED ? 'auto' : 'smooth' });
}
D.addEventListener('click', (e) => {
  const a = e.target.closest('a[href^="#"]');
  if (!a) return;
  const id = a.getAttribute('href');
  if (id.startsWith('#detalhe-')) {
    e.preventDefault();
    setMenu(false);
    openDetail(id.slice(9), true);
    return;
  }
  if (id === '#qs') { e.preventDefault(); startTap(); return; }
  const el = id.length > 1 ? D.getElementById(id.slice(1)) : null;
  if (!el) return;
  e.preventDefault();
  setMenu(false);
  scrollToTarget(el, id === '#planta' ? 200 : 10);
});

/* seção atual destacada no menu */
const NAV = qa('.hd-nav > a:not(.btn)');
const navIO = new IntersectionObserver((ents) => ents.forEach((e) => {
  if (!e.isIntersecting) return;
  NAV.forEach((a) => { const on = a.getAttribute('href') === '#' + e.target.id; a.classList.toggle('cur', on); if (on) a.setAttribute('aria-current', 'true'); else a.removeAttribute('aria-current'); });
}), { rootMargin: '-45% 0px -50% 0px' });
['planta', 'detalhes', 'projetos', 'processo', 'duvidas'].forEach((id) => { const el = D.getElementById(id); if (el) navIO.observe(el); });

/* ============================================================
   A MESA: conversa + planta
   ============================================================ */
const sheet = q('#sheet');
const sub = q('#sub'), subWho = q('#sub-who'), subT = q('#sub-t'), subStop = q('#sub-stop'), foot = q('#sheet-foot');
const micBtn = q('#mic'), writeBtn = q('#write'), compW = q('#comp-w'), txt = q('#txt'), txtGo = q('#txt-go');
const compMsg = q('#comp-msg');
const live = q('#live');
const b3d = q('#b3d'), bwa = q('#bwa'), bpdf = q('#bpdf'), blink = q('#blink');
const qTabs = qa('.q-tabs [role=tab]'), qPanes = [q('#qp-0'), q('#qp-1'), q('#qp-2')];
const cRamo = qa('#c-ramo [role=radio]'), cDor = qa('#c-dor button'), cEq = qa('#c-eq [role=radio]');
const nomeIn = q('#nome'), qDone = q('#q-done');

/* o que o visitante escolheu tocando (manual) vale mais do que o que foi entendido da fala ou do texto (spoken) */
const manual = { ramo: null, equipe: null, on: new Set(), off: new Set(), nome: '', obra: null };
let spoken = { ramo: null, dores: [], equipe: null, obra: null };
/* o que a conversa entendeu */
const heard = (r) => ({ ramo: r.ramo, dores: r.dores, equipe: r.equipe, obra: r.obra });
let mode = 'idle';
let exCancel = null, exTimers = [];
let lastAnnounce = { dores: [], mods: [], obra: '' };

function effective() {
  const set = new Set(spoken.dores);
  manual.on.forEach((k) => set.add(k));
  manual.off.forEach((k) => set.delete(k));
  return {
    ramo: manual.ramo || spoken.ramo || null,
    equipe: manual.equipe !== null ? manual.equipe : spoken.equipe,
    dores: DORES.map((d) => d.k).filter((k) => set.has(k)),
    obra: spoken.obra || manual.obra || null,
    nome: manual.nome,
    example: mode === 'example'
  };
}

const plan = new Plan(sheet, { reduced: REDUCED, onChange: onPlanChange });
function apply() { plan.set(effective()); }

/* tudo o que depende da planta: opções marcadas, resumo das abas, WhatsApp, detalhes e projetos */
function onPlanChange(st, Dv) {
  cRamo.forEach((b) => { const on = b.dataset.v === st.ramo; b.setAttribute('aria-checked', String(on)); });
  cDor.forEach((b) => b.setAttribute('aria-pressed', String(st.dores.includes(b.dataset.v))));
  cEq.forEach((b) => b.setAttribute('aria-checked', String(+b.dataset.v === st.equipe)));
  rovingFix(cRamo); rovingFix(cEq);
  q('#qv-0').textContent = st.ramo ? RAMOS[st.ramo].nome : 'A definir';
  q('#qv-1').textContent = st.dores.length ? (st.dores.length === 1 ? '1 marcado' : st.dores.length + ' marcados') : 'Nada marcado';
  q('#qv-2').textContent = st.equipe !== null ? EQUIPES_CURTO[st.equipe] + ' pessoas' : 'A definir';
  qTabs[0].classList.toggle('set', !!st.ramo);
  qTabs[1].classList.toggle('set', st.dores.length > 0);
  qTabs[2].classList.toggle('set', st.equipe !== null);
  qDone.hidden = !(st.ramo && st.dores.length && st.equipe !== null) || st.example;
  /* WhatsApp com o resumo da planta */
  const msg = planMessage(st, Dv);
  setWaRaw(bwa, msg);
  const fwa = q('#fin-wa');
  setWaRaw(fwa, msg);
  q('#fin-wa span').textContent = Dv.any && !st.example ? 'Enviar a minha planta' : 'Conversar no WhatsApp';
  /* detalhes: as partes que estão na planta ganham a etiqueta */
  const detIn = new Set(st.example ? [] : Dv.mods.map((m) => MODULOS[m].det));
  qa('.det-tabs [role=tab]').forEach((b) => b.classList.toggle('in-plan', detIn.has(b.dataset.d)));
  if (!detUser && detIn.size) { const first = DETALHES.find((d) => detIn.has(d.k)); if (first && first.k !== detCur) openDetail(first.k, false, true); }
  if (demos.auto && demos.auto.setRamo && st.ramo && !st.example) demos.auto.setRamo(RAMOS[st.ramo].auto);
  if (demos.app && demos.app.setRamo && st.ramo && !st.example) demos.app.setRamo(st.ramo);
  if (demos.boards && demos.boards.rank) demos.boards.rank(st, Dv);
  if (demos.fin && demos.fin.refresh) demos.fin.refresh();
  if (!st.example) announce(st, Dv);
}

/* leitor de tela: conta o que mudou na planta */
let annT = 0;
function announce(st, Dv) {
  clearTimeout(annT);
  annT = setTimeout(() => {
    const newD = Dv.dores.filter((d) => !lastAnnounce.dores.includes(d.k));
    const newM = Dv.mods.filter((m) => !lastAnnounce.mods.includes(m));
    const parts = [];
    if (newD.length) parts.push('Marcado em vermelho: ' + newD.map((d) => lc1(d.nota)).join(', ') + '.');
    if (newM.length) parts.push('Proposta em azul: ' + newM.map((m) => lc1(MODULOS[m].nome)).join(', ') + '.');
    const ob = Dv.obra ? obraSig(Dv.obra) : '';
    if (ob && ob !== lastAnnounce.obra) parts.push('Casa desenhada no canteiro: ' + obraFrase(Dv.obra) + '.');
    lastAnnounce = { dores: Dv.dores.map((d) => d.k), mods: Dv.mods.slice(), obra: ob };
    if (parts.length) live.textContent = parts.join(' ');
  }, 700);
}

function planMessage(st, Dv) {
  if (st.example || !Dv.any) return waContext(st.example ? 'vi a planta de exemplo no site e quero desenhar a da minha empresa.' : 'quero conversar sobre uma solução para a minha empresa.');
  const L = ['Olá, vim pelo site da Konan Tech e desenhei a planta da minha empresa.'];
  if (st.nome) L.push('Empresa: ' + st.nome);
  if (st.ramo) L.push('Ramo: ' + RAMOS[st.ramo].nome);
  if (st.equipe !== null) L.push('Equipe: ' + EQUIPES[st.equipe].toLowerCase());
  if (Dv.obra) L.push('Obra: ' + obraFrase(Dv.obra));
  if (Dv.dores.length) L.push('O que trava hoje: ' + Dv.dores.map((d) => lc1(d.chip)).join('; '));
  if (Dv.mods.length) L.push('Partes da planta: ' + Dv.mods.map((m) => MODULOS[m].nome).join('; '));
  const link = shareUrl(st);
  if (link) L.push('Planta: ' + link);
  L.push('Quero conversar sobre como tirar essa planta do papel.');
  return L.join('\n');
}

/* ---------- link da planta: #planta=ramo.dores.equipe.nome ---------- */
function encodeState(st) {
  return [st.ramo || 'x', st.dores.join('-') || 'x', st.equipe === null ? 'x' : st.equipe, encodeURIComponent(st.nome || ''), obraSig(st.obra) || 'x'].join('.');
}
function decodeState(s) {
  const [r, d, e, n, o] = (s || '').split('.');
  const out = { ramo: RAMOS[r] ? r : null, dores: (d || '').split('-').filter((k) => DORES.some((x) => x.k === k)), equipe: /^[0-3]$/.test(e || '') ? +e : null, nome: '' };
  try { out.nome = decodeURIComponent(n || '').slice(0, 40); } catch (err) { out.nome = ''; }
  out.obra = o && o !== 'x' ? obraFromSig(o) : null;
  return out;
}
function shareUrl(st) {
  if (IS_FILE) return '';
  const base = location.origin + location.pathname;
  return base + '#planta=' + encodeState(st);
}

/* ---------- legenda sobre a planta ---------- */
function showSub(who, text, hits, rec) {
  subWho.textContent = who;
  let start = 0;
  if (text.length > 170) { start = text.indexOf(' ', text.length - 170) + 1 || text.length - 170; }
  const tail = text.slice(start);
  const th = (hits || []).filter((h) => h.a >= start).map((h) => ({ a: h.a - start, b: h.b - start, kind: h.kind }));
  subT.innerHTML = text ? (start ? '… ' : '') + highlight(tail, th) : (rec ? 'Pode falar, estou ouvindo.' : 'Digitando…');
  sub.classList.add('on');
  sub.classList.toggle('rec', !!rec);
  foot.classList.add('talk');
  clearTimeout(subT_hide);
}
let subT_hide = 0;
function hideSub(after) {
  clearTimeout(subT_hide);
  const go = () => { sub.classList.remove('on', 'rec'); foot.classList.remove('talk'); };
  if (after) subT_hide = setTimeout(go, after); else go();
}
/* "Entendi: ..." embaixo da caixa de texto: o visitante vê na hora o que a planta aproveitou */
const hintEl = q('#comp-hint'), HINT0 = hintEl ? hintEl.textContent : '';
function hint(r, empty) {
  if (!hintEl) return;
  const bits = [];
  if (r && r.ramo) bits.push(RAMOS[r.ramo].nome.toLowerCase());
  if (r && r.obra) bits.push('obra com ' + obraFrase(r.obra));
  if (r && r.equipe !== null) bits.push('equipe de ' + EQUIPES_CURTO[r.equipe].toLowerCase() + ' pessoas');
  if (r && r.dores.length) bits.push(r.dores.length === 1 ? '1 atrito marcado' : r.dores.length + ' atritos marcados');
  hintEl.textContent = bits.length ? 'Entendi: ' + bits.join('; ') + '.' : (empty ? HINT0 : 'Ainda não reconheci o ramo, a obra ou o que trava. Conte com outras palavras.');
  hintEl.classList.toggle('ok', bits.length > 0);
  /* a casa descrita também pode ser vista em 3D, numa página própria */
  if (r && r.obra && obraTemComodos(r.obra)) {
    const a = document.createElement('a');
    a.href = 'casa-3d/#' + obraSig(r.obra);
    a.className = 'hint-3d';
    a.textContent = 'Ver essa casa em 3D';
    hintEl.append(' ', a);
  }
}
function msg(t, warn) { compMsg.textContent = t || ''; compMsg.classList.toggle('warn', !!warn); }

/* ---------- exemplo que se desenha sozinho ao abrir a página ---------- */
function clearTimers() { exTimers.forEach(clearTimeout); exTimers = []; }
function runExample() {
  if (mode !== 'idle') return;
  mode = 'example';
  if (REDUCED) {
    const r = parse(EXEMPLO.texto);
    spoken = heard(r);
    apply();
    showSub('Exemplo', EXEMPLO.texto, r.hits);
    exTimers.push(setTimeout(() => { if (mode === 'example') msg('Este é um exemplo. Agora conte como a sua empresa funciona: fale, escreva ou toque nas opções.'); }, 400));
    return;
  }
  showSub('Exemplo', '', []);
  exCancel = typeOut(EXEMPLO.texto, (part, done) => {
    if (mode !== 'example') return;
    const r = parse(part);
    spoken = heard(r);
    apply();
    showSub('Exemplo', part, r.hits);
    if (done) {
      exTimers.push(setTimeout(() => { if (mode === 'example') { plan.set3D(true, { orbit: true }); b3d.setAttribute('aria-pressed', 'true'); label3d(); } }, 1500));
      exTimers.push(setTimeout(() => { if (mode === 'example') { plan.set3D(false); b3d.setAttribute('aria-pressed', 'false'); label3d(); hideSub(); } }, 8200));
      exTimers.push(setTimeout(() => { if (mode === 'example') msg('Este foi um exemplo. Agora conte como a sua empresa funciona: fale, escreva ou toque nas opções.'); }, 9000));
    }
  }, { cps: 24 });
}
/* o visitante começou: o exemplo some e a folha fica em branco */
function stopExample() {
  if (mode !== 'example') return;
  if (exCancel) exCancel();
  exCancel = null;
  clearTimers();
  mode = 'idle';
  spoken = { ramo: null, dores: [], equipe: null, obra: null };
  plan.stopOrbit();
  if (plan.d3.on) { plan.set3D(false); b3d.setAttribute('aria-pressed', 'false'); label3d(); }
  hideSub();
  msg('');
  apply();
}
/* o visitante começou a responder: sai do exemplo; tocar nas opções não interrompe a voz ou o texto */
function begin(newMode) {
  const was = mode;
  stopExample();
  mode = newMode || (was === 'example' || was === 'idle' ? 'tap' : was);
}

/* ---------- voz ---------- */
const voice = new Voice({
  onText(text) {
    const r = parse(text);
    spoken = heard(r);
    apply();
    showSub('Você', text, r.hits, true);
    hint(r);
  },
  onState(on) {
    micBtn.setAttribute('aria-pressed', String(on));
    micBtn.querySelector('span').textContent = on ? 'Ouvindo' : 'Falar';
    subStop.hidden = !on;
    if (on) { showSub('Você', '', [], true); msg('Fale como se estivesse explicando para um amigo: o ramo, quantas pessoas trabalham e o que mais atrapalha.'); }
    else {
      sub.classList.remove('rec');
      hideSub(2200);
      nextStep();
    }
  },
  onEnd() {},
  onError(code) {
    const M = {
      'not-allowed': 'O navegador não liberou o microfone. Você pode escrever ou tocar nas opções.',
      'service-not-allowed': 'O navegador não liberou o reconhecimento de voz. Você pode escrever ou tocar nas opções.',
      'no-speech': 'Não ouvi nada. Tente de novo mais perto do microfone, ou escreva.',
      network: 'O reconhecimento de voz precisa de internet. Você pode escrever ou tocar nas opções.',
      'audio-capture': 'Nenhum microfone encontrado. Você pode escrever ou tocar nas opções.',
      unsupported: 'Este navegador não reconhece voz. Você pode escrever ou tocar nas opções.'
    };
    msg(M[code] || 'Não deu para ouvir agora. Você pode escrever ou tocar nas opções.', true);
  }
});
if (!SR) {
  micBtn.hidden = true;
  writeBtn.classList.replace('btn-ghost', 'btn-pri');
}
micBtn.addEventListener('click', () => {
  if (voice.on) { voice.stop(); return; }
  begin('voice');
  setWrite(false);
  voice.start();
  if (narrow()) scrollToTarget(sheet, 8);
});
subStop.addEventListener('click', () => voice.stop());

/* ---------- texto ---------- */
function setWrite(open) {
  compW.hidden = !open;
  writeBtn.setAttribute('aria-expanded', String(open));
}
writeBtn.addEventListener('click', () => {
  const open = compW.hidden;
  if (open) { begin('text'); if (voice.on) voice.stop(); }
  setWrite(open);
  if (open) { txt.focus(); msg(''); }
});
let txtT = 0;
function readText(final) {
  const v = txt.value.trim();
  const r = parse(v);
  spoken = heard(r);
  apply();
  hint(r, !v);
  if (v) { showSub('Você', v, r.hits); hideSub(final ? 2600 : 4200); } else hideSub();
  if (final) {
    if (!r.ramo && !r.dores.length && r.equipe === null && !r.obra) msg('Não reconheci o ramo nem o que trava. Tente contar com outras palavras ou toque nas opções.', true);
    else msg('');
    nextStep();
    if (narrow()) scrollToTarget(sheet, 8);
  }
}
txt.addEventListener('input', () => { begin('text'); clearTimeout(txtT); txtT = setTimeout(() => readText(false), 160); });
txt.addEventListener('keydown', (e) => { if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) { e.preventDefault(); readText(true); } });
txtGo.addEventListener('click', () => readText(true));

/* ---------- perguntas: abas e opções ---------- */
let qCur = 0;
function setTab(i, focus) {
  qCur = i;
  qTabs.forEach((t, k) => { t.setAttribute('aria-selected', String(k === i)); t.tabIndex = k === i ? 0 : -1; });
  qPanes.forEach((p, k) => { p.hidden = k !== i; });
  if (focus) qTabs[i].focus();
}
qTabs.forEach((t, i) => {
  t.addEventListener('click', () => setTab(i));
  t.addEventListener('keydown', (e) => {
    const d = { ArrowRight: 1, ArrowLeft: -1 }[e.key];
    if (!d) return;
    e.preventDefault();
    setTab((i + d + 3) % 3, true);
  });
});
function nextStep() {
  const st = effective();
  if (!st.ramo) setTab(0);
  else if (!st.dores.length) setTab(1);
  else if (st.equipe === null) setTab(2);
}
function startTap() {
  begin('tap');
  if (narrow()) scrollToTarget(q('#qs'), 8);
  else scrollToTarget(q('#planta'), 200);
  nextStep();
  const pane = qPanes[qCur];
  const first = pane.querySelector('[aria-checked=true], [role=radio], button');
  if (first) setTimeout(() => first.focus({ preventScroll: true }), REDUCED ? 0 : 500);
}
/* grupos de escolha única: setas mudam a opção */
function rovingFix(btns) {
  const sel = btns.find((b) => b.getAttribute('aria-checked') === 'true') || btns[0];
  btns.forEach((b) => { b.tabIndex = b === sel ? 0 : -1; });
}
function radios(btns, onPick) {
  btns.forEach((b, k) => {
    b.addEventListener('click', () => onPick(b, k));
    b.addEventListener('keydown', (e) => {
      const d = { ArrowRight: 1, ArrowDown: 1, ArrowLeft: -1, ArrowUp: -1 }[e.key];
      if (!d) return;
      e.preventDefault();
      const n = (k + d + btns.length) % btns.length;
      btns[n].focus();
      onPick(btns[n], n, true);
    });
  });
}
let advT = 0;
radios(cRamo, (b, k, kb) => {
  begin();
  manual.ramo = b.dataset.v;
  apply();
  clearTimeout(advT);
  if (!kb) advT = setTimeout(() => { if (!effective().dores.length) setTab(1); }, REDUCED ? 0 : 420);
});
cDor.forEach((b) => b.addEventListener('click', () => {
  begin();
  const k = b.dataset.v;
  const on = effective().dores.includes(k);
  if (on) { manual.on.delete(k); if (spoken.dores.includes(k)) manual.off.add(k); }
  else { manual.off.delete(k); manual.on.add(k); }
  apply();
}));
q('.q-next').addEventListener('click', () => setTab(2, true));
radios(cEq, (b) => {
  begin();
  manual.equipe = +b.dataset.v;
  apply();
});
let nomeT = 0;
nomeIn.addEventListener('input', () => { begin(); clearTimeout(nomeT); nomeT = setTimeout(() => { manual.nome = nomeIn.value.trim(); apply(); }, 250); });

/* ---------- barra: 3D, WhatsApp, PDF e link ---------- */
function label3d() { b3d.querySelector('span').textContent = plan.d3.on ? 'Voltar para a planta' : 'Levantar em 3D'; }
b3d.addEventListener('click', () => {
  if (mode === 'example') { plan.stopOrbit(); clearTimers(); hideSub(); }
  const on = !plan.d3.on;
  plan.set3D(on);
  b3d.setAttribute('aria-pressed', String(on));
  sheet.tabIndex = on ? 0 : -1;
  label3d();
});
bpdf.addEventListener('click', () => { if (mode === 'example') { clearTimers(); plan.stopOrbit(); } window.print(); });
let titleBefore = D.title;
addEventListener('beforeprint', () => {
  titleBefore = D.title;
  const st = effective();
  D.title = 'Planta do sistema' + (st.nome ? ', ' + st.nome : '') + ', Konan Tech';
  plan.forceOrient = 'land';
  if (plan.d3.on || plan.d3.rise > 0) { plan.set3D(false, { instant: true }); b3d.setAttribute('aria-pressed', 'false'); label3d(); }
  plan.relayout(true);
});
addEventListener('afterprint', () => { D.title = titleBefore; plan.forceOrient = null; plan.relayout(true); });
if (IS_FILE) blink.hidden = true;
blink.addEventListener('click', async () => {
  const url = shareUrl(effective());
  let ok = false;
  try { await navigator.clipboard.writeText(url); ok = true; } catch (e) {
    const t = D.createElement('textarea');
    t.value = url; t.setAttribute('readonly', ''); t.style.position = 'fixed'; t.style.opacity = '0';
    D.body.append(t); t.select();
    try { ok = D.execCommand('copy'); } catch (err) { ok = false; }
    t.remove();
  }
  const s = blink.querySelector('span');
  s.textContent = ok ? 'Link copiado' : 'Não deu para copiar';
  blink.classList.toggle('ok', ok);
  setTimeout(() => { s.textContent = 'Copiar link'; blink.classList.remove('ok'); }, 2400);
});

/* bolinhas de dados só correm com a planta na tela */
const deskIO = new IntersectionObserver((ents) => ents.forEach((e) => plan.pause(!e.isIntersecting)), { threshold: 0 });
deskIO.observe(sheet);

/* ============================================================
   DETALHES
   ============================================================ */
const detTabs = qa('.det-tabs [role=tab]');
let detCur = 'ia', detUser = false;
function openDetail(k, scroll, quiet) {
  if (!detTabs.some((b) => b.dataset.d === k)) return;
  if (scroll) detUser = true;
  detCur = k;
  detTabs.forEach((b) => { const on = b.dataset.d === k; b.setAttribute('aria-selected', String(on)); b.tabIndex = on ? 0 : -1; });
  qa('.det-p').forEach((p) => { p.hidden = p.id !== 'detalhe-' + k; });
  if (!quiet || detNear) loadDetail(k);
  if (scroll) scrollToTarget(q('#detalhes'), 10);
}
detTabs.forEach((b, i) => {
  b.addEventListener('click', () => { detUser = true; openDetail(b.dataset.d); });
  b.addEventListener('keydown', (e) => {
    const d = { ArrowRight: 1, ArrowLeft: -1 }[e.key];
    if (!d) return;
    e.preventDefault();
    const n = detTabs[(i + d + detTabs.length) % detTabs.length];
    detUser = true;
    openDetail(n.dataset.d);
    n.focus();
  });
});
const DET_DEMO = { ia: 'ia', auto: 'auto', painel: 'painel', app: 'app' };
function loadDetail(k) { if (DET_DEMO[k]) loadDemo(DET_DEMO[k]); }
let detNear = false;

/* ---------- perguntas frequentes ---------- */
qa('.fq').forEach((f) => {
  const b = q('.fq-q', f);
  b.addEventListener('click', () => { const open = !f.classList.contains('open'); f.classList.toggle('open', open); b.setAttribute('aria-expanded', String(open)); });
});

/* ---------- botão flutuante do WhatsApp ---------- */
let fabT = 0;
addEventListener('scroll', () => { if (!fabT) fabT = requestAnimationFrame(() => { fabT = 0; H.classList.toggle('fab-on', scrollY > innerHeight * 0.75); }); }, { passive: true });
const fabSeen = new Set();
const fabIO = new IntersectionObserver((ents) => { ents.forEach((e) => { if (e.isIntersecting) fabSeen.add(e.target); else fabSeen.delete(e.target); }); H.classList.toggle('fab-hide', fabSeen.size > 0); }, { threshold: 0.2 });
qa('.bar, .fin-msg .cta, .cv-ask, .ft-block').forEach((el) => fabIO.observe(el));

/* ============================================================
   DEMONSTRAÇÕES E FINAL (carregam quando se aproximam)
   ============================================================ */
const ctx = {
  reduced: REDUCED, fine: FINE, setWa, waLink, waContext,
  stage: () => null, chapter: () => null,
  lenis: () => lenis,
  scrollTo: (el) => scrollToTarget(el),
  plan,
  ramo: () => { const st = effective(); return st.example ? null : st.ramo; },
  autoRamo: () => { const st = effective(); return st.ramo && !st.example ? RAMOS[st.ramo].auto : 0; },
  finalState: () => { const st = effective(); const Dv = derive(st); if (Dv.any && !st.example) return st; const r = parse(EXEMPLO.texto); return { ramo: r.ramo, dores: r.dores, equipe: r.equipe, nome: '', example: true }; },
  getStage
};
const LOADERS = {
  ia: [() => import('./demos/ai.js'), (m) => m.initAI(q('#detalhe-ia'), ctx)],
  auto: [() => import('./demos/auto.js'), (m) => m.initAuto(q('#detalhe-auto'), ctx)],
  painel: [() => import('./demos/dash.js'), (m) => m.initDash(q('#detalhe-painel'), ctx)],
  app: [() => import('./demos/team.js'), (m) => m.initTeam(q('#detalhe-app'), ctx)],
  boards: [() => import('./demos/boards.js'), (m) => m.initBoards(q('#projetos'), ctx)],
  fin: [() => import('./demos/liftoff.js'), (m) => m.initLiftoff(q('#fim'), ctx)]
};
const loading = {};
function loadDemo(name) {
  if (!loading[name]) {
    const [imp, init] = LOADERS[name];
    loading[name] = imp().then((m) => {
      demos[name] = init(m) || {};
      const st = effective();
      const Dv = derive(st);
      if (name === 'boards' && demos.boards.rank) demos.boards.rank(st, Dv);
      return demos[name];
    }).catch((err) => { console.warn('demo', name, err); demos[name] = {}; return demos[name]; });
  }
  return loading[name];
}
const lzIO = new IntersectionObserver((ents) => ents.forEach((e) => {
  if (!e.isIntersecting) return;
  const id = e.target.id;
  if (id === 'detalhes') { detNear = true; loadDetail(detCur); }
  if (id === 'projetos') loadDemo('boards');
  if (id === 'fim') loadDemo('fin');
  lzIO.unobserve(e.target);
}), { rootMargin: '120% 0px 120% 0px' });
['detalhes', 'projetos', 'fim'].forEach((id) => lzIO.observe(D.getElementById(id)));
if (/^#projeto-/.test(location.hash)) loadDemo('boards');

/* ---------- palco de partículas (só para o final) ---------- */
function getStage() {
  if (stagePromise) return stagePromise;
  stagePromise = (async () => {
    const gl = probeGL();
    if (!gl.ok) { H.classList.add('no-gl'); return null; }
    const tier = pickTier(gl);
    H.classList.add('tier-' + tier);
    try {
      const { Stage } = await import('./stage.js');
      stage = new Stage(q('#stage'), { count: TIERS[tier].count, dpr: TIERS[tier].dpr, tier, reduced: REDUCED });
      await stage.init('assets/konan-logo.png');
      D.addEventListener('visibilitychange', () => { if (D.hidden && stage) stage.stop(); });
      return stage;
    } catch (err) {
      console.warn('palco 3D indisponível', err);
      stage = null;
      H.classList.add('no-gl');
      return null;
    }
  })();
  return stagePromise;
}

/* ---------- tamanho da tela ---------- */
let rzT = 0, lastW = innerWidth;
addEventListener('resize', () => {
  clearTimeout(rzT);
  rzT = setTimeout(() => {
    if (innerWidth !== lastW || plan.d3.on) plan.relayout();
    lastW = innerWidth;
    if (stage && H.classList.contains('fin-live')) stage.resize();
  }, 140);
});

/* ---------- começo: planta por link, ou o exemplo ---------- */
/* a planta mede os textos com a fonte: quando ela termina de carregar, a folha é refeita */
const fontsReady = D.fonts && D.fonts.status !== 'loaded' ? D.fonts.ready : Promise.resolve();
const fontsOrTimeout = Promise.race([fontsReady, new Promise((r) => setTimeout(r, 2500))]);
const hashPlan = /^#planta=(.+)$/.exec(location.hash);
if (hashPlan) {
  const st = decodeState(hashPlan[1]);
  mode = 'tap';
  manual.ramo = st.ramo;
  manual.equipe = st.equipe;
  st.dores.forEach((k) => manual.on.add(k));
  manual.nome = st.nome;
  manual.obra = st.obra;
  nomeIn.value = st.nome;
  apply();
  msg('Esta planta chegou por link. Você pode ajustar as respostas e mandar de volta pelo WhatsApp.');
  nextStep();
  fontsOrTimeout.then(() => plan.relayout(true));
} else {
  apply();
  /* o exemplo espera a fonte carregar, para a planta medir os textos com a letra certa */
  fontsOrTimeout.then(() => {
    plan.relayout(true);
    setTimeout(() => { if (scrollY < innerHeight * 0.6 && !D.hidden) runExample(); }, REDUCED ? 200 : 700);
  });
}
setTimeout(() => loadDemo('boards'), 1400);

window.konan = { plan, lenis: () => lenis, demos, loadDemo, state: effective, manual, runExample, stopExample, openDetail, getStage, mode: () => mode };
window.__ktReady = true;
