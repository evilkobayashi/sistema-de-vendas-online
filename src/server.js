import http from 'node:http';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { DataStore } from './dataStore.js';
import { listPendingByCollaborator, runDailyRecurrenceNotificationJob } from './recurrenceService.js';
import { InternalNotifier, consoleChannels } from './notifier.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const ROOT_DIR = path.resolve(__dirname, '..');
const store = new DataStore(path.join(ROOT_DIR, 'data.json'));
const notifier = new InternalNotifier(consoleChannels);

await store.load();

if (store.getRecurringOrders().length === 0) {
  store.upsertRecurringOrder({
    id: 'R-001',
    customer: 'Acme',
    collaboratorId: 'colab-ana',
    nextBillingDate: new Date().toISOString(),
    needsConfirmation: true
  });
  await store.save();
}

function sendJson(res, statusCode, payload) {
  res.writeHead(statusCode, { 'Content-Type': 'application/json; charset=utf-8' });
  res.end(JSON.stringify(payload));
}

const server = http.createServer(async (req, res) => {
  const url = new URL(req.url, 'http://localhost');

  if (req.method === 'GET' && url.pathname === '/api/recurrences/pending') {
    const collaboratorId = url.searchParams.get('collaboratorId');
    const pending = listPendingByCollaborator({ store, collaboratorId });
    return sendJson(res, 200, { data: pending });
  }

  if (req.method === 'POST' && url.pathname === '/api/jobs/recurrences/daily') {
    const pending = await runDailyRecurrenceNotificationJob({ store, notifier });
    return sendJson(res, 200, { notified: pending.length, data: pending });
  }

  const filePath = url.pathname === '/' ? path.join(ROOT_DIR, 'public/index.html') : path.join(ROOT_DIR, url.pathname);
  if (filePath.startsWith(path.join(ROOT_DIR, 'public'))) {
    try {
      const content = await readFile(filePath);
      const contentType = filePath.endsWith('.js') ? 'text/javascript; charset=utf-8' : 'text/html; charset=utf-8';
      res.writeHead(200, { 'Content-Type': contentType });
      res.end(content);
      return;
    } catch {
      // continue
    }
  }

  sendJson(res, 404, { error: 'Not found' });
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
  console.log(`Servidor iniciado em http://localhost:${PORT}`);
});
