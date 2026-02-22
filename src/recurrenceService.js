import { businessDateKey, dayDistance } from './dateUtils.js';

export async function runDailyRecurrenceNotificationJob({
  store,
  notifier,
  now = new Date(),
  timeZone = 'America/Sao_Paulo'
}) {
  const todayKey = businessDateKey(now, timeZone);
  const orders = store.getRecurringOrders();
  const pending = [];

  for (const order of orders) {
    if (!order.needsConfirmation) continue;

    const billingKey = businessDateKey(order.nextBillingDate, timeZone);
    const distance = dayDistance(todayKey, billingKey);
    if (distance < 0 || distance > 3) continue;

    if (order.confirmedAt) {
      const confirmationKey = businessDateKey(order.confirmedAt, timeZone);
      if (confirmationKey === todayKey) continue;
    }

    if (store.findNotification(order.id, billingKey)) continue;

    const notificationEvent = {
      id: crypto.randomUUID(),
      orderId: order.id,
      collaboratorId: order.collaboratorId,
      dueDateKey: billingKey,
      createdAt: new Date().toISOString(),
      channels: []
    };

    const deliveries = await notifier.notify({ collaboratorId: order.collaboratorId, order, billingKey });
    notificationEvent.channels = deliveries;

    store.insertNotification(notificationEvent);
    pending.push({ ...order, priority: distance === 0 ? 'alta' : 'normal' });
  }

  await store.save();
  return pending;
}

export function listPendingByCollaborator({ store, collaboratorId, now = new Date(), timeZone = 'America/Sao_Paulo' }) {
  const todayKey = businessDateKey(now, timeZone);

  return store
    .getRecurringOrders()
    .filter((order) => order.needsConfirmation)
    .filter((order) => !collaboratorId || order.collaboratorId === collaboratorId)
    .map((order) => {
      const billingKey = businessDateKey(order.nextBillingDate, timeZone);
      const distance = dayDistance(todayKey, billingKey);
      return { ...order, daysUntilBilling: distance, priority: distance <= 0 ? 'alta' : 'normal' };
    })
    .filter((order) => order.daysUntilBilling >= 0 && order.daysUntilBilling <= 3)
    .sort((a, b) => a.daysUntilBilling - b.daysUntilBilling);
}
