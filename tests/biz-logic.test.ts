import { describe, expect, it, beforeEach } from 'vitest';
import {
  computePatientEligibility,
  calculateRunOutDate,
  parsePrescriptionToSuggestions,
  reserveStockFefo,
  buildInventorySummary,
  buildRecurringReminders
} from '../src/biz-logic.js';
import { deliveries, inventoryLots, inventoryMovements, orders, type Order } from '../src/data.js';

beforeEach(() => {
  inventoryLots.forEach((lot) => { lot.reserved = 0; });
  inventoryMovements.splice(0, inventoryMovements.length);
  deliveries.splice(0, deliveries.length);
  // Remove test orders added by eligibility tests
  orders.splice(0, orders.length);
});

describe('computePatientEligibility', () => {
  it('permite pedido quando não há entregas anteriores', () => {
    const result = computePatientEligibility('paciente-novo');
    expect(result.canOrderThisMonth).toBe(true);
    expect(result.nextEligibleDate).toBeDefined();
    expect(result.lastDeliveryDate).toBeUndefined();
  });

  it('bloqueia pedido no mesmo mês da última entrega', () => {
    const today = new Date().toISOString().slice(0, 10);
    deliveries.push({
      orderId: 'test-1',
      patientName: 'Test',
      patientId: 'blocked-1',
      status: 'entregue',
      forecastDate: today,
      carrier: 'TestCarrier'
    });

    const result = computePatientEligibility('blocked-1');
    expect(result.canOrderThisMonth).toBe(false);

    const nextMonth = new Date(today);
    nextMonth.setUTCMonth(nextMonth.getUTCMonth() + 1, 1);
    expect(result.nextEligibleDate).toBe(nextMonth.toISOString().slice(0, 10));
  });

  it('permite pedido quando última entrega foi em mês anterior', () => {
    const yesterday = new Date(Date.now() - 31 * 86400000).toISOString().slice(0, 10);
    deliveries.push({
      orderId: 'test-2',
      patientName: 'Prev',
      patientId: 'prev-1',
      status: 'entregue',
      forecastDate: yesterday,
      carrier: 'TestCarrier'
    });

    const result = computePatientEligibility('prev-1');
    expect(result.canOrderThisMonth).toBe(true);
  });
});

describe('calculateRunOutDate', () => {
  it('calcula data com consumo diário', () => {
    const result = calculateRunOutDate(2, 2, 30);
    expect(result).toBeDefined();
    expect(result).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  });

  it('usa treatmentDays quando fornecido', () => {
    const result = calculateRunOutDate(1, undefined, 30, 14);
    expect(result).toBeDefined();
    const diff = new Date(result!).getTime() - Date.now();
    const diffDays = diff / 86400000;
    expect(diffDays).toBeGreaterThanOrEqual(13);
    expect(diffDays).toBeLessThanOrEqual(15);
  });

  it('retorna undefined sem tabletsPerDay', () => {
    const result = calculateRunOutDate(2);
    expect(result).toBeUndefined();
  });

  it('calcula corretamente com 1 comprimido ao dia', () => {
    const result = calculateRunOutDate(1, 1, 30);
    const diff = new Date(result!).getTime() - Date.now();
    const diffDays = diff / 86400000;
    expect(diffDays).toBeGreaterThanOrEqual(29);
    expect(diffDays).toBeLessThanOrEqual(31);
  });
});

describe('parsePrescriptionToSuggestions', () => {
  it('encontra remédios por nome exato', () => {
    const result = parsePrescriptionToSuggestions('Receito CardioPlus para o paciente');
    expect(result.found).toBe(true);
    expect(result.suggestions.length).toBeGreaterThan(0);
    expect(result.suggestions[0].name).toContain('CardioPlus');
  });

  it('não encontra remédios sem termos comuns', () => {
    const result = parsePrescriptionToSuggestions('Receito xyzabc para qzvwlm de paciente');
    expect(result.found).toBe(false);
    expect(result.suggestions.length).toBe(0);
  });

  it('retorna sugestões ordenadas por confiança', () => {
    const result = parsePrescriptionToSuggestions('OncoRelief e ImunoCare para tratamento');
    expect(result.found).toBe(true);
    for (let i: number = 1; i < result.suggestions.length; i++) {
      expect(result.suggestions[i - 1].confidence).toBeGreaterThanOrEqual(result.suggestions[i].confidence);
    }
  });

  it('máximo de 5 sugestões', () => {
    const result = parsePrescriptionToSuggestions('Remédio medicamento tratamento paciente dor febre inflamação alergia pressão');
    expect(result.suggestions.length).toBeLessThanOrEqual(5);
  });
});

describe('reserveStockFefo', () => {
  it('reserva estoque no lote mais próximo do vencimento', () => {
    const medId = inventoryLots[1].medicineId;
    reserveStockFefo(medId, 10, 'test-order-1', 'u1');

    const reserved = inventoryLots.find((l) => l.medicineId === medId)?.reserved ?? 0;
    expect(reserved).toBe(10);
  });

  it('falha quando estoque é insuficiente', () => {
    const medId = 'm2';
    const available = inventoryLots.filter((l) => l.medicineId === medId).reduce((a, l) => a + l.quantity, 0);
    expect(() => reserveStockFefo(medId, available + 1, 'test-order-2', 'u1')).toThrow(/Estoque insuficiente/);
  });

  it('distribui reserva entre múltiplos lotes (FEFO)', () => {
    const existingLot = inventoryLots[1];
    reserveStockFefo(existingLot.medicineId, existingLot.quantity, 'fefo-1', 'u1');
    expect(existingLot.reserved).toBe(existingLot.quantity);
  });
});

describe('buildInventorySummary', () => {
  it('retorna contagem por medicamento com estoque disponível', () => {
    const summary = buildInventorySummary();
    expect(summary.items.length).toBeGreaterThanOrEqual(4);
    expect(summary.critical).toBeDefined();
    expect(summary.nearExpiry).toBeDefined();
  });

  it('considera reservas no cálculo de disponível', () => {
    const medId = 'm2';
    inventoryLots.find((l) => l.medicineId === medId)!.reserved = 100;

    const summary = buildInventorySummary();
    const medItem = summary.items.find((i: any) => i.medicineId === medId);
    expect(medItem?.stockAvailable).toBeLessThan(medItem!.stockTotal);
  });
});

describe('buildRecurringReminders', () => {
  it('retorna pedidos com recorrência próxima', () => {
    const tomorrow = new Date(Date.now() + 2 * 86400000).toISOString().slice(0, 10);
    const testOrders: Order[] = [{
      id: 'rec-1',
      patientName: 'Paciente Recorrente',
      email: 'rec@test.com',
      phone: '11900000000',
      address: 'Rua Rec',
      patientId: 'p1',
      items: [],
      total: 100,
      controlledValidated: false,
      createdBy: 'u1',
      createdAt: new Date().toISOString(),
      recurring: { discountPercent: 10, nextBillingDate: tomorrow, needsConfirmation: true }
    }];

    const reminders = buildRecurringReminders(testOrders);
    expect(reminders.length).toBe(1);
    expect(reminders[0].message).toContain('Confirmar');
  });

  it('ignora pedidos sem recorrência', () => {
    const testOrders: Order[] = [{
      id: 'no-rec',
      patientName: 'Avulso',
      email: 'av@t.com',
      phone: '11900000000',
      address: 'Rua Av',
      patientId: 'p2',
      items: [],
      total: 50,
      controlledValidated: false,
      createdBy: 'u1',
      createdAt: new Date().toISOString()
    }];

    const reminders = buildRecurringReminders(testOrders);
    expect(reminders.length).toBe(0);
  });
});
