#!/bin/sh
# Gera de novo casa-3d/casa3d.min.js (a casa em 3D) a partir de casa-3d/src/main.js.
# Rode na raiz do projeto: sh scripts/build-casa3d.sh
set -e
ROOT=$(pwd)
TMP=$(mktemp -d)
cd "$TMP"
npm init -y >/dev/null
npm install three@0.187.0 esbuild --no-audit --no-fund >/dev/null
NODE_PATH="$TMP/node_modules" ./node_modules/.bin/esbuild "$ROOT/casa-3d/src/main.js" --bundle --format=iife --minify --legal-comments=eof --target=es2020 --outfile="$ROOT/casa-3d/casa3d.min.js"
cd "$ROOT"
echo "Pronto: casa-3d/casa3d.min.js atualizado"
