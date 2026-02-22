import { DatabaseClient } from '../db/database';
import { User } from '../models/types';

export class UserRepository {
  constructor(private readonly db: DatabaseClient) {}

  async findById(id: string): Promise<User | null> {
    const result = await this.db.query<User>(
      'SELECT id, patient_name AS "patientName", email, created_at AS "createdAt" FROM users WHERE id = $1',
      [id]
    );
    return result.rows[0] ?? null;
  }
}
