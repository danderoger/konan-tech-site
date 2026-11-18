/* Detalhe 4: aplicativo da equipe e painel do gestor.
   Cada toque no celular (iniciar, concluir com foto) aparece no painel do gestor na mesma hora.
   Com "sem internet", o celular guarda as atualizações e envia tudo quando o sinal volta.
   Pessoas e tarefas são fictícias. */

import { TEAM, TEAM_PEOPLE } from '../content.js';

const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));

/* conta como visto quando boa parte aparece, ou quando ocupa mais da metade da tela (blocos altos no celular) */
const seenEnough = (e, t) => e.isIntersecting && (e.intersectionRatio >= t || e.intersectionRect.height >= innerHeight * 0.5);
export function initTeam(root, ctx) {
  const box = root.querySelector('#tm');
  const list = root.querySelector('#tm-list');
  const act = root.querySelector('#tm-act');
  const who = root.querySelector('#tm-who');
  const where = root.querySelector('#tm-where');
  const off = root.querySelector('#tm-off');
  const sync = root.querySelector('#tm-sync');
  const k1 = root.querySelector('#tm-k1'), k2 = root.querySelector('#tm-k2'), k3 = root.querySelector('#tm-k3');
  const people = root.querySelector('#tm-people');
  const feed = root.querySelector('#tm-feed');
  const reduced = ctx.reduced;
  let ramo = 'obras', tasks = [], cur = 0, phase = 0, clock = 8 * 60 + 2, queue = [], user = false, auto = 0, seen = false;
  /* painel: o que o gestor já recebeu */
  let srv = { st: [], photos: 0 };

  const hhmm = (m) => `${String(Math.floor(m / 60)).padStart(2, '0')}h${String(m % 60).padStart(2, '0')}`;
  const ME = TEAM_PEOPLE[0];

  function reset(r) {
    if (r) ramo = TEAM[r] ? r : 'outro';
    const T = TEAM[ramo];
    tasks = T.tarefas.map((t) => ({ t, st: 0 }));
    cur = 0; phase = 0; clock = 8 * 60 + 2; queue = [];
    srv = { st: tasks.map(() => 0), photos: 0 };
    who.textContent = 'Minhas tarefas';
    where.textContent = `${T.quem}, ${T.lugar}`;
    feed.innerHTML = '';
    paintPhone();
    paintPanel();
  }

  function paintPhone() {
    list.innerHTML = tasks.map((x, i) => {
      const cls = x.st === 2 ? 'done' : x.st === 1 ? 'go now' : i === cur ? 'now' : '';
      const lbl = x.st === 2 ? 'Concluída, 2 fotos' : x.st === 1 ? 'Em andamento' : i === cur ? 'Próxima' : 'Agendada';
      const pend = queue.some((q) => q.i === i) ? ' wait' : '';
      return `<li class="${cls}${pend}"><b>${esc(x.t)}</b><span>${pend ? 'Guardado no celular' : lbl}</span></li>`;
    }).join('');
    if (cur >= tasks.length) { act.textContent = 'Dia concluído'; act.disabled = true; }
    else { act.disabled = false; act.textContent = tasks[cur].st === 1 ? 'Concluir com foto' : 'Iniciar'; }
  }

  function bump(el, v) { if (el.textContent !== v) { el.textContent = v; if (!reduced) { el.classList.remove('flash'); void el.offsetWidth; el.classList.add('flash'); } } }

  function paintPanel() {
    const done = srv.st.filter((s) => s === 2).length, going = srv.st.filter((s) => s === 1).length;
    bump(k1, `${done} de ${tasks.length}`);
    bump(k2, String(going));
    bump(k3, String(srv.photos));
    const T = TEAM[ramo];
    const meIdx = srv.st.findIndex((s) => s === 1);
    const meTxt = meIdx > -1 ? `Em andamento: ${tasks[meIdx].t}` : done === tasks.length ? 'Concluiu o dia' : done ? `Concluiu ${done} de ${tasks.length}` : 'Ainda não começou';
    people.innerHTML = [
      [ME, `${T.quem}, ${meTxt.charAt(0).toLowerCase() + meTxt.slice(1)}`, off.checked ? 'Sem sinal' : 'Online'],
      [TEAM_PEOPLE[1], `${T.quem}, em outra rota`, 'Online'],
      [TEAM_PEOPLE[2], `${T.quem}, folga hoje`, 'Folga']
    ].map(([n, t, s]) => `<li><i aria-hidden="true">${n[0]}</i><span><b>${n}</b><small>${esc(t)}</small></span><em class="st ${s === 'Online' ? 'st-ok' : s === 'Sem sinal' ? 'st-w' : ''}">${s}</em></li>`).join('');
    sync.textContent = off.checked ? (queue.length ? `${queue.length} ${queue.length > 1 ? 'atualizações' : 'atualização'} esperando sinal` : 'Celular sem sinal') : 'Tudo sincronizado';
    sync.className = off.checked ? 'off' : 'ok';
  }

  function log(text) {
    feed.insertAdjacentHTML('afterbegin', `<li><b>${hhmm(clock)}</b>${esc(text)}</li>`);
    while (feed.children.length > 6) feed.lastElementChild.remove();
  }

  function deliver(ev) {
    srv.st[ev.i] = ev.st;
    if (ev.st === 2) srv.photos += 2;
    log(ev.st === 1 ? `${ME} iniciou: ${tasks[ev.i].t}` : `${ME} concluiu com 2 fotos: ${tasks[ev.i].t}`);
  }

  function step() {
    if (cur >= tasks.length) return;
    const x = tasks[cur];
    clock += x.st === 0 ? 7 + cur * 3 : 38 + cur * 9;
    x.st = x.st === 0 ? 1 : 2;
    const ev = { i: cur, st: x.st };
    if (x.st === 2) cur++;
    if (off.checked) queue.push(ev);
    else deliver(ev);
    paintPhone();
    paintPanel();
  }

  act.addEventListener('click', () => { user = true; clearTimeout(auto); step(); });
  off.addEventListener('change', () => {
    user = true;
    clearTimeout(auto);
    if (!off.checked && queue.length) {
      const n = queue.length;
      queue.splice(0).forEach(deliver);
      log(`Sinal de volta: ${n} ${n > 1 ? 'atualizações enviadas' : 'atualização enviada'}`);
    }
    paintPhone();
    paintPanel();
  });
  root.querySelector('#tm-reset').addEventListener('click', () => { user = true; clearTimeout(auto); off.checked = false; reset(); });

  /* sozinho, o dia avança devagar enquanto o visitante só observa */
  function autoplay() {
    if (user || !seen) return;
    if (cur >= tasks.length) return;
    step();
    auto = setTimeout(autoplay, reduced ? 2400 : 1700);
  }
  const io = new IntersectionObserver((ents) => ents.forEach((e) => {
    const now = seenEnough(e, 0.4);
    if (now === seen) return;
    seen = now;
    clearTimeout(auto);
    if (seen && !user) auto = setTimeout(autoplay, reduced ? 800 : 1100);
  }), { threshold: [0, 0.1, 0.2, 0.3, 0.4, 0.5, 0.6, 0.7, 0.8, 0.9, 1] });
  io.observe(box);

  reset(ctx.ramo && ctx.ramo());
  return { setRamo(r) { if (!user && r && r !== ramo) { clearTimeout(auto); reset(r); if (seen) auto = setTimeout(autoplay, 900); } } };
}
