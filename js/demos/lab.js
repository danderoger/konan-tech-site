/* Diagnóstico: três perguntas montam a sugestão e a mensagem do WhatsApp. */

import { LAB, waLink } from '../content.js';

export function initLab(root) {
  const form = root.querySelector('#lab');
  const arch = root.querySelector('#arch');
  const first = root.querySelector('#lab-first');
  const msgEl = root.querySelector('#lab-msg');
  const send = root.querySelector('#lab-send');
  let lastDor = null;

  function update() {
    const val = (n) => { const e = form.querySelector(`input[name="${n}"]:checked`); return e ? +e.value : null; };
    const dor = val('dor'), area = val('area'), time = val('time');
    const txt = form.querySelector('#lab-txt').value.trim().replace(/\s+/g, ' ');
    if (dor !== null && dor !== lastDor) {
      const D = LAB.dores[dor];
      arch.innerHTML = D.blocos.map((b, i) => `<div class="arch-b" style="animation-delay:${i * 120}ms"><i>${i + 1}</i><p>${b[0]}<small>${b[1]}</small></p></div>`).join('');
      first.textContent = D.passo;
      lastDor = dor;
    }
    let m = 'Olá, vim pelo site da Konan Tech.';
    if (dor !== null) m += ` Meu principal desafio: ${LAB.dores[dor].frase}.`;
    if (area !== null) m += ` Área: ${LAB.areas[area]}.`;
    if (time !== null) m += ` Equipe: ${LAB.times[time]}.`;
    if (txt) m += ` ${txt}${/[.!?]$/.test(txt) ? '' : '.'}`;
    m += dor !== null ? ' Quero conversar sobre uma solução.' : ' Quero conversar sobre uma solução para a minha empresa.';
    msgEl.textContent = m;
    send.href = waLink(m);
  }
  form.addEventListener('change', update);
  form.addEventListener('input', update);
  form.addEventListener('submit', (e) => e.preventDefault());
  update();
  return {};
}
