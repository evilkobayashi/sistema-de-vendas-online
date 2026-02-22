import bcrypt from 'bcryptjs';

export type SensitiveAction =
  | 'LOGIN'
  | 'CREATE_ORDER'
  | 'CONFIRM_RECURRENCE'
  | 'UPDATE_DELIVERY';

export interface AuditLog {
  userId: string;
  action: SensitiveAction;
  timestamp: string;
}

export interface UserRecord {
  id: string;
  username: string;
  passwordHash: string;
  legacyPassword?: string;
}

export interface Order {
  id: string;
  userId: string;
  description: string;
  recurringConfirmed: boolean;
}

export interface Delivery {
  id: string;
  userId: string;
  status: string;
}

export interface Ticket {
  id: string;
  userId: string;
  subject: string;
}

export interface DataStore {
  users: UserRecord[];
  orders: Order[];
  deliveries: Delivery[];
  tickets: Ticket[];
  auditLogs: AuditLog[];
}

const SALT_ROUNDS = 10;

export async function hashPassword(password: string): Promise<string> {
  return bcrypt.hash(password, SALT_ROUNDS);
}

export async function createDataStore(): Promise<DataStore> {
  const seededHash = await hashPassword('alice-pass');

  return {
    users: [
      {
        id: 'u1',
        username: 'alice',
        passwordHash: seededHash,
      },
      {
        id: 'u2',
        username: 'legacy-user',
        passwordHash: '',
        legacyPassword: 'legacy-pass',
      },
    ],
    orders: [
      { id: 'o1', userId: 'u1', description: 'Pedido Alice', recurringConfirmed: false },
      { id: 'o2', userId: 'u2', description: 'Pedido Legacy', recurringConfirmed: false },
    ],
    deliveries: [
      { id: 'd1', userId: 'u1', status: 'PENDING' },
      { id: 'd2', userId: 'u2', status: 'PENDING' },
    ],
    tickets: [
      { id: 't1', userId: 'u1', subject: 'Ticket Alice' },
      { id: 't2', userId: 'u2', subject: 'Ticket Legacy' },
    ],
    auditLogs: [],
  };
}

export async function verifyAndMigrateUserPassword(
  user: UserRecord,
  candidatePassword: string,
): Promise<boolean> {
  if (user.legacyPassword) {
    if (user.legacyPassword !== candidatePassword) {
      return false;
    }

    user.passwordHash = await hashPassword(candidatePassword);
    delete user.legacyPassword;
    return true;
  }

  if (!user.passwordHash) {
    return false;
  }

  return bcrypt.compare(candidatePassword, user.passwordHash);
}

export function addAuditLog(store: DataStore, userId: string, action: SensitiveAction): void {
  store.auditLogs.push({
    userId,
    action,
    timestamp: new Date().toISOString(),
  });
}
