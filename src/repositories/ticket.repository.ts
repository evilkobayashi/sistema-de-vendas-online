import { DatabaseClient } from '../db/database';
import { Ticket } from '../models/types';

export class TicketRepository {
  constructor(private readonly db: DatabaseClient) {}

  async findByOrderId(orderId: string): Promise<Ticket[]> {
    const result = await this.db.query<Ticket>(
      `SELECT id, order_id AS "orderId", user_id AS "userId", subject, status, created_at AS "createdAt"
       FROM tickets WHERE order_id = $1 ORDER BY created_at DESC`,
      [orderId]
    );
    return result.rows;
  }
}
