import http from 'node:http';
import { existsSync, statSync } from 'node:fs';
import { readFile } from 'node:fs/promises';
import { gzip } from 'node:zlib';
import { promisify } from 'node:util';
const compress = promisify(gzip);
const encoded = new Map();
import path from 'node:path';

// Prévia local de arquivos exportados. Não é um servidor da aplicação.
const root = path.resolve(process.argv[2] || 'out');
const port = Number(process.argv[3] || 4173);
const types = { '.html':'text/html; charset=utf-8', '.txt':'text/plain; charset=utf-8', '.xml':'application/xml', '.json':'application/json', '.css':'text/css', '.js':'text/javascript', '.png':'image/png', '.webp':'image/webp', '.avif':'image/avif', '.ico':'image/x-icon', '.woff2':'font/woff2', '.svg':'image/svg+xml' };
http.createServer(async (req,res) => {
  let pathname;
  try { pathname = decodeURIComponent(new URL(req.url, 'http://localhost').pathname); }
  catch { res.writeHead(400).end(); return; }
  if (!['GET','HEAD'].includes(req.method)) { res.writeHead(405).end(); return; }
  let file = path.resolve(root, '.' + pathname);
  if (file !== root && !file.startsWith(root + path.sep)) { res.writeHead(403).end(); return; }
  if (existsSync(file) && statSync(file).isDirectory() && !existsSync(path.join(file,'index.html')) && existsSync(file + '.html')) file += '.html';
  if (existsSync(file) && statSync(file).isDirectory()) {
    if (!pathname.endsWith('/')) { res.writeHead(308, { Location: pathname + '/' + new URL(req.url,'http://localhost').search }).end(); return; }
    file = path.join(file,'index.html');
  }
  // Também permite medir o export anterior, sem trailingSlash.
  if (!existsSync(file) && !path.extname(file) && existsSync(file + '.html')) file += '.html';
  const found = existsSync(file) && statSync(file).isFile();
  if (!found) file = path.join(root,'404.html');
  if (!existsSync(file)) { res.writeHead(404).end('Não encontrado'); return; }
  try {
    const mime = types[path.extname(file)] || 'application/octet-stream';
    const useGzip = /\bgzip\b/.test(req.headers['accept-encoding'] || '') && /^(text\/|application\/(json|xml)|text\/javascript)/.test(mime);
    const key = file + ':' + statSync(file).mtimeMs + ':' + useGzip;
    if (!encoded.has(key)) encoded.set(key, readFile(file).then(bytes => useGzip ? compress(bytes) : bytes));
    const bytes = await encoded.get(key);
    res.writeHead(found ? 200 : 404, { 'Content-Type':mime, 'Content-Length':bytes.length, 'Cache-Control':'no-store', 'Vary':'Accept-Encoding', ...(useGzip ? {'Content-Encoding':'gzip'} : {}) });
    if (req.method === 'HEAD') res.end(); else res.end(bytes);
  } catch { res.writeHead(500).end('Falha ao ler arquivo da prévia'); }
}).listen(port,'127.0.0.1',()=>console.log(`Local: http://127.0.0.1:${port} — ${root}`));



