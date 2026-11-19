import layout from './assembly-layout.js';
import {
  Scene, PerspectiveCamera, WebGLRenderer, Group, Mesh, MeshStandardMaterial,
  LineSegments, LineBasicMaterial, EdgesGeometry, BoxGeometry, CylinderGeometry,
  GridHelper, HemisphereLight, DirectionalLight, Vector3, CanvasTexture,
  EquirectangularReflectionMapping, SRGBColorSpace, ACESFilmicToneMapping,
  MathUtils, RoundedBoxGeometry, mergeGeometries
} from './vendor/three.min.js';

const { clamp, lerp } = MathUtils;

function studioTexture() {
  const image = document.createElement('canvas');
  image.width = 384;
  image.height = 192;
  const context = image.getContext('2d');
  const ambient = context.createLinearGradient(0, 0, 0, 192);
  ambient.addColorStop(0, '#8ca4c3');
  ambient.addColorStop(.44, '#253d59');
  ambient.addColorStop(1, '#080e1c');
  context.fillStyle = ambient;
  context.fillRect(0, 0, 384, 192);
  const softboxes = [[84, 58, 70, '#d7ecff'], [277, 45, 64, '#ffd3a2'], [332, 103, 31, '#548bfb']];
  for (const [x, y, radius, color] of softboxes) {
    const gradient = context.createRadialGradient(x, y, 0, x, y, radius);
    gradient.addColorStop(0, color);
    gradient.addColorStop(1, '#ffffff00');
    context.fillStyle = gradient;
    context.fillRect(x - radius, y - radius, radius * 2, radius * 2);
  }
  const texture = new CanvasTexture(image);
  texture.mapping = EquirectangularReflectionMapping;
  texture.colorSpace = SRGBColorSpace;
  return texture;
}

function materials() {
  return Object.fromEntries(Object.entries(layout.materials).map(([key, params]) => {
    const surface = new MeshStandardMaterial({
      color: params.color, roughness: params.rough, metalness: params.metal
    });
    if (params.glow) {
      surface.emissive.set(params.color);
      surface.emissiveIntensity = params.glow * .43;
    }
    if (params.glass) {
      surface.transparent = true;
      surface.opacity = .26 + params.rough * .64;
      surface.depthWrite = false;
      surface.envMapIntensity = 1.1;
    }
    return [key, surface];
  }));
}

function createPart(data, surfaces) {
  const shell = new Group();
  const solids = new Group();
  const wires = [];
  const buckets = new Map();
  function collect(key, geometry) {
    if (!buckets.has(key)) buckets.set(key, []);
    buckets.get(key).push(geometry.index ? geometry.toNonIndexed() : geometry);
    if (geometry.index) geometry.dispose();
  }
  for (const [shape, material, position, size, bevel] of data.items) {
    const form = shape === 'pin' ? new CylinderGeometry(size[0], size[0], size[1], 12) : new RoundedBoxGeometry(...size, 1, bevel);
    form.translate(...position);
    collect(material, form);
    if (shape === 'box' && Math.max(...size) >= .56) {
      const proxy = new BoxGeometry(...size);
      const edges = new EdgesGeometry(proxy);
      edges.translate(...position);
      wires.push(edges);
      proxy.dispose();
    }
  }
  for (const [material, path, radius] of data.cables || []) {
    for (let i = 1; i < path.length; i++) {
      const begin = new Vector3(...path[i - 1]);
      const end = new Vector3(...path[i]);
      const direction = end.clone().sub(begin);
      const length = direction.length();
      const diameter = radius * 2;
      const cable = new BoxGeometry(diameter, length, diameter);
      const midpoint = begin.add(end).multiplyScalar(.5);
      cable.rotateX(Math.PI / 2);
      cable.rotateY(Math.atan2(direction.x, direction.z));
      cable.translate(midpoint.x, midpoint.y, midpoint.z);
      collect(material, cable);
    }
  }
  for (const [key, geometries] of buckets) {
    const merged = mergeGeometries(geometries);
    solids.add(new Mesh(merged, surfaces[key]));
    for (const geometry of geometries) geometry.dispose();
  }
  let wire = null;
  if (wires.length) {
    wire = new LineSegments(mergeGeometries(wires), new LineBasicMaterial({
      color: '#86d8ff', transparent: true, depthWrite: false, opacity: .6
    }));
    for (const edges of wires) edges.dispose();
    shell.add(wire);
  }
  shell.add(solids);
  return { shell, solids, wire, data };
}

export function createAssemblyScene(canvas, context) {
  const renderer = new WebGLRenderer({ canvas, context });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.55));
  renderer.outputColorSpace = SRGBColorSpace;
  renderer.toneMapping = ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.12;

  const scene = new Scene();
  scene.environment = studioTexture();
  scene.environmentIntensity = .85;
  const cameraSettings = layout.camera;
  const camera = new PerspectiveCamera(cameraSettings.fov, layout.aspect, .1, 100);
  const target = new Vector3(...cameraSettings.target);
  const fixed = new Vector3(...cameraSettings.position).sub(target);
  const up = new Vector3(0, 1, 0);

  scene.add(new HemisphereLight('#b6d8f6', '#14253a', 1.60));
  function illuminate(color, strength, position) {
    const light = new DirectionalLight(color, strength);
    light.position.set(...position);
    scene.add(light);
  }
  illuminate('#cfe8ff', 2.7, [1.6, 6.2, 3.8]);
  illuminate('#46a6ff', 2.2, [1.5, 5.6, -5.5]);
  illuminate('#ffac65', 2.2, [-5.2, 2.5, 1.85]);

  const grid = new GridHelper(12.3, 28, '#3877a3', '#194464');
  grid.position.y = -.112;
  grid.material.transparent = true;
  grid.material.depthWrite = false;
  scene.add(grid);

  const surfaces = materials();
  const parts = layout.parts.map((part) => createPart(part, surfaces));
  for (const part of parts) scene.add(part.shell);

  function resize() {
    const box = canvas.getBoundingClientRect();
    renderer.setSize(Math.max(1, Math.round(box.width)), Math.max(1, Math.round(box.height)), false);
    camera.aspect = box.width / Math.max(1, box.height);
    camera.updateProjectionMatrix();
  }

  function draw(progress, horizontal = 0, vertical = 0, explore = false) {
    camera.position.copy(fixed).applyAxisAngle(up, horizontal);
    camera.position.y = Math.max(.8, camera.position.y + vertical);
    camera.position.add(target);
    camera.lookAt(target);
    grid.material.opacity = explore ? .21 : lerp(.46, .12, progress);
    for (const { shell, solids, wire, data } of parts) {
      const t = clamp((progress - data.start) / data.duration, 0, 1);
      const ease = 1 - (1 - t) ** 3;
      shell.visible = t > 0;
      shell.position.set(...data.base.map((value, i) => lerp(data.origin[i], value, ease)));
      shell.scale.setScalar(lerp(.93, 1, ease));
      solids.visible = t > .18;
      if (wire) {
        wire.visible = !explore && t < .99;
        wire.material.opacity = .92 * (1 - t);
      }
    }
    renderer.render(scene, camera);
  }

  resize();
  return { draw, resize };
}
