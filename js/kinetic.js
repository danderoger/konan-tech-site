/* Konan Tech 3.0: tipografia cinética.
   Cada palavra dos títulos marcados com data-k nasce estreita e fina e se expande até o desenho final,
   usando os eixos de largura e peso da fonte. O espaço final de cada palavra é reservado antes,
   para as linhas não pularem durante a animação. */

const esc = (s) => s.replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));

export function initKinetic(els, { reduced = false } = {}) {
  if (reduced || !els.length) { els.forEach((el) => el.classList.add('kt-off')); return { play() {} }; }
  const pending = new Set(els);
  els.forEach((el) => {
    const text = el.textContent.trim().replace(/\s+/g, ' ');
    el.innerHTML = text.split(' ').map((w, i) => `<span class="kw"><span class="kw-i" style="--d:${i * 60}ms">${esc(w)}</span></span>`).join(' ');
  });
  const measure = (el) => {
    el.classList.remove('kt');
    el.querySelectorAll('.kw').forEach((k) => { k.style.width = ''; });
    el.querySelectorAll('.kw').forEach((k) => { k.style.width = Math.ceil(k.getBoundingClientRect().width + 1) + 'px'; });
    el.classList.add('kt');
  };
  const play = (el) => {
    if (!pending.has(el)) return;
    pending.delete(el);
    el.classList.add('in');
    const n = el.querySelectorAll('.kw').length;
    setTimeout(() => el.querySelectorAll('.kw').forEach((k) => { k.style.width = ''; }), 1500 + n * 60);
  };
  const io = new IntersectionObserver((ents) => ents.forEach((e) => { if (e.isIntersecting) { play(e.target); io.unobserve(e.target); } }), { threshold: 0.25, rootMargin: '0px 0px -6% 0px' });
  const ready = document.fonts && document.fonts.ready ? document.fonts.ready : Promise.resolve();
  Promise.race([ready, new Promise((r) => setTimeout(r, 1500))]).then(() => {
    els.forEach((el) => { measure(el); io.observe(el); });
  });
  let rz;
  addEventListener('resize', () => {
    clearTimeout(rz);
    rz = setTimeout(() => pending.forEach((el) => measure(el)), 150);
  });
  return { play };
}
