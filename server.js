const http = require('node:http');
const fs = require('node:fs');
const path = require('node:path');
const { DatabaseSync } = require('node:sqlite');

const root = __dirname;
const port = Number(process.env.PORT) || 8000;
const databasePath = process.env.DATABASE_PATH || path.join(root, 'comments.db');
const database = new DatabaseSync(databasePath);
database.exec(`
  CREATE TABLE IF NOT EXISTS comments (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    track_id TEXT NOT NULL,
    name TEXT NOT NULL,
    text TEXT NOT NULL,
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
  );
  CREATE INDEX IF NOT EXISTS comments_track_id_idx ON comments(track_id);
`);

const listComments = database.prepare(
  'SELECT id, name, text, created_at AS createdAt FROM comments WHERE track_id = ? ORDER BY id DESC'
);
const insertComment = database.prepare(
  'INSERT INTO comments (track_id, name, text) VALUES (?, ?, ?)'
);

const mimeTypes = {
  '.css': 'text/css; charset=utf-8',
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.mp3': 'audio/mpeg',
  '.png': 'image/png',
  '.svg': 'image/svg+xml',
  '.mp4': 'video/mp4',
  '.webmanifest': 'application/manifest+json; charset=utf-8',
};

function sendJson(response, statusCode, payload) {
  response.writeHead(statusCode, {
    'Content-Type': 'application/json; charset=utf-8',
    'Cache-Control': 'no-store',
  });
  response.end(JSON.stringify(payload));
}

function readRequestBody(request) {
  return new Promise((resolve, reject) => {
    let body = '';
    request.setEncoding('utf8');
    request.on('data', chunk => {
      body += chunk;
      if (body.length > 10000) {
        reject(new Error('Payload too large'));
        request.destroy();
      }
    });
    request.on('end', () => resolve(body));
    request.on('error', reject);
  });
}

async function handleComments(request, response, url) {
  const trackId = url.searchParams.get('track') || '';
  if (!/^[a-z0-9-]+$/.test(trackId)) {
    sendJson(response, 400, { error: 'Invalid track' });
    return;
  }

  if (request.method === 'GET') {
    sendJson(response, 200, { comments: listComments.all(trackId) });
    return;
  }

  if (request.method === 'POST') {
    let payload;
    try {
      payload = JSON.parse(await readRequestBody(request));
    } catch {
      sendJson(response, 400, { error: 'Invalid JSON' });
      return;
    }

    const name = String(payload.name || 'Anonyme').trim().slice(0, 40) || 'Anonyme';
    const text = String(payload.text || '').trim().slice(0, 280);
    if (!text) {
      sendJson(response, 400, { error: 'Comment is required' });
      return;
    }

    insertComment.run(trackId, name, text);
    sendJson(response, 201, { comments: listComments.all(trackId) });
    return;
  }

  response.setHeader('Allow', 'GET, POST');
  sendJson(response, 405, { error: 'Method not allowed' });
}

function serveStatic(request, response, url) {
  const requestedPath = decodeURIComponent(url.pathname === '/' ? '/index.html' : url.pathname);
  const filePath = path.resolve(root, `.${requestedPath}`);
  if (!filePath.startsWith(`${root}${path.sep}`)) {
    response.writeHead(403);
    response.end('Forbidden');
    return;
  }

  fs.stat(filePath, (error, stats) => {
    if (error || !stats.isFile()) {
      response.writeHead(404);
      response.end('Not found');
      return;
    }
    response.writeHead(200, {
      'Content-Type': mimeTypes[path.extname(filePath).toLowerCase()] || 'application/octet-stream',
      'Cache-Control': 'no-cache',
    });
    fs.createReadStream(filePath).pipe(response);
  });
}

const server = http.createServer(async (request, response) => {
  const url = new URL(request.url, `http://${request.headers.host || 'localhost'}`);
  try {
    if (url.pathname === '/api/comments') {
      await handleComments(request, response, url);
      return;
    }
    serveStatic(request, response, url);
  } catch (error) {
    console.error(error);
    if (!response.headersSent) sendJson(response, 500, { error: 'Internal server error' });
  }
});

server.listen(port, () => {
  console.log(`Philosophie Romaricaine available at http://localhost:${port}`);
  console.log(`Comments database: ${databasePath}`);
});

process.on('SIGINT', () => {
  database.close();
  server.close(() => process.exit(0));
});
