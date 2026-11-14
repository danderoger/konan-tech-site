/* Konan Tech 3.0: escolhe a força do efeito 3D de acordo com o aparelho.
   0 = leve (aparelhos modestos ou sem aceleração de vídeo), 1 = médio (celulares), 2 = completo.
   Na página: ?tier=0, ?tier=1 ou ?tier=2 força um nível; ?hq trava o nível completo (usado nos testes). */

export const TIERS = [
  { count: 9000, dpr: 1 },
  { count: 20000, dpr: 1.5 },
  { count: 42000, dpr: 1.75 }
];

export function probeGL() {
  try {
    const c = document.createElement('canvas');
    const gl = c.getContext('webgl2') || c.getContext('webgl');
    if (!gl) return { ok: false };
    const ext = gl.getExtension('WEBGL_debug_renderer_info');
    const name = ext ? gl.getParameter(ext.UNMASKED_RENDERER_WEBGL) : '';
    const software = /swiftshader|llvmpipe|software|softpipe|basic render/i.test(name || '');
    const lose = gl.getExtension('WEBGL_lose_context');
    if (lose) lose.loseContext();
    return { ok: true, software, name };
  } catch (e) {
    return { ok: false };
  }
}

export function pickTier(gl) {
  const qs = new URLSearchParams(location.search);
  if (qs.has('tier')) return Math.max(0, Math.min(2, parseInt(qs.get('tier'), 10) || 0));
  if (qs.has('hq')) return 2;
  const mem = navigator.deviceMemory || 8;
  const cores = navigator.hardwareConcurrency || 8;
  const small = Math.min(innerWidth, innerHeight) < 600 || innerWidth <= 760;
  const save = !!(navigator.connection && navigator.connection.saveData);
  if (gl && gl.software) return 0;
  if (save || mem <= 2 || cores <= 2) return 0;
  if (small || mem <= 4 || cores <= 4) return 1;
  return 2;
}
