const state = { user: null, medicines: [], orders: [], deliveries: [], tickets: [], filters: { specialty: '', lab: '' } };

const byId = (id) => document.getElementById(id);
const money = (v) => `R$ ${Number(v).toFixed(2)}`;

function activateTab(tab) {
  document.querySelectorAll('.tab').forEach((b) => b.classList.toggle('active', b.dataset.tab === tab));
  document.querySelectorAll('.tab-content').forEach((s) => s.classList.toggle('active', s.id === tab));
}

document.querySelectorAll('.tab').forEach((btn) => btn.addEventListener('click', () => activateTab(btn.dataset.tab)));

byId('login-form').addEventListener('submit', async (e) => {
  e.preventDefault();
  const payload = Object.fromEntries(new FormData(e.target).entries());
  const r = await fetch('/api/login', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) });
  const data = await r.json();
  if (!r.ok) return alert(data.error || 'Falha no login');

  state.user = data.user;
  byId('user-badge').textContent = `${state.user.name} • ${state.user.role}`;
  byId('user-badge').classList.remove('hidden');
  byId('login-panel').classList.add('hidden');
  byId('app').classList.remove('hidden');

  await refreshAll();
});

async function refreshAll() {
  await Promise.all([loadDashboard(), loadCatalog(), loadOrders(), loadDeliveries(), loadTickets()]);
  renderPurchaseForm();
}

async function loadDashboard() {
  const r = await fetch(`/api/dashboard/${state.user.role}`);
  const data = await r.json();
  byId('dashboard').innerHTML = `
    <h2>Dashboard Operacional</h2>
    <div class="kpis">
      <div class="kpi"><div class="value">${data.indicators.pedidos}</div><div>Pedidos</div></div>
      <div class="kpi"><div class="value">${data.indicators.entregasPendentes}</div><div>Entregas pendentes</div></div>
      <div class="kpi"><div class="value">${data.indicators.ticketsAbertos}</div><div>Tickets abertos</div></div>
      <div class="kpi"><div class="value">${money(data.indicators.totalSales)}</div><div>Total vendido</div></div>
    </div>
    <h3>Lembretes de recorrência</h3>
    ${data.reminders.length ? data.reminders.map((x) => `<div class="card">${x.orderId} • ${x.patientName} — ${x.message}</div>`).join('') : '<div class="empty">Sem lembretes para os próximos 3 dias.</div>'}
  `;
}

async function loadCatalog() {
  const q = new URLSearchParams();
  if (state.filters.specialty) q.set('specialty', state.filters.specialty);
  if (state.filters.lab) q.set('lab', state.filters.lab);
  const r = await fetch(`/api/medicines?${q.toString()}`);
  const data = await r.json();
  state.medicines = data.items;

  byId('catalogo').innerHTML = `
    <h2>Catálogo de medicamentos</h2>
    <form id="catalog-form" class="inline">
      <select name="specialty"><option value="">Todas especialidades</option>${data.specialties.map((s) => `<option ${state.filters.specialty===s?'selected':''}>${s}</option>`).join('')}</select>
      <select name="lab"><option value="">Todos laboratórios</option>${data.labs.map((l) => `<option ${state.filters.lab===l?'selected':''}>${l}</option>`).join('')}</select>
      <button type="submit">Filtrar</button>
      <button type="button" id="clear-filters" class="quick-btn">Limpar</button>
    </form>
    <div class="grid">
      ${state.medicines.map((m) => `
        <article class="card">
          <h4>${m.image} ${m.name}</h4>
          <p><strong>${money(m.price)}</strong></p>
          <p>${m.lab} • ${m.specialty}</p>
          ${m.controlled ? '<span class="tag">Controlado (receita obrigatória)</span>' : '<span class="tag">Não controlado</span>'}
        </article>
      `).join('')}
    </div>
  `;

  byId('catalog-form').addEventListener('submit', (e) => {
    e.preventDefault();
    const f = Object.fromEntries(new FormData(e.target).entries());
    state.filters.specialty = f.specialty || '';
    state.filters.lab = f.lab || '';
    loadCatalog();
  });

  byId('clear-filters').addEventListener('click', () => {
    state.filters = { specialty: '', lab: '' };
    loadCatalog();
  });
}

function renderPurchaseForm() {
  byId('nova-venda').innerHTML = `
    <h2>Registrar compra interna</h2>
    <form id="sale-form">
      <input name="patientName" placeholder="Nome do paciente" required />
      <input name="email" type="email" placeholder="E-mail" required />
      <input name="phone" placeholder="Telefone" required />
      <input name="address" placeholder="Endereço" required />
      <select name="medicineId" required>${state.medicines.map((m) => `<option value="${m.id}">${m.name} (${money(m.price)})</option>`)}</select>
      <input name="quantity" type="number" min="1" value="1" required />
      <input name="prescriptionCode" placeholder="Código da receita (se controlado)" />
      <input name="discountPercent" type="number" min="0" max="100" placeholder="Desconto recorrência (%)" />
      <input name="nextBillingDate" type="date" />
      <button type="submit">Salvar pedido</button>
    </form>
    <small>O valor final é calculado no backend e validado por regra de medicamentos controlados.</small>
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
      recurring: f.nextBillingDate
        ? { discountPercent: Number(f.discountPercent || 0), nextBillingDate: f.nextBillingDate }
        : undefined
    };

    const r = await fetch('/api/orders', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) });
    const data = await r.json();
    if (!r.ok) return alert(typeof data.error === 'string' ? data.error : 'Erro ao criar pedido');

    alert(`Pedido ${data.order.id} criado com total ${money(data.order.total)}`);
    await Promise.all([loadDashboard(), loadOrders(), loadDeliveries()]);
    e.target.reset();
  });
}

async function loadOrders() {
  const r = await fetch('/api/orders');
  const data = await r.json();
  state.orders = data.items;

  byId('pedidos').innerHTML = `
    <h2>Histórico de pedidos</h2>
    ${state.orders.length ? `
      <table class="table">
        <thead><tr><th>Pedido</th><th>Paciente</th><th>Total</th><th>Criado em</th></tr></thead>
        <tbody>${state.orders.map((o) => `<tr><td>${o.id}</td><td>${o.patientName}</td><td>${money(o.total)}</td><td>${new Date(o.createdAt).toLocaleString()}</td></tr>`).join('')}</tbody>
      </table>
    ` : '<div class="empty">Ainda não existem pedidos.</div>'}
  `;
}

async function loadDeliveries() {
  const r = await fetch('/api/deliveries');
  const data = await r.json();
  state.deliveries = data.items;

  byId('entregas').innerHTML = `
    <h2>Central de entregas</h2>
    ${state.deliveries.length ? `
      <table class="table">
        <thead><tr><th>Pedido</th><th>Paciente</th><th>Status</th><th>Previsão</th><th>Ações</th></tr></thead>
        <tbody>
          ${state.deliveries.map((d) => `
            <tr>
              <td>${d.orderId}</td>
              <td>${d.patientName}</td>
              <td>${d.status}</td>
              <td>${d.forecastDate}</td>
              <td class="inline">
                <button data-did="${d.orderId}" data-status="em_rota" class="quick-btn">Em rota</button>
                <button data-did="${d.orderId}" data-status="entregue" class="quick-btn">Entregue</button>
              </td>
            </tr>
          `).join('')}
        </tbody>
      </table>
    ` : '<div class="empty">Sem entregas registradas.</div>'}
  `;

  document.querySelectorAll('[data-did]').forEach((btn) => {
    btn.addEventListener('click', async () => {
      await fetch(`/api/deliveries/${btn.dataset.did}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: btn.dataset.status })
      });
      await Promise.all([loadDeliveries(), loadDashboard()]);
    });
  });
}

async function loadTickets() {
  const r = await fetch(`/api/tickets/${state.user.id}`);
  const data = await r.json();
  state.tickets = data.items;
  byId('atendimento').innerHTML = `
    <h2>Atendimento</h2>
    ${state.tickets.length
      ? state.tickets.map((t) => `<div class="card"><strong>${t.subject}</strong><p>Status: ${t.status}</p></div>`).join('')
      : '<div class="empty">Nenhum ticket atribuído ao colaborador atual.</div>'}
  `;
}
