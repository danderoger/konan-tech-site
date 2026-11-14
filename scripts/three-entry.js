/* Ponto de entrada do pacote Three.js usado pelo site (só o que o palco de partículas usa).
   Gere de novo com: sh scripts/build-vendor.sh */
export {
  Scene, PerspectiveCamera, WebGLRenderer, BufferGeometry, BufferAttribute, Points, LineSegments, Group,
  ShaderMaterial, Color, Vector2, Vector3, CustomBlending, AddEquation, OneFactor, OneMinusSrcAlphaFactor
} from 'three';
