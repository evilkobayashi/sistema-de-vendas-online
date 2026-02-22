import { DatabaseClient } from '../db/database';
import { RecurringConfirmation } from '../models/types';

export class RecurringConfirmationRepository {
  constructor(private readonly db: DatabaseClient) {}

  async listPending(fromDate: Date): Promise<RecurringConfirmation[]> {
    const result = await this.db.query<RecurringConfirmation>(
      `SELECT id, user_id AS "userId", order_id AS "orderId", next_billing_date AS "nextBillingDate", active, created_at AS "createdAt"
       FROM recurring_confirmations
       WHERE active = true AND next_billing_date <= $1
       ORDER BY next_billing_date ASC`,
      [fromDate]
    );

    return result.rows;
  }

  async postponeBilling(id: string, nextBillingDate: Date): Promise<void> {
    await this.db.query(
      'UPDATE recurring_confirmations SET next_billing_date = $2 WHERE id = $1',
      [id, nextBillingDate]
    );
  }
}
