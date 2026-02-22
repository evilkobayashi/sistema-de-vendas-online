CREATE TABLE IF NOT EXISTS users (
  id UUID PRIMARY KEY,
  patient_name TEXT NOT NULL,
  email TEXT NOT NULL UNIQUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS medicines (
  id UUID PRIMARY KEY,
  name TEXT NOT NULL,
  sku TEXT NOT NULL UNIQUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS orders (
  id UUID PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES users(id),
  status TEXT NOT NULL CHECK (status IN ('created', 'paid', 'cancelled')),
  total_amount NUMERIC(10,2) NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS order_items (
  id UUID PRIMARY KEY,
  order_id UUID NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
  medicine_id UUID NOT NULL REFERENCES medicines(id),
  quantity INTEGER NOT NULL CHECK (quantity > 0),
  unit_price NUMERIC(10,2) NOT NULL CHECK (unit_price >= 0)
);

CREATE TABLE IF NOT EXISTS deliveries (
  id UUID PRIMARY KEY,
  order_id UUID NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
  patient_name TEXT NOT NULL,
  status TEXT NOT NULL CHECK (status IN ('pending', 'in_transit', 'delivered', 'failed')),
  estimated_at TIMESTAMPTZ,
  delivered_at TIMESTAMPTZ
);

CREATE TABLE IF NOT EXISTS tickets (
  id UUID PRIMARY KEY,
  order_id UUID NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES users(id),
  subject TEXT NOT NULL,
  status TEXT NOT NULL CHECK (status IN ('open', 'closed')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS recurring_confirmations (
  id UUID PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES users(id),
  order_id UUID NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
  next_billing_date TIMESTAMPTZ NOT NULL,
  active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Dashboard and delivery search indexes
CREATE INDEX IF NOT EXISTS idx_orders_status_created_at ON orders (status, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_deliveries_status_order_id ON deliveries (status, order_id);
CREATE INDEX IF NOT EXISTS idx_deliveries_patient_name ON deliveries (patient_name);
CREATE INDEX IF NOT EXISTS idx_recurring_confirmations_next_billing_date ON recurring_confirmations (next_billing_date) WHERE active = true;
