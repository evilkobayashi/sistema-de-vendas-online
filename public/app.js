const state = { token: null, user: null, medicines: [], orders: [], deliveries: [], tickets: [] };
const byId = (id) => document.getElementById(id);
const money = (v) => `R$ ${Number(v).toFixed(2)}`;
const ensureArray = (v) => (Array.isArray(v) ? v : []);

async function apiFetch(url, options = {}) {
  const headers = { ...(options.headers || {}) };
  if (state.token) headers.Authorization = `Bearer ${state.token}`;
  if (options.body && !headers['Content-Type']) headers['Content-Type'] = 'application/json';

  const doRequest = async (targetUrl) => {
    const response = await fetch(targetUrl, { ...options, headers });
    const payload = (response.headers.get('content-type') || '').includes('application/json') ? await response.json() : await response.text();
    return { response, payload };
  };

  let { response, payload } = await doRequest(url);

  if (response.status === 404 && url.startsWith('/api/')) {
    ({ response, payload } = await doRequest(url.slice(1)));
  }

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
    ${ensureArray(data.reminders).length ? ensureArray(data.reminders).map((x) => `<div class="card reminder"><strong>${x.orderId}</strong> • ${x.patientName}<br/>${x.message} (${x.nextBillingDate})${x.estimatedTreatmentEndDate ? `<br/>Término estimado do tratamento: ${x.estimatedTreatmentEndDate}` : ""}<div class="inline"><button data-confirm-order="${x.orderId}" class="quick-btn">Confirmado</button></div></div>`).join('') : '<div class="empty">Sem lembretes.</div>'}
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
  state.medicines = ensureArray(data.items);
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
    ${canManage ? `
      <h3>Opção 1: adicionar novo remédio</h3>
      <form id="medicine-form-stock" class="inline grid-form">
        <input name="name" placeholder="Nome do remédio" required />
        <input name="price" type="number" min="0.01" step="0.01" placeholder="Preço" required />
        <input name="lab" placeholder="Laboratório" required />
        <input name="specialty" placeholder="Especialidade" required />
        <input name="description" placeholder="Descrição" required />
        <input name="image" placeholder="URL da imagem (opcional)" />
        <label><input type="checkbox" name="controlled" /> Controlado</label>
        <button type="submit">Adicionar remédio</button>
      </form>

      <h3>Opção 2: adicionar lote em remédio existente</h3>
      <form id="lot-form" class="inline grid-form">
        <select name="medicineId" required>${ensureArray(state.medicines).map((m) => `<option value="${m.id}">${m.name}</option>`).join('')}</select>
        <input name="batchCode" placeholder="Lote" required />
        <input name="expiresAt" type="date" required />
        <input name="quantity" type="number" min="1" placeholder="Qtd" required />
        <input name="unitCost" type="number" min="0.01" step="0.01" placeholder="Custo unit." required />
        <input name="supplier" placeholder="Fornecedor" required />
        <button type="submit">Adicionar lote</button>
      </form>
    ` : ''}
    <table class="table"><thead><tr><th>Medicamento</th><th>Disponível</th><th>Total</th><th>Lotes</th><th>Risco venc.</th></tr></thead>
    <tbody>${ensureArray(summary.items).map((item) => `<tr><td>${item.medicineName}</td><td>${item.stockAvailable}</td><td>${item.stockTotal}</td><td>${item.lotCount}</td><td>${item.expiresIn30Days}</td></tr>`).join('')}</tbody></table>
  `;

  const medicineForm = byId('medicine-form-stock');
  if (medicineForm) {
    medicineForm.addEventListener('submit', async (e) => {
      e.preventDefault();
      try {
        const payload = Object.fromEntries(new FormData(medicineForm).entries());
        payload.controlled = payload.controlled === 'on';
        await apiFetch('/api/medicines', { method: 'POST', body: JSON.stringify(payload) });
        await Promise.all([loadCatalog(), loadInventory(), loadDashboard()]);
        medicineForm.reset();
      } catch (error) {
        alert(error.message || 'Erro ao adicionar remédio');
      }
    });
  }

  const lotForm = byId('lot-form');
  if (lotForm) {
    lotForm.addEventListener('submit', async (e) => {
      e.preventDefault();
      try {
        const payload = Object.fromEntries(new FormData(lotForm).entries());
        await apiFetch('/api/inventory/lots', { method: 'POST', body: JSON.stringify(payload) });
        await Promise.all([loadInventory(), loadCatalog(), loadDashboard()]);
        lotForm.reset();
      } catch (error) {
        alert(error.message || 'Erro ao adicionar lote');
      }
    });
  }
}


function renderPrescriptionSuggestions(suggestions) {
  const box = byId('prescription-suggestions');
  if (!box) return;
  const items = ensureArray(suggestions);
  if (!items.length) {
    box.innerHTML = '<div class="empty">Nenhum medicamento do catálogo foi identificado automaticamente.</div>';
    return;
  }

  box.innerHTML = items
    .map((item) => `<div class="card"><strong>${item.name}</strong><br/>Confiança: ${(item.confidence * 100).toFixed(0)}%${item.controlled ? ' • Controlado' : ''}<br/><small>${item.reason || ''}</small></div>`)
    .join('');
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
      <input name="tabletsPerDay" type="number" min="0.1" step="0.1" placeholder="Comprimidos por dia"/>
      <input name="tabletsPerPackage" type="number" min="1" step="1" value="30" placeholder="Comprimidos por caixa"/>
      <input name="prescriptionCode" placeholder="Código da receita (controlados)"/>
      <textarea name="prescriptionText" rows="4" placeholder="Cole aqui o texto do pedido médico para identificar remédios automaticamente"></textarea>
      <div class="inline">
        <button type="button" id="parse-prescription-btn" class="quick-btn">Ler pedido médico</button>
      </div>
      <div id="prescription-suggestions" class="stack"></div>
      <label><input type="checkbox" name="recurringEnabled"/> Compra recorrente</label>
      <input name="discountPercent" type="number" min="0" max="100" value="5"/>
      <input name="nextBillingDate" type="date"/>
      <button type="submit">Registrar</button>
    </form>
  `;
  byId('parse-prescription-btn').addEventListener('click', async () => {
    const form = byId('sale-form');
    const payload = Object.fromEntries(new FormData(form).entries());
    if (!payload.prescriptionText || String(payload.prescriptionText).trim().length < 8) {
      alert('Adicione um texto de pedido médico com mais detalhes para leitura automática.');
      return;
    }

    try {
      const data = await apiFetch('/api/prescriptions/parse', { method: 'POST', body: JSON.stringify({ text: payload.prescriptionText }) });
      renderPrescriptionSuggestions(data.suggestions);
      const top = ensureArray(data.suggestions)[0];
      if (top?.medicineId) {
        form.querySelector('[name="medicineId"]').value = top.medicineId;
      }
    } catch (error) {
      alert(error.message || 'Erro ao ler pedido médico');
    }
  });

  byId('sale-form').addEventListener('submit', async (e) => {
    e.preventDefault();
    const p = Object.fromEntries(new FormData(e.target).entries());
    const payload = {
      patientName: p.patientName, email: p.email, phone: p.phone, address: p.address, prescriptionCode: p.prescriptionCode || undefined,
      items: [{ medicineId: p.medicineId, quantity: Number(p.quantity), tabletsPerDay: p.tabletsPerDay ? Number(p.tabletsPerDay) : undefined, tabletsPerPackage: p.tabletsPerPackage ? Number(p.tabletsPerPackage) : undefined }],
      recurring: p.recurringEnabled === 'on' ? { discountPercent: Number(p.discountPercent || 0), nextBillingDate: p.nextBillingDate } : undefined
    };
    try {
      const data = await apiFetch('/api/orders', { method: 'POST', body: JSON.stringify(payload) });
      const end = data.order.estimatedTreatmentEndDate ? ` • previsão de término: ${data.order.estimatedTreatmentEndDate}` : '';
      alert(`Pedido ${data.order.id} criado (${money(data.order.total)})${end}`);
      await Promise.all([loadOrders(), loadDeliveries(), loadDashboard(), loadCatalog(), loadInventory()]);
      e.target.reset();
    } catch (error) { alert(error.message || 'Erro ao criar pedido'); }
  });
}

async function loadOrders() {
  const data = await apiFetch('/api/orders?page=1&pageSize=50');
  const orderItems = ensureArray(data.items);
  byId('pedidos').innerHTML = `<h2>Histórico de pedidos</h2>${orderItems.length ? `<table class="table"><thead><tr><th>Pedido</th><th>Paciente</th><th>Total</th><th>Término estimado</th><th>Criado em</th></tr></thead><tbody>${orderItems.map((o) => `<tr><td>${o.id}</td><td>${o.patientName}</td><td>${money(o.total)}</td><td>${o.estimatedTreatmentEndDate || "-"}</td><td>${new Date(o.createdAt).toLocaleString()}</td></tr>`).join('')}</tbody></table>` : '<div class="empty">Sem pedidos.</div>'}`;
}

async function loadDeliveries() {
  const data = await apiFetch('/api/deliveries?page=1&pageSize=50');
  const deliveryItems = ensureArray(data.items);
  byId('entregas').innerHTML = `<h2>Central de entregas</h2>${deliveryItems.length ? `<table class="table"><thead><tr><th>Pedido</th><th>Paciente</th><th>Status</th></tr></thead><tbody>${deliveryItems.map((d) => `<tr><td>${d.orderId}</td><td>${d.patientName}</td><td>${d.status}</td></tr>`).join('')}</tbody></table>` : '<div class="empty">Sem entregas.</div>'}`;
}

async function loadTickets() {
  const data = await apiFetch(`/api/tickets/${state.user.id}`);
  const ticketItems = ensureArray(data.items);
  byId('atendimento').innerHTML = `<h2>Atendimento</h2>${ticketItems.length ? ticketItems.map((t) => `<div class="card"><strong>${t.subject}</strong><p>Status: ${t.status}</p></div>`).join('') : '<div class="empty">Sem tickets.</div>'}`;
}
