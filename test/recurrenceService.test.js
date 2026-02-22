import test from 'node:test';
import assert from 'node:assert/strict';
import { DataStore } from '../src/dataStore.js';
import { InternalNotifier } from '../src/notifier.js';
import { listPendingByCollaborator, runDailyRecurrenceNotificationJob } from '../src/recurrenceService.js';

function createStoreWithOrders(orders) {
  const store = new DataStore();
  for (const order of orders) store.upsertRecurringOrder(order);
  return store;
}

test('job notifica apenas janelas D+0..D+3 e evita duplicidade', async () => {
  const store = createStoreWithOrders([
    { id: 'A', collaboratorId: 'c1', nextBillingDate: '2025-01-10T11:00:00Z', needsConfirmation: true },
    { id: 'B', collaboratorId: 'c1', nextBillingDate: '2025-01-14T11:00:00Z', needsConfirmation: true }
  ]);
  const sent = [];
  const notifier = new InternalNotifier([{ name: 'email', send: async (payload) => sent.push(payload) }]);

  const now = new Date('2025-01-10T10:00:00Z');
  const firstRun = await runDailyRecurrenceNotificationJob({ store, notifier, now, timeZone: 'UTC' });
  const secondRun = await runDailyRecurrenceNotificationJob({ store, notifier, now, timeZone: 'UTC' });

  assert.equal(firstRun.length, 1);
  assert.equal(secondRun.length, 0);
  assert.equal(store.getNotifications().length, 1);
  assert.equal(sent.length, 1);
});

test('fuso horário e virada do dia consideram data de negócio', () => {
  const store = createStoreWithOrders([
    {
      id: 'TZ-1',
      collaboratorId: 'ana',
      nextBillingDate: '2025-01-12T01:00:00Z',
      needsConfirmation: true
    }
  ]);

  const pending = listPendingByCollaborator({
    store,
    collaboratorId: 'ana',
    now: new Date('2025-01-10T23:30:00-03:00'),
    timeZone: 'America/Sao_Paulo'
  });

  assert.equal(pending.length, 1);
  assert.equal(pending[0].daysUntilBilling, 1);
});

test('confirmação no mesmo dia não gera notificação', async () => {
  const store = createStoreWithOrders([
    {
      id: 'C-1',
      collaboratorId: 'c2',
      nextBillingDate: '2025-02-01T12:00:00Z',
      needsConfirmation: true,
      confirmedAt: '2025-02-01T03:00:00Z'
    }
  ]);

  const notifier = new InternalNotifier([{ name: 'slack', send: async () => ({ channel: 'slack', status: 'sent' }) }]);
  const notified = await runDailyRecurrenceNotificationJob({
    store,
    notifier,
    now: new Date('2025-02-01T18:00:00Z'),
    timeZone: 'UTC'
  });

  assert.equal(notified.length, 0);
  assert.equal(store.getNotifications().length, 0);
});
