export type DeliveryStatus = 'pending' | 'in_transit' | 'delivered' | 'failed';
export type OrderStatus = 'created' | 'paid' | 'cancelled';

export interface User {
  id: string;
  patientName: string;
  email: string;
  createdAt: Date;
}

export interface Medicine {
  id: string;
  name: string;
  sku: string;
  createdAt: Date;
}

export interface Order {
  id: string;
  userId: string;
  status: OrderStatus;
  totalAmount: number;
  createdAt: Date;
}

export interface OrderItem {
  id: string;
  orderId: string;
  medicineId: string;
  quantity: number;
  unitPrice: number;
}

export interface Delivery {
  id: string;
  orderId: string;
  patientName: string;
  status: DeliveryStatus;
  estimatedAt: Date | null;
  deliveredAt: Date | null;
}

export interface Ticket {
  id: string;
  orderId: string;
  userId: string;
  subject: string;
  status: 'open' | 'closed';
  createdAt: Date;
}

export interface RecurringConfirmation {
  id: string;
  userId: string;
  orderId: string;
  nextBillingDate: Date;
  active: boolean;
  createdAt: Date;
}
