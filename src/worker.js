import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { DataStore } from './dataStore.js';
import { InternalNotifier, consoleChannels } from './notifier.js';
import { runDailyRecurrenceNotificationJob } from './recurrenceService.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const ROOT_DIR = path.resolve(__dirname, '..');

const store = new DataStore(path.join(ROOT_DIR, 'data.json'));
const notifier = new InternalNotifier(consoleChannels);

await store.load();
const pending = await runDailyRecurrenceNotificationJob({ store, notifier });

console.log(`[worker] Job diário executado. Notificações enviadas: ${pending.length}`);
