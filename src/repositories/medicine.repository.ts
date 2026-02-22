import { DatabaseClient } from '../db/database';
import { Medicine } from '../models/types';

export class MedicineRepository {
  constructor(private readonly db: DatabaseClient) {}

  async findById(id: string): Promise<Medicine | null> {
    const result = await this.db.query<Medicine>(
      'SELECT id, name, sku, created_at AS "createdAt" FROM medicines WHERE id = $1',
      [id]
    );
    return result.rows[0] ?? null;
  }
}
