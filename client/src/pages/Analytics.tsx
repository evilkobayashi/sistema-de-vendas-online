import { useEffect, useState } from 'react';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
  LineChart,
  Line
} from 'recharts';
import api from '../api';

interface RevenueByMonth {
  month: string;
  revenue: number;
}

interface TopProduct {
  medicineId: string;
  name: string;
  volume: number;
}

interface OrderStatusEntry {
  status: string;
  count: number;
}

interface DailyOrderCount {
  date: string;
  count: number;
}

interface AnalyticsData {
  revenueByMonth: RevenueByMonth[];
  topProducts: TopProduct[];
  orderStatusDistribution: OrderStatusEntry[];
  dailyOrderCount: DailyOrderCount[];
}

const STATUS_COLORS: Record<string, string> = {
  pendente: '#f59e0b',
  em_rota: '#3b82f6',
  entregue: '#10b981',
  sem_entrega: '#6b7280'
};

const CHART_COLORS = ['#0d9488', '#10b981', '#14b8a6', '#06b6d4', '#3b82f6', '#8b5cf6', '#ec4899', '#f59e0b', '#ef4444', '#84cc16'];

const money = (v: number) =>
  new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(v);

function EmptyChart({ message }: { message: string }) {
  return (
    <div className="empty" style={{ minHeight: 200, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      {message}
    </div>
  );
}

function SectionCard({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="card" style={{ padding: 24, marginBottom: 24 }}>
      <h3 style={{ marginBottom: 20, color: 'var(--text-main)' }}>{title}</h3>
      {children}
    </div>
  );
}

export default function Analytics() {
  const [data, setData] = useState<AnalyticsData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    api
      .get('/analytics')
      .then((d: unknown) => setData(d as AnalyticsData))
      .catch((err: Error) => setError(err.message))
      .finally(() => setLoading(false));
  }, []);

  if (loading) {
    return (
      <div style={{ display: 'grid', gap: 16 }}>
        {[1, 2, 3, 4].map((i) => (
          <div
            key={i}
            className="card"
            style={{
              height: 280,
              background:
                'linear-gradient(90deg, rgba(255,255,255,0.03) 25%, rgba(255,255,255,0.06) 50%, rgba(255,255,255,0.03) 75%)',
              backgroundSize: '200% 100%',
              animation: 'shimmer 1.5s infinite'
            }}
          />
        ))}
        <style>{`@keyframes shimmer { 0% { background-position: 200% 0; } 100% { background-position: -200% 0; } }`}</style>
      </div>
    );
  }

  if (error) {
    return (
      <div className="empty">
        {error.includes('403') || error.includes('permiss')
          ? 'Acesso restrito a administradores e gerentes.'
          : `Erro ao carregar analytics: ${error}`}
      </div>
    );
  }

  if (!data) return <div className="empty">Sem dados de analytics.</div>;

  const hasRevenue = data.revenueByMonth.length > 0;
  const hasProducts = data.topProducts.length > 0;
  const hasStatus = data.orderStatusDistribution.length > 0;
  const hasDailyOrders = data.dailyOrderCount.some((d) => d.count > 0);

  const revenueTotal = data.revenueByMonth.reduce((acc, r) => acc + r.revenue, 0);

  return (
    <>
      <h2>Analytics de Vendas</h2>

      <div className="kpis" style={{ marginBottom: 24 }}>
        <div className="kpi">
          <div style={{ color: 'var(--text-muted)', fontSize: 13 }}>Receita total</div>
          <div className="value" style={{ fontSize: 24 }}>{money(revenueTotal)}</div>
        </div>
        <div className="kpi">
          <div style={{ color: 'var(--text-muted)', fontSize: 13 }}>Meses com vendas</div>
          <div className="value" style={{ fontSize: 24 }}>{data.revenueByMonth.length}</div>
        </div>
        <div className="kpi">
          <div style={{ color: 'var(--text-muted)', fontSize: 13 }}>Produtos distintos</div>
          <div className="value" style={{ fontSize: 24 }}>{data.topProducts.length}</div>
        </div>
        <div className="kpi">
          <div style={{ color: 'var(--text-muted)', fontSize: 13 }}>Pedidos (30 dias)</div>
          <div className="value" style={{ fontSize: 24 }}>
            {data.dailyOrderCount.reduce((acc, d) => acc + d.count, 0)}
          </div>
        </div>
      </div>

      <SectionCard title="Receita por Mês">
        {hasRevenue ? (
          <ResponsiveContainer width="100%" height={280}>
            <BarChart data={data.revenueByMonth} margin={{ top: 4, right: 16, left: 0, bottom: 4 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.06)" />
              <XAxis dataKey="month" tick={{ fill: '#94a3b8', fontSize: 12 }} />
              <YAxis
                tick={{ fill: '#94a3b8', fontSize: 12 }}
                tickFormatter={(v: number) => `R$${(v / 1000).toFixed(0)}k`}
              />
              <Tooltip
                contentStyle={{ background: '#1e293b', border: '1px solid #2a3441', borderRadius: 8 }}
                labelStyle={{ color: '#f8fafc' }}
                formatter={(v: number) => [money(v), 'Receita']}
              />
              <Bar dataKey="revenue" fill="#0d9488" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        ) : (
          <EmptyChart message="Sem pedidos registrados para exibir receita por mês." />
        )}
      </SectionCard>

      <SectionCard title="Top 10 Produtos por Volume de Vendas">
        {hasProducts ? (
          <ResponsiveContainer width="100%" height={320}>
            <BarChart
              layout="vertical"
              data={data.topProducts}
              margin={{ top: 4, right: 32, left: 8, bottom: 4 }}
            >
              <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.06)" horizontal={false} />
              <XAxis type="number" tick={{ fill: '#94a3b8', fontSize: 12 }} />
              <YAxis
                dataKey="name"
                type="category"
                width={160}
                tick={{ fill: '#94a3b8', fontSize: 12 }}
              />
              <Tooltip
                contentStyle={{ background: '#1e293b', border: '1px solid #2a3441', borderRadius: 8 }}
                labelStyle={{ color: '#f8fafc' }}
                formatter={(v: number) => [v, 'Unidades vendidas']}
              />
              <Bar dataKey="volume" radius={[0, 4, 4, 0]}>
                {data.topProducts.map((_entry, index) => (
                  <Cell key={index} fill={CHART_COLORS[index % CHART_COLORS.length]} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        ) : (
          <EmptyChart message="Sem itens de pedido para exibir ranking de produtos." />
        )}
      </SectionCard>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(340px, 1fr))', gap: 24 }}>
        <SectionCard title="Distribuição de Status dos Pedidos">
          {hasStatus ? (
            <ResponsiveContainer width="100%" height={260}>
              <PieChart>
                <Pie
                  data={data.orderStatusDistribution}
                  dataKey="count"
                  nameKey="status"
                  cx="50%"
                  cy="50%"
                  outerRadius={90}
                  innerRadius={50}
                  paddingAngle={3}
                  label={({ status, percent }: { status: string; percent: number }) =>
                    `${status} ${(percent * 100).toFixed(0)}%`
                  }
                  labelLine={false}
                >
                  {data.orderStatusDistribution.map((entry, index) => (
                    <Cell
                      key={entry.status}
                      fill={STATUS_COLORS[entry.status] ?? CHART_COLORS[index % CHART_COLORS.length]}
                    />
                  ))}
                </Pie>
                <Tooltip
                  contentStyle={{ background: '#1e293b', border: '1px solid #2a3441', borderRadius: 8 }}
                  formatter={(v: number, name: string) => [v, name]}
                />
                <Legend
                  wrapperStyle={{ color: '#94a3b8', fontSize: 13 }}
                  formatter={(value: string) => value}
                />
              </PieChart>
            </ResponsiveContainer>
          ) : (
            <EmptyChart message="Nenhuma entrega registrada ainda." />
          )}
        </SectionCard>

        <SectionCard title="Pedidos por Dia — Últimos 30 Dias">
          {hasDailyOrders ? (
            <ResponsiveContainer width="100%" height={260}>
              <LineChart
                data={data.dailyOrderCount}
                margin={{ top: 4, right: 16, left: 0, bottom: 4 }}
              >
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.06)" />
                <XAxis
                  dataKey="date"
                  tick={{ fill: '#94a3b8', fontSize: 10 }}
                  tickFormatter={(v: string) => v.slice(5)}
                  interval={6}
                />
                <YAxis tick={{ fill: '#94a3b8', fontSize: 12 }} allowDecimals={false} />
                <Tooltip
                  contentStyle={{ background: '#1e293b', border: '1px solid #2a3441', borderRadius: 8 }}
                  labelStyle={{ color: '#f8fafc' }}
                  formatter={(v: number) => [v, 'Pedidos']}
                />
                <Line
                  type="monotone"
                  dataKey="count"
                  stroke="#10b981"
                  strokeWidth={2}
                  dot={false}
                  activeDot={{ r: 4, fill: '#10b981' }}
                />
              </LineChart>
            </ResponsiveContainer>
          ) : (
            <EmptyChart message="Nenhum pedido nos últimos 30 dias." />
          )}
        </SectionCard>
      </div>
    </>
  );
}
