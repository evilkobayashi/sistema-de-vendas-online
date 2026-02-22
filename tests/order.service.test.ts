import { buildRepositories } from '../src/data';
import { OrderService } from '../src/services/order.service';
import { createTestDb, seedTestDb } from './testDb';

describe('OrderService', () => {
  it('creates order and delivery using repositories', async () => {
    const db = createTestDb();
    await seedTestDb(db);
    const repos = buildRepositories(db);
    const service = new OrderService(repos.users, repos.medicines, repos.orders, repos.deliveries);

    const result = await service.createOrder({
      userId: '11111111-1111-1111-1111-111111111111',
      patientName: 'Maria Souza',
      items: [
        { medicineId: 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', quantity: 2, unitPrice: 10 },
        { medicineId: 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb', quantity: 1, unitPrice: 30 }
      ]
    });

    expect(result.order.id).toBeDefined();
    expect(result.order.totalAmount).toBe(50);
    expect(result.items).toHaveLength(2);
    expect(result.delivery.status).toBe('pending');
  });
});
