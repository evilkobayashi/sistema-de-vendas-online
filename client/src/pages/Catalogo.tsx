import { useEffect, useState } from 'react';
import api from '../api';

const money = (v: number) => `R$ ${Number(v).toFixed(2)}`;

export default function Catalogo() {
  const [medicines, setMedicines] = useState<any[]>([]);
  const [q, setQ] = useState('');
  const [sort, setSort] = useState('relevance');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api.get('/medicines').then((d: any) => {
      setMedicines(Array.isArray(d.items) ? d.items : []);
    }).finally(() => setLoading(false));
  }, []);

  const filtered = medicines
    .map(m => {
      const haystack = `${m.name} ${m.description} ${m.lab} ${m.specialty}`.toLowerCase();
      let relevance = 0;
      const query = q.trim().toLowerCase();
      if (query) {
        if (m.name.toLowerCase().includes(query)) relevance += 5;
        if (m.description?.toLowerCase().includes(query)) relevance += 2;
        if (haystack.includes(query)) relevance += 1;
      }
      return { ...m, relevance };
    })
    .filter(m => !q.trim() || m.relevance > 0)
    .sort((a, b) => {
      if (sort === 'price-asc') return a.price - b.price;
      if (sort === 'price-desc') return b.price - a.price;
      if (sort === 'name-asc') return a.name.localeCompare(b.name);
      return b.relevance - a.relevance || a.name.localeCompare(b.name);
    });

  if (loading) return <div className="empty">Carregando catálogo...</div>;

  return (
    <>
      <div className="dashboard-header">
        <h2>Catálogo farmacêutico</h2>
      </div>

      <div className="panel">
        <div className="inline" style={{ marginBottom: 16, gap: 12 }}>
          <input
            placeholder="Pesquisar por nome/descrição"
            value={q}
            onChange={e => setQ(e.target.value)}
            style={{ flex: 2 }}
          />
          <select value={sort} onChange={e => setSort(e.target.value)} style={{ flex: 1 }}>
            <option value="relevance">Relevância</option>
            <option value="price-asc">Menor preço</option>
            <option value="price-desc">Maior preço</option>
            <option value="name-asc">Nome (A-Z)</option>
          </select>
        </div>

        {filtered.length ? (
          <div className="grid" style={{ gridTemplateColumns: 'repeat(auto-fill, minmax(260px, 1fr))', display: 'grid', gap: 16 }}>
            {filtered.map(m => (
              <div key={m.id} className="card medicine-card">
                {m.image?.startsWith('http') || m.image?.startsWith('data:image/') ? (
                  <img src={m.image} alt={m.name} className="medicine-image" loading="lazy" />
                ) : (
                  <div className="medicine-fallback">💊</div>
                )}
                <h4>{m.name}</h4>
                <p className="description">{m.description}</p>
                <p style={{ color: 'var(--text-muted)', fontSize: 14 }}>{m.lab} • {m.specialty}</p>
                <p>Disponível: <strong>{m.inventory?.stockAvailable ?? 0}</strong></p>
                <strong style={{ fontSize: 18, color: 'var(--accent)' }}>{money(m.price)}</strong>
                {m.controlled && <span className="tag controlled">Controlado</span>}
              </div>
            ))}
          </div>
        ) : <div className="empty">Nenhum medicamento encontrado.</div>}
      </div>
    </>
  );
}
