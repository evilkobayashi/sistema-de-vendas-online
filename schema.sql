-- Tabela lógica para persistência de notificações de recorrência.
CREATE TABLE recurrence_notifications (
  id TEXT PRIMARY KEY,
  order_id TEXT NOT NULL,
  collaborator_id TEXT NOT NULL,
  due_date_key TEXT NOT NULL,
  created_at TEXT NOT NULL,
  channels_json TEXT NOT NULL,
  UNIQUE(order_id, due_date_key)
);
