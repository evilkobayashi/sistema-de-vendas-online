/// <reference types="vitest/globals" />
import { beforeEach, afterEach, describe, it, expect, vi } from 'vitest';
import { render } from '@testing-library/react';
import Dashboard from '../pages/Dashboard';

vi.mock('../api', () => ({
  default: {
    get: vi.fn().mockResolvedValue({
      indicators: {
        pedidos: 0,
        entregasPendentes: 0,
        estoqueCritico: 0,
        lotesProximosVencimento: 0,
        totalSales: 0,
      },
      reminders: [],
    }),
    patch: vi.fn().mockResolvedValue({}),
  },
}));

vi.mock('react-hot-toast', () => ({
  default: { error: vi.fn(), success: vi.fn() },
  Toaster: () => null,
}));

describe('Dashboard polling interval', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.clearAllMocks();
  });

  it('uses a 30-second polling interval', () => {
    const spy = vi.spyOn(globalThis, 'setInterval');
    render(<Dashboard />);

    const call = spy.mock.calls.find(([, delay]) => typeof delay === 'number' && delay >= 25_000);
    expect(call, 'setInterval deve ser chamado com delay >= 25000ms').toBeDefined();
    expect(call?.[1]).toBe(30_000);
  });

  it('does not use a 3-second polling interval', () => {
    const spy = vi.spyOn(globalThis, 'setInterval');
    render(<Dashboard />);

    const shortPoll = spy.mock.calls.find(([, delay]) => typeof delay === 'number' && delay <= 5_000);
    expect(shortPoll, 'Não deve haver polling com intervalo <= 5000ms').toBeUndefined();
  });
});
