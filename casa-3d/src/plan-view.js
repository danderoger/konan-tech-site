const SVG = 'http://www.w3.org/2000/svg';
const COLORS = {
  sala: '#dcebf7', cozinha: '#e9edf3', quarto: '#e9e2f3', suite: '#e9e2f3',
  banheiro: '#d9edf0', lavabo: '#d9edf0', varanda: '#e1ecde', garagem: '#ebedf0', servico: '#d9edf0',
};
const AREA = new Intl.NumberFormat('pt-BR', { maximumFractionDigits: 1 });

function svgElement(tag, attrs, text) {
  const node = document.createElementNS(SVG, tag);
  for (const [key, value] of Object.entries(attrs)) node.setAttribute(key, value);
  if (text) node.textContent = text;
  return node;
}

export const formatArea = (value) => AREA.format(value) + ' m²';

export function renderPlan(svg, plan, selected) {
  const { rooms, segs, W, D } = plan;
  const margin = Math.max(W, D) * 0.06;
  svg.setAttribute('viewBox', [-W / 2 - margin, -D / 2 - margin, W + margin * 2, D + margin * 2].join(' '));
  const floors = svgElement('g', {});
  const walls = svgElement('g', { stroke: '#34455b', 'stroke-linecap': 'square', 'aria-hidden': 'true' });
  const labels = svgElement('g', { 'text-anchor': 'middle', 'aria-hidden': 'true' });

  for (const room of rooms) {
    const active = room.idx === selected;
    floors.append(svgElement('rect', {
      x: room.x0, y: room.z0, width: room.w, height: room.d,
      fill: active ? '#bbd6ff' : COLORS[room.k] || '#e9eef5',
    }));
    const size = Math.min(0.47, room.d * 0.23, room.w / (room.name.length * 0.63));
    labels.append(
      svgElement('text', { x: room.cx, y: room.cz, fill: '#203651', 'font-weight': 700, 'font-size': size }, room.name),
      svgElement('text', { x: room.cx, y: room.cz + size * 1.12, fill: '#405974', 'font-size': size * 0.8 }, formatArea(room.area)),
    );
  }

  for (const wall of segs) {
    const line = (start, end, attrs) => {
      if (end <= start) return;
      walls.append(svgElement('line', {
        x1: wall.x0 + (wall.horiz ? start : 0), y1: wall.z0 + (wall.horiz ? 0 : start),
        x2: wall.x0 + (wall.horiz ? end : 0), y2: wall.z0 + (wall.horiz ? 0 : end),
        'stroke-width': wall.thick, ...attrs,
      }));
    };
    let cursor = 0;
    for (const opening of [...wall.ops].sort((a, b) => a.c - b.c)) {
      const start = Math.max(cursor, 0, opening.c - opening.w / 2);
      const end = Math.min(wall.len, opening.c + opening.w / 2);
      line(cursor, start);
      if (opening.kind === 'win' || opening.kind === 'high') {
        line(start, end, { stroke: '#3583bd', 'stroke-width': wall.thick * 0.56 });
      }
      cursor = Math.max(cursor, end);
    }
    line(cursor, wall.len);
  }
  svg.replaceChildren(floors, walls, labels);
}

export function renderRooms(plan, selected, onSelect) {
  const list = document.querySelector('#rooms');
  const previous = document.activeElement;
  const focusedIndex = Array.from(list.children).findIndex((item) => item.contains(previous));
  const buttons = [];
  const items = plan.rooms.map((room) => {
    const item = document.createElement('li');
    const button = document.createElement('button');
    button.type = 'button';
    button.classList.toggle('on', room.idx === selected);
    button.setAttribute('aria-pressed', String(room.idx === selected));
    const name = document.createElement('span');
    name.textContent = room.name;
    const area = document.createElement('em');
    area.textContent = formatArea(room.area);
    button.append(name, area);
    button.addEventListener('click', () => onSelect(room.idx));
    buttons.push(button);
    item.append(button);
    return item;
  });
  list.replaceChildren(...items);
  buttons[focusedIndex]?.focus({ preventScroll: true });
  document.querySelector('#total').textContent = formatArea(plan.total);
}
