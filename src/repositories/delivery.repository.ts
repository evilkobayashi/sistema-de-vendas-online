import { DatabaseClient } from '../db/database';
import { Delivery, DeliveryStatus } from '../models/types';

export class DeliveryRepository {
  constructor(private readonly db: DatabaseClient) {}

  async create(delivery: Omit<Delivery, 'estimatedAt' | 'deliveredAt'> & { estimatedAt?: Date | null; deliveredAt?: Date | null }): Promise<Delivery> {
    const result = await this.db.query<Delivery>(
      `INSERT INTO deliveries (id, order_id, patient_name, status, estimated_at, delivered_at)
       VALUES ($1, $2, $3, $4, $5, $6)
       RETURNING id, order_id AS "orderId", patient_name AS "patientName", status, estimated_at AS "estimatedAt", delivered_at AS "deliveredAt"`,
      [delivery.id, delivery.orderId, delivery.patientName, delivery.status, delivery.estimatedAt ?? null, delivery.deliveredAt ?? null]
    );
    return result.rows[0];
  }

  async searchByStatusAndOrder(status: DeliveryStatus, orderId?: string): Promise<Delivery[]> {
    if (orderId) {
      const result = await this.db.query<Delivery>(
        `SELECT id, order_id AS "orderId", patient_name AS "patientName", status, estimated_at AS "estimatedAt", delivered_at AS "deliveredAt"
         FROM deliveries WHERE status = $1 AND order_id = $2`,
        [status, orderId]
      );
      return result.rows;
    }

    const result = await this.db.query<Delivery>(
      `SELECT id, order_id AS "orderId", patient_name AS "patientName", status, estimated_at AS "estimatedAt", delivered_at AS "deliveredAt"
       FROM deliveries WHERE status = $1`,
      [status]
    );
    return result.rows;
  }

  async searchByPatientName(patientName: string): Promise<Delivery[]> {
    const result = await this.db.query<Delivery>(
      `SELECT id, order_id AS "orderId", patient_name AS "patientName", status, estimated_at AS "estimatedAt", delivered_at AS "deliveredAt"
       FROM deliveries
       WHERE patient_name ILIKE $1
       ORDER BY patient_name ASC`,
      [`%${patientName}%`]
    );

    return result.rows;
  }
}
