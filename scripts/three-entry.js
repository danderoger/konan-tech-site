/* Ponto de entrada do pacote Three.js usado pelo site. Gere de novo com scripts/build-vendor.mjs */
export {
  Scene, PerspectiveCamera, OrthographicCamera, WebGLRenderer, BufferGeometry, BufferAttribute, Float32BufferAttribute,
  Points, LineSegments, Line, Mesh, Group, Object3D, ShaderMaterial, MeshBasicMaterial, PointsMaterial, LineBasicMaterial,
  PlaneGeometry, SphereGeometry, AdditiveBlending, NormalBlending, Color, Vector2, Vector3, Vector4, Quaternion, Euler,
  Matrix4, MathUtils, Clock, Raycaster, Plane, SRGBColorSpace, LinearSRGBColorSpace, CanvasTexture, Texture
} from 'three';
export { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
export { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
export { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';
export { OutputPass } from 'three/addons/postprocessing/OutputPass.js';
export { ShaderPass } from 'three/addons/postprocessing/ShaderPass.js';
