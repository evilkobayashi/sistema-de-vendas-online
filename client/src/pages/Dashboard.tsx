import { useEffect, useState } from 'react';
import api from '../api';

const money = (v: number) => `R$ ${Number(v).toFixed(2)}`;

export default function Dashboard() {
  const [data, setData] = useState<any>(null);
  const [metrics, setMetrics] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      try {
        const [dash, met] = await Promise.all([
          api.get('/dashboard'),
          api.get('/metrics/operational').catch(() => null),
        ]);
        setData(dash);
        setMetrics(met);
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  if (loading) return <SkeletonBlock />;
  if (!data) return <div className="empty">Erro ao carregar dashboard.</div>;

  const ind = data.indicators || {};
  const reminders = Array.isArray(data.reminders) ? data.reminders : [];

  return (
    <>
      <h2>Dashboard Operacional</h2>
      <div className="kpis">
        <KPI value={ind.pedidos} label="Pedidos" />
        <KPI value={ind.entregasPendentes} label="Entregas pendentes" />
        <KPI value={ind.estoqueCritico} label="Estoque crítico" />
        <KPI value={ind.lotesProximosVencimento} label="Lotes próx. vencimento" />
        <KPI value={money(ind.totalSales || 0)} label="Total vendido" />
      </div>

      <h3>Métricas operacionais</h3>
      {metrics ? (
        <div className="kpis" style={{ marginBottom: 24 }}>
          <div className="card">
            <strong>Falhas de contato</strong><br/>
            Call: {metrics.contactFailures?.call || 0}<br/>
            Email: {metrics.contactFailures?.email || 0}
          </div>
          <div className="card">
            <strong>Bloqueios por competência</strong><br/>
            {metrics.eligibilityBlocks || 0}
          </div>
          <div className="card">
            <strong>Latências médias (ms)</strong><br/>
            Discador: {metrics.integrationLatency?.dialerAvgMs || 0}<br/>
            E-mail: {metrics.integrationLatency?.emailAvgMs || 0}<br/>
            Frete: {metrics.integrationLatency?.shippingQuoteAvgMs || 0}
          </div>
        </div>
      ) : <div className="empty">Métricas indisponíveis para este perfil.</div>}

      <h3>Lembretes de recorrência</h3>
      {reminders.length ? (
        <div className="stack">
          {reminders.map((r: any) => (
            <div key={r.orderId} className="card reminder">
              <strong>{r.orderId}</strong> • {r.patientName}<br/>
              {r.message} ({r.nextBillingDate})
              {r.estimatedTreatmentEndDate && <><br/>Término estimado: {r.estimatedTreatmentEndDate}</>}
            </div>
          ))}
        </div>
      ) : <div className="empty">Sem lembretes.</div>}
    </>
  );
}

function KPI({ value, label }: { value: any; label: string }) {
  return (
    <div className="kpi">
      <div className="value">{value ?? 0}</div>
      <div>{label}</div>
    </div>
  );
}

function SkeletonBlock() {
  return (
    <div style={{ display: 'grid', gap: 16 }}>
      {[1,2,3].map(i => (
        <div key={i} className="card" style={{
          height: 60,
          background: 'linear-gradient(90deg, rgba(255,255,255,0.03) 25%, rgba(255,255,255,0.06) 50%, rgba(255,255,255,0.03) 75%)',
          backgroundSize: '200% 100%',
          animation: 'shimmer 1.5s infinite',
          borderRadius: 'var(--radius-md)',
        }} />
      ))}
      <style>{`@keyframes shimmer { 0% { background-position: 200% 0; } 100% { background-position: -200% 0; } }`}</style>
    </div>
  );
}
