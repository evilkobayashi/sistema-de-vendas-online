import { useEffect, useState } from 'react';
import api from '../api';
import toast from 'react-hot-toast';

export default function Inventario() {
  const [medicines, setMedicines] = useState<any[]>([]);

  useEffect(() => {
    api.get('/medicines').then((d: any) => setMedicines(Array.isArray(d.items) ? d.items : []));
  }, []);

  const submitForm = (endpoint: string) => async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const payload: any = Object.fromEntries(new FormData(e.currentTarget).entries());
    // Convert numerics
    ['sourceQuantity','conversionFactor','unitCost','defaultUnitCost','percent'].forEach(k => {
      if (payload[k]) payload[k] = Number(payload[k]);
    });
    await api.post(endpoint, payload);
    toast.success('Operação realizada!');
    e.currentTarget.reset();
  };

  const [printOutput, setPrintOutput] = useState('Sem impressão gerada.');
  const [printOrderId, setPrintOrderId] = useState('');

  const printLabels = async () => {
    if (!printOrderId) { toast.error('Informe o ID do pedido.'); return; }
    const data: any = await api.get(`/print/labels/${printOrderId}`);
    setPrintOutput(data.printableText || 'Etiquetas geradas.');
  };

  const printQuality = async () => {
    if (!printOrderId) { toast.error('Informe o ID do pedido.'); return; }
    const data: any = await api.get(`/quality/reports/${printOrderId}`);
    setPrintOutput(data.printableText || 'Laudo gerado.');
  };

  return (
    <>
      <div className="dashboard-header">
        <h2>Inventário operacional</h2>
        <p className="dashboard-subtitle">Módulo dedicado para entradas de mercadoria, XML NF-e, impressões e atualização automática de preços.</p>
      </div>

      <div className="panel">
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, minmax(280px, 1fr))', gap: 16 }}>
          <form onSubmit={submitForm('/inventory/entries')} className="grid-form card">
            <h3>Entrada de Mercadoria (conversão)</h3>
            <select name="medicineId" required>{medicines.map(m => <option key={m.id} value={m.id}>{m.name}</option>)}</select>
            <input name="sourceQuantity" type="number" min="0.01" step="0.01" placeholder="Qtd origem" required/>
            <input name="sourceUnit" placeholder="Unidade origem" required/>
            <input name="conversionFactor" type="number" min="0.01" step="0.01" placeholder="Fator conversão" required/>
            <input name="targetUnit" placeholder="Unidade destino" required/>
            <input name="batchCode" placeholder="Lote" required/>
            <input name="expiresAt" type="date" required/>
            <input name="unitCost" type="number" min="0.01" step="0.01" placeholder="Custo unitário" required/>
            <input name="supplier" placeholder="Fornecedor" required/>
            <button type="submit">Lançar entrada</button>
          </form>

          <form onSubmit={submitForm('/inventory/entries/nfe-xml')} className="grid-form card">
            <h3>Entrada por XML NF-e</h3>
            <textarea name="xml" rows={4} placeholder="Cole o XML da NF-e" required></textarea>
            <input name="supplier" placeholder="Fornecedor" required/>
            <input name="defaultExpiresAt" type="date"/>
            <input name="defaultUnitCost" type="number" min="0.01" step="0.01" placeholder="Custo unitário padrão"/>
            <input name="conversionFactor" type="number" min="0.01" step="0.01" defaultValue={1}/>
            <button type="submit">Importar XML</button>
          </form>

          <form onSubmit={submitForm('/pricing/auto-update')} className="grid-form card">
            <h3>Atualização automática de preço</h3>
            <input name="percent" type="number" step="0.01" placeholder="Percentual (+/-)" required/>
            <input name="specialty" placeholder="Especialidade (opcional)"/>
            <input name="lab" placeholder="Laboratório (opcional)"/>
            <input name="reason" placeholder="Motivo" defaultValue="Atualização automática" required/>
            <button type="submit">Aplicar</button>
          </form>

          <div className="card">
            <h3>Impressões operacionais</h3>
            <input value={printOrderId} onChange={e => setPrintOrderId(e.target.value)} placeholder="ID do pedido (ex: P-2025-001)" />
            <div className="inline" style={{ marginTop: 12 }}>
              <button type="button" className="quick-btn" onClick={printLabels}>Imprimir etiquetas</button>
              <button type="button" className="quick-btn" onClick={printQuality}>Imprimir laudo CQ</button>
            </div>
            <pre className="empty" style={{ marginTop: 12, whiteSpace: 'pre-wrap' }}>{printOutput}</pre>
          </div>
        </div>
      </div>
    </>
  );
}
