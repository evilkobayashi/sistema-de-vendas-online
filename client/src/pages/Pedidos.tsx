import { useEffect, useState, useRef } from 'react';
import api from '../api';
import toast from 'react-hot-toast';

const money = (v: number) => `R$ ${Number(v).toFixed(2)}`;

type Prescription = {
  contentBase64?: string;
  mimeType?: string;
  prescriptionText: string;
  uploadedAt: string;
};

type Order = {
  id: string;
  patientName: string;
  email: string;
  phone: string;
  address: string;
  total: number;
  items: any[];
  controlledValidated: boolean;
  prescriptionCode?: string;
  prescription?: Prescription;
  recurring?: {
    discountPercent: number;
    nextBillingDate: string;
    needsConfirmation: boolean;
  };
  estimatedTreatmentEndDate?: string;
  createdAt: string;
};

export default function Pedidos() {
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);
  const [editingOrder, setEditingOrder] = useState<Order | null>(null);
  const [viewingPrescription, setViewingPrescription] = useState<Order | null>(null);
  const [editForm, setEditForm] = useState({
    estimatedTreatmentEndDate: '',
    total: 0,
    address: '',
  });
  const [uploadForm, setUploadForm] = useState({
    prescriptionText: '',
  });
  const fileInputRef = useRef<HTMLInputElement>(null);

  const loadOrders = () => {
    api
      .get('/orders?page=1&pageSize=50')
      .then((d: any) => {
        setOrders(Array.isArray(d.items) ? d.items : []);
      })
      .catch(() => toast.error('Erro ao carregar pedidos'))
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    loadOrders();
  }, []);

  const handleEdit = (order: Order) => {
    setEditingOrder(order);
    setEditForm({
      estimatedTreatmentEndDate: order.estimatedTreatmentEndDate || '',
      total: order.total,
      address: order.address || '',
    });
  };

  const handleSave = async () => {
    if (!editingOrder) return;
    try {
      await api.patch(`/orders/${editingOrder.id}`, {
        estimatedTreatmentEndDate: editForm.estimatedTreatmentEndDate || undefined,
        total: editForm.total,
        address: editForm.address || undefined,
      });
      toast.success('Pedido atualizado!');
      setEditingOrder(null);
      loadOrders();
    } catch {
      toast.error('Erro ao atualizar pedido');
    }
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>, order: Order) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (file.size > 10 * 1024 * 1024) {
      toast.error('Arquivo muito grande (máximo 10MB)');
      return;
    }

    const validTypes = ['application/pdf', 'image/jpeg', 'image/png', 'image/webp'];
    if (!validTypes.includes(file.type)) {
      toast.error('Tipo de arquivo inválido. Use PDF, JPG, PNG ou WEBP');
      return;
    }

    try {
      const reader = new FileReader();
      reader.onload = async () => {
        const base64 = (reader.result as string).split(',')[1];
        try {
          await api.post(`/orders/${order.id}/prescription`, {
            contentBase64: base64,
            mimeType: file.type,
            prescriptionText: uploadForm.prescriptionText || '',
          });
          toast.success('Receita carregada com sucesso!');
          setUploadForm({ prescriptionText: '' });
          if (fileInputRef.current) fileInputRef.current.value = '';
          loadOrders();
        } catch (err: any) {
          toast.error(err.message || 'Erro ao carregar receita');
        }
      };
      reader.readAsDataURL(file);
    } catch {
      toast.error('Erro ao ler arquivo');
    }
  };

  const handleTextPrescription = async (order: Order) => {
    if (!uploadForm.prescriptionText.trim()) {
      toast.error('Informe o texto da receita');
      return;
    }
    try {
      await api.post(`/orders/${order.id}/prescription`, {
        prescriptionText: uploadForm.prescriptionText,
      });
      toast.success('Receita salva com sucesso!');
      setUploadForm({ prescriptionText: '' });
      loadOrders();
    } catch (err: any) {
      toast.error(err.message || 'Erro ao salvar receita');
    }
  };

  const openPrescription = async (order: Order) => {
    try {
      await api.get(`/orders/${order.id}/prescription`);
      setViewingPrescription(order);
    } catch {
      toast.error('Erro ao carregar receita');
    }
  };

  const getPrescriptionPreview = (order: Order) => {
    if (order.prescription?.contentBase64) {
      return `📄 ${order.prescription.mimeType?.includes('pdf') ? 'PDF' : 'Imagem'} anexado`;
    }
    if (order.prescription?.prescriptionText) {
      return `📝 Texto: "${order.prescription.prescriptionText.substring(0, 50)}..."`;
    }
    return null;
  };

  if (loading) return <div className="empty">Carregando pedidos...</div>;

  return (
    <>
      <div className="dashboard-header">
        <h2>Histórico de pedidos</h2>
      </div>

      <div className="panel">
        {orders.length ? (
          <table className="table">
            <thead>
              <tr>
                <th>Pedido</th>
                <th>Paciente</th>
                <th>Total</th>
                <th>Término estimado</th>
                <th>Receita</th>
                <th>Criado em</th>
                <th>Ações</th>
              </tr>
            </thead>
            <tbody>
              {orders.map((o) => {
                const hasPrescription = o.prescription?.contentBase64 || o.prescription?.prescriptionText;
                return (
                  <tr key={o.id}>
                    <td>{o.id}</td>
                    <td>{o.patientName}</td>
                    <td>{money(o.total)}</td>
                    <td>{o.estimatedTreatmentEndDate || '-'}</td>
                    <td>
                      {hasPrescription ? (
                        <span
                          className="tag"
                          style={{
                            background: o.controlledValidated ? 'rgba(239, 68, 68, 0.15)' : 'rgba(16,185,129,0.15)',
                            color: o.controlledValidated ? '#fca5a5' : '#34d399',
                            cursor: 'pointer',
                            border: o.controlledValidated
                              ? '1px solid rgba(239, 68, 68, 0.3)'
                              : '1px solid rgba(16, 185, 129, 0.3)',
                          }}
                          onClick={() => openPrescription(o)}
                          title={
                            o.controlledValidated ? 'Receita de medicamento controlado' : 'Clique para ver a receita'
                          }
                        >
                          {o.controlledValidated ? '🔴 Controlado' : '🟢 Regular'} {getPrescriptionPreview(o)}
                        </span>
                      ) : (
                        <span
                          className="tag"
                          style={{ background: 'rgba(255,255,255,0.05)', color: 'var(--text-muted)' }}
                        >
                          Sem receita
                        </span>
                      )}
                    </td>
                    <td>{new Date(o.createdAt).toLocaleString()}</td>
                    <td>
                      <div className="inline" style={{ gap: 4 }}>
                        <button
                          className="quick-btn"
                          onClick={() => handleEdit(o)}
                          style={{ fontSize: 12, padding: '4px 8px' }}
                        >
                          Editar
                        </button>
                        {hasPrescription && (
                          <button
                            className="quick-btn"
                            onClick={() => openPrescription(o)}
                            style={{ fontSize: 12, padding: '4px 8px' }}
                          >
                            Ver Receita
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        ) : (
          <div className="empty">Sem pedidos.</div>
        )}
      </div>

      {/* Modal Editar Pedido */}
      {editingOrder && (
        <div className="modal-overlay" onClick={() => setEditingOrder(null)}>
          <div className="modal" onClick={(e) => e.stopPropagation()}>
            <h3>Editar Pedido</h3>
            <p>
              <strong>ID:</strong> {editingOrder.id}
            </p>
            <p>
              <strong>Paciente:</strong> {editingOrder.patientName}
            </p>

            <div className="form-group">
              <label>Término do Tratamento</label>
              <input
                type="date"
                value={editForm.estimatedTreatmentEndDate}
                onChange={(e) => setEditForm((f) => ({ ...f, estimatedTreatmentEndDate: e.target.value }))}
              />
            </div>

            <div className="form-group">
              <label>Total (R$)</label>
              <input
                type="number"
                step="0.01"
                value={editForm.total}
                onChange={(e) => setEditForm((f) => ({ ...f, total: parseFloat(e.target.value) || 0 }))}
              />
            </div>

            <div className="form-group">
              <label>Endereço</label>
              <input
                type="text"
                value={editForm.address}
                onChange={(e) => setEditForm((f) => ({ ...f, address: e.target.value }))}
                placeholder="Endereço de entrega"
              />
            </div>

            <div className="inline" style={{ marginTop: 16, gap: 8 }}>
              <button className="quick-btn save-btn" onClick={handleSave}>
                Salvar
              </button>
              <button className="quick-btn cancel-btn" onClick={() => setEditingOrder(null)}>
                Cancelar
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal Visualizar/Anexar Receita */}
      {viewingPrescription && (
        <div className="modal-overlay" onClick={() => setViewingPrescription(null)}>
          <div className="modal" onClick={(e) => e.stopPropagation()} style={{ maxWidth: 700 }}>
            <h3>Receita do Pedido</h3>
            <p>
              <strong>Pedido:</strong> {viewingPrescription.id}
            </p>
            <p>
              <strong>Paciente:</strong> {viewingPrescription.patientName}
            </p>

            {viewingPrescription.prescription?.contentBase64 ? (
              <div className="prescription-preview">
                {viewingPrescription.prescription.mimeType?.includes('pdf') ? (
                  <iframe
                    src={`data:${viewingPrescription.prescription.mimeType};base64,${viewingPrescription.prescription.contentBase64}`}
                    title="Receita PDF"
                    style={{ width: '100%', height: 500, border: 'none', borderRadius: 8 }}
                  />
                ) : (
                  <img
                    src={`data:${viewingPrescription.prescription.mimeType};base64,${viewingPrescription.prescription.contentBase64}`}
                    alt="Receita"
                    style={{ maxWidth: '100%', borderRadius: 8, border: '1px solid var(--border-light)' }}
                  />
                )}
              </div>
            ) : viewingPrescription.prescription?.prescriptionText ? (
              <div className="prescription-text">
                <pre
                  style={{
                    background: 'rgba(0,0,0,0.2)',
                    padding: 16,
                    borderRadius: 8,
                    whiteSpace: 'pre-wrap',
                    fontSize: 14,
                    maxHeight: 400,
                    overflow: 'auto',
                  }}
                >
                  {viewingPrescription.prescription.prescriptionText}
                </pre>
              </div>
            ) : (
              <div className="empty">Sem receita anexada.</div>
            )}

            {viewingPrescription.prescription?.uploadedAt && (
              <p style={{ marginTop: 12, fontSize: 12, color: 'var(--text-muted)' }}>
                Anexado em: {new Date(viewingPrescription.prescription.uploadedAt).toLocaleString()}
              </p>
            )}

            <hr style={{ margin: '20px 0', borderColor: 'var(--border-light)' }} />

            <h4 style={{ marginBottom: 12 }}>Anexar Nova Receita</h4>

            <div className="form-group">
              <label>Upload de arquivo (PDF ou Imagem)</label>
              <input
                ref={fileInputRef}
                type="file"
                accept=".pdf,image/jpeg,image/png,image/webp"
                onChange={(e) => handleFileUpload(e, viewingPrescription)}
                style={{ padding: 8 }}
              />
            </div>

            <div className="form-group">
              <label>Ou digite/cole o texto da receita</label>
              <textarea
                rows={4}
                value={uploadForm.prescriptionText}
                onChange={(e) => setUploadForm((f) => ({ ...f, prescriptionText: e.target.value }))}
                placeholder="Cole aqui o texto da receita médica..."
              />
            </div>

            <button className="quick-btn" onClick={() => handleTextPrescription(viewingPrescription)}>
              Salvar Texto da Receita
            </button>

            <div className="inline" style={{ marginTop: 16 }}>
              <button
                className="quick-btn"
                onClick={() => setViewingPrescription(null)}
                style={{ background: 'var(--bg-secondary)' }}
              >
                Fechar
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
