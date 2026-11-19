// Gera UM arquivo HTML que abre com duplo clique (sem servidor), com todos os efeitos.
// Por quê: ao abrir pelo arquivo (file://), o navegador bloqueia scripts do tipo module
// e impede a leitura da logo pelas partículas. Aqui tudo vira um script comum e as imagens
// ficam dentro do próprio arquivo.
// Uso: ESBUILD_BIN=/caminho/esbuild node scripts/build-offline.mjs saida/konan-tech-7.0.html
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { dirname, join, extname } from 'node:path';
import { tmpdir } from 'node:os';

const root = new URL('..', import.meta.url).pathname;
const out = process.argv[2] || join(root, 'dist-offline', 'konan-tech-7.0.html');
const esbuild = process.env.ESBUILD_BIN || 'esbuild';
mkdirSync(dirname(out), { recursive: true });

const MIME = { '.png': 'image/png', '.jpg': 'image/jpeg', '.webp': 'image/webp', '.woff2': 'font/woff2', '.svg': 'image/svg+xml' };
const uri = (rel) => {
  const buf = readFileSync(join(root, rel));
  return `data:${MIME[extname(rel)]};base64,${buf.toString('base64')}`;
};

// 1) JavaScript: app + demos + palco 3D + Three.js em um único script comum
const tmpJs = join(tmpdir(), `konan-bundle-${process.pid}.js`);
execFileSync(esbuild, [join(root, 'js/app.js'), '--bundle', '--format=iife', '--minify', '--target=es2020', `--outfile=${tmpJs}`, '--log-level=warning'], { stdio: 'inherit' });
let js = readFileSync(tmpJs, 'utf8');
// imagens usadas pelo JavaScript (logo das partículas e logo do carimbo da planta)
for (const rel of ['assets/konan-logo-dark.png', 'assets/konan-logo.png']) js = js.split(rel).join(uri(rel));
js = js.replace(/<\/script/gi, '<\\/script');

// 2) CSS com a fonte embutida
let css = ['main.css', 'redesign.css'].map((file) => readFileSync(join(root, 'css', file), 'utf8')).join('\n');
css = css.replace(/\.\.\/(assets\/fonts\/[\w.-]+\.woff2)/g, (_, asset) => uri(asset));

// 3) HTML
let html = readFileSync(join(root, 'index.html'), 'utf8');
html = html.replace(/<link rel="preload"[^>]*>\n?/g, '');
html = html.replace(/<link rel="stylesheet" href="css\/main\.css">/, () => `<style>\n${css}\n</style>`);
html = html.replace('<link rel="stylesheet" href="css/redesign.css">\n', '');
html = html.replace(/<script defer src="js\/vendor\/lenis\.min\.js"><\/script>\n?/, '');
html = html.replace(/<script type="module" src="js\/app\.js"><\/script>/, () => `<script>\n${js}\n</script>`);
// imagens relativas viram dados dentro do arquivo (as URLs absolutas do og:image e do JSON-LD ficam como estão)
html = html.replace(/(src|srcset|href)="(assets\/[^"]+\.(?:png|jpg|webp|svg))"/g, (_, attr, rel) => `${attr}="${uri(rel)}"`);
// imagens listadas em atributos de dados (ex.: data-shots)
html = html.replace(/(?<![\w/.:-])(assets\/projetos\/[\w-]+\.webp)/g, (m, rel) => uri(rel));

const left = html.match(/(?<![\w/.:-])assets\/[\w./-]+/g);
if (left) console.warn('Atenção: sobraram caminhos relativos:', [...new Set(left)]);
html = html.replace('<head>', '<head>\n<meta name="robots" content="noindex, nofollow">');
writeFileSync(out, html);
console.log('Arquivo gerado:', out, (html.length / 1048576).toFixed(2) + ' MB');
