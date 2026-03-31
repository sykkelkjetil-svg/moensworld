#!/usr/bin/env node
/**
 * Frost API proxy + web server
 * Kjør: node frost-proxy.js
 * Åpne:  http://localhost:3333
 */

const http  = require('http');
const https = require('https');
const fs    = require('fs');
const path  = require('path');
const url   = require('url');

const PORT      = 3333;
const CLIENT_ID = '28d354ac-9ec4-4749-9a6b-122162028a89';
const AUTH      = 'Basic ' + Buffer.from(CLIENT_ID + ':').toString('base64');
const FROST_HOST= 'frost.met.no';

const CORS = {
  'Access-Control-Allow-Origin':  '*',
  'Access-Control-Allow-Headers': '*',
  'Access-Control-Allow-Methods': 'GET, OPTIONS',
};

const server = http.createServer((req, res) => {
  const parsed = url.parse(req.url, true);

  // ── Static: serve vaerkart.html at root ──────────────────────────────
  if (parsed.pathname === '/' || parsed.pathname === '/vaerkart.html') {
    const file = path.join(__dirname, 'vaerkart.html');
    fs.readFile(file, (err, data) => {
      if (err) { res.writeHead(404); res.end('Not found'); return; }
      res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8', ...CORS });
      res.end(data);
    });
    return;
  }

  // ── CORS preflight ────────────────────────────────────────────────────
  if (req.method === 'OPTIONS') {
    res.writeHead(204, CORS);
    res.end();
    return;
  }

  // ── Proxy: /frost/* → https://frost.met.no/* ─────────────────────────
  if (parsed.pathname.startsWith('/frost/')) {
    const frostPath = parsed.pathname.replace('/frost/', '/') + (parsed.search || '');
    const options = {
      hostname: FROST_HOST,
      path:     frostPath,
      method:   'GET',
      headers:  { Authorization: AUTH, Accept: 'application/json' },
    };

    const proxyReq = https.request(options, (proxyRes) => {
      res.writeHead(proxyRes.statusCode, {
        'Content-Type': proxyRes.headers['content-type'] || 'application/json',
        ...CORS,
      });
      proxyRes.pipe(res);
    });

    proxyReq.on('error', (e) => {
      console.error('Proxy error:', e.message);
      res.writeHead(502, CORS);
      res.end(JSON.stringify({ error: e.message }));
    });

    proxyReq.end();
    return;
  }

  res.writeHead(404, CORS);
  res.end('Not found');
});

server.listen(PORT, () => {
  console.log(`\n  ⛅  Norsk Vær Live`);
  console.log(`  Åpne: http://localhost:${PORT}\n`);
});
