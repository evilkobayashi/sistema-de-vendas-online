import { randomUUID } from 'crypto';
import { DeliveryRepository } from '../repositories/delivery.repository';
import { MedicineRepository } from '../repositories/medicine.repository';
import { OrderRepository } from '../repositories/order.repository';
import { UserRepository } from '../repositories/user.repository';
import { Delivery, Order, OrderItem } from '../models/types';

interface OrderRequestItem {
  medicineId: string;
  quantity: number;
  unitPrice: number;
}

export interface CreateOrderRequest {
  userId: string;
  patientName: string;
  items: OrderRequestItem[];
}

export interface OrderCreationResult {
  order: Order;
  items: OrderItem[];
  delivery: Delivery;
}

export class OrderService {
  constructor(
    private readonly userRepository: UserRepository,
    private readonly medicineRepository: MedicineRepository,
    private readonly orderRepository: OrderRepository,
    private readonly deliveryRepository: DeliveryRepository
  ) {}

  async createOrder(input: CreateOrderRequest): Promise<OrderCreationResult> {
    const user = await this.userRepository.findById(input.userId);
    if (!user) {
      throw new Error('User not found');
    }

    for (const item of input.items) {
      const medicine = await this.medicineRepository.findById(item.medicineId);
      if (!medicine) {
        throw new Error(`Medicine ${item.medicineId} not found`);
      }
    }

    const totalAmount = input.items.reduce((acc, item) => acc + item.quantity * item.unitPrice, 0);

    const order = await this.orderRepository.createOrder({
      id: randomUUID(),
      userId: input.userId,
      status: 'created',
      totalAmount
    });

    const items = await this.orderRepository.createItems(
      input.items.map((item) => ({
        id: randomUUID(),
        orderId: order.id,
        medicineId: item.medicineId,
        quantity: item.quantity,
        unitPrice: item.unitPrice
      }))
    );

    const delivery = await this.deliveryRepository.create({
      id: randomUUID(),
      orderId: order.id,
      patientName: input.patientName,
      status: 'pending',
      estimatedAt: null,
      deliveredAt: null
    });

    return { order, items, delivery };
  }
}
