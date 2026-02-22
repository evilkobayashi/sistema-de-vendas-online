import { readFile, writeFile } from 'node:fs/promises';

const DEFAULT_DATA = {
  recurring_orders: [],
  recurrence_notifications: []
};

export class DataStore {
  constructor(filePath = null) {
    this.filePath = filePath;
    this.data = structuredClone(DEFAULT_DATA);
  }

  async load() {
    if (!this.filePath) return;
    try {
      const raw = await readFile(this.filePath, 'utf8');
      this.data = { ...structuredClone(DEFAULT_DATA), ...JSON.parse(raw) };
    } catch (error) {
      if (error.code !== 'ENOENT') throw error;
      await this.save();
    }
  }

  async save() {
    if (!this.filePath) return;
    await writeFile(this.filePath, JSON.stringify(this.data, null, 2));
  }

  getRecurringOrders() {
    return this.data.recurring_orders;
  }

  upsertRecurringOrder(order) {
    const index = this.data.recurring_orders.findIndex((item) => item.id === order.id);
    if (index >= 0) this.data.recurring_orders[index] = { ...this.data.recurring_orders[index], ...order };
    else this.data.recurring_orders.push(order);
  }

  getNotifications() {
    return this.data.recurrence_notifications;
  }

  findNotification(orderId, dueDateKey) {
    return this.data.recurrence_notifications.find(
      (notification) => notification.orderId === orderId && notification.dueDateKey === dueDateKey
    );
  }

  insertNotification(notification) {
    this.data.recurrence_notifications.push(notification);
  }
}
