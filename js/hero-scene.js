/* Dados dispersos convergem em um fluxo e se assentam no núcleo. As mesmas
   coordenadas projetadas alimentam o canvas e a imagem estática da abertura. */
const TAU = Math.PI * 2;
const CENTER = [362, 312];
const palette = ['#aebff8', '#7196ff', '#4b72fc', '#2356ed', '#063bd9', '#0e9bf5'];
const smooth = (v) => {
  const t = Math.max(0, Math.min(1, v));
  return t * t * (3 - 2 * t);
};

function radial(u, v, stage) {
  const wave = Math.sin(u * 3 + v * 1.9) * Math.sin(v) ** 2;
  const r = (163 + 21 * wave) * Math.sin(v);
  const sphere = [r * Math.cos(u), 168 * Math.cos(v) + 13 * wave, r * Math.sin(u)];
  const index = u / TAU;
  const shift = (1 - smooth((stage - 0.08) / 0.75)) * Math.sin(u * 2 + v * 5);
  return [
    sphere[0] + shift * (38 + v * 25),
    sphere[1] + shift * Math.sin(v + u) * 61,
    sphere[2] + shift * (18 + index * 118)
  ];
}

function projector(yaw, pitch, angle = -0.32) {
  const c = Math.cos(yaw), s = Math.sin(yaw), cp = Math.cos(pitch), sp = Math.sin(pitch);
  const cr = Math.cos(angle), sr = Math.sin(angle);
  return ([x, y, z]) => {
    const x1 = x * c + z * s;
    const z1 = z * c - x * s;
    const y1 = y * cp - z1 * sp;
    const z2 = y * sp + z1 * cp;
    const depth = 655 / (655 - z2);
    return [CENTER[0] + (x1 * cr - y1 * sr) * depth, CENTER[1] + (x1 * sr + y1 * cr) * depth, z2, depth];
  };
}

export function primitives({ yaw = -0.38, pitch = 0.18, stage = 1, compact = false } = {}) {
  const project = projector(yaw, pitch);
  const lines = [], dots = [];
  const ringPath = (rx, rz, elevation, tilt, from, to, color, width, opacity) => {
    const points = [];
    for (let i = 0; i <= 70; i++) {
      const a = from + (to - from) * i / 70;
      points.push(project([rx * Math.cos(a), elevation + tilt * Math.cos(a), rz * Math.sin(a)]));
    }
    lines.push({ points, color, width, opacity });
  };
  ringPath(256, 205, 0, -18, -0.13, 5.45, '#5680f7', 0.85, 0.32);
  ringPath(281, 224, 25, -30, 1.14, 5.52, '#5680f7', 0.65, 0.24);
  ringPath(224, 237, -14, 75, 0.48, 4.65, '#2862f2', 0.85, 0.31);
  ringPath(219, 196, 15, 17, 3.27, 6.78, '#528dff', 0.75, 0.35);
  ringPath(308, 172, 40, 68, 2.68, 5.77, '#5680f7', 0.65, 0.22);
  ringPath(233, 210, -32, 66, -0.68, 1.1, '#2862f2', 1, 0.43);

  const rowCount = compact ? 24 : 40;
  for (let row = 1; row < rowCount; row++) {
    const v = Math.PI * row / rowCount;
    const count = Math.max(9, Math.round((compact ? 56 : 94) * Math.sin(v)));
    const line = [];
    for (let col = 0; col < count; col++) {
      const u = TAU * (col + row / 5) / count;
      const point = project(radial(u, v, stage));
      const [x, y, z, depth] = point;
      const front = smooth((z + 160) / 290);
      const strength = (Math.sin(u * 2 - v * 4 + 0.5) + 1) / 2;
      const cyan = z > 0 && Math.sin(u * 3 + v * 2.6) > 0.89;
      const color = cyan ? 5 : Math.round(Math.min(4, 0.2 + front * 2.8 + strength));
      const radius = (0.5 + front * 0.69 + strength * 0.36) * depth * (compact ? 1.15 : 1);
      dots.push({ x, y, z, radius, color: palette[color], opacity: 0.38 + front * 0.49 });
      line.push(point);
    }
    if (row % 4 === 0) {
      line.push(line[0]);
      lines.push({ points: line, color: '#6a8df4', width: 0.7, opacity: 0.24 });
    }
  }

  for (let i = 0; i < 92; i++) {
    const a = i * 2.39996;
    const r = 197 + (i * 103 % 99);
    const [x, y, z] = project([Math.cos(a) * r, Math.sin(a * 1.52) * (30 + (i * 17 % 111)), Math.sin(a) * r]);
    dots.push({ x, y, z, radius: i % 11 === 0 ? 3 : i % 4 === 0 ? 1.8 : 1.1, color: palette[i % 11 === 0 ? 5 : 2], opacity: i % 4 === 0 ? 0.72 : 0.45 });
  }

  dots.sort((a, b) => a.z - b.z);
  return { lines, dots };
}

function paint(context, frame) {
  context.clearRect(0, 0, 720, 640);
  for (const { points, color, width, opacity } of frame.lines) {
    context.beginPath();
    context.moveTo(points[0][0], points[0][1]);
    for (const [x, y] of points.slice(1)) context.lineTo(x, y);
    context.strokeStyle = color;
    context.lineWidth = width;
    context.globalAlpha = opacity;
    context.stroke();
  }
  for (const { x, y, radius, color, opacity } of frame.dots) {
    context.beginPath();
    context.arc(x, y, radius, 0, TAU);
    context.fillStyle = color;
    context.globalAlpha = opacity;
    context.fill();
  }
  context.globalAlpha = 1;
}

export function initHero(figure, canvas) {
  const motion = matchMedia('(prefers-reduced-motion: reduce)');
  const picture = figure.querySelector('img');
  if (motion.matches || navigator.connection?.saveData) return;
  const ctx = canvas.getContext('2d');
  if (!ctx) return;

  const compact = matchMedia('(max-width: 760px)').matches || (navigator.deviceMemory || 8) <= 4;
  const dpr = Math.min(devicePixelRatio || 1, compact ? 1 : 1.5);
  canvas.width = Math.round(720 * dpr);
  canvas.height = Math.round(640 * dpr);
  ctx.scale(dpr, dpr);

  let visible = false, active = false, raf = 0, start = 0, finished = false, lastPaint = 0;
  let yaw = 0, pitch = 0, targetX = 0, targetY = 0;
  const frame = (now) => {
    raf = 0;
    if (!active) return;
    start ||= now;
    const progress = finished ? 1 : Math.min(1, (now - start) / 3800);
    finished = progress === 1;
    yaw += (targetX - yaw) * 0.13;
    pitch += (targetY - pitch) * 0.13;
    if (now - lastPaint > (compact ? 31 : 15) || !lastPaint) {
      const phase = smooth(progress);
      paint(ctx, primitives({ yaw: -0.38 + (1 - phase) * 0.8 + yaw, pitch: 0.18 + pitch, stage: phase, compact }));
      lastPaint = now;
      canvas.hidden = false;
      picture.classList.add('hero-poster-covered');
    }
    if (!finished || Math.abs(yaw - targetX) + Math.abs(pitch - targetY) > 0.002) raf = requestAnimationFrame(frame);
  };
  function update() {
    active = visible && !document.hidden && !motion.matches;
    if (active && !raf) raf = requestAnimationFrame(frame);
    if (!active) {
      cancelAnimationFrame(raf);
      raf = 0;
    }
    if (motion.matches) {
      canvas.hidden = true;
      picture.classList.remove('hero-poster-covered');
      finished = true;
    }
  }
  const observer = new IntersectionObserver(([entry]) => {
    visible = entry.isIntersecting;
    update();
  }, { threshold: 0.12 });
  observer.observe(figure);
  document.addEventListener('visibilitychange', update);
  motion.addEventListener('change', update);
  figure.addEventListener('pointermove', (event) => {
    if (!active || event.pointerType !== 'mouse') return;
    const box = figure.getBoundingClientRect();
    targetX = ((event.clientX - box.left) / box.width - 0.5) * 0.32;
    targetY = ((event.clientY - box.top) / box.height - 0.5) * 0.24;
    if (!raf) raf = requestAnimationFrame(frame);
  });
  figure.addEventListener('pointerleave', () => {
    targetX = targetY = 0;
    if (active && !raf) raf = requestAnimationFrame(frame);
  });
}
