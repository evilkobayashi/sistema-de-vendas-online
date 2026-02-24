const state = { token: null, user: null, medicines: [], orders: [], deliveries: [], tickets: [] };
const byId = (id) => document.getElementById(id);
const money = (v) => `R$ ${Number(v).toFixed(2)}`;

async function apiFetch(url, options = {}) {
  const headers = { ...(options.headers || {}) };
  if (state.token) headers.Authorization = `Bearer ${state.token}`;
  if (options.body && !headers['Content-Type']) headers['Content-Type'] = 'application/json';
  const response = await fetch(url, { ...options, headers });
  const payload = (response.headers.get('content-type') || '').includes('application/json') ? await response.json() : await response.text();
  if (!response.ok) {
    const error = typeof payload === 'object' && payload?.error ? payload.error : `Erro HTTP ${response.status}`;
    if (response.status === 401) location.reload();
    throw new Error(error);
  }
  return payload;
}

function activateTab(tab) {
  document.querySelectorAll('.tab').forEach((b) => b.classList.toggle('active', b.dataset.tab === tab));
  document.querySelectorAll('.tab-content').forEach((s) => s.classList.toggle('active', s.id === tab));
}

document.querySelectorAll('.tab').forEach((btn) => btn.addEventListener('click', () => activateTab(btn.dataset.tab)));

byId('logout-btn').addEventListener('click', async () => {
  try { await apiFetch('/api/logout', { method: 'POST' }); } catch {}
  state.token = null;
  byId('app').classList.add('hidden');
  byId('login-panel').classList.remove('hidden');
  byId('user-badge').classList.add('hidden');
  byId('logout-btn').classList.add('hidden');
});

byId('login-form').addEventListener('submit', async (e) => {
  e.preventDefault();
  try {
    const data = await apiFetch('/api/login', { method: 'POST', body: JSON.stringify(Object.fromEntries(new FormData(e.target).entries())) });
    state.token = data.token;
    state.user = data.user;
    byId('user-badge').textContent = `${state.user.name} • ${state.user.role}`;
    byId('user-badge').classList.remove('hidden');
    byId('logout-btn').classList.remove('hidden');
    byId('login-panel').classList.add('hidden');
    byId('app').classList.remove('hidden');
    await refreshAll();
  } catch (error) {
    alert(error.message || 'Falha no login');
  }
});

async function refreshAll() {
  await Promise.all([loadDashboard(), loadCatalog(), loadInventory(), loadOrders(), loadDeliveries(), loadTickets()]);
  renderPurchaseForm();
}

async function loadDashboard() {
  const data = await apiFetch('/api/dashboard');
  byId('dashboard').innerHTML = `
    <h2>Dashboard Operacional</h2>
    <div class="kpis">
      <div class="kpi"><div class="value">${data.indicators.pedidos}</div><div>Pedidos</div></div>
      <div class="kpi"><div class="value">${data.indicators.entregasPendentes}</div><div>Entregas pendentes</div></div>
      <div class="kpi"><div class="value">${data.indicators.estoqueCritico}</div><div>Estoque crítico</div></div>
      <div class="kpi"><div class="value">${data.indicators.lotesProximosVencimento}</div><div>Lotes próximos ao vencimento</div></div>
      <div class="kpi"><div class="value">${money(data.indicators.totalSales)}</div><div>Total vendido</div></div>
    </div>
    <h3>Lembretes de recorrência</h3>
    ${data.reminders.length ? data.reminders.map((x) => `<div class="card reminder"><strong>${x.orderId}</strong> • ${x.patientName}<br/>${x.message} (${x.nextBillingDate})<div class="inline"><button data-confirm-order="${x.orderId}" class="quick-btn">Confirmado</button></div></div>`).join('') : '<div class="empty">Sem lembretes.</div>'}
  `;
  document.querySelectorAll('[data-confirm-order]').forEach((btn) => btn.addEventListener('click', async () => {
    await apiFetch(`/api/orders/${btn.dataset.confirmOrder}/recurring/confirm`, { method: 'PATCH' });
    await loadDashboard();
  }));
}

function renderMedicineImage(medicine) {
  if (medicine.image?.startsWith('http') || medicine.image?.startsWith('data:image/')) return `<img src="${medicine.image}" alt="${medicine.name}" class="medicine-image" loading="lazy"/>`;
  return '<div class="medicine-fallback">💊</div>';
}

async function loadCatalog() {
  const data = await apiFetch('/api/medicines');
  state.medicines = data.items;
  byId('catalogo').innerHTML = `
    <h2>Catálogo farmacêutico</h2>
    <div class="cards">${state.medicines.map((m) => `<article class="card">${renderMedicineImage(m)}<h3>${m.name}</h3><p>${m.description}</p><p>${m.lab} • ${m.specialty}</p><p>Disponível: <strong>${m.inventory?.stockAvailable ?? 0}</strong></p><strong>${money(m.price)}</strong></article>`).join('')}</div>
  `;
}

async function loadInventory() {
  const summary = await apiFetch('/api/inventory/summary?page=1&pageSize=50');
  const canManage = ['admin', 'gerente', 'inventario'].includes(state.user.role);
  byId('estoque').innerHTML = `
    <h2>Gestão transacional de estoque</h2>
    <div class="kpis">
      <div class="kpi"><div class="value">${summary.critical}</div><div>Itens críticos</div></div>
      <div class="kpi"><div class="value">${summary.nearExpiry}</div><div>Lotes até 30 dias</div></div>
    </div>
    ${canManage ? `<form id="lot-form" class="inline grid-form">
      <select name="medicineId" required>${state.medicines.map((m) => `<option value="${m.id}">${m.name}</option>`)}</select>
      <input name="batchCode" placeholder="Lote" required />
      <input name="expiresAt" type="date" required />
      <input name="quantity" type="number" min="1" placeholder="Qtd" required />
      <input name="unitCost" type="number" min="0.01" step="0.01" placeholder="Custo unit." required />
      <input name="supplier" placeholder="Fornecedor" required />
      <button type="submit">Adicionar lote</button>
    </form>` : ''}
    <table class="table"><thead><tr><th>Medicamento</th><th>Disponível</th><th>Total</th><th>Lotes</th><th>Risco venc.</th></tr></thead>
    <tbody>${summary.items.map((s) => `<tr><td>${s.medicineName}</td><td>${s.stockAvailable}</td><td>${s.stockTotal}</td><td>${s.lotCount}</td><td>${s.expiresIn30Days}</td></tr>`).join('')}</tbody></table>
  `;

  const form = byId('lot-form');
  if (form) {
    form.addEventListener('submit', async (e) => {
      e.preventDefault();
      try {
        const payload = Object.fromEntries(new FormData(form).entries());
        await apiFetch('/api/inventory/lots', { method: 'POST', body: JSON.stringify(payload) });
        await Promise.all([loadInventory(), loadCatalog(), loadDashboard()]);
        form.reset();
      } catch (error) {
        alert(error.message || 'Erro ao adicionar lote');
      }
    });
  }
}

function renderPurchaseForm() {
  byId('nova-venda').innerHTML = `
    <h2>Nova compra</h2>
    <form id="sale-form" class="grid-form">
      <input name="patientName" placeholder="Paciente" required/>
      <input name="email" type="email" placeholder="E-mail" required/>
      <input name="phone" placeholder="Telefone" required/>
      <input name="address" placeholder="Endereço" required/>
      <select name="medicineId" required>${state.medicines.map((m) => `<option value="${m.id}">${m.name} (${money(m.price)})</option>`)}</select>
      <input name="quantity" type="number" min="1" value="1" required/>
      <input name="prescriptionCode" placeholder="Receita (controlados)"/>
      <label><input type="checkbox" name="recurringEnabled"/> Compra recorrente</label>
      <input name="discountPercent" type="number" min="0" max="100" value="5"/>
      <input name="nextBillingDate" type="date"/>
      <button type="submit">Registrar</button>
    </form>
  `;
  byId('sale-form').addEventListener('submit', async (e) => {
    e.preventDefault();
    const p = Object.fromEntries(new FormData(e.target).entries());
    const payload = {
      patientName: p.patientName, email: p.email, phone: p.phone, address: p.address, prescriptionCode: p.prescriptionCode || undefined,
      items: [{ medicineId: p.medicineId, quantity: Number(p.quantity) }],
      recurring: p.recurringEnabled === 'on' ? { discountPercent: Number(p.discountPercent || 0), nextBillingDate: p.nextBillingDate } : undefined
    };
    try {
      const data = await apiFetch('/api/orders', { method: 'POST', body: JSON.stringify(payload) });
      alert(`Pedido ${data.order.id} criado (${money(data.order.total)})`);
      await Promise.all([loadOrders(), loadDeliveries(), loadDashboard(), loadCatalog(), loadInventory()]);
      e.target.reset();
    } catch (error) { alert(error.message || 'Erro ao criar pedido'); }
  });
}

async function loadOrders() {
  const data = await apiFetch('/api/orders?page=1&pageSize=50');
  byId('pedidos').innerHTML = `<h2>Histórico de pedidos</h2>${data.items.length ? `<table class="table"><thead><tr><th>Pedido</th><th>Paciente</th><th>Total</th><th>Criado em</th></tr></thead><tbody>${data.items.map((o) => `<tr><td>${o.id}</td><td>${o.patientName}</td><td>${money(o.total)}</td><td>${new Date(o.createdAt).toLocaleString()}</td></tr>`).join('')}</tbody></table>` : '<div class="empty">Sem pedidos.</div>'}`;
}

async function loadDeliveries() {
  const data = await apiFetch('/api/deliveries?page=1&pageSize=50');
  byId('entregas').innerHTML = `<h2>Central de entregas</h2>${data.items.length ? `<table class="table"><thead><tr><th>Pedido</th><th>Paciente</th><th>Status</th></tr></thead><tbody>${data.items.map((d) => `<tr><td>${d.orderId}</td><td>${d.patientName}</td><td>${d.status}</td></tr>`).join('')}</tbody></table>` : '<div class="empty">Sem entregas.</div>'}`;
}

async function loadTickets() {
  const data = await apiFetch(`/api/tickets/${state.user.id}`);
  byId('atendimento').innerHTML = `<h2>Atendimento</h2>${data.items.length ? data.items.map((t) => `<div class="card"><strong>${t.subject}</strong><p>Status: ${t.status}</p></div>`).join('') : '<div class="empty">Sem tickets.</div>'}`;
}
