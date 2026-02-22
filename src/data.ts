import { DatabaseClient } from './db/database';
import { DeliveryRepository } from './repositories/delivery.repository';
import { MedicineRepository } from './repositories/medicine.repository';
import { OrderRepository } from './repositories/order.repository';
import { RecurringConfirmationRepository } from './repositories/recurring-confirmation.repository';
import { TicketRepository } from './repositories/ticket.repository';
import { UserRepository } from './repositories/user.repository';

export interface Repositories {
  users: UserRepository;
  medicines: MedicineRepository;
  orders: OrderRepository;
  deliveries: DeliveryRepository;
  tickets: TicketRepository;
  recurringConfirmations: RecurringConfirmationRepository;
}

export const buildRepositories = (db: DatabaseClient): Repositories => ({
  users: new UserRepository(db),
  medicines: new MedicineRepository(db),
  orders: new OrderRepository(db),
  deliveries: new DeliveryRepository(db),
  tickets: new TicketRepository(db),
  recurringConfirmations: new RecurringConfirmationRepository(db)
});
