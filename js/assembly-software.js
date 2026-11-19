import layout from './assembly-layout.js';

const dot = (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
const add = (a, b) => [a[0] + b[0], a[1] + b[1], a[2] + b[2]];
const sub = (a, b) => [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
const cross = (a, b) => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
const unit = (v) => { const length = Math.hypot(...v); return v.map((n) => n / length); };
const blend = (a, b, t) => a.map((n, i) => n + (b[i] - n) * t);

const faces = [
  [[0, 3, 2, 1], [0, -1, 0]], [[4, 5, 6, 7], [0, 1, 0]],
  [[0, 4, 7, 3], [-1, 0, 0]], [[1, 2, 6, 5], [1, 0, 0]],
  [[0, 1, 5, 4], [0, 0, -1]], [[3, 7, 6, 2], [0, 0, 1]]
];
const corners = [
  [-1,-1,-1], [1,-1,-1], [1,-1,1], [-1,-1,1],
  [-1,1,-1], [1,1,-1], [1,1,1], [-1,1,1]
];

function tint(hex, multiplier) {
  const color = [1, 3, 5].map((i) => Math.round(Math.min(255, parseInt(hex.slice(i, i + 2), 16) * multiplier)));
  return `rgb(${color.join(' ')})`;
}

const prepared = layout.parts.map((part) => ({
  ...part,
  meshes: part.items.map(([kind, material, center, size]) => {
    const dimensions = kind === 'pin' ? [size[0] * 2, size[1], size[0] * 2] : size;
    const surface = layout.materials[material];
    return {
      center, surface,
      points: corners.map((corner) => corner.map((axis, i) => center[i] + axis * dimensions[i] / 2)),
      paint: faces.map(([, normal]) => tint(surface.color, surface.glow ? 1.35 : 1.07 + dot(normal, [-.23,.52,.34])))
    };
  })
}));

export function createSoftwareAssembly(canvas) {
  const context = canvas.getContext('2d');
  if (!context) throw new Error('Canvas indisponível');
  let width, height, scale;
  const target = layout.camera.target;
  const baseEye = sub(layout.camera.position, target);
  function resize() {
    const rect = canvas.getBoundingClientRect();
    scale = Math.min(window.devicePixelRatio || 1, 1.4);
    width = Math.max(1, rect.width);
    height = Math.max(1, rect.height);
    canvas.width = Math.round(width * scale);
    canvas.height = Math.round(height * scale);
    context.setTransform(scale, 0, 0, scale, 0, 0);
  }

  function draw(progress, angle = 0, elevation = 0) {
    const c = Math.cos(angle), s = Math.sin(angle);
    const eye = add(target, [c * baseEye[0] + s * baseEye[2], Math.max(.8, baseEye[1] + elevation), c * baseEye[2] - s * baseEye[0]]);
    const forward = unit(sub(target, eye));
    const right = unit(cross(forward, [0, 1, 0]));
    const up = cross(right, forward);
    const focal = height / (2 * Math.tan(layout.camera.fov * Math.PI / 360));
    const project = (point) => {
      const ray = sub(point, eye);
      const depth = dot(ray, forward);
      return [width / 2 + focal * dot(ray, right) / depth, height / 2 - focal * dot(ray, up) / depth, depth];
    };
    function path(screen) {
      context.beginPath();
      context.moveTo(screen[0][0], screen[0][1]);
      for (let i = 1; i < screen.length; i++) context.lineTo(screen[i][0], screen[i][1]);
    }

    context.clearRect(0, 0, width, height);
    context.strokeStyle = '#3b759a';
    context.lineWidth = .6;
    context.globalAlpha = .16 + (1 - progress) * .12;
    for (let i = -12; i <= 12; i++) {
      const n = i / 2;
      path([project([n, -.112, -6]), project([n, -.112, 6])]);
      context.stroke();
      path([project([-6, -.112, n]), project([6, -.112, n])]);
      context.stroke();
    }
    context.globalAlpha = 1;

    const layers = [];
    for (const part of prepared) {
      const t = Math.max(0, Math.min(1, (progress - part.start) / part.duration));
      if (t <= 0) continue;
      const origin = blend(part.origin, part.base, 1 - (1 - t) ** 3);
      for (const { points, center, surface, paint } of part.meshes) {
        const screen = points.map((point) => project(add(origin, point)));
        const eyeVector = sub(eye, add(origin, center));
        for (let i = 0; i < faces.length; i++) {
          const [indices, normal] = faces[i];
          if (dot(eyeVector, normal) <= 0) continue;
          const polygon = indices.map((index) => screen[index]);
          const depth = polygon.reduce((sum, point) => sum + point[2], 0) / 4;
          layers.push({ type: 'face', depth, polygon, surface, t, color: paint[i] });
        }
      }
      for (const [material, route, radius] of part.cables || []) {
        for (let i = 1; i < route.length; i++) {
          const screens = [project(add(origin, route[i - 1])), project(add(origin, route[i]))];
          const depth = (screens[0][2] + screens[1][2]) / 2;
          layers.push({ type: 'line', depth, polygon: screens, surface: layout.materials[material], t, radius });
        }
      }
    }

    layers.sort((a, b) => b.depth - a.depth);
    for (const { type, depth, polygon, surface, t, color, radius } of layers) {
      path(polygon);
      if (type === 'line') {
        context.strokeStyle = surface.color;
        context.globalAlpha = Math.min(.94, t + .2);
        context.lineWidth = Math.max(.65, radius * focal * 1.8 / depth);
        context.stroke();
      } else {
        context.closePath();
        if (t > .17) {
          context.fillStyle = color;
          context.globalAlpha = surface.glass ? .30 : Math.min(1, t + .45);
          context.fill();
        }
        if (t < .94 || surface.glass) {
          context.strokeStyle = '#91cefa';
          context.globalAlpha = (1 - t) * .65 + (surface.glass ? .23 : .025);
          context.lineWidth = .65;
          context.stroke();
        }
      }
    }
    context.globalAlpha = 1;
  }

  resize();
  return { draw, resize };
}
