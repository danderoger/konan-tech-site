/* Konan Tech 5.0: a conversa que alimenta a planta.
   parse(texto)  lê o que o visitante falou ou escreveu e devolve ramo, o que trava e tamanho da equipe,
                 com a posição de cada trecho reconhecido (para destacar na legenda).
   Voice         reconhecimento de voz do próprio navegador, em português do Brasil.
                 No Chrome o áudio é processado pelo serviço do Google; a página só recebe o texto.
   typeOut       digita um texto aos poucos (usado no exemplo da abertura). */

export const SR = typeof window !== 'undefined' ? (window.SpeechRecognition || window.webkitSpeechRecognition || null) : null;

/* tira acentos sem mudar o tamanho do texto, para as posições continuarem valendo */
export function fold(text) {
  let out = '';
  for (const ch of text.normalize('NFC')) {
    const f = ch.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();
    out += f.length === 1 ? f : ch.toLowerCase().slice(0, 1);
    if (ch.length === 2) out += ' ';
  }
  return out;
}

const RAMO_RX = [
  ['comercio', /\b(lojas? de materia(l|is) de construcao|materia(l|is) de construcao|depositos? de materia(l|is)|home center)\b/g, 3],
  ['obras', /\b(construtoras?|construcao|construcoes|construimos|construir|obras?|engenharia|engenheir[oa]s?|reformas?|reformamos|empreiteiras?|incorporadoras?|canteiros?|mestres? de obras?|pedreiros?|alvenaria|loteamentos?)\b/g, 2],
  ['comercio', /\b(lojas?|comercio|comercial|varejo|atacado|atacadista|distribuidoras?|revendas?|revendemos|vendemos|vendo|e ?commerce|loja virtual|mercados?|supermercados?|padarias?|restaurantes?|lanchonetes?|delivery|farmacias?|autopecas|vendas)\b/g, 1.5],
  ['campo', /\b(tecnic[oa]s?|instalacao|instalacoes|instalamos|instaladores?|manutencao|manutencoes|assistencia tecnica|montagem|montagens|montadores?|montamos|visitas? tecnicas?|ordens? de servico|servicos? em campo|equipe externa|equipe de campo|dedetizacao|climatizacao|ar condicionado|seguranca eletronica|limpeza|jardinagem|piscinas?|vistorias?|prestadora de servicos?|prestamos servicos?)\b/g, 1.6],
  ['escritorio', /\b(escritorios?|contabilidade|contabil|contador(es)?|advocacia|advogad[oa]s?|consultoria|imobiliarias?|corretora|corretores?|seguradora|agencia|clinicas?|consultorios?|despachante|cartorio)\b/g, 1.6],
  ['industria', /\b(fabricas?|industrias?|industrial|producao|produzimos|fabricamos|fabricacao|confeccao|confeccoes|marcenarias?|metalurgicas?|serralherias?|usinagem|linha de producao|graficas?|alimentos congelados)\b/g, 1.8]
];

const DOR_RX = [
  ['planilhas', /\b(planilhas?|excel|google sheets|sheets|cadernos?|caderninho|papeis|papel|controles? paralelos?|anotamos|anoto)\b/g],
  ['documentos', /\b(notas? fiscais?|notas? fiscal|notas?|nfe|nf|recibos?|comprovantes?|cupons?|cupom|documentos?|digitad[oa]s?|digitamos|digito|digitar|lancamentos? manuais|lancamos a mao)\b/g],
  ['whatsapp', /\b(whatsapp|whats|zap|zapzap|mensagens?|pedidos? (chegam|chega|vem|vem pelo|por) (pelo |por )?(whatsapp|mensagem|telefone|zap|instagram)|pedidos? se perde[m]?|perde(mos)? pedidos?|ligacoes|telefonemas?)\b/g],
  ['equipe', /\b((nao sei|nunca sei|sem saber|dificil saber|nao consigo (ver|acompanhar|saber)|nao tenho como saber)( o que| onde| como| se)?[^.]{0,48}?\b(equipe|tecnicos?|montadores?|motoristas?|entregadores?|pessoal|funcionarios|obras?|campo|rua|cliente[s]?)|acompanhar (a )?equipe|equipe (externa|de campo|na rua)|onde (os|as|a|o) (tecnicos?|equipe|montadores?|motoristas?|entregadores?) (esta|estao))\b/g],
  ['retrabalho', /\b(retrabalho|repetid[ao]s?|repetitiv[ao]s?|mesma coisa|copiar e colar|copia e cola|refazer|refazemos|perd(o|emos|e) (muito )?tempo|perda de tempo|tudo manual|trabalho manual|burocracia|duas vezes|varias vezes)\b/g],
  ['indicadores', /\b(indicadores?|numeros|relatorios?|dashboards?|paineis|painel|metricas?|lucro|margem|resultados?|faturamento|kpis?|nao sei (quanto|se) (ganho|lucro|estou|estamos|sobra))\b/g],
  ['financeiro', /\b(financeiro|contas a pagar|contas a receber|boletos?|cobrancas?|cobrar|inadimplencia|inadimplentes?|fluxo de caixa|pagamentos?|vencimentos?)\b/g],
  ['presenca', /\b(sites?|instagram|redes sociais|google|divulgacao|divulgar|marketing|presenca (digital|online)|anuncios?|captar clientes|novos clientes|mais clientes|clientes? (nao|nao me|nao nos) (acha|acham|encontra|encontram|conhece|conhecem))\b/g]
];

const NUM_WORDS = {
  um: 1, uma: 1, dois: 2, duas: 2, tres: 3, quatro: 4, cinco: 5, seis: 6, sete: 7, oito: 8, nove: 9, dez: 10,
  onze: 11, doze: 12, treze: 13, quatorze: 14, catorze: 14, quinze: 15, dezesseis: 16, dezessete: 17, dezoito: 18, dezenove: 19,
  vinte: 20, trinta: 30, quarenta: 40, cinquenta: 50, sessenta: 60, setenta: 70, oitenta: 80, noventa: 90, cem: 100, cento: 100, duzentos: 200, duzentas: 200, trezentos: 300, mil: 1000
};
const NUM = '(\\d{1,4}|(?:(?:' + Object.keys(NUM_WORDS).join('|') + ')(?: e (?:' + Object.keys(NUM_WORDS).join('|') + '))*))';
const PEOPLE = '(pessoas|funcionari[oa]s|colaboradores|colaboradoras|empregad[oa]s|profissionais|tecnicos|montadores|vendedores|motoristas|operarios|pedreiros|entregadores|pessoas na equipe)';
const EQ_RX = [
  new RegExp('\\b' + NUM + ' ' + PEOPLE + '\\b', 'g'),
  new RegExp('\\b(?:equipe|time) de ' + NUM + '\\b', 'g'),
  new RegExp('\\bsomos (\\d{1,4}|(?:(?:' + Object.keys(NUM_WORDS).filter((w) => w !== 'um' && w !== 'uma').join('|') + ')(?: e (?:' + Object.keys(NUM_WORDS).join('|') + '))*))(?! empresas?)\\b', 'g')
];
const SOLO_RX = /\b(trabalho sozinh[oa]|so eu|eu sozinh[oa]|sou sozinh[oa])\b/g;

function numFrom(s) {
  if (/^\d+$/.test(s)) return parseInt(s, 10);
  return s.split(' e ').reduce((a, w) => a + (NUM_WORDS[w] || 0), 0);
}
export function bucket(n) { return n <= 5 ? 0 : n <= 20 ? 1 : n <= 50 ? 2 : 3; }

/* lê o texto e devolve o que reconheceu, sem sobrepor trechos */
export function parse(text) {
  const t = fold(text || '');
  const taken = [];
  const free = (a, b) => !taken.some(([x, y]) => a < y && b > x);
  const hits = [];
  const score = {}, firstAt = {}, dores = [];
  let equipe = null, eqAt = -1;
  /* percorre um padrão e reserva os trechos encontrados */
  const scan = (rx, cb) => {
    rx.lastIndex = 0;
    let m;
    while ((m = rx.exec(t))) {
      const a = m.index, b = a + m[0].length;
      if (b === a) { rx.lastIndex++; continue; }
      if (!free(a, b)) continue;
      if (cb(m, a, b) === false) continue;
      taken.push([a, b]);
    }
  };
  const ramoHit = (k, w) => (m, a, b) => { score[k] = (score[k] || 0) + w; if (firstAt[k] === undefined) firstAt[k] = a; hits.push({ a, b, kind: 'r', key: k }); };
  const dorHit = (k) => (m, a, b) => { hits.push({ a, b, kind: 'd', key: k }); if (!dores.includes(k)) dores.push(k); };
  /* frases longas primeiro ("nunca sei o que acontece em cada obra"), depois palavras soltas */
  scan(RAMO_RX[0][1], ramoHit(RAMO_RX[0][0], RAMO_RX[0][2]));
  const longDor = DOR_RX.find(([k]) => k === 'equipe');
  scan(longDor[1], dorHit('equipe'));
  EQ_RX.forEach((rx) => scan(rx, (m, a, b) => {
    const n = numFrom(m[1]);
    if (!n) return false;
    hits.push({ a, b, kind: 'e' });
    if (a > eqAt) { eqAt = a; equipe = bucket(n); }
    return true;
  }));
  RAMO_RX.slice(1).forEach(([k, rx, w]) => scan(rx, ramoHit(k, w)));
  scan(SOLO_RX, (m, a, b) => { hits.push({ a, b, kind: 'e' }); if (a > eqAt) { eqAt = a; equipe = 0; } });
  DOR_RX.forEach(([k, rx]) => { if (k !== 'equipe') scan(rx, dorHit(k)); });
  let ramo = null;
  Object.keys(score).forEach((k) => { if (!ramo || score[k] > score[ramo] || (score[k] === score[ramo] && firstAt[k] < firstAt[ramo])) ramo = k; });
  hits.sort((p, q) => p.a - q.a);
  return { ramo, dores, equipe, hits };
}

const esc = (s) => s.replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
/* texto com os trechos reconhecidos marcados: azul = ramo, vermelho = o que trava, grafite = equipe */
export function highlight(text, hits) {
  const src = (text || '').normalize('NFC');
  let out = '', i = 0;
  hits.forEach((h) => {
    if (h.a < i) return;
    out += esc(src.slice(i, h.a)) + `<mark class="t-${h.kind}">${esc(src.slice(h.a, h.b))}</mark>`;
    i = h.b;
  });
  return out + esc(src.slice(i));
}

/* reconhecimento de voz: continua ouvindo até o visitante parar (ou 60 segundos) */
export class Voice {
  constructor(o) {
    this.o = o;
    this.on = false;
    this.prev = '';
  }
  get supported() { return !!SR; }
  start() {
    if (!SR || this.on) return;
    this.prev = '';
    this.heard = false;
    this.t0 = Date.now();
    this.on = true;
    this._run();
    this.o.onState(true);
    clearTimeout(this.limit);
    this.limit = setTimeout(() => this.stop(), 60000);
    /* sem fala nenhuma em 9 segundos: para e avisa */
    clearTimeout(this.quiet);
    this.quiet = setTimeout(() => { if (this.on && !this.heard) { this.o.onError('no-speech'); this.stop(); } }, 9000);
  }
  _run() {
    let rec;
    try { rec = new SR(); } catch (e) { this.on = false; this.o.onError('unsupported'); this.o.onState(false); return; }
    this.rec = rec;
    rec.lang = 'pt-BR';
    rec.interimResults = true;
    rec.continuous = true;
    rec.maxAlternatives = 1;
    let sessionFinal = '';
    rec.onresult = (e) => {
      let fin = '', mid = '';
      for (let i = 0; i < e.results.length; i++) {
        const r = e.results[i];
        if (r.isFinal) fin += r[0].transcript + ' ';
        else mid += r[0].transcript;
      }
      sessionFinal = fin;
      this.heard = true;
      /* depois de 6,5 segundos de silêncio, encerra sozinho */
      clearTimeout(this.quiet);
      this.quiet = setTimeout(() => { if (this.on) this.stop(); }, 6500);
      this.o.onText((this.prev + ' ' + fin + ' ' + mid).replace(/\s+/g, ' ').trim(), !!mid);
    };
    rec.onerror = (e) => { if (e.error !== 'aborted' && e.error !== 'no-speech') { this.on = false; this.o.onError(e.error); } else if (e.error === 'no-speech' && !this.prev && !sessionFinal) { this.on = false; this.o.onError('no-speech'); } };
    rec.onend = () => {
      this.prev = (this.prev + ' ' + sessionFinal).trim();
      if (this.on && Date.now() - this.t0 < 60000) { try { this._run(); return; } catch (err) { /* segue para o fim */ } }
      this.on = false;
      clearTimeout(this.limit);
      this.o.onState(false);
      this.o.onEnd && this.o.onEnd(this.prev);
    };
    try { rec.start(); } catch (e) { this.on = false; this.o.onError('start'); this.o.onState(false); }
  }
  stop() {
    this.on = false;
    clearTimeout(this.limit);
    clearTimeout(this.quiet);
    try { if (this.rec) this.rec.stop(); } catch (e) { /* já parou */ }
  }
}

/* digita um texto aos poucos; devolve uma função para cancelar */
export function typeOut(text, onStep, o = {}) {
  const cps = o.cps || 24;
  let i = 0, alive = true, last = performance.now(), acc = 0;
  const tick = (now) => {
    if (!alive) return;
    acc += ((now - last) / 1000) * cps;
    last = now;
    const n = Math.floor(acc);
    if (n > 0) { acc -= n; i = Math.min(text.length, i + n); onStep(text.slice(0, i), i >= text.length); }
    if (i < text.length) requestAnimationFrame(tick);
  };
  requestAnimationFrame(tick);
  return () => { alive = false; };
}
