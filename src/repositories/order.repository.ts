import { DatabaseClient } from '../db/database';
import { Order, OrderItem } from '../models/types';

export interface CreateOrderPayload {
  id: string;
  userId: string;
  status: Order['status'];
  totalAmount: number;
}

export interface CreateOrderItemPayload {
  id: string;
  orderId: string;
  medicineId: string;
  quantity: number;
  unitPrice: number;
}

export class OrderRepository {
  constructor(private readonly db: DatabaseClient) {}

  async createOrder(payload: CreateOrderPayload): Promise<Order> {
    const result = await this.db.query<Order>(
      `INSERT INTO orders (id, user_id, status, total_amount)
       VALUES ($1, $2, $3, $4)
       RETURNING id, user_id AS "userId", status, total_amount AS "totalAmount", created_at AS "createdAt"`,
      [payload.id, payload.userId, payload.status, payload.totalAmount]
    );

    return result.rows[0];
  }

  async createItems(items: CreateOrderItemPayload[]): Promise<OrderItem[]> {
    const created: OrderItem[] = [];
    for (const item of items) {
      const result = await this.db.query<OrderItem>(
        `INSERT INTO order_items (id, order_id, medicine_id, quantity, unit_price)
         VALUES ($1, $2, $3, $4, $5)
         RETURNING id, order_id AS "orderId", medicine_id AS "medicineId", quantity, unit_price AS "unitPrice"`,
        [item.id, item.orderId, item.medicineId, item.quantity, item.unitPrice]
      );
      created.push(result.rows[0]);
    }
    return created;
  }

  async findById(id: string): Promise<Order | null> {
    const result = await this.db.query<Order>(
      'SELECT id, user_id AS "userId", status, total_amount AS "totalAmount", created_at AS "createdAt" FROM orders WHERE id = $1',
      [id]
    );
    return result.rows[0] ?? null;
  }
}
