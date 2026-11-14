#!/bin/sh
# Gera de novo js/vendor/three.min.js (Three.js com só o que o site usa) e copia GSAP e Lenis.
# Rode na raiz do projeto: sh scripts/build-vendor.sh
set -e
TMP=$(mktemp -d)
cp scripts/three-entry.js "$TMP/"
cd "$TMP"
npm init -y >/dev/null
npm install three@0.187.0 gsap@3.15.1 lenis@1.3.27 esbuild --no-audit --no-fund >/dev/null
./node_modules/.bin/esbuild three-entry.js --bundle --format=esm --minify --legal-comments=eof --target=es2020 --outfile=three.min.js
cd - >/dev/null
cp "$TMP/three.min.js" js/vendor/three.min.js
cp "$TMP/node_modules/gsap/dist/gsap.min.js" "$TMP/node_modules/gsap/dist/ScrollTrigger.min.js" "$TMP/node_modules/lenis/dist/lenis.min.js" js/vendor/
echo "Pronto: js/vendor atualizado"
