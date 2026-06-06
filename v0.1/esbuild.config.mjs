// esbuild 打包設定:把 TS 打包成 Electron 能跑的 JS
// 三個 entry:main(主行程)、preload、overlay(renderer)
import * as esbuild from 'esbuild';
import { cpSync, mkdirSync } from 'node:fs';
import { dirname } from 'node:path';

const watch = process.argv.includes('--watch');

/** 共用設定 */
const common = {
  bundle: true,
  sourcemap: true,
  logLevel: 'info',
  target: 'es2022',
};

/** 三個建置目標 */
const builds = [
  // main process(Node + Electron 環境,CommonJS)
  // mainFields 只留 'main':讓 esbuild 把 electron 當純 CJS,
  // 不套 __toESM interop,否則 electron.app 會跑到 .default 變 undefined
  {
    ...common,
    entryPoints: ['src/shell/main.ts'],
    outfile: 'dist/shell/main.js',
    platform: 'node',
    format: 'cjs',
    mainFields: ['main'],
    external: ['electron'],
  },
  // preload(Electron 沙盒橋,CommonJS)
  {
    ...common,
    entryPoints: ['src/preload/preload.ts'],
    outfile: 'dist/preload/preload.js',
    platform: 'node',
    format: 'cjs',
    mainFields: ['main'],
    external: ['electron'],
  },
  // overlay renderer(瀏覽器環境)
  {
    ...common,
    entryPoints: ['src/ui/overlay/overlay.ts'],
    outfile: 'dist/ui/overlay/overlay.js',
    platform: 'browser',
    format: 'iife',
  },
  // main 主視窗 renderer(瀏覽器環境)
  {
    ...common,
    entryPoints: ['src/ui/main/main.ts'],
    outfile: 'dist/ui/main/main.js',
    platform: 'browser',
    format: 'iife',
  },
];

/** 把靜態資源(html/css)複製到 dist */
function copyStatic() {
  const files = [
    ['src/ui/overlay/overlay.html', 'dist/ui/overlay/overlay.html'],
    ['src/ui/overlay/overlay.css', 'dist/ui/overlay/overlay.css'],
    ['src/ui/main/main.html', 'dist/ui/main/main.html'],
    ['src/ui/main/main.css', 'dist/ui/main/main.css'],
  ];
  for (const [from, to] of files) {
    mkdirSync(dirname(to), { recursive: true });
    cpSync(from, to);
  }
}

if (watch) {
  const ctxs = await Promise.all(builds.map((b) => esbuild.context(b)));
  await Promise.all(ctxs.map((c) => c.watch()));
  copyStatic();
  console.log('[esbuild] watching…');
} else {
  await Promise.all(builds.map((b) => esbuild.build(b)));
  copyStatic();
  console.log('[esbuild] build done');
}
