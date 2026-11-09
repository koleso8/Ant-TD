/// <reference types="node" />
import fs from 'node:fs';
import path from 'node:path';
import { defineConfig, type Plugin } from 'vite';

/**
 * После сборки вшивает JS прямо в index.html, чтобы dist/index.html
 * открывался двойным кликом (file://) без сервера и без внешних файлов.
 */
function singleFile(): Plugin {
  return {
    name: 'single-file-html',
    enforce: 'post',
    apply: 'build',
    generateBundle(_options, bundle) {
      const html = Object.values(bundle).find(
        (b) => b.type === 'asset' && b.fileName.endsWith('.html'),
      );
      const js = Object.values(bundle).find((b) => b.type === 'chunk' && b.isEntry);
      if (!html || html.type !== 'asset' || !js || js.type !== 'chunk') return;
      let src = String(html.source);
      src = src.replace(/<link rel="modulepreload"[^>]*>\s*/g, '');
      src = src.replace(
        /<script[^>]*src="[^"]*"[^>]*><\/script>/,
        () => `<script>\n${js.code}\n</script>`,
      );
      html.source = src;
      delete bundle[js.fileName];
    },
  };
}

/**
 * Только dev: пекарня спрайтов (sprites.html) присылает готовый лист, плагин кладёт
 * PNG и JSON с раскладкой в src/assets/sprites/, откуда игра их импортирует (в сборке вшиваются base64).
 */
function writeIfChanged(file: string, data: Buffer): void {
  if (fs.existsSync(file) && fs.readFileSync(file).equals(data)) return;
  fs.writeFileSync(file, data);
}

function spriteSaver(): Plugin {
  return {
    name: 'sprite-saver',
    apply: 'serve',
    configureServer(server) {
      server.middlewares.use('/__sprites/save', (req, res) => {
        if (req.method !== 'POST') {
          res.statusCode = 405;
          res.end('POST only');
          return;
        }
        let body = '';
        req.on('data', (chunk: Buffer | string) => { body += chunk; });
        req.on('end', () => {
          try {
            const { name, png, webp, meta } = JSON.parse(body) as { name: string; png?: string | null; webp?: string | null; meta: unknown };
            if (!/^[a-z0-9_-]+$/i.test(name)) throw new Error('bad sprite name');
            const dir = path.resolve(server.config.root, 'src/assets/sprites');
            fs.mkdirSync(dir, { recursive: true });
            const b64 = png ? png.replace(/^data:image\/png;base64,/, '') : null;
            // Пишем только изменившееся: иначе Vite перезагружает страницу пекарни, а та печёт заново, и так по кругу.
            if (b64) writeIfChanged(path.join(dir, `${name}.png`), Buffer.from(b64, 'base64'));
            writeIfChanged(path.join(dir, `${name}.json`), Buffer.from(JSON.stringify(meta, null, 2) + '\n'));
            if (webp) writeIfChanged(path.join(dir, `${name}.webp`), Buffer.from(webp.replace(/^data:image\/webp;base64,/, ''), 'base64'));
            res.setHeader('Content-Type', 'application/json');
            res.end(JSON.stringify({ ok: true }));
          } catch (e) {
            res.statusCode = 400;
            res.end(String(e));
          }
        });
      });
    },
  };
}

export default defineConfig({
  base: './',
  server: { host: true, port: 5173, strictPort: true },
  build: {
    target: 'es2019',
    modulePreload: false,
    assetsInlineLimit: 1e9,
    rollupOptions: {
      output: {
        format: 'iife',
        inlineDynamicImports: true,
        entryFileNames: 'game.js',
      },
    },
  },
  plugins: [singleFile(), spriteSaver()],
});
