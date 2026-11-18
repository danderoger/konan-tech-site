/* Auditoria da planta: desenha todas as combinações e procura colisões de desenho.
   6 ramos x 256 combinações de atritos x 2 folhas (deitada no computador, em pé no celular) = 3.072 plantas.
   Uso, com o site servido localmente:
     npm install --no-save playwright && npx playwright install chromium
     node scripts/auditar-planta.cjs http://localhost:8000
   Termina com código 1 se encontrar colisão. Itens "informativos" não são erro. */

const { chromium } = require('playwright');

const URL = (process.argv[2] || 'http://localhost:8000').replace(/\/$/, '');

(async () => {
  const browser = await chromium.launch();
  const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
  const errors = [];
  page.on('pageerror', (e) => errors.push(e.message));
  await page.goto(URL + '/index.html', { waitUntil: 'load' });
  await page.waitForFunction(() => window.__ktReady);
  await page.evaluate(() => document.fonts.ready);

  const res = await page.evaluate(async () => {
    const { GEO } = await import('/js/plan.js');
    const RAMOS = ['obras', 'comercio', 'campo', 'escritorio', 'industria', 'outro'];
    const DORES = ['planilhas', 'documentos', 'whatsapp', 'equipe', 'retrabalho', 'indicadores', 'financeiro', 'presenca'];
    const host = document.createElement('div');
    host.style.cssText = 'position:fixed;left:-3000px;top:0;width:1000px;height:700px;';
    document.body.append(host);

    /* caixa de um elemento no espaço da folha (soma os deslocamentos dos grupos) */
    const tr = (el) => { const m = /translate\(([-\d.]+)px,\s*([-\d.]+)px\)/.exec(el.style.transform || ''); return m ? [+m[1], +m[2]] : [0, 0]; };
    const box = (t) => {
      const r = t.getBBox();
      let x = r.x, y = r.y, e = t.parentNode;
      while (e && e.tagName !== 'svg') { const [dx, dy] = tr(e); x += dx; y += dy; e = e.parentNode; }
      return { x0: x, y0: y, x1: x + r.width, y1: y + r.height };
    };
    const overlap = (a, b, pad = 0) => a.x0 - pad < b.x1 && a.x1 + pad > b.x0 && a.y0 - pad < b.y1 && a.y1 + pad > b.y0;
    const points = (path, step) => { const L = path.getTotalLength(), out = []; for (let s = 0; s <= L; s += step) { const q = path.getPointAtLength(s); out.push([q.x, q.y]); } return out; };
    const hits = (b, P, pad = 0.5) => P.some(([x, y]) => x > b.x0 - pad && x < b.x1 + pad && y > b.y0 - pad && y < b.y1 + pad);

    const found = {};
    const add = (kind, ex) => { const f = (found[kind] = found[kind] || { n: 0, ex: [] }); f.n++; if (f.ex.length < 5 && !f.ex.includes(ex)) f.ex.push(ex); };
    let n = 0;
    for (const orient of ['land', 'port']) for (const ramo of RAMOS) for (let mask = 0; mask < 256; mask++) {
      const dores = DORES.filter((_, i) => mask & (1 << i));
      host.innerHTML = '';
      const svg = window.konan.plan.snapshot(orient, { ramo, dores, equipe: 1, nome: '', example: false }, '-a' + n, host);
      n++;
      const tag = `${orient === 'land' ? 'computador' : 'celular'}/${ramo}/${dores.join('+') || 'nenhum atrito'}`;
      const G = GEO[orient];
      const labels = [...svg.querySelectorAll('.room-t')].filter((t) => t.textContent).map((t) => ({ t, b: box(t), s: t.textContent }));
      const corT = svg.querySelector('.cor-t');
      const cor = { t: corT, b: box(corT), s: corT.textContent };
      const notes = [...svg.querySelectorAll('.note-t')].map((t) => ({ t, b: box(t), s: t.textContent }));
      const modT = [...svg.querySelectorAll('.mod-t')].map((t) => ({ b: box(t), s: t.textContent }));
      const modR = [...svg.querySelectorAll('.mod-r')].map((r) => ({ b: box(r) }));
      const tags = [...svg.querySelectorAll('.rev-tag')].map((g) => ({ b: box(g), s: g.textContent }));
      const doors = [...svg.querySelectorAll('.door')].map((g) => [...g.querySelectorAll('path')].flatMap((q) => points(q, 1)));
      const flows = [...svg.querySelectorAll('.flow')].map((f) => points(f, 1.5));
      const texts = [...labels, cor, ...notes];

      labels.forEach((l) => doors.forEach((P) => { if (hits(l.b, P, 0.8)) add('nome cruzado por porta', `${tag}: ${l.s}`); }));
      tags.forEach((g) => [...labels, ...notes].forEach((l) => { if (overlap(g.b, l.b, 0.5)) add('triângulo em cima de texto', `${tag}: ${l.s}`); }));
      tags.forEach((g) => doors.forEach((P) => { if (hits(g.b, P, 0.5)) add('triângulo em cima de porta', tag); }));
      texts.forEach((l) => flows.forEach((P) => { if (hits(l.b, P, 0.5)) add('texto cruzado por fluxo', `${tag}: ${l.s}`); }));
      [...labels, ...notes].forEach((l) => modR.forEach((m) => { if (overlap(l.b, m.b, 0.5)) add('texto em cima de módulo', `${tag}: ${l.s}`); }));
      for (let i = 0; i < texts.length; i++) for (let j = i + 1; j < texts.length; j++) if (overlap(texts[i].b, texts[j].b)) add('texto em cima de texto', `${tag}: ${texts[i].s} / ${texts[j].s}`);
      modT.forEach((t) => { if (!modR.some((m) => t.b.x0 >= m.b.x0 - 0.5 && t.b.x1 <= m.b.x1 + 0.5 && t.b.y0 >= m.b.y0 - 2 && t.b.y1 <= m.b.y1 + 2)) add('nome de módulo fora da caixa', `${tag}: ${t.s}`); });
      const areas = [...Object.values(G.rooms), G.ext, [G.walk[0], G.walk[1] - 4, G.walk[2] + 40, G.walk[3] + 4]];
      [...labels, ...notes].forEach((l) => { if (!areas.some(([x0, y0, x1, y1]) => l.b.x0 >= x0 + 1 && l.b.x1 <= x1 - 1 && l.b.y0 >= y0 + 1 && l.b.y1 <= y1 - 1)) add('texto saindo da sala', `${tag}: ${l.s}`); });
      labels.forEach((l) => {
        if (l.t.querySelectorAll('tspan').length > 1) add('informativo: nome em duas linhas', `${orient === 'land' ? 'computador' : 'celular'}: ${l.s}`);
        else if (+l.t.getAttribute('font-size') < G.fs.room - 0.01) add('informativo: nome com letra um pouco menor', `${orient === 'land' ? 'computador' : 'celular'}: ${l.s}`);
      });
    }
    host.remove();
    return { n, found };
  });

  console.log(`${res.n} plantas desenhadas, erros de JavaScript: ${errors.length ? errors.join('; ') : 'nenhum'}`);
  let bad = errors.length > 0;
  for (const [kind, v] of Object.entries(res.found)) {
    if (!kind.startsWith('informativo')) bad = true;
    console.log(`\n${kind}: ${v.n}`);
    v.ex.forEach((e) => console.log('  ' + e));
  }
  console.log(bad ? '\nResultado: há colisões para corrigir.' : '\nResultado: nenhuma colisão.');
  await browser.close();
  process.exit(bad ? 1 : 0);
})();
