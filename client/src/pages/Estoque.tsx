import { useEffect, useState } from 'react';
import api from '../api';
import toast from 'react-hot-toast';

export default function Estoque() {
  const [summary, setSummary] = useState<any>(null);
  const [medicines, setMedicines] = useState<any[]>([]);
  const user = JSON.parse(localStorage.getItem('auth_user') || '{}');
  const canManage = ['admin', 'gerente', 'inventario'].includes(user.role);

  const load = async () => {
    const [s, m] = await Promise.all([
      api.get('/inventory/summary?page=1&pageSize=50'),
      api.get('/medicines'),
    ]);
    setSummary(s);
    setMedicines(Array.isArray((m as any).items) ? (m as any).items : []);
  };

  useEffect(() => { load(); }, []);

  const handleAddMedicine = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    const payload: any = Object.fromEntries(fd.entries());
    payload.controlled = payload.controlled === 'on';
    await api.post('/medicines', payload);
    toast.success('Remédio adicionado!');
    e.currentTarget.reset();
    load();
  };

  const handleAddLot = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const payload = Object.fromEntries(new FormData(e.currentTarget).entries());
    await api.post('/inventory/lots', payload);
    toast.success('Lote adicionado!');
    e.currentTarget.reset();
    load();
  };

  if (!summary) return <div className="empty">Carregando estoque...</div>;

  const items = Array.isArray(summary.items) ? summary.items : [];

  return (
    <>
      <h2>Gestão transacional de estoque</h2>
      <div className="kpis">
        <div className="kpi"><div className="value">{summary.critical}</div><div>Itens críticos</div></div>
        <div className="kpi"><div className="value">{summary.nearExpiry}</div><div>Lotes até 30 dias</div></div>
      </div>

      {canManage && (
        <>
          <h3>Adicionar novo remédio</h3>
          <form onSubmit={handleAddMedicine} className="form-modern" style={{ marginBottom: 24, display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 12 }}>
            <input name="name" placeholder="Nome do remédio" required />
            <input name="price" type="number" min="0.01" step="0.01" placeholder="Preço" required />
            <input name="lab" placeholder="Laboratório" required />
            <input name="specialty" placeholder="Especialidade" required />
            <input name="description" placeholder="Descrição" required />
            <input name="image" placeholder="URL da imagem (opcional)" />
            <label style={{ display: 'flex', alignItems: 'center', gap: 8 }}><input type="checkbox" name="controlled" /> Controlado</label>
            <button type="submit">Adicionar remédio</button>
          </form>

          <h3>Adicionar lote em remédio existente</h3>
          <form onSubmit={handleAddLot} className="form-modern" style={{ marginBottom: 24, display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: 12 }}>
            <select name="medicineId" required>
              {medicines.map((m: any) => <option key={m.id} value={m.id}>{m.name}</option>)}
            </select>
            <input name="batchCode" placeholder="Lote" required />
            <input name="expiresAt" type="date" required />
            <input name="quantity" type="number" min="1" placeholder="Qtd" required />
            <input name="unitCost" type="number" min="0.01" step="0.01" placeholder="Custo unit." required />
            <input name="supplier" placeholder="Fornecedor" required />
            <button type="submit">Adicionar lote</button>
          </form>
        </>
      )}

      <table className="table">
        <thead><tr><th>Medicamento</th><th>Disponível</th><th>Total</th><th>Lotes</th><th>Risco venc.</th></tr></thead>
        <tbody>
          {items.map((item: any) => (
            <tr key={item.medicineName}>
              <td>{item.medicineName}</td>
              <td>{item.stockAvailable}</td>
              <td>{item.stockTotal}</td>
              <td>{item.lotCount}</td>
              <td>{item.expiresIn30Days}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </>
  );
}
