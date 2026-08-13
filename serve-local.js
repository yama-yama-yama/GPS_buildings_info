// Vercelの@vercel/static-buildと同じレイアウトを再現するローカルサーバー
// - ビルド成果物(frontend/build/*) は /frontend/* として配信される
// - それ以外のパス(SPA遷移含む)は /frontend/index.html にフォールバック
const http = require('http');
const fs = require('fs');
const path = require('path');

const PORT = process.env.PORT || 3001;
const ROOT = __dirname;
const BUILD_DIR = path.join(ROOT, 'frontend', 'build');

const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.mjs': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.ico': 'image/x-icon',
  '.png': 'image/png',
  '.svg': 'image/svg+xml',
  '.txt': 'text/plain; charset=utf-8',
  '.map': 'application/json; charset=utf-8',
  '.woff': 'font/woff',
  '.woff2': 'font/woff2',
};

const server = http.createServer((req, res) => {
  let pathname = decodeURIComponent(new URL(req.url, 'http://localhost').pathname);

  // /frontend/* のときだけビルド成果物を返す(それ以外はSPAフォールバック)
  let file;
  if (pathname === '/frontend/' || pathname === '/frontend') {
    file = path.join(BUILD_DIR, 'index.html');
  } else if (pathname.startsWith('/frontend/')) {
    file = path.join(BUILD_DIR, pathname.slice('/frontend/'.length));
  } else {
    file = path.join(BUILD_DIR, 'index.html');
  }

  fs.readFile(file, (err, data) => {
    if (!err) {
      const ext = path.extname(file).toLowerCase();
      res.writeHead(200, { 'Content-Type': MIME[ext] || 'application/octet-stream' });
      res.end(data);
      return;
    }
    fs.readFile(path.join(BUILD_DIR, 'index.html'), (err2, html) => {
      if (err2) {
        res.writeHead(500, { 'Content-Type': 'text/plain' });
        res.end('build/index.html が見つかりません。先に npm run build を実行してください。');
        return;
      }
      res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
      res.end(html);
    });
  });
});

server.listen(PORT, () => {
  console.log(`Serving Vercel-equivalent layout at http://localhost:${PORT}/`);
});