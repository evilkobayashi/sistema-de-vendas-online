import { RecurringConfirmation } from '../models/types';
import { RecurringConfirmationRepository } from '../repositories/recurring-confirmation.repository';

export class RecurrenceService {
  constructor(private readonly recurrenceRepository: RecurringConfirmationRepository) {}

  async listDueConfirmations(referenceDate = new Date()): Promise<RecurringConfirmation[]> {
    return this.recurrenceRepository.listPending(referenceDate);
  }

  async confirmAndReschedule(id: string, nextBillingDate: Date): Promise<void> {
    await this.recurrenceRepository.postponeBilling(id, nextBillingDate);
  }
}
