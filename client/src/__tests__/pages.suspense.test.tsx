/// <reference types="vitest/globals" />
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import { Suspense, lazy } from 'react';
import { MemoryRouter } from 'react-router-dom';

// ── API mock ─────────────────────────────────────────────────────────────────
vi.mock('../api', () => ({
  default: {
    get: vi.fn((url: string) => {
      if (url.startsWith('/orders')) return Promise.resolve({ items: [] });
      if (url.startsWith('/inventory/summary')) return Promise.resolve({ items: [], critical: 0, nearExpiry: 0 });
      if (url.startsWith('/medicines')) return Promise.resolve({ items: [] });
      if (url.startsWith('/dashboard')) return Promise.resolve({
        indicators: { pedidos: 0, entregasPendentes: 0, estoqueCritico: 0, lotesProximosVencimento: 0, totalSales: 0 },
        reminders: [],
      });
      return Promise.resolve({});
    }),
    post: vi.fn().mockResolvedValue({}),
    patch: vi.fn().mockResolvedValue({}),
  },
}));

vi.mock('react-hot-toast', () => ({
  default: { error: vi.fn(), success: vi.fn() },
  Toaster: () => null,
}));

// ── localStorage mock ─────────────────────────────────────────────────────────
beforeEach(() => {
  vi.spyOn(Storage.prototype, 'getItem').mockImplementation((key) => {
    if (key === 'auth_user') return JSON.stringify({ role: 'operador', name: 'Test' });
    if (key === 'auth_token') return 'fake-token';
    if (key === 'sidebar_collapsed') return 'false';
    if (key === 'theme') return 'dark';
    return null;
  });
});

const FALLBACK = 'Carregando página...';

const LazyDashboard = lazy(() => import('../pages/Dashboard'));
const LazyPedidos = lazy(() => import('../pages/Pedidos'));
const LazyEstoque = lazy(() => import('../pages/Estoque'));

function SuspenseWrapper({ children }: { children: React.ReactNode }) {
  return (
    <MemoryRouter>
      <Suspense fallback={<div>{FALLBACK}</div>}>
        {children}
      </Suspense>
    </MemoryRouter>
  );
}

describe('Lazy-loaded pages within Suspense', () => {
  it('Dashboard carrega e não exibe mais o fallback', async () => {
    render(
      <SuspenseWrapper>
        <LazyDashboard />
      </SuspenseWrapper>,
    );

    await waitFor(
      () => expect(screen.queryByText(FALLBACK)).not.toBeInTheDocument(),
      { timeout: 3_000 },
    );
  });

  it('Pedidos carrega e não exibe mais o fallback', async () => {
    render(
      <SuspenseWrapper>
        <LazyPedidos />
      </SuspenseWrapper>,
    );

    await waitFor(
      () => expect(screen.queryByText(FALLBACK)).not.toBeInTheDocument(),
      { timeout: 3_000 },
    );
  });

  it('Estoque carrega e não exibe mais o fallback', async () => {
    render(
      <SuspenseWrapper>
        <LazyEstoque />
      </SuspenseWrapper>,
    );

    await waitFor(
      () => expect(screen.queryByText(FALLBACK)).not.toBeInTheDocument(),
      { timeout: 3_000 },
    );
  });
});
