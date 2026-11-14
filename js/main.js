/* Konan Tech: lógica do site (sem bibliotecas externas).
   Seções deste arquivo:
   1. Configurações e textos que mudam com frequência (logo abaixo)
   2. Classe Konan: estado da página, partículas WebGL (makeField, buildScene) e animações de rolagem
   Para trocar a cor de destaque, altere ACCENT. Para trocar textos de soluções, perguntas frequentes
   ou desafios do contato, altere SOL, FAQ e CH. */
(function () {
'use strict';

const ACCENT = '#3EA6FF';
const WA_BASE = 'https://wa.me/5561982270780?text=';

const SOL = [
  { t: 'Inteligência artificial', d: 'Lê documentos, extrai dados de notas fiscais, classifica lançamentos e responde perguntas sobre as informações da empresa.', ben: 'Menos digitação manual e menos erro nos lançamentos.', tags: ['Leitura de documentos', 'Classificação automática', 'Assistentes inteligentes'], cap: 'Documentos entram, informação organizada sai' },
  { t: 'Automação de processos', d: 'Conecta as ferramentas que a empresa já usa e executa sozinha as tarefas repetidas: avisos, atualizações, relatórios e cobranças.', ben: 'A equipe para de copiar e colar e cuida do que importa.', tags: ['Integrações', 'Rotinas automáticas', 'Mensagens automáticas'], cap: 'Uma nova ordem de serviço dispara o fluxo inteiro' },
  { t: 'Sistemas personalizados', d: 'Plataformas web e aplicativos feitos sob medida para o jeito que a sua empresa trabalha, no escritório ou no campo.', ben: 'A operação inteira em um só lugar, no computador ou no celular.', tags: ['Gestão operacional', 'Controle financeiro', 'Aplicativos de campo'], cap: 'Um sistema se montando a partir do seu processo' },
  { t: 'Dashboards e gestão', d: 'Painéis de indicadores atualizados automaticamente a partir dos dados que a empresa já gera.', ben: 'Decisões tomadas com números, não com achismo.', tags: ['Indicadores', 'Relatórios', 'Acompanhamento em tempo real'], cap: 'Dados soltos viram indicadores' },
  { t: 'Sites e experiências digitais', d: 'Sites institucionais e comerciais que apresentam a empresa com clareza e levam o visitante até a conversa.', ben: 'Mais credibilidade e mais pedidos de orçamento.', tags: ['Sites institucionais', 'Páginas comerciais', 'Identidade digital'], cap: 'Interfaces modernas, prontas para qualquer tela' }
];

const FAQ = [
  ['Preciso saber exatamente o que quero antes de chamar?', 'Não. Basta contar como funciona hoje e o que incomoda. Transformar o problema em solução é o nosso trabalho.'],
  ['A Konan Tech atende empresas pequenas?', 'Sim. Atendemos principalmente pequenas e médias empresas, com soluções do tamanho da necessidade e sem funcionalidades que ninguém vai usar.'],
  ['Quanto custa um sistema personalizado?', 'Depende do escopo. Depois da conversa inicial você recebe uma proposta com valor e etapas definidos antes de qualquer desenvolvimento começar.'],
  ['Posso continuar usando minhas planilhas?', 'Pode. Vários dos nossos sistemas usam o Google Sheets como base, então a equipe continua vendo e conferindo os dados onde já está acostumada.'],
  ['Como a inteligência artificial entra nos projetos?', 'Quando faz sentido para a operação: leitura automática de notas fiscais, organização de documentos, resumos e assistentes que respondem dúvidas sobre os dados da empresa.'],
  ['O que acontece depois que o sistema fica pronto?', 'Oferecemos acompanhamento mensal com suporte, ajustes e melhorias contínuas. O sistema evolui junto com a empresa.'],
  ['Vocês atendem fora de Brasília?', 'Sim. O trabalho é feito online, com reuniões por vídeo, para empresas de todo o Brasil.']
];

const CH = [
  ['Minha operação vive em planilhas', 'minha operação vive em planilhas e eu quero organizar tudo em um sistema.'],
  ['Perco tempo com tarefas repetidas', 'minha equipe perde tempo com tarefas repetidas que poderiam ser automáticas.'],
  ['Quero usar inteligência artificial', 'quero entender como usar inteligência artificial na minha empresa.'],
  ['Preciso de um site que traga clientes', 'preciso de um site profissional que traga novos clientes.'],
  ['Tenho outra ideia', 'tenho uma ideia de solução e quero entender como tirar do papel.']
];

const esc = (t) => String(t).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
const CHECK = '<svg class="ic" viewBox="0 0 24 24" aria-hidden="true"><path d="M5 12.5l4.5 4.5L19 7.5"></path></svg>';
const PLUS = '<path d="M12 5v14 M5 12h14"></path>';

class Konan {
  constructor() {
    this.props = { accent: ACCENT };
    this.state = { menu: false, active: '', sol: 0, faq: 0, chal: 0, scene: 0, capHide: false, fab: false };
    this._t = [];
    this._obs = [];
    this._offs = [];
    this._fields = [];
    this._dead = false;
  }

  setState(o) {
    Object.assign(this.state, o);
    this.render();
  }

  on(el, ev, fn) {
    if (!el) return;
    el.addEventListener(ev, fn);
    this._offs.push(() => el.removeEventListener(ev, fn));
  }

  initUI() {
    const $ = (id) => document.getElementById(id);
    const HD = this.heroDef();
    $('hud-bar').innerHTML = HD.map((h) => '<span class="seg"><i style="animation-duration: ' + h[2] + 's"></i></span>').join('');
    $('so-list').innerHTML = SOL.map((x, i) => '<div class="so" data-i="' + i + '">' +
      '<button type="button" class="so-h" aria-expanded="false"><span class="so-n">0' + (i + 1) + '</span><span class="so-t">' + esc(x.t) + '</span><svg class="ic so-x" viewBox="0 0 24 24" aria-hidden="true">' + PLUS + '</svg></button>' +
      '<div class="so-b"><div class="so-bi"><p class="so-d">' + esc(x.d) + '</p><p class="so-r">' + CHECK + '<span>' + esc(x.ben) + '</span></p>' +
      '<p class="so-tags">' + x.tags.map((g) => '<span class="tg">' + esc(g) + '</span>').join('') + '</p></div></div></div>').join('');
    $('faq-list').innerHTML = FAQ.map((f, i) => '<div class="fq" data-i="' + i + '">' +
      '<button type="button" class="fq-q" aria-expanded="false"><span>' + esc(f[0]) + '</span><span class="fq-i"><svg class="ic" viewBox="0 0 24 24" aria-hidden="true">' + PLUS + '</svg></span></button>' +
      '<div class="fq-a"><div class="fq-ai"><p>' + esc(f[1]) + '</p></div></div></div>').join('');
    $('chals').innerHTML = CH.map((c, i) => '<button type="button" class="chal" aria-pressed="false" data-i="' + i + '">' + esc(c[0]) + '</button>').join('');

    this.on($('burger'), 'click', () => this.setState({ menu: !this.state.menu }));
    document.querySelectorAll('[data-close-menu]').forEach((el) => this.on(el, 'click', () => { if (this.state.menu) this.setState({ menu: false }); }));
    this.on(document, 'keydown', (e) => { if (e.key === 'Escape' && this.state.menu) this.setState({ menu: false }); });
    this.on($('so-list'), 'click', (e) => {
      const h = e.target.closest ? e.target.closest('.so-h') : null;
      if (h) this.setState({ sol: parseInt(h.parentNode.getAttribute('data-i'), 10) });
    });
    this.on($('faq-list'), 'click', (e) => {
      const q = e.target.closest ? e.target.closest('.fq-q') : null;
      if (!q) return;
      const i = parseInt(q.parentNode.getAttribute('data-i'), 10);
      this.setState({ faq: this.state.faq === i ? -1 : i });
    });
    this.on($('chals'), 'click', (e) => {
      const b = e.target.closest ? e.target.closest('.chal') : null;
      if (b) this.setState({ chal: parseInt(b.getAttribute('data-i'), 10) });
    });
    const rng = $('rng');
    const after = document.querySelector('[data-k="after"]');
    const divi = document.querySelector('[data-k="divider"]');
    this.on(rng, 'input', () => {
      this._touched = true;
      const v = parseFloat(rng.value);
      const val = isNaN(v) ? 50 : v;
      if (after) after.style.clipPath = 'inset(0 0 0 ' + val + '%)';
      if (divi) divi.style.left = val + '%';
    });
    this.render();
  }

  render() {
    const s = this.state;
    const $ = (id) => document.getElementById(id);
    document.querySelectorAll('[data-nl]').forEach((a) => { a.className = a.getAttribute('data-nl') === s.active ? 'nl on' : 'nl'; });
    const burger = $('burger');
    burger.className = s.menu ? 'burger x' : 'burger';
    burger.setAttribute('aria-label', s.menu ? 'Fechar menu' : 'Abrir menu');
    burger.setAttribute('aria-expanded', s.menu ? 'true' : 'false');
    $('mm').className = s.menu ? 'mm open' : 'mm';

    const HD = this.heroDef();
    const sc = HD[s.scene] ? s.scene : 0;
    $('hud-n').textContent = '0' + (sc + 1);
    const cap = $('cap');
    cap.textContent = HD[sc][1];
    cap.className = s.capHide ? 'cap hide' : 'cap';
    document.querySelectorAll('#hud-bar .seg').forEach((el, i) => { el.className = i < sc ? 'seg done' : (i === sc ? 'seg on' : 'seg'); });

    const sol = SOL[s.sol] ? s.sol : 0;
    document.querySelectorAll('#so-list .so').forEach((el, i) => {
      const on = i === sol;
      el.className = on ? 'so on' : 'so';
      el.querySelector('.so-h').setAttribute('aria-expanded', on ? 'true' : 'false');
    });
    $('holo-cap').textContent = SOL[sol].cap;
    document.querySelectorAll('.holo [data-v]').forEach((el) => { el.hidden = parseInt(el.getAttribute('data-v'), 10) !== sol; });

    document.querySelectorAll('#faq-list .fq').forEach((el, i) => {
      const on = i === s.faq;
      el.className = on ? 'fq open' : 'fq';
      el.querySelector('.fq-q').setAttribute('aria-expanded', on ? 'true' : 'false');
    });

    const chal = CH[s.chal] ? s.chal : 0;
    document.querySelectorAll('#chals .chal').forEach((el, i) => {
      el.className = i === chal ? 'chal on' : 'chal';
      el.setAttribute('aria-pressed', i === chal ? 'true' : 'false');
    });
    const msg = 'Olá, vim pelo site da Konan Tech. Meu desafio: ' + CH[chal][1];
    $('bub-msg').textContent = msg;
    $('wa-link').href = WA_BASE + encodeURIComponent(msg);

    $('fab').className = s.fab ? 'fab show' : 'fab';
  }

  reduced() {
    try { return !!(window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches); } catch (e) { return false; }
  }

  heroDef() {
    return [['logo', 'Konan Tech', 5.6], ['network', 'Conectando dados', 6.5], ['brain', 'Aprendendo padrões', 6.5], ['streams', 'Organizando informações', 7], ['dash', 'Gerando indicadores', 7], ['city', 'Construindo estruturas', 7]];
  }

  mount() {
    this._dead = false;
    this.applyAccent();
    this.initUI();
    this.waitFor(() => document.querySelector('[data-k="hero"]'), (cv) => this.initHero(cv));
    this.waitFor(() => document.querySelector('[data-k="ctacv"]'), (cv) => this.initCta(cv));
    this.waitFor(() => { const l = document.querySelectorAll('[data-rv]'); return l.length ? l : null; }, (els) => this.initReveal(els));
    this.waitFor(() => document.querySelector('[data-k="tl"]'), (el) => this.initTagline(el));
    this.waitFor(() => document.querySelector('[data-k="cmp"]'), (el) => this.initCompare(el));
    this.waitFor(() => document.querySelector('[data-k="stats"]'), (el) => this.initStats(el));
    this.waitFor(() => { const l = document.querySelectorAll('[data-sec]'); return l.length ? l : null; }, (els) => this.initNav(els));
    this.waitFor(() => document.querySelector('.k'), (el) => this.initPointer(el));
  }

  componentWillUnmount() {
    this._dead = true;
    this._t.forEach((id) => clearTimeout(id));
    this._obs.forEach((o) => { try { o.disconnect(); } catch (e) {} });
    this._offs.forEach((f) => { try { f(); } catch (e) {} });
    this._fields.forEach((f) => { try { f.stop(); } catch (e) {} });
  }

  applyAccent() {
    const a = this.props.accent || '#3EA6FF';
    this._accent = a;
    try { document.documentElement.style.setProperty('--ac', a); } catch (e) {}
    this._fields.forEach((f) => { try { f.tint(a); } catch (e) {} });
  }

  waitFor(get, cb, n) {
    n = n || 0;
    let r = null;
    try { r = get(); } catch (e) { r = null; }
    if (r) { cb(r); return; }
    if (n > 80 || this._dead) return;
    this._t.push(setTimeout(() => this.waitFor(get, cb, n + 1), 60));
  }

  observe(els, opts, fn) {
    if (typeof IntersectionObserver === 'undefined') {
      els.forEach((el) => fn({ target: el, isIntersecting: true, intersectionRatio: 1, intersectionRect: { height: 9999 } }, null));
      return null;
    }
    const io = new IntersectionObserver((ents) => ents.forEach((en) => fn(en, io)), opts);
    els.forEach((el) => io.observe(el));
    this._obs.push(io);
    return io;
  }

  tween(ms, fn, done) {
    const t0 = performance.now();
    const step = (now) => {
      if (this._dead) return;
      const p = Math.min(1, (now - t0) / ms);
      fn(p);
      if (p < 1) requestAnimationFrame(step);
      else if (done) done();
    };
    requestAnimationFrame(step);
  }

  setCap(i) {
    if (this._dead) return;
    this.setState({ capHide: true });
    this._t.push(setTimeout(() => { if (!this._dead) this.setState({ scene: i, capHide: false }); }, 360));
  }

  initReveal(els) {
    const list = Array.prototype.slice.call(els);
    this.observe(list, { threshold: 0.12 }, (en, io) => {
      if (en.isIntersecting) {
        en.target.classList.add('in');
        if (io) io.unobserve(en.target);
      }
    });
  }

  initTagline(el) {
    const words = Array.prototype.slice.call(el.querySelectorAll('.w'));
    if (!words.length) return;
    if (this.reduced()) { words.forEach((w) => w.classList.add('on')); return; }
    let done = false;
    this.observe([el], { threshold: [0, 0.35, 0.6] }, (en) => {
      if (done || !en.isIntersecting || en.intersectionRatio < 0.35) return;
      done = true;
      words.forEach((w, i) => this._t.push(setTimeout(() => w.classList.add('on'), 120 + i * 90)));
    });
  }

  initCompare(el) {
    const after = el.querySelector('[data-k="after"]');
    const divi = el.querySelector('[data-k="divider"]');
    if (!after || !divi) return;
    let done = false;
    this.observe([el], { threshold: [0, 0.55] }, (en) => {
      if (done || !en.isIntersecting || en.intersectionRatio < 0.55) return;
      done = true;
      if (this._touched || this.reduced()) return;
      const keys = [[0, 50], [0.34, 24], [0.72, 74], [1, 50]];
      const ease = (x) => (x < 0.5 ? 4 * x * x * x : 1 - Math.pow(-2 * x + 2, 3) / 2);
      this._t.push(setTimeout(() => {
        this.tween(2400, (p) => {
          if (this._touched) return;
          let a = keys[0];
          let b = keys[1];
          for (let i = 0; i < keys.length - 1; i++) {
            if (p >= keys[i][0] && p <= keys[i + 1][0]) { a = keys[i]; b = keys[i + 1]; break; }
          }
          const v = a[1] + (b[1] - a[1]) * ease((p - a[0]) / (b[0] - a[0]));
          after.style.clipPath = 'inset(0 0 0 ' + v.toFixed(2) + '%)';
          divi.style.left = v.toFixed(2) + '%';
        });
      }, 300));
    });
  }

  initStats(el) {
    const nums = Array.prototype.slice.call(el.querySelectorAll('[data-cnt]'));
    if (!nums.length || this.reduced()) return;
    let done = false;
    let prep = false;
    const paint = (p) => nums.forEach((n) => {
      const to = parseFloat(n.getAttribute('data-cnt')) || 0;
      n.textContent = (n.getAttribute('data-pre') || '') + Math.round(to * p);
    });
    this.observe([el], { threshold: [0, 0.3] }, (en) => {
      if (done) return;
      if (!en.isIntersecting) { if (!prep) { prep = true; paint(0); } return; }
      if (en.intersectionRatio < 0.3) return;
      done = true;
      this.tween(1600, (p) => paint(1 - Math.pow(1 - p, 3)));
    });
  }

  initNav(els) {
    const list = Array.prototype.slice.call(els);
    const vis = {};
    const th = [];
    for (let i = 0; i <= 20; i++) th.push(i / 20);
    this.observe(list, { threshold: th }, (en) => {
      const id = en.target.getAttribute('data-sec');
      vis[id] = en.isIntersecting && en.intersectionRect ? en.intersectionRect.height : 0;
      let best = '';
      let bv = 80;
      Object.keys(vis).forEach((key) => { if (vis[key] > bv) { bv = vis[key]; best = key; } });
      if (best !== this.state.active) this.setState({ active: best });
    });
  }

  initPointer(root) {
    const reduce = this.reduced();
    let fine = true;
    try { fine = window.matchMedia('(hover: hover) and (pointer: fine)').matches; } catch (e) { fine = true; }
    let last = null;
    const reset = () => { if (last) { const i = last.querySelector('.tilt-in'); if (i) i.style.transform = ''; } last = null; };
    const mv = (e) => {
      const t = e.target;
      if (!t || !t.closest) return;
      const sp = t.closest('.spot');
      if (sp) {
        const r = sp.getBoundingClientRect();
        sp.style.setProperty('--mx', (e.clientX - r.left) + 'px');
        sp.style.setProperty('--my', (e.clientY - r.top) + 'px');
      }
      if (reduce || !fine) return;
      const tl = t.closest('.pj');
      if (tl !== last) reset();
      if (!tl) return;
      last = tl;
      const dev = tl.querySelector('.tilt');
      const inr = tl.querySelector('.tilt-in');
      if (!dev || !inr) return;
      const r = dev.getBoundingClientRect();
      const x = Math.max(-0.6, Math.min(0.6, (e.clientX - r.left) / r.width - 0.5));
      const y = Math.max(-0.6, Math.min(0.6, (e.clientY - r.top) / r.height - 0.5));
      inr.style.transform = 'rotateY(' + (x * 14).toFixed(2) + 'deg) rotateX(' + (-y * 10).toFixed(2) + 'deg)';
    };
    root.addEventListener('pointermove', mv);
    root.addEventListener('pointerleave', reset);
    this._offs.push(() => { root.removeEventListener('pointermove', mv); root.removeEventListener('pointerleave', reset); });
  }

  initHero(cv) {
    const HD = this.heroDef();
    const sec = cv.parentNode;
    this.makeField(cv, {
      scenes: HD.map((h) => h[0]),
      durs: HD.map((h) => h[2]),
      nD: 5200,
      nM: 2400,
      seed: 5,
      host: sec,
      onScene: (i) => { if (i !== this.state.scene) this.setCap(i); },
      layout: (W, H) => (W >= 1200
        ? { ox: W * 0.25, oy: H * 0.03, sc: Math.min(W * 0.44 / 2.6, H / 2.5), a: 1 }
        : { ox: 0, oy: H * 0.2, sc: Math.min(W * 0.9 / 2.6, H * 0.44 / 2.0), a: 0.9 })
    });
    this.observe([sec], { threshold: [0, 0.15] }, (en) => {
      const show = !(en.isIntersecting && en.intersectionRatio > 0.15);
      if (show !== this.state.fab) this.setState({ fab: show });
    });
  }

  initCta(cv) {
    this.makeField(cv, {
      scenes: ['network', 'logo'],
      durs: [7, 6],
      nD: 1800,
      nM: 900,
      seed: 9,
      host: cv.parentNode,
      layout: (W, H) => ({ ox: 0, oy: 0, sc: Math.min(W * 0.84 / 2.6, H / 2.3), a: 0.34 })
    });
  }

  rng(seed) {
    let a = (seed >>> 0) || 1;
    return () => {
      a = (a + 0x6D2B79F5) | 0;
      let t = Math.imul(a ^ (a >>> 15), 1 | a);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }

  palette(hex) {
    let h = String(hex || '#3EA6FF').replace('#', '');
    if (h.length === 3) h = h.split('').map((c) => c + c).join('');
    let n = parseInt(h, 16);
    if (isNaN(n)) n = 0x3EA6FF;
    const a = [((n >> 16) & 255) / 255, ((n >> 8) & 255) / 255, (n & 255) / 255];
    const mix = (t) => [a[0] + (1 - a[0]) * t, a[1] + (1 - a[1]) * t, a[2] + (1 - a[2]) * t];
    return [[0.6, 0.65, 0.72], [a[0] * 0.9, a[1] * 0.9, a[2] * 0.9], mix(0.42), mix(0.75), [0.16, 0.2, 0.27]];
  }

  logoData() {
    return window.KONAN_LOGO_POINTS || '';
  }

  logoPts() {
    if (this._lp) return this._lp;
    const s = this.logoData();
    const al = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/';
    const out = [];
    const asp = 0.1534;
    for (let i = 0; i + 3 < s.length; i += 4) {
      const qx = al.indexOf(s[i]) * 64 + al.indexOf(s[i + 1]);
      const qy = al.indexOf(s[i + 2]) * 64 + al.indexOf(s[i + 3]);
      out.push([qx / 4095 * 2 - 1, -((qy >> 1) / 2047 * 2 - 1) * asp, qy & 1]);
    }
    this._lp = out;
    return out;
  }

  buildScene(name, N, seed) {
    const r = this.rng(seed);
    const g = () => (r() + r() + r() - 1.5) / 1.5;
    const p = new Float32Array(N * 3);
    const ci = new Uint8Array(N);
    const sz = new Float32Array(N);
    const ord = new Uint32Array(N);
    for (let i = 0; i < N; i++) ord[i] = i;
    for (let i = N - 1; i > 0; i--) { const j = Math.floor(r() * (i + 1)); const t = ord[i]; ord[i] = ord[j]; ord[j] = t; }
    let k = 0;
    const put = (x, y, z, c, s) => { const i = ord[k++]; p[i * 3] = x; p[i * 3 + 1] = y; p[i * 3 + 2] = z; ci[i] = c; sz[i] = s; return i; };
    const sc = { p: p, ci: ci, sz: sz, dyn: null, lines: null, la: 0, spin: true, pitch: 0.12, zoom: 1, sway: 0, hub: 0.5, dur: 6.5, amb: 0.006 };
    const LN = [];
    const seg = (a, b) => { LN.push(a[0], a[1], a[2], b[0], b[1], b[2]); };

    if (name === 'logo') {
      const L = this.logoPts();
      const M = L.length;
      const W = 1.25;
      const dn = Math.floor(N * 0.07);
      const need = N - dn;
      let q = 0;
      while (k < need) {
        const idx = need <= M ? Math.floor(q * M / need) : q % M;
        const ex = need > M && q >= M;
        const a = L[idx];
        q++;
        const j = ex ? 0.014 : 0.004;
        put(a[0] * W + (r() - 0.5) * j, a[1] * W + (r() - 0.5) * j, (r() - 0.5) * (ex ? 0.08 : 0.04), a[2] ? 2 : 0, ex ? 3 + r() * 2 : 4.6 + r() * 2.4);
      }
      while (k < N) { const a = r() * 6.2832; const rd = 1.5 + r() * 1.3; put(Math.cos(a) * rd, (r() - 0.5) * 1.6, Math.sin(a) * rd * 0.5 - 0.5, 4, 3 + r() * 3); }
      Object.assign(sc, { spin: false, pitch: 0, zoom: 1, hub: 0.12, dur: 5.6, amb: 0.003 });
    } else if (name === 'network') {
      const X = [-1.1, -0.55, 0, 0.55, 1.1];
      const CNT = [5, 8, 11, 8, 5];
      const nodes = [];
      X.forEach((x, l) => { const m = CNT[l]; const R = 0.14 + m * 0.055; for (let j = 0; j < m; j++) { const a = 6.2832 * j / m + l * 0.5; nodes.push([x, Math.sin(a) * R, Math.cos(a) * R * 0.75, l]); } });
      const edges = [];
      for (let a = 0; a < nodes.length; a++) for (let b = 0; b < nodes.length; b++) if (nodes[b][3] === nodes[a][3] + 1) edges.push([a, b]);
      edges.forEach((e) => seg(nodes[e[0]], nodes[e[1]]));
      const per = Math.max(1, Math.floor(N * 0.26 / nodes.length));
      for (let n = 0; n < nodes.length && k < N; n++) for (let j = 0; j < per && k < N; j++) { const q = nodes[n]; put(q[0] + g() * 0.035, q[1] + g() * 0.035, q[2] + g() * 0.035, j % 3 === 0 ? 3 : 2, 5 + r() * 4); }
      const eOf = new Int32Array(N).fill(-1);
      const u0 = new Float32Array(N);
      const sp = new Float32Array(N);
      while (k < N) {
        const e = Math.floor(r() * edges.length);
        const u = r();
        const A = nodes[edges[e][0]];
        const B = nodes[edges[e][1]];
        const i = put(A[0] + (B[0] - A[0]) * u, A[1] + (B[1] - A[1]) * u, A[2] + (B[2] - A[2]) * u, r() < 0.35 ? 1 : 0, 3 + r() * 2.5);
        eOf[i] = e; u0[i] = u; sp[i] = 0.08 + r() * 0.14;
      }
      sc.dyn = (t, tg) => {
        for (let i = 0; i < N; i++) {
          const e = eOf[i];
          if (e < 0) continue;
          const A = nodes[edges[e][0]];
          const B = nodes[edges[e][1]];
          let u = u0[i] + t * sp[i];
          u -= Math.floor(u);
          tg[i * 3] = A[0] + (B[0] - A[0]) * u;
          tg[i * 3 + 1] = A[1] + (B[1] - A[1]) * u;
          tg[i * 3 + 2] = A[2] + (B[2] - A[2]) * u;
        }
      };
      Object.assign(sc, { la: 0.09, hub: 0.3, pitch: 0.1, zoom: 1.05 });
    } else if (name === 'brain') {
      while (k < N) {
        const q = r();
        if (q < 0.78) {
          const s = r() < 0.5 ? -1 : 1;
          const u = r() * 2 - 1;
          const th = r() * 6.2832;
          const sq = Math.sqrt(1 - u * u);
          const dx = sq * Math.cos(th);
          const dy = u;
          const dz = sq * Math.sin(th);
          const f = 1 + 0.08 * Math.sin(dz * 12 + Math.sin(dy * 6) * 2.2) * Math.cos(dy * 10 + dx * 6);
          let lx = dx * 0.44 * f;
          if (s * lx < -0.3) lx = -s * 0.3;
          let y = dy * 0.6 * f + 0.1;
          if (y < -0.28) y = -0.28 + (y + 0.28) * 0.3;
          put(s * 0.4 + lx, y, dz * 0.84 * f, r() < 0.6 ? 1 : (r() < 0.55 ? 2 : 0), 3.5 + r() * 3);
        } else if (q < 0.88) {
          const u = r() * 2 - 1;
          const th = r() * 6.2832;
          const sq = Math.sqrt(1 - u * u);
          const x = sq * Math.cos(th) * 0.5;
          put(x, -0.32 + u * 0.17 + Math.sin(x * 40) * 0.012, -0.62 + sq * Math.sin(th) * 0.26, r() < 0.5 ? 0 : 1, 3 + r() * 2);
        } else if (q < 0.92) {
          const t = r();
          put((r() - 0.5) * 0.12, -0.36 - t * 0.5, -0.32 - t * 0.12 + (r() - 0.5) * 0.1, 4, 3 + r() * 2);
        } else {
          put(g() * 0.55, g() * 0.38 + 0.1, g() * 0.65, 3, 7 + r() * 5);
        }
      }
      Object.assign(sc, { pitch: 0.18, zoom: 1.25, hub: 0.5 });
    } else if (name === 'streams') {
      const K = 9;
      const yIn = [];
      const zIn = [];
      const yOut = [];
      for (let s = 0; s < K; s++) { yIn.push(-1.0 + 2.0 * s / (K - 1) + (r() - 0.5) * 0.15); zIn.push((r() * 2 - 1) * 0.7); yOut.push(-0.6 + 1.2 * s / (K - 1)); }
      for (let s = 0; s < K; s++) seg([0.15, yOut[s], 0], [1.5, yOut[s], 0]);
      const coreN = Math.floor(N * 0.12);
      for (let j = 0; j < coreN; j++) { const u = r() * 2 - 1; const th = r() * 6.2832; const sq = Math.sqrt(1 - u * u); const rd = 0.17 * Math.cbrt(r()); put(sq * Math.cos(th) * rd, u * rd, sq * Math.sin(th) * rd, r() < 0.5 ? 3 : 2, 5 + r() * 4); }
      const sOf = new Int16Array(N).fill(-1);
      const u0 = new Float32Array(N);
      const jy = new Float32Array(N);
      const jz = new Float32Array(N);
      while (k < N) { const i = put(0, 0, 0, 0, 3 + r() * 2.5); sOf[i] = Math.floor(r() * K); u0[i] = r(); jy[i] = g() * 0.035; jz[i] = g() * 0.035; }
      const pos = (s, u, out, i) => {
        let y;
        let z;
        if (u < 0.5) {
          const a = u / 0.5;
          const w = 1 - a * a * (3 - 2 * a);
          y = yIn[s] * w + Math.sin(u * 14 + s) * 0.1 * w + jy[i] * (0.4 + w);
          z = zIn[s] * w + Math.cos(u * 11 + s * 2) * 0.1 * w + jz[i] * (0.4 + w);
        } else {
          const b = (u - 0.5) / 0.5;
          const e = b * b * (3 - 2 * b);
          y = yOut[s] * e + jy[i] * 0.25;
          z = jz[i] * 0.25;
        }
        out[i * 3] = -1.5 + 3.0 * u;
        out[i * 3 + 1] = y;
        out[i * 3 + 2] = z;
      };
      for (let i = 0; i < N; i++) if (sOf[i] >= 0) pos(sOf[i], u0[i], p, i);
      sc.dyn = (t, tg, cc) => {
        for (let i = 0; i < N; i++) {
          const s = sOf[i];
          if (s < 0) continue;
          let u = u0[i] + t * 0.075;
          u -= Math.floor(u);
          pos(s, u, tg, i);
          cc[i] = u < 0.46 ? (u < 0.2 ? 4 : 0) : (u < 0.56 ? 3 : 1);
        }
      };
      Object.assign(sc, { spin: false, sway: 0.35, pitch: 0.08, zoom: 0.9, la: 0.07, hub: 0.35 });
    } else if (name === 'dash') {
      const PN = [{ cx: 0, cy: 0.02, cz: 0.12, w: 1.3, h: 0.86, a: 0 }, { cx: -1.0, cy: 0, cz: -0.32, w: 0.64, h: 0.56, a: 0.55 }, { cx: 1.0, cy: 0, cz: -0.32, w: 0.64, h: 0.56, a: -0.55 }];
      const W3 = (pn, lx, ly) => [pn.cx + lx * Math.cos(pn.a), pn.cy + ly, pn.cz - lx * Math.sin(pn.a)];
      const P3 = (pn, lx, ly, c, s) => { const w = W3(pn, lx, ly); return put(w[0], w[1], w[2] + (r() - 0.5) * 0.01, c, s); };
      const peri = (pn) => { const w = pn.w; const h = pn.h; let t = r() * 2 * (w + h); if (t < w) return [-w / 2 + t, h / 2]; t -= w; if (t < h) return [w / 2, h / 2 - t]; t -= h; if (t < w) return [w / 2 - t, -h / 2]; t -= w; return [-w / 2, -h / 2 + t]; };
      const quota = [Math.floor(N * 0.5), Math.floor(N * 0.25)];
      quota.push(N - quota[0] - quota[1]);
      const HB = [0.16, 0.24, 0.2, 0.32, 0.28, 0.4, 0.36, 0.48, 0.44];
      PN.forEach((pn, pi) => {
        const end = k + quota[pi];
        const nO = Math.floor(quota[pi] * 0.22);
        for (let j = 0; j < nO; j++) { const q = peri(pn); P3(pn, q[0], q[1], 0, 3 + r() * 1.5); }
        const hw = pn.w / 2;
        const hh = pn.h / 2;
        const cs = [[-hw, hh], [hw, hh], [hw, -hh], [-hw, -hh]];
        for (let j = 0; j < 4; j++) seg(W3(pn, cs[j][0], cs[j][1]), W3(pn, cs[(j + 1) % 4][0], cs[(j + 1) % 4][1]));
        while (k < end) {
          const q = r();
          if (pi === 0) {
            if (q < 0.06) P3(pn, -0.56 + r() * 0.34, 0.33, 0, 3);
            else if (q < 0.26) { const b = Math.floor(r() * 3); P3(pn, -0.44 + b * 0.44 + (r() - 0.5) * 0.3, 0.17 + (r() - 0.5) * 0.09, b === 0 ? 2 : 0, 3 + r()); }
            else if (q < 0.64) { const b = Math.floor(r() * 9); P3(pn, -0.56 + b * 0.066 + (r() - 0.5) * 0.034, -0.36 + r() * HB[b], 1, 3 + r() * 1.5); }
            else { const u = r(); const x = 0.08 + u * 0.5; const cy = -0.3 + u * 0.4 + Math.sin(u * 9) * 0.05; if (r() < 0.62) P3(pn, x, cy + g() * 0.008, 2, 3.4 + r() * 1.5); else P3(pn, x, -0.36 + r() * (cy + 0.36), 4, 2.6 + r()); }
          } else if (pi === 1) {
            if (q < 0.55) { const a = r() * 6.2832; const rd = 0.14 + g() * 0.012; P3(pn, Math.cos(a) * rd, 0.07 + Math.sin(a) * rd, a < 4.2 ? 1 : 4, 3.2 + r()); }
            else { const l = Math.floor(r() * 3); P3(pn, -0.24 + r() * (0.48 - l * 0.1), -0.12 - l * 0.06, l === 0 ? 0 : 4, 2.6 + r()); }
          } else {
            if (q < 0.45) { const u = r(); P3(pn, -0.26 + u * 0.52, 0.06 + Math.sin(u * 7 + 1) * 0.07 + u * 0.06 + g() * 0.006, 2, 3.2 + r()); }
            else { const b = Math.floor(r() * 4); P3(pn, (b % 2 ? 0.13 : -0.13) + (r() - 0.5) * 0.2, (b < 2 ? -0.1 : -0.2) + (r() - 0.5) * 0.06, b === 0 ? 1 : 0, 2.8 + r()); }
          }
        }
      });
      Object.assign(sc, { spin: false, sway: 0.24, pitch: 0.06, zoom: 0.95, la: 0.16, hub: 0.2 });
    } else if (name === 'city') {
      const G = 6;
      const cs = 0.3;
      const off = -(G - 1) * cs / 2;
      const base = -0.6;
      const B = [];
      for (let gx = 0; gx < G; gx++) for (let gz = 0; gz < G; gz++) {
        if (r() < 0.2) continue;
        const x = off + gx * cs;
        const z = off + gz * cs;
        const dd = Math.sqrt(x * x + z * z);
        const h = 0.1 + (0.35 + r() * 0.65) * Math.max(0.12, 1.05 - dd * 0.75) * (r() < 0.12 ? 1.5 : 1);
        B.push([x, z, 0.085 + r() * 0.035, 0.085 + r() * 0.035, h]);
      }
      const cn = (b, sx, sy, sz) => [b[0] + sx * b[2], base + sy * b[4], b[1] + sz * b[3]];
      const EG = [];
      [0, 1].forEach((sy) => { EG.push([[-1, sy, -1], [1, sy, -1]], [[1, sy, -1], [1, sy, 1]], [[1, sy, 1], [-1, sy, 1]], [[-1, sy, 1], [-1, sy, -1]]); });
      [[-1, -1], [1, -1], [1, 1], [-1, 1]].forEach((q) => EG.push([[q[0], 0, q[1]], [q[0], 1, q[1]]]));
      B.forEach((b) => EG.forEach((e) => seg(cn(b, e[0][0], e[0][1], e[0][2]), cn(b, e[1][0], e[1][1], e[1][2]))));
      const ext = -off + cs / 2;
      for (let j = 0; j <= G; j++) { const v = -ext + j * cs; seg([v, base, -ext], [v, base, ext]); seg([-ext, base, v], [ext, base, v]); }
      const hs = B.reduce((acc, b) => acc + b[4], 0);
      const pick = () => { let t = r() * hs; for (let i = 0; i < B.length; i++) { t -= B[i][4]; if (t <= 0) return B[i]; } return B[B.length - 1]; };
      const face = (b, y, c, s) => {
        const side = Math.floor(r() * 4);
        const u = r() * 2 - 1;
        const x = side < 2 ? b[0] + u * b[2] : b[0] + (side === 2 ? 1 : -1) * b[2];
        const z = side < 2 ? b[1] + (side === 0 ? 1 : -1) * b[3] : b[1] + u * b[3];
        put(x, y, z, c, s);
      };
      while (k < N) {
        const q = r();
        if (q < 0.4) {
          const b = pick();
          const e = EG[Math.floor(r() * 12)];
          const u = r();
          const A = cn(b, e[0][0], e[0][1], e[0][2]);
          const Bq = cn(b, e[1][0], e[1][1], e[1][2]);
          put(A[0] + (Bq[0] - A[0]) * u, A[1] + (Bq[1] - A[1]) * u, A[2] + (Bq[2] - A[2]) * u, e[0][1] === 1 && e[1][1] === 1 ? 2 : 0, 3.2 + r() * 1.5);
        } else if (q < 0.68) {
          const b = pick();
          const lv = Math.max(2, Math.floor(b[4] / 0.07));
          face(b, base + b[4] * (1 + Math.floor(r() * (lv - 1))) / lv, 4, 2.4 + r());
        } else if (q < 0.8) {
          const b = pick();
          face(b, base + r() * b[4], r() < 0.5 ? 1 : 3, 4.5 + r() * 3);
        } else {
          const v = -ext + Math.floor(r() * (G + 1)) * cs;
          const u = -ext + r() * 2 * ext;
          if (r() < 0.5) put(v, base, u, 4, 2.2 + r()); else put(u, base, v, 4, 2.2 + r());
        }
      }
      Object.assign(sc, { spin: true, pitch: 0.42, zoom: 1.0, la: 0.12, hub: 0.25 });
    } else {
      while (k < N) put((r() * 2 - 1) * 2.4, (r() * 2 - 1) * 1.4, (r() * 2 - 1) * 1.4, r() < 0.3 ? 1 : 4, 3 + r() * 4);
    }
    if (LN.length) sc.lines = new Float32Array(LN);
    return sc;
  }

  makeField(cv, cfg) {
    const self = this;
    const reduce = this.reduced();
    const small = (window.innerWidth || 1200) < 760;
    const r = this.rng((cfg.seed || 7) * 7919);
    let gl = null;
    try { gl = cv.getContext('webgl', { alpha: true, antialias: false, premultipliedAlpha: true, depth: false, powerPreference: 'high-performance' }) || cv.getContext('experimental-webgl'); } catch (e) { gl = null; }
    const N = gl ? (small ? cfg.nM : cfg.nD) : Math.min(1400, small ? cfg.nM : cfg.nD);
    const SC = cfg.scenes.map((nm, i) => {
      const sc = this.buildScene(nm, N, (cfg.seed || 7) * 31 + i * 17 + 3);
      if (cfg.durs && cfg.durs[i]) sc.dur = cfg.durs[i];
      return sc;
    });
    const P = new Float32Array(N * 3);
    const V = new Float32Array(N * 3);
    const T = new Float32Array(N * 3);
    const C = new Float32Array(N * 3);
    const TC = new Float32Array(N * 3);
    const SZ = new Float32Array(N);
    const PH = new Float32Array(N);
    const KS = new Float32Array(N);
    for (let i = 0; i < N; i++) {
      const a = r() * 6.2832;
      const rd = 1.2 + r() * 2.2;
      P[i * 3] = Math.cos(a) * rd * 1.3;
      P[i * 3 + 1] = (r() - 0.5) * 2.6;
      P[i * 3 + 2] = Math.sin(a) * rd * 0.8;
      C[i * 3] = 0.1; C[i * 3 + 1] = 0.14; C[i * 3 + 2] = 0.2;
      PH[i] = r() * 6.2832;
      KS[i] = 0.016 + r() * 0.03;
      SZ[i] = 4;
    }
    let pal = this.palette(this._accent || '#3EA6FF');
    const st = { cur: 0, t0: 0, time: 0, yaw: 0, yawE: 0, pitch: 0.1, zoom: 1, mx: 0, my: 0, tmx: 0, tmy: 0, mOn: false, px: -9999, py: -9999, vis: true, run: false, dead: false, last: 0, W: 0, H: 0, d: 1, L: null, fade: 0, raf: 0 };
    let sizeDirty = true;
    const recolor = () => {
      const sc = SC[st.cur];
      for (let i = 0; i < N; i++) { const c = pal[sc.ci[i]] || pal[0]; TC[i * 3] = c[0]; TC[i * 3 + 1] = c[1]; TC[i * 3 + 2] = c[2]; }
    };
    const setScene = (idx) => {
      st.cur = idx;
      st.t0 = st.time;
      const sc = SC[idx];
      T.set(sc.p);
      SZ.set(sc.sz);
      sizeDirty = true;
      if (sc.dyn) sc.dyn(st.time, T, sc.ci);
      recolor();
      for (let i = 0; i < N; i++) {
        const j = i * 3;
        const q = 0.6 + r() * 0.8;
        V[j] += -P[j + 2] * 0.018 * q + (r() - 0.5) * 0.012;
        V[j + 1] += (r() - 0.5) * 0.014;
        V[j + 2] += P[j] * 0.018 * q + (r() - 0.5) * 0.012;
      }
      if (cfg.onScene) cfg.onScene(idx);
    };

    let prog = null;
    let lprog = null;
    let bPos = null;
    let bCol = null;
    let bSz = null;
    let bPh = null;
    let bLn = null;
    const uP = {};
    const uL = {};
    const aP = {};
    const aL = {};
    const LMAX = 1800;
    const LB = new Float32Array(LMAX * 2 * 4);
    if (gl) {
      try {
        const sh = (type, src) => { const s = gl.createShader(type); gl.shaderSource(s, src); gl.compileShader(s); if (!gl.getShaderParameter(s, gl.COMPILE_STATUS)) throw new Error('shader'); return s; };
        const mk = (vs, fs) => { const pr = gl.createProgram(); gl.attachShader(pr, sh(gl.VERTEX_SHADER, vs)); gl.attachShader(pr, sh(gl.FRAGMENT_SHADER, fs)); gl.linkProgram(pr); if (!gl.getProgramParameter(pr, gl.LINK_STATUS)) throw new Error('link'); return pr; };
        const HEAD = 'uniform mat3 uRot;uniform vec2 uRes;uniform float uScale;uniform vec2 uOff;uniform float uCam;';
        const PROJ = 'vec3 p=uRot*aPos;float k=uCam/max(uCam-p.z,0.25);vec2 s=p.xy*k*uScale+uOff;gl_Position=vec4(s/(uRes*0.5),0.0,1.0);';
        prog = mk(
          'attribute vec3 aPos;attribute vec3 aCol;attribute float aSize;attribute float aPh;' + HEAD + 'uniform float uDpr;uniform float uTime;varying vec3 vCol;varying float vA;void main(){' + PROJ + 'float tw=1.0+0.32*sin(uTime*2.1+aPh);gl_PointSize=clamp(aSize*k*uDpr*tw,1.0,64.0);vCol=aCol;vA=clamp(k*k*0.85,0.12,1.5);}',
          'precision mediump float;varying vec3 vCol;varying float vA;uniform float uAlpha;void main(){vec2 c=gl_PointCoord-vec2(0.5);float d=dot(c,c)*4.0;if(d>1.0)discard;float a=exp(-d*3.6)*0.42+exp(-d*16.0)*0.95;float i=a*vA*uAlpha;gl_FragColor=vec4(vCol*i,i);}'
        );
        lprog = mk(
          'attribute vec3 aPos;attribute float aA;' + HEAD + 'varying float vA;void main(){' + PROJ + 'vA=aA*clamp(k,0.4,1.3);}',
          'precision mediump float;varying float vA;uniform vec3 uCol;uniform float uAlpha;void main(){float i=vA*uAlpha;gl_FragColor=vec4(uCol*i,i);}'
        );
        ['uRot', 'uRes', 'uScale', 'uOff', 'uCam', 'uDpr', 'uTime', 'uAlpha'].forEach((n) => { uP[n] = gl.getUniformLocation(prog, n); });
        ['uRot', 'uRes', 'uScale', 'uOff', 'uCam', 'uCol', 'uAlpha'].forEach((n) => { uL[n] = gl.getUniformLocation(lprog, n); });
        ['aPos', 'aCol', 'aSize', 'aPh'].forEach((n) => { aP[n] = gl.getAttribLocation(prog, n); });
        ['aPos', 'aA'].forEach((n) => { aL[n] = gl.getAttribLocation(lprog, n); });
        const buf = (data, usage) => { const b = gl.createBuffer(); gl.bindBuffer(gl.ARRAY_BUFFER, b); gl.bufferData(gl.ARRAY_BUFFER, data, usage); return b; };
        bPos = buf(P, gl.DYNAMIC_DRAW);
        bCol = buf(C, gl.DYNAMIC_DRAW);
        bSz = buf(SZ, gl.DYNAMIC_DRAW);
        bPh = buf(PH, gl.STATIC_DRAW);
        bLn = buf(LB, gl.DYNAMIC_DRAW);
        gl.disable(gl.DEPTH_TEST);
        gl.enable(gl.BLEND);
        gl.blendFunc(gl.ONE, gl.ONE);
      } catch (e) { gl = null; prog = null; }
    }
    let c2 = null;
    if (!gl) { try { c2 = cv.getContext('2d'); } catch (e) { c2 = null; } }

    const resize = () => {
      const W = cv.clientWidth || 1;
      const H = cv.clientHeight || 1;
      if (W === st.W && H === st.H && st.L) return;
      st.W = W;
      st.H = H;
      st.d = Math.min(window.devicePixelRatio || 1, small ? 1.5 : 1.75);
      cv.width = Math.max(1, Math.round(W * st.d));
      cv.height = Math.max(1, Math.round(H * st.d));
      st.L = cfg.layout(W, H);
    };

    let nv = 0;
    const push = (x, y, z, a) => { const o = nv * 4; LB[o] = x; LB[o + 1] = y; LB[o + 2] = z; LB[o + 3] = a; nv++; };
    const sm = (x) => { const v = Math.max(0, Math.min(1, x)); return v * v * (3 - 2 * v); };
    const buildLines = () => {
      nv = 0;
      const sc = SC[st.cur];
      const el = st.time - st.t0;
      const lf = sc.lines ? sm((el - 0.9) / 1.4) * (1 - sm((el - sc.dur + 1.0) / 0.9)) * sc.la : 0;
      const cap = LMAX * 2 - 2;
      if (lf > 0.002) {
        const Ls = sc.lines;
        for (let i = 0; i < Ls.length && nv < cap; i += 6) { push(Ls[i], Ls[i + 1], Ls[i + 2], lf); push(Ls[i + 3], Ls[i + 4], Ls[i + 5], lf); }
      }
      const hA = sc.hub * 0.55 * Math.min(1, st.fade);
      if (hA > 0.01) {
        const Hn = Math.min(170, N);
        const R2 = 0.075;
        for (let a = 0; a < Hn && nv < cap; a++) {
          const ja = a * 3;
          for (let b = a + 1; b < Hn; b++) {
            const jb = b * 3;
            const dx = P[ja] - P[jb];
            const dy = P[ja + 1] - P[jb + 1];
            const dz = P[ja + 2] - P[jb + 2];
            const d2 = dx * dx + dy * dy + dz * dz;
            if (d2 < R2) {
              const al = (1 - d2 / R2) * hA;
              push(P[ja], P[ja + 1], P[ja + 2], al);
              push(P[jb], P[jb + 1], P[jb + 2], al);
              if (nv >= cap) break;
            }
          }
        }
      }
      return nv;
    };

    const draw = () => {
      resize();
      const W = st.W;
      const H = st.H;
      const L = st.L;
      const ca = Math.cos(st.yawE);
      const sa = Math.sin(st.yawE);
      const cp = Math.cos(st.pitch);
      const sp = Math.sin(st.pitch);
      const M = [ca, sp * sa, -cp * sa, 0, cp, sp, sa, -sp * ca, cp * ca];
      const scl = L.sc * st.zoom;
      const alpha = L.a * st.fade;
      if (gl && prog) {
        gl.viewport(0, 0, cv.width, cv.height);
        gl.clearColor(0, 0, 0, 0);
        gl.clear(gl.COLOR_BUFFER_BIT);
        const setU = (U) => { gl.uniformMatrix3fv(U.uRot, false, M); gl.uniform2f(U.uRes, W, H); gl.uniform1f(U.uScale, scl); gl.uniform2f(U.uOff, L.ox, L.oy); gl.uniform1f(U.uCam, 3.4); gl.uniform1f(U.uAlpha, alpha); };
        const attr = (b, loc, n, data) => { if (loc < 0) return; gl.bindBuffer(gl.ARRAY_BUFFER, b); if (data) gl.bufferSubData(gl.ARRAY_BUFFER, 0, data); gl.enableVertexAttribArray(loc); gl.vertexAttribPointer(loc, n, gl.FLOAT, false, 0, 0); };
        gl.useProgram(prog);
        setU(uP);
        gl.uniform1f(uP.uDpr, st.d);
        gl.uniform1f(uP.uTime, st.time);
        attr(bPos, aP.aPos, 3, P);
        attr(bCol, aP.aCol, 3, C);
        attr(bSz, aP.aSize, 1, sizeDirty ? SZ : null);
        sizeDirty = false;
        attr(bPh, aP.aPh, 1, null);
        gl.drawArrays(gl.POINTS, 0, N);
        [aP.aPos, aP.aCol, aP.aSize, aP.aPh].forEach((l) => { if (l >= 0) gl.disableVertexAttribArray(l); });
        const n = buildLines();
        if (n > 1) {
          gl.useProgram(lprog);
          setU(uL);
          const lc = pal[1];
          gl.uniform3f(uL.uCol, lc[0], lc[1], lc[2]);
          gl.bindBuffer(gl.ARRAY_BUFFER, bLn);
          gl.bufferSubData(gl.ARRAY_BUFFER, 0, LB.subarray(0, n * 4));
          if (aL.aPos >= 0) { gl.enableVertexAttribArray(aL.aPos); gl.vertexAttribPointer(aL.aPos, 3, gl.FLOAT, false, 16, 0); }
          if (aL.aA >= 0) { gl.enableVertexAttribArray(aL.aA); gl.vertexAttribPointer(aL.aA, 1, gl.FLOAT, false, 16, 12); }
          gl.drawArrays(gl.LINES, 0, n);
          if (aL.aPos >= 0) gl.disableVertexAttribArray(aL.aPos);
          if (aL.aA >= 0) gl.disableVertexAttribArray(aL.aA);
        }
      } else if (c2) {
        c2.setTransform(st.d, 0, 0, st.d, 0, 0);
        c2.clearRect(0, 0, W, H);
        c2.globalCompositeOperation = 'lighter';
        for (let i = 0, j = 0; i < N; i++, j += 3) {
          const x = P[j];
          const y = P[j + 1];
          const z = P[j + 2];
          const rx = M[0] * x + M[3] * y + M[6] * z;
          const ry = M[1] * x + M[4] * y + M[7] * z;
          const rz = M[2] * x + M[5] * y + M[8] * z;
          const k = 3.4 / Math.max(3.4 - rz, 0.25);
          const s = Math.max(1, SZ[i] * k * 0.3);
          c2.fillStyle = 'rgba(' + ((C[j] * 255) | 0) + ',' + ((C[j + 1] * 255) | 0) + ',' + ((C[j + 2] * 255) | 0) + ',' + (0.9 * alpha).toFixed(2) + ')';
          c2.fillRect(W / 2 + rx * k * scl + L.ox - s / 2, H / 2 - (ry * k * scl + L.oy) - s / 2, s, s);
        }
        c2.globalCompositeOperation = 'source-over';
      }
    };

    const step = (dt) => {
      const f = dt * 60;
      st.time += dt;
      if (st.time - st.t0 > SC[st.cur].dur) setScene((st.cur + 1) % SC.length);
      const sc = SC[st.cur];
      if (sc.dyn) { sc.dyn(st.time, T, sc.ci); recolor(); }
      st.mx += (st.tmx - st.mx) * Math.min(1, 0.05 * f);
      st.my += (st.tmy - st.my) * Math.min(1, 0.05 * f);
      st.pitch += (sc.pitch + st.my * 0.14 - st.pitch) * Math.min(1, 0.03 * f);
      st.zoom += (sc.zoom - st.zoom) * Math.min(1, 0.03 * f);
      if (sc.spin) st.yaw += dt * 0.15;
      else { const tg = Math.round(st.yaw / 6.2832) * 6.2832 + Math.sin(st.time * 0.35) * sc.sway; st.yaw += (tg - st.yaw) * Math.min(1, 0.025 * f); }
      st.yawE = st.yaw + st.mx * 0.3;
      st.fade = Math.min(1, st.fade + dt * 0.6);
      const damp = Math.pow(0.88, f);
      const amb = sc.amb || 0.006;
      const tm = st.time;
      const ca = Math.cos(st.yawE);
      const sa = Math.sin(st.yawE);
      const cp = Math.cos(st.pitch);
      const sp = Math.sin(st.pitch);
      const L = st.L;
      const scl = L.sc * st.zoom;
      const mOn = st.mOn;
      const mwx = mOn ? (st.px - st.W / 2 - L.ox) / scl : 0;
      const mwy = mOn ? (st.H / 2 - st.py - L.oy) / scl : 0;
      const R = 0.3;
      const R2 = R * R;
      const cf = Math.min(1, 0.05 * f);
      for (let i = 0, j = 0; i < N; i++, j += 3) {
        const k = KS[i] * f;
        const ph = PH[i];
        const tx = T[j] + Math.sin(tm * 0.7 + ph) * amb;
        const ty = T[j + 1] + Math.cos(tm * 0.9 + ph * 1.3) * amb;
        const tz = T[j + 2] + Math.sin(tm * 0.6 + ph * 0.7) * amb;
        let vx = (V[j] + (tx - P[j]) * k) * damp;
        let vy = (V[j + 1] + (ty - P[j + 1]) * k) * damp;
        let vz = (V[j + 2] + (tz - P[j + 2]) * k) * damp;
        if (mOn) {
          const x = P[j];
          const y = P[j + 1];
          const z = P[j + 2];
          const rx = ca * x + sa * z;
          const ry = sp * sa * x + cp * y - sp * ca * z;
          const dx = rx - mwx;
          const dy = ry - mwy;
          const d2 = dx * dx + dy * dy;
          if (d2 < R2 && d2 > 1e-6) {
            const dd = Math.sqrt(d2);
            const fo = (1 - dd / R) * 0.014 * f / dd;
            const qx = dx * fo;
            const qy = dy * fo;
            vx += ca * qx + sp * sa * qy;
            vy += cp * qy;
            vz += sa * qx - sp * ca * qy;
          }
        }
        V[j] = vx; V[j + 1] = vy; V[j + 2] = vz;
        P[j] += vx * f; P[j + 1] += vy * f; P[j + 2] += vz * f;
        C[j] += (TC[j] - C[j]) * cf;
        C[j + 1] += (TC[j + 1] - C[j + 1]) * cf;
        C[j + 2] += (TC[j + 2] - C[j + 2]) * cf;
      }
    };

    const loop = (now) => {
      if (st.dead) return;
      if (!st.vis || document.hidden) { st.run = false; return; }
      const dt = Math.min(0.05, Math.max(0.001, (now - st.last) / 1000));
      st.last = now;
      resize();
      step(dt);
      draw();
      st.raf = requestAnimationFrame(loop);
    };
    const start = () => {
      if (st.run || st.dead || reduce) return;
      st.run = true;
      st.last = performance.now();
      st.raf = requestAnimationFrame(loop);
    };

    const host = cfg.host || cv.parentNode;
    const pm = (e) => {
      const rc = cv.getBoundingClientRect();
      if (!rc.width || !rc.height) return;
      st.px = e.clientX - rc.left;
      st.py = e.clientY - rc.top;
      st.tmx = (st.px / rc.width) * 2 - 1;
      st.tmy = (st.py / rc.height) * 2 - 1;
      st.mOn = e.pointerType !== 'touch' || e.buttons > 0;
    };
    const pl = () => { st.mOn = false; st.tmx = 0; st.tmy = 0; };
    const vc = () => { if (!document.hidden) start(); };
    const rz = () => { if (reduce) draw(); };
    if (host) { host.addEventListener('pointermove', pm); host.addEventListener('pointerleave', pl); }
    document.addEventListener('visibilitychange', vc);
    window.addEventListener('resize', rz);

    resize();
    setScene(0);
    if (reduce) {
      P.set(T);
      C.set(TC);
      st.fade = 1;
      st.pitch = SC[0].pitch;
      st.zoom = SC[0].zoom;
      this._t.push(setTimeout(() => draw(), 60));
      draw();
    } else {
      this.observe([cv], { threshold: 0 }, (en) => { st.vis = !!en.isIntersecting; if (st.vis) start(); });
      start();
    }

    const ctl = {
      tint: (hex) => { pal = self.palette(hex); recolor(); if (reduce) { C.set(TC); draw(); } },
      stop: () => {
        st.dead = true;
        if (st.raf) cancelAnimationFrame(st.raf);
        if (host) { host.removeEventListener('pointermove', pm); host.removeEventListener('pointerleave', pl); }
        document.removeEventListener('visibilitychange', vc);
        window.removeEventListener('resize', rz);
      }
    };
    this._fields.push(ctl);
    return ctl;
  }
}

try {
  const app = new Konan();
  app.mount();
  window.konan = app;
} catch (err) {
  document.documentElement.classList.remove('kjs');
  if (window.console) console.error(err);
}
})();
