import { useEffect, useState } from 'react';
import api from '../api';
import toast from 'react-hot-toast';

export default function Orcamentos() {
  const [budgets, setBudgets] = useState<any[]>([]);
  const [medicines, setMedicines] = useState<any[]>([]);
  const [formulas, setFormulas] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [printOutput, setPrintOutput] = useState('Sem impressão gerada.');
  const [printId, setPrintId] = useState('');

  const load = async () => {
    const [b, m, f] = await Promise.all([
      api.get('/budgets'), api.get('/medicines'), api.get('/standard-formulas'),
    ]) as any[];
    setBudgets(Array.isArray(b.items) ? b.items : []);
    setMedicines(Array.isArray(m.items) ? m.items : []);
    setFormulas(Array.isArray(f.items) ? f.items : []);
    setLoading(false);
  };
  useEffect(() => { load(); }, []);

  const submitForm = (endpoint: string, cb?: () => void) => async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const payload: any = Object.fromEntries(new FormData(e.currentTarget).entries());
    ['estimatedDays','batchSize','expectedWeightGrams','measuredWeightGrams'].forEach(k => {
      if (payload[k]) payload[k] = Number(payload[k]);
    });
    await api.post(endpoint, payload);
    toast.success('Operação realizada!');
    e.currentTarget.reset();
    cb?.();
  };

  if (loading) return <div className="empty">Carregando orçamentos...</div>;

  return (
    <>
      <div className="dashboard-header">
        <h2>Orçamentos e produção</h2>
      </div>

      <div className="panel">
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, minmax(280px, 1fr))', gap: 16, marginTop: 16 }}>
          <form onSubmit={submitForm('/budgets', load)} className="grid-form card">
            <h3>Novo orçamento inteligente</h3>
            <input name="patientName" placeholder="Paciente" required/>
            <input name="doctorName" placeholder="Médico"/>
            <textarea name="prescriptionText" rows={4} placeholder="Texto da receita" required></textarea>
            <input name="estimatedDays" type="number" min="1" defaultValue={30}/>
            <button type="submit">Gerar orçamento</button>
          </form>

          <form onSubmit={submitForm('/scale/readings')} className="grid-form card">
            <h3>Balança monitorada integrada</h3>
            <input name="quoteId" placeholder="ID do orçamento" required/>
            <select name="medicineId" required>{medicines.map(m => <option key={m.id} value={m.id}>{m.name}</option>)}</select>
            <input name="expectedWeightGrams" type="number" min="0.01" step="0.01" placeholder="Peso esperado (g)" required/>
            <input name="measuredWeightGrams" type="number" min="0.01" step="0.01" placeholder="Peso medido (g)" required/>
            <button type="submit">Enviar leitura</button>
          </form>

          <form onSubmit={submitForm('/production/standard-formula')} className="grid-form card">
            <h3>Produção de fórmula padrão</h3>
            <select name="formulaId" required>{formulas.map(f => <option key={f.id} value={f.id}>{f.name} ({f.version})</option>)}</select>
            <input name="batchSize" type="number" min="1" defaultValue={1} required/>
            <input name="operator" placeholder="Operador" required/>
            <button type="submit">Criar ordem de produção</button>
          </form>

          <div className="card">
            <h3>Impressões do orçamento</h3>
            <input value={printId} onChange={e => setPrintId(e.target.value)} placeholder="ID do orçamento"/>
            <div className="inline" style={{ marginTop: 12 }}>
              <button type="button" className="quick-btn" onClick={async () => {
                if (!printId) return toast.error('Informe o ID.');
                const d: any = await api.get(`/budgets/${printId}/manipulation-order`);
                setPrintOutput(d.printableText || 'Ordem gerada.');
              }}>Ordem de Manipulação</button>
              <button type="button" className="quick-btn" onClick={async () => {
                if (!printId) return toast.error('Informe o ID.');
                const d: any = await api.get(`/budgets/${printId}/labels`);
                setPrintOutput(d.printableText || 'Rótulo gerado.');
              }}>Imprimir rótulo</button>
            </div>
            <pre className="empty" style={{ marginTop: 12, whiteSpace: 'pre-wrap' }}>{printOutput}</pre>
          </div>
        </div>
      </div>

      <div className="panel" style={{ marginTop: 24 }}>
        <h3>Lista de orçamentos</h3>
        {budgets.length ? (
          <table className="table">
            <thead><tr><th>ID</th><th>Paciente</th><th>Médico</th><th>Itens sugeridos</th><th>Status</th></tr></thead>
            <tbody>
              {budgets.map(b => (
                <tr key={b.id}>
                  <td>{b.id}</td>
                  <td>{b.patientName}</td>
                  <td>{b.doctorName || '-'}</td>
                  <td>{Array.isArray(b.suggestedItems) ? b.suggestedItems.map((x: any) => x.medicineName).join(', ') : '-'}</td>
                  <td><span className="tag">{b.status}</span></td>
                </tr>
              ))}
            </tbody>
          </table>
        ) : <div className="empty">Nenhum orçamento.</div>}
      </div>
    </>
  );
}
