import { useEffect, useState } from 'react';
import api from '../api';
import toast from 'react-hot-toast';

type TicketHistoryEntry = {
  type: 'status_change' | 'note' | 'contact';
  from?: string;
  to?: string;
  channel?: string;
  subject?: string;
  message?: string;
  by: string;
  at: string;
  note?: string;
  status?: string;
};

type Ticket = {
  id: string;
  subject: string;
  status: 'aberto' | 'em_atendimento' | 'fechado';
  assignedTo: string;
  priority?: 'baixa' | 'media' | 'alta';
  customerName?: string;
  customerEmail?: string;
  customerPhone?: string;
  description?: string;
  createdAt?: string;
  updatedAt?: string;
  history?: TicketHistoryEntry[];
};

export default function Atendimento() {
  const [tickets, setTickets] = useState<Ticket[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<'all' | 'aberto' | 'em_atendimento' | 'fechado'>('all');
  const [expandedTicket, setExpandedTicket] = useState<string | null>(null);
  const [showHistoryModal, setShowHistoryModal] = useState<Ticket | null>(null);
  const [showContactModal, setShowContactModal] = useState<Ticket | null>(null);
  const [contactType, setContactType] = useState<'chat' | 'email'>('email');
  const [contactMessage, setContactMessage] = useState('');
  const [contactSubject, setContactSubject] = useState('');
  const [processing, setProcessing] = useState(false);

  useEffect(() => {
    loadTickets();
  }, []);

  const loadTickets = () => {
    setLoading(true);
    api
      .get('/tickets')
      .then((d: any) => {
        setTickets(Array.isArray(d.items) ? d.items : []);
      })
      .catch(() => {
        toast.error('Erro ao carregar tickets');
      })
      .finally(() => setLoading(false));
  };

  const handleAttendTicket = async (ticket: Ticket) => {
    setProcessing(true);
    try {
      await api.patch(`/tickets/${ticket.id}`, { action: 'attend' });
      toast.success('Ticket em atendimento');
      loadTickets();
      setExpandedTicket(null);
    } catch {
      toast.error('Erro ao atender ticket');
    } finally {
      setProcessing(false);
    }
  };

  const handleResolveTicket = async (ticket: Ticket) => {
    setProcessing(true);
    try {
      await api.patch(`/tickets/${ticket.id}`, { action: 'resolve', notes: 'Ticket resolvido com sucesso' });
      toast.success('Ticket resolvido!');
      loadTickets();
      setExpandedTicket(null);
    } catch {
      toast.error('Erro ao resolver ticket');
    } finally {
      setProcessing(false);
    }
  };

  const handleReopenTicket = async (ticket: Ticket) => {
    setProcessing(true);
    try {
      await api.patch(`/tickets/${ticket.id}`, { action: 'reopen' });
      toast.success('Ticket reaberto');
      loadTickets();
    } catch {
      toast.error('Erro ao reabrir ticket');
    } finally {
      setProcessing(false);
    }
  };

  const handleSendContact = async () => {
    if (!contactMessage.trim()) {
      toast.error('Digite uma mensagem');
      return;
    }
    setProcessing(true);
    try {
      const result: any = await api.post(`/tickets/${showContactModal!.id}/contact`, {
        type: contactType,
        message: contactMessage,
        subject: contactSubject || showContactModal!.subject,
      });
      toast.success(result.result?.message || `Contato enviado via ${contactType}`);
      setShowContactModal(null);
      setContactMessage('');
      setContactSubject('');
      loadTickets();
    } catch {
      toast.error('Erro ao enviar contato');
    } finally {
      setProcessing(false);
    }
  };

  const getStatusLabel = (status: string) => {
    switch (status) {
      case 'aberto':
        return 'Aberto';
      case 'em_atendimento':
        return 'Em Atendimento';
      case 'fechado':
        return 'Fechado';
      default:
        return status;
    }
  };

  const filteredTickets = filter === 'all' ? tickets : tickets.filter((t) => t.status === filter);

  const stats = {
    total: tickets.length,
    aberto: tickets.filter((t) => t.status === 'aberto').length,
    emAtendimento: tickets.filter((t) => t.status === 'em_atendimento').length,
    fechado: tickets.filter((t) => t.status === 'fechado').length,
  };

  if (loading) return <div className="empty">Carregando tickets...</div>;

  return (
    <>
      <div className="dashboard-header">
        <h2>Central de Atendimento</h2>
      </div>

      <div className="kpis-grid" style={{ marginBottom: 24 }}>
        <div
          className="kpi-card"
          style={{
            background: 'linear-gradient(135deg, #64748b, #475569)',
            cursor: 'pointer',
            border: filter === 'all' ? '2px solid white' : '2px solid transparent',
          }}
          onClick={() => setFilter('all')}
        >
          <div className="kpi-header">
            <i className="ph ph-ticket" style={{ fontSize: '24px', color: 'white' }}></i>
            <div className="kpi-label" style={{ color: 'rgba(255,255,255,0.9)' }}>
              Total
            </div>
          </div>
          <div className="kpi-value" style={{ color: 'white' }}>
            {stats.total}
          </div>
        </div>

        <div
          className="kpi-card"
          style={{
            background: 'linear-gradient(135deg, #ef4444, #dc2626)',
            cursor: 'pointer',
            border: filter === 'aberto' ? '2px solid white' : '2px solid transparent',
          }}
          onClick={() => setFilter('aberto')}
        >
          <div className="kpi-header">
            <i className="ph ph-warning-circle" style={{ fontSize: '24px', color: 'white' }}></i>
            <div className="kpi-label" style={{ color: 'rgba(255,255,255,0.9)' }}>
              Abertos
            </div>
          </div>
          <div className="kpi-value" style={{ color: 'white' }}>
            {stats.aberto}
          </div>
        </div>

        <div
          className="kpi-card"
          style={{
            background: 'linear-gradient(135deg, #f59e0b, #d97706)',
            cursor: 'pointer',
            border: filter === 'em_atendimento' ? '2px solid white' : '2px solid transparent',
          }}
          onClick={() => setFilter('em_atendimento')}
        >
          <div className="kpi-header">
            <i className="ph ph-headset" style={{ fontSize: '24px', color: 'white' }}></i>
            <div className="kpi-label" style={{ color: 'rgba(255,255,255,0.9)' }}>
              Em Atendimento
            </div>
          </div>
          <div className="kpi-value" style={{ color: 'white' }}>
            {stats.emAtendimento}
          </div>
        </div>

        <div
          className="kpi-card"
          style={{
            background: 'linear-gradient(135deg, #10b981, #059669)',
            cursor: 'pointer',
            border: filter === 'fechado' ? '2px solid white' : '2px solid transparent',
          }}
          onClick={() => setFilter('fechado')}
        >
          <div className="kpi-header">
            <i className="ph ph-check-circle" style={{ fontSize: '24px', color: 'white' }}></i>
            <div className="kpi-label" style={{ color: 'rgba(255,255,255,0.9)' }}>
              Fechados
            </div>
          </div>
          <div className="kpi-value" style={{ color: 'white' }}>
            {stats.fechado}
          </div>
        </div>
      </div>

      <div className="panel">
        {filteredTickets.length ? (
          <div className="stack">
            {filteredTickets.map((ticket) => {
              const isExpanded = expandedTicket === ticket.id;

              const statusColors: Record<string, { bg: string; color: string; text: string }> = {
                aberto: { bg: '#fef2f2', color: '#dc2626', text: 'Vermelho' },
                em_atendimento: { bg: '#fffbeb', color: '#d97706', text: 'Amarelo' },
                fechado: { bg: '#ecfdf5', color: '#059669', text: 'Verde' },
              };
              const statusColor = statusColors[ticket.status] || statusColors.aberto;

              const priorityColors: Record<string, string> = {
                alta: '#ef4444',
                media: '#f59e0b',
                baixa: '#3b82f6',
              };

              return (
                <div
                  key={ticket.id}
                  style={{
                    border: ticket.priority === 'alta' ? '2px solid #ef4444' : '1px solid var(--border-light)',
                    borderRadius: 12,
                    background: 'var(--bg-panel)',
                    overflow: 'hidden',
                    transition: 'all 0.2s',
                  }}
                >
                  <div
                    style={{
                      padding: 16,
                      cursor: 'pointer',
                      display: 'flex',
                      justifyContent: 'space-between',
                      alignItems: 'center',
                      background: isExpanded ? 'rgba(0,0,0,0.05)' : 'transparent',
                    }}
                    onClick={() => setExpandedTicket(isExpanded ? null : ticket.id)}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                      <div
                        style={{
                          width: 10,
                          height: 10,
                          borderRadius: '50%',
                          background: statusColor.color,
                        }}
                      />
                      <div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
                          <span style={{ fontSize: 15, fontWeight: 600 }}>{ticket.subject}</span>
                          {ticket.priority && (
                            <span
                              style={{
                                padding: '2px 8px',
                                borderRadius: 12,
                                fontSize: 10,
                                fontWeight: 700,
                                textTransform: 'uppercase',
                                background: `${priorityColors[ticket.priority]}20`,
                                color: priorityColors[ticket.priority],
                              }}
                            >
                              {ticket.priority}
                            </span>
                          )}
                        </div>
                        <div
                          style={{
                            display: 'flex',
                            alignItems: 'center',
                            gap: 12,
                            fontSize: 12,
                            color: 'var(--text-muted)',
                          }}
                        >
                          <span>
                            <i className="ph ph-hash"></i> {ticket.id}
                          </span>
                          <span
                            style={{
                              background: statusColor.bg,
                              color: statusColor.color,
                              padding: '2px 8px',
                              borderRadius: 8,
                              fontWeight: 600,
                            }}
                          >
                            {getStatusLabel(ticket.status)}
                          </span>
                          <span>
                            <i className="ph ph-user"></i> {ticket.customerName || 'Sem cliente'}
                          </span>
                        </div>
                      </div>
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
                      <div style={{ textAlign: 'right', color: 'var(--text-muted)', fontSize: 12 }}>
                        <div>{ticket.createdAt ? new Date(ticket.createdAt).toLocaleDateString('pt-BR') : '-'}</div>
                        {ticket.history && ticket.history.length > 0 && (
                          <div style={{ marginTop: 2 }}>
                            <i className="ph ph-clock"></i> {ticket.history.length} registros
                          </div>
                        )}
                      </div>
                      <i
                        className={`ph ${isExpanded ? 'ph-caret-up' : 'ph-caret-down'}`}
                        style={{ fontSize: 20, color: 'var(--text-muted)' }}
                      ></i>
                    </div>
                  </div>

                  {isExpanded && (
                    <div
                      style={{
                        padding: 20,
                        borderTop: '1px solid var(--border-light)',
                        background: 'var(--bg-panel-hover)',
                      }}
                    >
                      <div
                        style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 16, marginBottom: 16 }}
                      >
                        <div className="info-card">
                          <label>
                            <i className="ph ph-user"></i> Cliente
                          </label>
                          <span>{ticket.customerName || 'Não informado'}</span>
                        </div>
                        <div className="info-card">
                          <label>
                            <i className="ph ph-envelope"></i> Email
                          </label>
                          <span>{ticket.customerEmail || '-'}</span>
                        </div>
                        <div className="info-card">
                          <label>
                            <i className="ph ph-phone"></i> Telefone
                          </label>
                          <span>{ticket.customerPhone || '-'}</span>
                        </div>
                        <div className="info-card">
                          <label>
                            <i className="ph ph-user-circle"></i> Atribuído
                          </label>
                          <span>{ticket.assignedTo}</span>
                        </div>
                      </div>

                      {ticket.description && (
                        <div style={{ marginBottom: 16 }}>
                          <label
                            style={{ fontSize: 12, color: 'var(--text-muted)', display: 'block', marginBottom: 6 }}
                          >
                            <i className="ph ph-text-align-left"></i> Descrição
                          </label>
                          <p
                            style={{
                              background: 'rgba(0,0,0,0.1)',
                              padding: 12,
                              borderRadius: 8,
                              fontSize: 14,
                              margin: 0,
                              lineHeight: 1.5,
                            }}
                          >
                            {ticket.description}
                          </p>
                        </div>
                      )}

                      <div style={{ borderTop: '1px solid var(--border-light)', paddingTop: 16 }}>
                        <h4
                          style={{
                            fontSize: 13,
                            color: 'var(--text-muted)',
                            marginBottom: 12,
                            display: 'flex',
                            alignItems: 'center',
                            gap: 6,
                          }}
                        >
                          <i className="ph ph-lightning"></i> Ações Rápidas
                        </h4>

                        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
                          {ticket.status === 'aberto' && (
                            <button
                              className="action-btn action-btn-primary"
                              onClick={() => handleAttendTicket(ticket)}
                              disabled={processing}
                            >
                              <i className="ph ph-headset"></i> Atender Ticket
                            </button>
                          )}

                          {ticket.status === 'em_atendimento' && (
                            <button
                              className="action-btn action-btn-success"
                              onClick={() => handleResolveTicket(ticket)}
                              disabled={processing}
                            >
                              <i className="ph ph-check-circle"></i> Resolver
                            </button>
                          )}

                          {ticket.status === 'fechado' && (
                            <button
                              className="action-btn action-btn-secondary"
                              onClick={() => handleReopenTicket(ticket)}
                              disabled={processing}
                            >
                              <i className="ph ph-arrow-counter-clockwise"></i> Reabrir
                            </button>
                          )}

                          <button
                            className="action-btn action-btn-secondary"
                            onClick={() => setShowHistoryModal(ticket)}
                          >
                            <i className="ph ph-clock-clockwise"></i> Histórico
                            {ticket.history && ticket.history.length > 0 && (
                              <span className="badge">{ticket.history.length}</span>
                            )}
                          </button>

                          {(ticket.customerEmail || ticket.customerPhone) && (
                            <>
                              <button
                                className="action-btn action-btn-email"
                                onClick={() => {
                                  setShowContactModal(ticket);
                                  setContactType('email');
                                  setContactSubject(`Re: ${ticket.subject}`);
                                }}
                              >
                                <i className="ph ph-envelope-simple"></i> Email
                              </button>

                              <button
                                className="action-btn action-btn-chat"
                                onClick={() => {
                                  setShowContactModal(ticket);
                                  setContactType('chat');
                                  setContactSubject(ticket.subject);
                                }}
                              >
                                <i className="ph ph-chat-circle-dots"></i> Chat
                              </button>
                            </>
                          )}
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        ) : (
          <div className="empty">Nenhum ticket encontrado.</div>
        )}
      </div>

      {/* Modal de Histórico */}
      {showHistoryModal && (
        <div className="modal-overlay" onClick={() => setShowHistoryModal(null)}>
          <div
            className="modal-content"
            onClick={(e) => e.stopPropagation()}
            style={{ maxWidth: 650, maxHeight: '80vh', display: 'flex', flexDirection: 'column' }}
          >
            <div
              className="modal-header"
              style={{
                background: 'var(--bg-panel)',
                borderBottom: '1px solid var(--border-light)',
                padding: 16,
                borderRadius: '12px 12px 0 0',
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <div
                  style={{
                    width: 40,
                    height: 40,
                    borderRadius: 10,
                    background: 'linear-gradient(135deg, #3b82f6, #2563eb)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                  }}
                >
                  <i className="ph ph-clock-clockwise" style={{ fontSize: 20, color: 'white' }}></i>
                </div>
                <div>
                  <h3 style={{ margin: 0, fontSize: 16 }}>Histórico do Ticket</h3>
                  <p style={{ margin: 0, fontSize: 12, color: 'var(--text-muted)' }}>{showHistoryModal.subject}</p>
                </div>
              </div>
              <button
                className="modal-close"
                onClick={() => setShowHistoryModal(null)}
                style={{
                  width: 32,
                  height: 32,
                  borderRadius: 8,
                  background: 'rgba(0,0,0,0.1)',
                  border: 'none',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
              >
                <i className="ph ph-x" style={{ fontSize: 18 }}></i>
              </button>
            </div>

            <div style={{ flex: 1, overflow: 'auto', padding: 20 }}>
              {!showHistoryModal.history || showHistoryModal.history.length === 0 ? (
                <div style={{ textAlign: 'center', padding: 60, color: 'var(--text-muted)' }}>
                  <i className="ph ph-clock" style={{ fontSize: 64, opacity: 0.3 }}></i>
                  <p style={{ marginTop: 16, fontSize: 16 }}>Nenhum registro no histórico</p>
                </div>
              ) : (
                <div style={{ position: 'relative' }}>
                  <div
                    style={{
                      position: 'absolute',
                      left: 23,
                      top: 20,
                      bottom: 20,
                      width: 2,
                      background: 'var(--border-light)',
                    }}
                  />

                  {showHistoryModal.history
                    .slice()
                    .reverse()
                    .map((entry, idx) => {
                      const isContact = entry.type === 'contact';
                      const isStatusChange = entry.type === 'status_change';

                      return (
                        <div key={idx} style={{ display: 'flex', gap: 16, marginBottom: 20, position: 'relative' }}>
                          <div
                            style={{
                              width: 48,
                              height: 48,
                              borderRadius: '50%',
                              background: isContact ? '#3b82f6' : isStatusChange ? '#10b981' : '#6b7280',
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'center',
                              flexShrink: 0,
                              zIndex: 1,
                            }}
                          >
                            <i
                              className={`ph ${isContact ? 'ph-paper-plane-tilt' : isStatusChange ? 'ph-arrows-left-right' : 'ph-note'}`}
                              style={{ color: 'white', fontSize: 18 }}
                            ></i>
                          </div>

                          <div
                            style={{
                              flex: 1,
                              background: 'var(--bg-panel)',
                              borderRadius: 12,
                              padding: 16,
                              border: '1px solid var(--border-light)',
                            }}
                          >
                            <div
                              style={{
                                display: 'flex',
                                justifyContent: 'space-between',
                                alignItems: 'flex-start',
                                marginBottom: 8,
                              }}
                            >
                              <div>
                                <strong style={{ fontSize: 14 }}>
                                  {isContact && `Contato via ${entry.channel === 'chat' ? 'Chat' : 'E-mail'}`}
                                  {isStatusChange && `Status alterado`}
                                  {!isContact && !isStatusChange && 'Nota'}
                                </strong>
                                {isStatusChange && entry.from && entry.to && (
                                  <div style={{ fontSize: 13, color: 'var(--text-muted)', marginTop: 4 }}>
                                    <span
                                      style={{
                                        background: '#fef2f2',
                                        color: '#dc2626',
                                        padding: '2px 8px',
                                        borderRadius: 6,
                                        marginRight: 6,
                                      }}
                                    >
                                      {getStatusLabel(entry.from)}
                                    </span>
                                    <i className="ph ph-arrow-right" style={{ marginRight: 6 }}></i>
                                    <span
                                      style={{
                                        background: '#ecfdf5',
                                        color: '#059669',
                                        padding: '2px 8px',
                                        borderRadius: 6,
                                      }}
                                    >
                                      {getStatusLabel(entry.to)}
                                    </span>
                                  </div>
                                )}
                              </div>
                              <span style={{ fontSize: 11, color: 'var(--text-muted)', whiteSpace: 'nowrap' }}>
                                {new Date(entry.at).toLocaleString('pt-BR', {
                                  day: '2-digit',
                                  month: '2-digit',
                                  hour: '2-digit',
                                  minute: '2-digit',
                                })}
                              </span>
                            </div>

                            {entry.subject && (
                              <div style={{ fontSize: 13, fontWeight: 600, marginBottom: 4 }}>{entry.subject}</div>
                            )}

                            {entry.message && (
                              <div
                                style={{
                                  background: 'rgba(0,0,0,0.1)',
                                  padding: 12,
                                  borderRadius: 8,
                                  fontSize: 13,
                                  lineHeight: 1.5,
                                  marginTop: 8,
                                }}
                              >
                                {entry.message}
                              </div>
                            )}

                            {entry.note && !entry.message && (
                              <p style={{ margin: '8px 0 0', fontSize: 13, color: 'var(--text-muted)' }}>
                                {entry.note}
                              </p>
                            )}

                            <div
                              style={{
                                fontSize: 11,
                                color: 'var(--text-muted)',
                                marginTop: 8,
                                display: 'flex',
                                alignItems: 'center',
                                gap: 4,
                              }}
                            >
                              <i className="ph ph-user"></i> {entry.by}
                            </div>
                          </div>
                        </div>
                      );
                    })}
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Modal de Contato */}
      {showContactModal && (
        <div className="modal-overlay" onClick={() => setShowContactModal(null)}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()} style={{ maxWidth: 500 }}>
            <div
              className="modal-header"
              style={{
                background:
                  contactType === 'chat'
                    ? 'linear-gradient(135deg, #8b5cf6, #7c3aed)'
                    : 'linear-gradient(135deg, #3b82f6, #2563eb)',
                padding: 16,
                borderRadius: '12px 12px 0 0',
                margin: '-20px -20px 20px -20px',
              }}
            >
              <h3 style={{ margin: 0, color: 'white', display: 'flex', alignItems: 'center', gap: 10 }}>
                <i className={`ph ${contactType === 'chat' ? 'ph-chat-circle-dots' : 'ph-envelope-simple'}`}></i>
                Enviar {contactType === 'chat' ? 'Chat' : 'E-mail'}
              </h3>
              <button
                className="modal-close"
                onClick={() => setShowContactModal(null)}
                style={{
                  width: 32,
                  height: 32,
                  borderRadius: 8,
                  background: 'rgba(255,255,255,0.2)',
                  border: 'none',
                  cursor: 'pointer',
                }}
              >
                <i className="ph ph-x" style={{ fontSize: 18, color: 'white' }}></i>
              </button>
            </div>

            <div className="modal-body" style={{ padding: 0 }}>
              <div style={{ padding: '0 20px 20px' }}>
                <div style={{ marginBottom: 16, padding: 12, background: 'rgba(0,0,0,0.1)', borderRadius: 10 }}>
                  <div style={{ fontSize: 13, marginBottom: 4 }}>
                    <strong>Para:</strong>{' '}
                    {showContactModal.customerEmail || showContactModal.customerPhone || 'Cliente'}
                  </div>
                  <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>Ticket: {showContactModal.subject}</div>
                </div>

                <div style={{ marginBottom: 16 }}>
                  <label
                    style={{
                      display: 'block',
                      fontSize: 12,
                      marginBottom: 6,
                      color: 'var(--text-muted)',
                      fontWeight: 600,
                    }}
                  >
                    Assunto {contactType === 'email' && '(obrigatório)'}
                  </label>
                  <input
                    type="text"
                    value={contactSubject}
                    onChange={(e) => setContactSubject(e.target.value)}
                    placeholder={showContactModal.subject}
                    style={{
                      width: '100%',
                      padding: '12px 14px',
                      background: 'var(--bg-panel)',
                      border: '1px solid var(--border-light)',
                      borderRadius: 10,
                      color: 'var(--text-main)',
                      fontSize: 14,
                    }}
                  />
                </div>

                <div style={{ marginBottom: 20 }}>
                  <label
                    style={{
                      display: 'block',
                      fontSize: 12,
                      marginBottom: 6,
                      color: 'var(--text-muted)',
                      fontWeight: 600,
                    }}
                  >
                    Mensagem
                  </label>
                  <textarea
                    value={contactMessage}
                    onChange={(e) => setContactMessage(e.target.value)}
                    placeholder={`Digite sua mensagem...`}
                    rows={5}
                    style={{
                      width: '100%',
                      padding: '12px 14px',
                      background: 'var(--bg-panel)',
                      border: '1px solid var(--border-light)',
                      borderRadius: 10,
                      color: 'var(--text-main)',
                      fontSize: 14,
                      resize: 'vertical',
                      fontFamily: 'inherit',
                    }}
                  />
                </div>

                <div style={{ display: 'flex', gap: 12, justifyContent: 'flex-end' }}>
                  <button
                    onClick={() => setShowContactModal(null)}
                    style={{
                      padding: '10px 20px',
                      background: 'rgba(0,0,0,0.1)',
                      border: 'none',
                      borderRadius: 10,
                      cursor: 'pointer',
                      fontSize: 14,
                      fontWeight: 600,
                    }}
                  >
                    Cancelar
                  </button>
                  <button
                    onClick={handleSendContact}
                    disabled={processing || !contactMessage.trim()}
                    style={{
                      padding: '10px 20px',
                      background:
                        contactType === 'chat'
                          ? 'linear-gradient(135deg, #8b5cf6, #7c3aed)'
                          : 'linear-gradient(135deg, #3b82f6, #2563eb)',
                      border: 'none',
                      borderRadius: 10,
                      cursor: 'pointer',
                      fontSize: 14,
                      fontWeight: 600,
                      color: 'white',
                      display: 'flex',
                      alignItems: 'center',
                      gap: 8,
                    }}
                  >
                    <i className={`ph ${contactType === 'chat' ? 'ph-paper-plane-tilt' : 'ph-envelope-simple'}`}></i>
                    Enviar
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      <style>{`
        .action-btn {
          display: inline-flex;
          align-items: center;
          gap: 6px;
          padding: 10px 16px;
          border-radius: 10px;
          font-size: 13px;
          font-weight: 600;
          border: none;
          cursor: pointer;
          transition: all 0.2s;
        }
        
        .action-btn:disabled {
          opacity: 0.5;
          cursor: not-allowed;
        }
        
        .action-btn-primary {
          background: linear-gradient(135deg, #0d9488, #0f766e);
          color: white;
        }
        .action-btn-primary:hover:not(:disabled) {
          background: linear-gradient(135deg, #0f766e, #115e59);
          transform: translateY(-1px);
        }
        
        .action-btn-success {
          background: linear-gradient(135deg, #10b981, #059669);
          color: white;
        }
        .action-btn-success:hover:not(:disabled) {
          background: linear-gradient(135deg, #059669, #047857);
          transform: translateY(-1px);
        }
        
        .action-btn-secondary {
          background: rgba(255,255,255,0.1);
          color: var(--text-main);
          border: 1px solid var(--border-light);
        }
        .action-btn-secondary:hover:not(:disabled) {
          background: rgba(255,255,255,0.15);
          transform: translateY(-1px);
        }
        
        .action-btn-email {
          background: linear-gradient(135deg, #3b82f6, #2563eb);
          color: white;
        }
        .action-btn-email:hover:not(:disabled) {
          background: linear-gradient(135deg, #2563eb, #1d4ed8);
          transform: translateY(-1px);
        }
        
        .action-btn-chat {
          background: linear-gradient(135deg, #8b5cf6, #7c3aed);
          color: white;
        }
        .action-btn-chat:hover:not(:disabled) {
          background: linear-gradient(135deg, #7c3aed, #6d28d9);
          transform: translateY(-1px);
        }
        
        .action-btn .badge {
          background: rgba(255,255,255,0.3);
          padding: 2px 6px;
          border-radius: 10px;
          font-size: 10px;
          margin-left: 4px;
        }
        
        .info-card {
          background: rgba(0,0,0,0.1);
          border-radius: 10px;
          padding: 12px;
        }
        
        .info-card label {
          display: flex;
          align-items: center;
          gap: 6px;
          font-size: 11px;
          color: var(--text-muted);
          text-transform: uppercase;
          margin-bottom: 4px;
        }
        
        .info-card span {
          font-size: 13px;
          font-weight: 500;
          color: var(--text-main);
        }
      `}</style>
    </>
  );
}
