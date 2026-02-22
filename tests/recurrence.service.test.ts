import { buildRepositories } from '../src/data';
import { RecurrenceService } from '../src/services/recurrence.service';
import { createTestDb, seedTestDb } from './testDb';

describe('RecurrenceService', () => {
  it('lists due recurring confirmations based on nextBillingDate', async () => {
    const db = createTestDb();
    await seedTestDb(db);
    const repos = buildRepositories(db);
    const service = new RecurrenceService(repos.recurringConfirmations);

    const due = await service.listDueConfirmations(new Date());

    expect(due).toHaveLength(1);
    expect(due[0].id).toBe('44444444-4444-4444-4444-444444444444');
  });
});
