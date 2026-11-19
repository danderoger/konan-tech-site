/* Ponto de entrada do Three.js usado pelos dois palcos do site. */
export {
  Scene, PerspectiveCamera, WebGLRenderer, BufferGeometry, BufferAttribute, Points, LineSegments, Group,
  ShaderMaterial, Color, Vector2, Vector3, CustomBlending, AddEquation, OneFactor, OneMinusSrcAlphaFactor,
  Mesh, MeshStandardMaterial, LineBasicMaterial, EdgesGeometry, BoxGeometry, CylinderGeometry,
  GridHelper, HemisphereLight, DirectionalLight, CanvasTexture, EquirectangularReflectionMapping,
  SRGBColorSpace, ACESFilmicToneMapping, MathUtils
} from 'three';
export { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';
export { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
