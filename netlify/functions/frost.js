/**
 * Netlify Function: Frost API proxy
 * Videresender /frost/* → https://frost.met.no/* med autentisering
 */

const https = require('https');

const CLIENT_ID = '28d354ac-9ec4-4749-9a6b-122162028a89';
const AUTH      = 'Basic ' + Buffer.from(CLIENT_ID + ':').toString('base64');

const CORS_HEADERS = {
  'Access-Control-Allow-Origin':  '*',
  'Access-Control-Allow-Headers': 'Content-Type',
  'Access-Control-Allow-Methods': 'GET, OPTIONS',
};

exports.handler = async (event) => {
  // CORS preflight
  if (event.httpMethod === 'OPTIONS') {
    return { statusCode: 204, headers: CORS_HEADERS, body: '' };
  }

  // Hent Frost-stien: /frost/sources/v0.jsonld → /sources/v0.jsonld
  const frostPath = event.path.replace(/^\/frost/, '') || '/';
  const query     = event.rawQuery ? '?' + event.rawQuery : '';
  const fullPath  = frostPath + query;

  return new Promise((resolve) => {
    const options = {
      hostname: 'frost.met.no',
      path:     fullPath,
      method:   'GET',
      headers:  { Authorization: AUTH, Accept: 'application/json' },
    };

    const req = https.request(options, (res) => {
      let body = '';
      res.on('data', chunk => body += chunk);
      res.on('end', () => {
        resolve({
          statusCode: res.statusCode,
          headers: {
            'Content-Type': res.headers['content-type'] || 'application/json',
            ...CORS_HEADERS,
          },
          body,
        });
      });
    });

    req.on('error', (e) => {
      resolve({
        statusCode: 502,
        headers: CORS_HEADERS,
        body: JSON.stringify({ error: e.message }),
      });
    });

    req.end();
  });
};
