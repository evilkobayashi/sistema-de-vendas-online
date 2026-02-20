const state = { user: null, medicines: [], orders: [], deliveries: [], tickets: [] };

const byId = (id) => document.getElementById(id);

for (const btn of document.querySelectorAll('button[data-tab]')) {
  btn.addEventListener('click', () => activateTab(btn.dataset.tab));
}

function activateTab(tab) {
  document.querySelectorAll('.tab').forEach((b) => b.classList.toggle('active', b.dataset.tab === tab));
  document.querySelectorAll('.tab-content').forEach((s) => s.classList.toggle('active', s.id === tab));
}

document.querySelectorAll('.tab').forEach((btn) => btn.addEventListener('click', () => activateTab(btn.dataset.tab)));

byId('login-form').addEventListener('submit', async (e) => {
  e.preventDefault();
  const data = Object.fromEntries(new FormData(e.target).entries());
  const r = await fetch('/api/login', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(data) });
  const json = await r.json();
  if (!r.ok) return alert(json.error || 'Falha no login');
  state.user = json.user;
  byId('auth-section').classList.add('hidden');
  byId('app-section').classList.remove('hidden');
  await bootstrap();
});

async function bootstrap() {
  await Promise.all([loadDashboard(), loadCatalog(), loadOrders(), loadDeliveries(), loadTickets()]);
  renderSaleForm();
}

async function loadDashboard() {
  const r = await fetch(`/api/dashboard/${state.user.role}`);
  const { indicators, reminders } = await r.json();
  byId('dashboard').innerHTML = `
    <div class="kpis">
      <div class="kpi"><strong>${indicators.pedidos}</strong><br>Pedidos</div>
      <div class="kpi"><strong>${indicators.entregasPendentes}</strong><br>Entregas pendentes</div>
      <div class="kpi"><strong>${indicators.ticketsAbertos}</strong><br>Tickets abertos</div>
      <div class="kpi"><strong>R$ ${indicators.totalSales.toFixed(2)}</strong><br>Total em vendas</div>
    </div>
    <h3>Lembretes (recorrência)</h3>
    ${reminders.length ? reminders.map((r) => `<div class="card">${r.orderId} - ${r.patientName}: ${r.message}</div>`).join('') : '<div class="empty">Nenhum lembrete para os próximos 3 dias.</div>'}
  `;
}

async function loadCatalog() {
  const r = await fetch('/api/medicines');
  const data = await r.json();
  state.medicines = data.items;
  renderCatalog(data.items, data.specialties, data.labs);
}

function renderCatalog(items, specialties, labs) {
  byId('catalogo').innerHTML = `
    <form id="catalog-filter">
      <select name="specialty"><option value="">Todas especialidades</option>${specialties.map((s) => `<option>${s}</option>`).join('')}</select>
      <select name="lab"><option value="">Todos laboratórios</option>${labs.map((l) => `<option>${l}</option>`).join('')}</select>
      <button>Filtrar</button>
    </form>
    <div class="grid">
      ${items.map((m) => `<article class="med-card"><h4>${m.image} ${m.name}</h4><p>Lab: ${m.lab}</p><p>Especialidade: ${m.specialty}</p><strong>R$ ${m.price.toFixed(2)}</strong>${m.controlled ? '<p>Controlado: exige receita</p>' : ''}</article>`).join('')}
    </div>
  `;

  byId('catalog-filter').addEventListener('submit', async (e) => {
    e.preventDefault();
    const q = new URLSearchParams(Object.fromEntries(new FormData(e.target).entries()));
    const r = await fetch(`/api/medicines?${q.toString()}`);
    const data = await r.json();
    renderCatalog(data.items, specialties, labs);
  });
}

function renderSaleForm() {
  byId('vendas').innerHTML = `
    <form id="sale-form">
      <input name="patientName" placeholder="Nome do paciente" required />
      <input name="email" type="email" placeholder="E-mail" required />
      <input name="phone" placeholder="Telefone" required />
      <input name="address" placeholder="Endereço" required />
      <select name="medicineId">${state.medicines.map((m) => `<option value="${m.id}">${m.name}</option>`)}</select>
      <input name="quantity" type="number" min="1" value="1" />
      <input name="prescriptionCode" placeholder="Receita (se controlado)" />
      <input name="discountPercent" type="number" min="0" max="100" value="0" />
      <input name="nextBillingDate" type="date" />
      <button>Registrar venda</button>
    </form>
    <p class="hint">Valor total é calculado no backend com validação de receita controlada.</p>
  `;

  byId('sale-form').addEventListener('submit', async (e) => {
    e.preventDefault();
    const f = Object.fromEntries(new FormData(e.target).entries());
    const payload = {
      userId: state.user.id,
      patientName: f.patientName,
      email: f.email,
      phone: f.phone,
      address: f.address,
      items: [{ medicineId: f.medicineId, quantity: Number(f.quantity) }],
      prescriptionCode: f.prescriptionCode || undefined,
      recurring: f.nextBillingDate ? { discountPercent: Number(f.discountPercent || 0), nextBillingDate: f.nextBillingDate } : undefined
    };

    const r = await fetch('/api/orders', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) });
    const data = await r.json();
    if (!r.ok) return alert(data.error || 'Erro ao salvar pedido');
    alert(`Pedido ${data.order.id} criado`);
    await Promise.all([loadOrders(), loadDeliveries(), loadDashboard()]);
  });
}

async function loadOrders() {
  const r = await fetch('/api/orders');
  const data = await r.json();
  state.orders = data.items;
  byId('pedidos').innerHTML = state.orders.length
    ? `<table class="table"><thead><tr><th>Pedido</th><th>Paciente</th><th>Total</th><th>Data</th></tr></thead><tbody>${state.orders.map((o) => `<tr><td>${o.id}</td><td>${o.patientName}</td><td>R$ ${o.total.toFixed(2)}</td><td>${new Date(o.createdAt).toLocaleString()}</td></tr>`).join('')}</tbody></table>`
    : '<div class="empty">Nenhum pedido registrado ainda.</div>';
}

async function loadDeliveries() {
  const r = await fetch('/api/deliveries');
  const data = await r.json();
  state.deliveries = data.items;
  renderDeliveries(state.deliveries);
}

function renderDeliveries(items) {
  byId('entregas').innerHTML = `
    <form id="delivery-filter">
      <select name="status"><option value="">Todos status</option><option value="pendente">Pendente</option><option value="em_rota">Em rota</option><option value="entregue">Entregue</option></select>
      <input name="q" placeholder="Buscar pedido ou paciente" />
      <button>Filtrar</button>
    </form>
    ${items.length ? `<table class="table"><thead><tr><th>Pedido</th><th>Paciente</th><th>Status</th><th>Previsão</th><th>Transportadora</th><th>Ação</th></tr></thead><tbody>${items.map((d) => `<tr><td>${d.orderId}</td><td>${d.patientName}</td><td>${d.status}</td><td>${d.forecastDate}</td><td>${d.carrier}</td><td><button data-delivery="${d.orderId}" data-status="em_rota">Em rota</button> <button data-delivery="${d.orderId}" data-status="entregue">Entregue</button></td></tr>`).join('')}</tbody></table>` : '<div class="empty">Sem entregas para os filtros atuais.</div>'}
  `;

  byId('delivery-filter').addEventListener('submit', async (e) => {
    e.preventDefault();
    const q = new URLSearchParams(Object.fromEntries(new FormData(e.target).entries()));
    const r = await fetch(`/api/deliveries?${q.toString()}`);
    const data = await r.json();
    renderDeliveries(data.items);
  });

  document.querySelectorAll('[data-delivery]').forEach((button) => {
    button.addEventListener('click', async () => {
      const orderId = button.getAttribute('data-delivery');
      const status = button.getAttribute('data-status');
      await fetch(`/api/deliveries/${orderId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status })
      });
      await Promise.all([loadDeliveries(), loadDashboard()]);
    });
  });
}

async function loadTickets() {
  const r = await fetch(`/api/tickets/${state.user.id}`);
  const data = await r.json();
  state.tickets = data.items;
  byId('atendimento').innerHTML = state.tickets.length
    ? state.tickets.map((t) => `<div class="card"><strong>${t.subject}</strong><br>Status: ${t.status}</div>`).join('')
    : '<div class="empty">Nenhum ticket atribuído para este colaborador.</div>';
}
