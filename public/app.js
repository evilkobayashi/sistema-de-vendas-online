const state = { token: null, user: null, medicines: [], orders: [], deliveries: [], tickets: [], customers: [], selectedCustomerId: '', doctors: [], selectedDoctorId: '', doctorsView: 'menu', employees: [], suppliers: [], finishedProducts: [], rawMaterials: [], standardFormulas: [], packagingFormulas: [], healthPlans: [], selectedHealthPlanId: '', patientActivities: [], budgets: [], catalogFilters: { q: '', specialty: '', lab: '', sort: 'relevance' } };
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
  await Promise.all([loadDashboard(), loadCatalog(), loadInventory(), loadOrders(), loadDeliveries(), loadTickets(), loadCustomers(), loadDoctors(), loadMasterData(), loadHealthPlans(), loadBudgets()]);
  renderPurchaseForm();
  if (state.selectedCustomerId) await loadPatientActivities(state.selectedCustomerId);
  renderCustomersModule();
  renderDoctorsModule();
  renderMasterDataModule();
  renderInventoryOpsModule();
  renderOrcamentosModule();
  renderHealthPlansModule();
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

  const specialties = [''].concat(ensureArray(data.specialties || [...new Set(state.medicines.map((m) => m.specialty))]));
  const labs = [''].concat(ensureArray(data.labs || [...new Set(state.medicines.map((m) => m.lab))]));

  const q = state.catalogFilters.q.trim().toLowerCase();
  const specialty = state.catalogFilters.specialty;
  const lab = state.catalogFilters.lab;
  const sort = state.catalogFilters.sort;

  const scored = state.medicines
    .map((m) => {
      const haystack = `${m.name} ${m.description} ${m.lab} ${m.specialty}`.toLowerCase();
      let relevance = 0;
      if (q) {
        if (m.name.toLowerCase().includes(q)) relevance += 5;
        if (m.description.toLowerCase().includes(q)) relevance += 2;
        if (m.lab.toLowerCase().includes(q) || m.specialty.toLowerCase().includes(q)) relevance += 1;
        if (haystack.includes(q)) relevance += 1;
      }
      return { ...m, relevance };
    })
    .filter((m) => (!q || m.relevance > 0) && (!specialty || m.specialty === specialty) && (!lab || m.lab === lab));

  const items = [...scored].sort((a, b) => {
    if (sort === 'price-asc') return a.price - b.price;
    if (sort === 'price-desc') return b.price - a.price;
    if (sort === 'name-asc') return a.name.localeCompare(b.name);
    return b.relevance - a.relevance || a.name.localeCompare(b.name);
  });

  byId('catalogo').innerHTML = `
    <h2>Catálogo farmacêutico</h2>
    <div class="grid-form" style="grid-template-columns: 2fr 1fr 1fr 1fr; margin-bottom:12px;">
      <input id="catalog-q" placeholder="Pesquisar por nome/descrição" value="${state.catalogFilters.q}" />
      <select id="catalog-specialty">${specialties.map((x) => `<option value="${x}" ${x === specialty ? 'selected' : ''}>${x || 'Todas especialidades'}</option>`).join('')}</select>
      <select id="catalog-lab">${labs.map((x) => `<option value="${x}" ${x === lab ? 'selected' : ''}>${x || 'Todos laboratórios'}</option>`).join('')}</select>
      <select id="catalog-sort">
        <option value="relevance" ${sort === 'relevance' ? 'selected' : ''}>Relevância</option>
        <option value="price-asc" ${sort === 'price-asc' ? 'selected' : ''}>Menor preço</option>
        <option value="price-desc" ${sort === 'price-desc' ? 'selected' : ''}>Maior preço</option>
        <option value="name-asc" ${sort === 'name-asc' ? 'selected' : ''}>Nome (A-Z)</option>
      </select>
    </div>
    <div class="cards">${items.map((m) => `<article class="card">${renderMedicineImage(m)}<h3>${m.name}</h3><p>${m.description}</p><p>${m.lab} • ${m.specialty}</p><p>Disponível: <strong>${m.inventory?.stockAvailable ?? 0}</strong></p><strong>${money(m.price)}</strong></article>`).join('')}</div>
    ${items.length ? '' : '<div class="empty">Nenhum medicamento encontrado com os filtros atuais.</div>'}
  `;

  const bind = (id, key) => {
    const el = byId(id);
    if (!el) return;
    el.addEventListener('input', () => {
      state.catalogFilters[key] = el.value;
      loadCatalog();
    });
    el.addEventListener('change', () => {
      state.catalogFilters[key] = el.value;
      loadCatalog();
    });
  };

  bind('catalog-q', 'q');
  bind('catalog-specialty', 'specialty');
  bind('catalog-lab', 'lab');
  bind('catalog-sort', 'sort');
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


function showPrescriptionParseWarning(message = '') {
  const el = byId('prescription-parse-warning');
  if (!el) return;
  el.textContent = message || '';
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

function addDaysFromNow(days) {
  const dt = new Date();
  dt.setDate(dt.getDate() + Number(days || 0));
  return dt.toISOString().slice(0, 10);
}

function renderTreatmentForecast(form) {
  const quantity = Number(form.querySelector('[name="quantity"]').value || 0);
  const tabletsPerDay = Number(form.querySelector('[name="tabletsPerDay"]').value || 0);
  const tabletsPerPackage = Number(form.querySelector('[name="tabletsPerPackage"]').value || 30);
  const treatmentDays = Number(form.querySelector('[name="treatmentDays"]').value || 0);

  const box = byId('sale-forecast');
  if (!box) return;

  if (!tabletsPerDay || !treatmentDays || !tabletsPerPackage) {
    box.innerHTML = '<div class="empty">Informe comprimidos/dia e dias de tratamento para ver a previsão de término e recomendação de recorrência.</div>';
    return;
  }

  const neededTablets = Math.ceil(tabletsPerDay * treatmentDays);
  const recommendedBoxes = Math.max(1, Math.ceil(neededTablets / tabletsPerPackage));
  const coveredDaysByQuantity = quantity > 0 ? Math.floor((quantity * tabletsPerPackage) / tabletsPerDay) : 0;
  const projectedRunOutDate = addDaysFromNow(quantity > 0 ? coveredDaysByQuantity : treatmentDays);
  const expectedTreatmentEndDate = addDaysFromNow(treatmentDays);
  const recurrenceContactDate = addDaysFromNow(Math.max(0, treatmentDays - 3));

  box.innerHTML = `
    <div class="card">
      <strong>Previsão para orientação ao cliente</strong><br/>
      Necessário para o tratamento: <strong>${neededTablets}</strong> comprimidos (~<strong>${recommendedBoxes}</strong> caixas).<br/>
      Quantidade informada cobre cerca de <strong>${coveredDaysByQuantity || treatmentDays}</strong> dias.<br/>
      Previsão de término (quantidade atual): <strong>${projectedRunOutDate}</strong>.<br/>
      Término esperado do tratamento: <strong>${expectedTreatmentEndDate}</strong>.<br/>
      Sugestão para recorrência: confirmar com o cliente em <strong>${recurrenceContactDate}</strong> (3 dias antes).
    </div>
  `;
}

async function loadCustomers() {
  const data = await apiFetch('/api/patients');
  state.customers = ensureArray(data.items);
  if (state.selectedCustomerId && !state.customers.some((c) => c.id === state.selectedCustomerId)) {
    state.selectedCustomerId = '';
  }
}



async function loadPatientActivities(patientId, page = 1, pageSize = 20) {
  if (!patientId) {
    state.patientActivities = [];
    return { items: [], page, pageSize, total: 0, totalPages: 1 };
  }
  const data = await apiFetch(`/api/patients/${patientId}/activities?page=${page}&pageSize=${pageSize}`);
  state.patientActivities = ensureArray(data.items);
  return data;
}

function renderCustomersModule() {
  const selected = state.customers.find((c) => c.id === state.selectedCustomerId);

  byId('clientes').innerHTML = `
    <h2>Pacientes cadastrados</h2>
    <div class="grid-form" style="grid-template-columns: 1fr 1fr; gap: 16px;">
      <div>
        <h3>Menu de pacientes</h3>
        ${state.customers.length ? `<div class="stack">${state.customers.map((c) => `<button class="quick-btn" data-open-customer="${c.id}">${c.name} • ${c.patientCode || "sem código"}</button>`).join('')}</div>` : '<div class="empty">Nenhum paciente cadastrado.</div>'}
      </div>
      <div>
        <h3>Dados do paciente</h3>
        ${selected ? `
          <form id="customer-edit-form" class="grid-form" data-customer-id="${selected.id}">
            <input name="name" value="${selected.name}" required />
            <input name="patientCode" value="${selected.patientCode || ""}" placeholder="Código do paciente" required />
            <input name="insuranceCardCode" value="${selected.insuranceCardCode || ""}" placeholder="Código da carteirinha" required />
            <select name="healthPlanId" required>${state.healthPlans.map((p) => `<option value="${p.id}" ${p.id === selected.healthPlanId ? "selected" : ""}>${p.name} • ${p.providerName}</option>`).join("")}</select>
            <select name="doctorId" required>${state.doctors.map((d) => `<option value="${d.id}" ${d.id === selected.doctorId ? "selected" : ""}>${d.name} • CRM ${d.crm}</option>`).join("")}</select>
            <input name="insurancePlanName" value="${selected.insurancePlanName || ""}" placeholder="(Legado) Nome do plano" />
            <input name="insuranceProviderName" value="${selected.insuranceProviderName || ""}" placeholder="(Legado) Operadora do plano" />
            <input name="diseaseCid" value="${selected.diseaseCid || ""}" placeholder="CID" required />
            <input name="primaryDoctorId" value="${selected.primaryDoctorId || ""}" placeholder="(Legado) ID do médico" />
            <input name="email" type="email" value="${selected.email}" required />
            <input name="phone" value="${selected.phone}" required />
            <input name="address" value="${selected.address}" required />
            <button type="submit">Salvar alterações</button>
          </form>
          <small>ID: ${selected.id}</small>
          <h4 style="margin-top:12px">Histórico de ações</h4>
          <div id="patient-activities" class="stack">${state.patientActivities.length ? state.patientActivities.map((a) => `<div class=\"card\"><strong>${a.activityType}</strong><br/>${a.description}<br/><small>${new Date(a.createdAt).toLocaleString()} • ${a.performedBy}</small></div>`).join('') : '<div class=\"empty\">Sem atividades registradas.</div>'}</div>
        ` : '<div class="empty">Selecione um paciente no menu para visualizar/editar.</div>'}
      </div>
    </div>
  `;

  document.querySelectorAll('[data-open-customer]').forEach((btn) => {
    btn.addEventListener('click', async () => {
      state.selectedCustomerId = btn.getAttribute('data-open-customer') || '';
      await loadPatientActivities(state.selectedCustomerId);
      renderCustomersModule();
    });
  });

  const form = byId('customer-edit-form');
  if (form) {
    form.addEventListener('submit', async (e) => {
      e.preventDefault();
      const customerId = form.getAttribute('data-customer-id');
      const payload = Object.fromEntries(new FormData(form).entries());
      try {
        await apiFetch(`/api/patients/${customerId}`, { method: 'PATCH', body: JSON.stringify(payload) });
        await loadCustomers();
        await loadPatientActivities(customerId || '');
        renderCustomersModule();
        renderPurchaseForm();
        alert('Informações do paciente salvas com sucesso.');
      } catch (error) {
        alert(error.message || 'Erro ao salvar paciente');
      }
    });
  }
}

async function loadDoctors() {
  const data = await apiFetch('/api/doctors');
  state.doctors = ensureArray(data.items);
  if (state.selectedDoctorId && !state.doctors.some((d) => d.id === state.selectedDoctorId)) {
    state.selectedDoctorId = '';
  }
}

function renderDoctorsModule() {
  const selected = state.doctors.find((d) => d.id === state.selectedDoctorId);

  byId('medicos').innerHTML = `
    <h2>Médicos</h2>
    <div class="inline">
      <button class="quick-btn" data-doctors-view="menu">Menu de médicos</button>
      <button class="quick-btn" data-doctors-view="cadastro">Cadastro de médicos</button>
    </div>
    ${state.doctorsView === 'cadastro' ? `
      <form id="doctor-create-form" class="grid-form" style="margin-top:12px">
        <input name="name" placeholder="Nome do médico" required />
        <input name="crm" placeholder="CRM" required />
        <input name="specialty" placeholder="Especialidade" required />
        <input name="email" type="email" placeholder="E-mail" required />
        <input name="phone" placeholder="Telefone" required />
        <button type="submit">Cadastrar médico</button>
      </form>
    ` : ''}
    ${state.doctorsView === 'menu' ? `
      <div class="grid-form" style="grid-template-columns: 1fr 1fr; gap: 16px; margin-top:12px">
        <div>
          <h3>Menu de médicos</h3>
          ${state.doctors.length ? `<div class="stack">${state.doctors.map((d) => `<button class="quick-btn" data-open-doctor="${d.id}">${d.name} • CRM ${d.crm}</button>`).join('')}</div>` : '<div class="empty">Nenhum médico cadastrado.</div>'}
        </div>
        <div>
          <h3>Informações do médico</h3>
          ${selected ? `
            <form id="doctor-edit-form" class="grid-form" data-doctor-id="${selected.id}">
              <input name="name" value="${selected.name}" required />
              <input name="crm" value="${selected.crm}" required />
              <input name="specialty" value="${selected.specialty}" required />
              <input name="email" type="email" value="${selected.email}" required />
              <input name="phone" value="${selected.phone}" required />
              <button type="submit">Salvar alterações</button>
            </form>
            <small>ID: ${selected.id}</small>
          ` : '<div class="empty">Selecione um médico para verificar/editar informações.</div>'}
        </div>
      </div>
    ` : ''}
  `;

  document.querySelectorAll('[data-doctors-view]').forEach((btn) => {
    btn.addEventListener('click', () => {
      state.doctorsView = btn.getAttribute('data-doctors-view') || 'menu';
      renderDoctorsModule();
    });
  });

  document.querySelectorAll('[data-open-doctor]').forEach((btn) => {
    btn.addEventListener('click', () => {
      state.selectedDoctorId = btn.getAttribute('data-open-doctor') || '';
      state.doctorsView = 'menu';
      renderDoctorsModule();
    });
  });

  const createForm = byId('doctor-create-form');
  if (createForm) {
    createForm.addEventListener('submit', async (e) => {
      e.preventDefault();
      const payload = Object.fromEntries(new FormData(createForm).entries());
      try {
        const data = await apiFetch('/api/doctors', { method: 'POST', body: JSON.stringify(payload) });
        state.doctors = [data.item, ...state.doctors];
        state.selectedDoctorId = data.item.id;
        state.doctorsView = 'menu';
        renderDoctorsModule();
        alert('Médico cadastrado com sucesso.');
      } catch (error) {
        alert(error.message || 'Erro ao cadastrar médico');
      }
    });
  }

  const editForm = byId('doctor-edit-form');
  if (editForm) {
    editForm.addEventListener('submit', async (e) => {
      e.preventDefault();
      const doctorId = editForm.getAttribute('data-doctor-id');
      const payload = Object.fromEntries(new FormData(editForm).entries());
      try {
        await apiFetch(`/api/doctors/${doctorId}`, { method: 'PATCH', body: JSON.stringify(payload) });
        await loadDoctors();
        renderDoctorsModule();
        alert('Informações do médico salvas com sucesso.');
      } catch (error) {
        alert(error.message || 'Erro ao salvar médico');
      }
    });
  }
}


async function loadMasterData() {
  const [employees, suppliers, finishedProducts, rawMaterials, standardFormulas, packagingFormulas] = await Promise.all([
    apiFetch('/api/employees'),
    apiFetch('/api/suppliers'),
    apiFetch('/api/finished-products'),
    apiFetch('/api/raw-materials'),
    apiFetch('/api/standard-formulas'),
    apiFetch('/api/packaging-formulas')
  ]);

  state.employees = ensureArray(employees.items);
  state.suppliers = ensureArray(suppliers.items);
  state.finishedProducts = ensureArray(finishedProducts.items);
  state.rawMaterials = ensureArray(rawMaterials.items);
  state.standardFormulas = ensureArray(standardFormulas.items);
  state.packagingFormulas = ensureArray(packagingFormulas.items);
}


function bindCreateForm({ id, endpoint, onSuccess }) {
  const form = byId(id);
  if (!form) return;
  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    const payload = Object.fromEntries(new FormData(form).entries());
    try {
      await apiFetch(endpoint, { method: 'POST', body: JSON.stringify(payload) });
      form.reset();
      await Promise.all([loadMasterData(), loadInventory(), loadCatalog(), loadDashboard()]);
      renderMasterDataModule();
      renderInventoryOpsModule();
  renderOrcamentosModule();
  renderHealthPlansModule();
      if (onSuccess) onSuccess();
      alert('Cadastro salvo com sucesso.');
    } catch (error) {
      alert(error.message || 'Erro ao salvar cadastro');
    }
  });
}

function renderMasterDataModule() {
  const el = byId('cadastros');
  if (!el) return;

  el.innerHTML = `
    <h2>Cadastros Mestres</h2>
    <div class="kpis">
      <div class="kpi"><div class="value">${state.customers.length}</div><div>Clientes</div></div>
      <div class="kpi"><div class="value">${state.doctors.length}</div><div>Médicos</div></div>
      <div class="kpi"><div class="value">${state.employees.length}</div><div>Funcionários</div></div>
      <div class="kpi"><div class="value">${state.suppliers.length}</div><div>Fornecedores</div></div>
      <div class="kpi"><div class="value">${state.finishedProducts.length}</div><div>Produtos acabados/revenda</div></div>
      <div class="kpi"><div class="value">${state.rawMaterials.length}</div><div>Matérias-primas</div></div>
      <div class="kpi"><div class="value">${state.standardFormulas.length}</div><div>Fórmulas padrão</div></div>
      <div class="kpi"><div class="value">${state.packagingFormulas.length}</div><div>Fórmulas embalagem</div></div>
    </div>
    <div class="grid-form" style="grid-template-columns: repeat(2, minmax(280px, 1fr)); gap: 16px; margin-top: 16px;">
      <form id="employee-form" class="grid-form card"><h3>Cadastro de Funcionários</h3><input name="name" placeholder="Nome" required/><input name="role" placeholder="Função" required/><input name="employeeCode" placeholder="Código" required/><input name="email" type="email" placeholder="E-mail" required/><input name="phone" placeholder="Telefone" required/><button type="submit">Salvar funcionário</button></form>
      <form id="supplier-form" class="grid-form card"><h3>Cadastro de Fornecedores</h3><input name="name" placeholder="Nome" required/><input name="document" placeholder="CNPJ/Documento" required/><input name="email" type="email" placeholder="E-mail" required/><input name="phone" placeholder="Telefone" required/><input name="category" placeholder="Categoria" required/><button type="submit">Salvar fornecedor</button></form>
      <form id="finished-product-form" class="grid-form card"><h3>Produtos Acabados e Revenda</h3><input name="name" placeholder="Nome" required/><select name="productType"><option value="acabado">Acabado</option><option value="revenda">Revenda</option></select><input name="sku" placeholder="SKU" required/><input name="unit" placeholder="Unidade" required/><input name="price" type="number" step="0.01" min="0.01" placeholder="Preço" required/><button type="submit">Salvar produto</button></form>
      <form id="raw-material-form" class="grid-form card"><h3>Cadastro de Matéria-prima</h3><input name="name" placeholder="Nome" required/><input name="code" placeholder="Código" required/><input name="unit" placeholder="Unidade" required/><input name="cost" type="number" step="0.01" min="0.01" placeholder="Custo" required/><button type="submit">Salvar matéria-prima</button></form>
      <form id="standard-formula-form" class="grid-form card"><h3>Cadastro de Fórmulas Padrão</h3><input name="name" placeholder="Nome" required/><input name="version" placeholder="Versão" required/><input name="productId" placeholder="ID do produto" required/><input name="instructions" placeholder="Instruções" required/><button type="submit">Salvar fórmula padrão</button></form>
      <form id="packaging-formula-form" class="grid-form card"><h3>Cadastro de Fórmulas de Embalagem</h3><input name="name" placeholder="Nome" required/><input name="productId" placeholder="ID do produto" required/><input name="packagingType" placeholder="Tipo de embalagem" required/><input name="unitsPerPackage" type="number" min="1" placeholder="Unidades por embalagem" required/><input name="notes" placeholder="Observações" required/><button type="submit">Salvar fórmula embalagem</button></form>
    </div>
  `;

  bindCreateForm({ id: 'employee-form', endpoint: '/api/employees' });
  bindCreateForm({ id: 'supplier-form', endpoint: '/api/suppliers' });
  bindCreateForm({ id: 'finished-product-form', endpoint: '/api/finished-products' });
  bindCreateForm({ id: 'raw-material-form', endpoint: '/api/raw-materials' });
  bindCreateForm({ id: 'standard-formula-form', endpoint: '/api/standard-formulas' });
  bindCreateForm({ id: 'packaging-formula-form', endpoint: '/api/packaging-formulas' });
}

function renderInventoryOpsModule() {
  const el = byId('inventario-op');
  if (!el) return;

  el.innerHTML = `
    <h2>Inventário operacional</h2>
    <p class="empty">Módulo dedicado para entradas de mercadoria, XML NF-e, impressões e atualização automática de preços.</p>
    <div class="grid-form" style="grid-template-columns: repeat(2, minmax(280px, 1fr)); gap: 16px; margin-top: 16px;">
      <form id="entry-conversion-form" class="grid-form card"><h3>Entrada de Mercadoria (conversão)</h3><select name="medicineId" required>${state.medicines.map((m) => `<option value="${m.id}">${m.name}</option>`).join('')}</select><input name="sourceQuantity" type="number" min="0.01" step="0.01" placeholder="Qtd origem" required/><input name="sourceUnit" placeholder="Unidade origem (ex: caixa)" required/><input name="conversionFactor" type="number" min="0.01" step="0.01" placeholder="Fator conversão" required/><input name="targetUnit" placeholder="Unidade destino (ex: comprimido)" required/><input name="batchCode" placeholder="Lote" required/><input name="expiresAt" type="date" required/><input name="unitCost" type="number" min="0.01" step="0.01" placeholder="Custo unitário" required/><input name="supplier" placeholder="Fornecedor" required/><button type="submit">Lançar entrada convertida</button></form>
      <form id="entry-nfe-form" class="grid-form card"><h3>Entrada por XML NF-e</h3><textarea name="xml" rows="4" placeholder="Cole o XML da NF-e" required></textarea><input name="supplier" placeholder="Fornecedor" required/><input name="defaultExpiresAt" type="date"/><input name="defaultUnitCost" type="number" min="0.01" step="0.01" placeholder="Custo unitário padrão"/><input name="conversionFactor" type="number" min="0.01" step="0.01" value="1"/><button type="submit">Importar XML NF-e</button></form>
      <form id="pricing-auto-form" class="grid-form card"><h3>Atualização automática de preço</h3><input name="percent" type="number" step="0.01" placeholder="Percentual (+/-)" required/><input name="specialty" placeholder="Especialidade (opcional)"/><input name="lab" placeholder="Laboratório (opcional)"/><input name="reason" placeholder="Motivo" value="Atualização automática de lista de preço" required/><button type="submit">Aplicar atualização</button></form>
      <div class="card"><h3>Impressões operacionais</h3><input id="print-order-id" placeholder="ID do pedido (ex: P-2025-001)"/><div class="inline"><button type="button" id="print-labels-btn" class="quick-btn">Imprimir etiquetas</button><button type="button" id="print-quality-btn" class="quick-btn">Imprimir laudo CQ</button></div><pre id="print-output" class="empty">Sem impressão gerada.</pre></div>
    </div>
  `;

  bindCreateForm({ id: 'entry-conversion-form', endpoint: '/api/inventory/entries' });
  bindCreateForm({ id: 'entry-nfe-form', endpoint: '/api/inventory/entries/nfe-xml' });
  bindCreateForm({ id: 'pricing-auto-form', endpoint: '/api/pricing/auto-update', onSuccess: loadCatalog });

  const labelsBtn = byId('print-labels-btn');
  const qualityBtn = byId('print-quality-btn');
  const printOrderInput = byId('print-order-id');
  const printOutput = byId('print-output');

  if (labelsBtn) {
    labelsBtn.addEventListener('click', async () => {
      try {
        const orderId = (printOrderInput?.value || '').trim();
        if (!orderId) throw new Error('Informe o ID do pedido para imprimir etiquetas.');
        const data = await apiFetch(`/api/print/labels/${orderId}`);
        if (printOutput) printOutput.textContent = data.printableText || 'Etiquetas geradas.';
      } catch (error) {
        alert(error.message || 'Erro ao imprimir etiquetas');
      }
    });
  }

  if (qualityBtn) {
    qualityBtn.addEventListener('click', async () => {
      try {
        const orderId = (printOrderInput?.value || '').trim();
        if (!orderId) throw new Error('Informe o ID do pedido para imprimir laudo.');
        const data = await apiFetch(`/api/quality/reports/${orderId}`);
        if (printOutput) printOutput.textContent = data.printableText || 'Laudo gerado.';
      } catch (error) {
        alert(error.message || 'Erro ao imprimir laudo de CQ');
      }
    });
  }
}


async function loadBudgets() {
  const data = await apiFetch('/api/budgets');
  state.budgets = ensureArray(data.items);
}

function renderOrcamentosModule() {
  const el = byId('orcamentos');
  if (!el) return;

  el.innerHTML = `
    <h2>Orçamentos e produção</h2>
    <div class="grid-form" style="grid-template-columns: repeat(2, minmax(280px, 1fr)); gap: 16px; margin-top: 16px;">
      <form id="budget-form" class="grid-form card"><h3>Novo orçamento com receita inteligente</h3><input name="patientName" placeholder="Paciente" required/><input name="doctorName" placeholder="Médico"/><textarea name="prescriptionText" rows="4" placeholder="Texto da receita" required></textarea><input name="estimatedDays" type="number" min="1" value="30"/><button type="submit">Gerar orçamento inteligente</button></form>
      <form id="scale-form" class="grid-form card"><h3>Balança monitorada integrada</h3><input name="quoteId" placeholder="ID do orçamento" required/><select name="medicineId" required>${state.medicines.map((m) => `<option value="${m.id}">${m.name}</option>`).join('')}</select><input name="expectedWeightGrams" type="number" min="0.01" step="0.01" placeholder="Peso esperado (g)" required/><input name="measuredWeightGrams" type="number" min="0.01" step="0.01" placeholder="Peso medido (g)" required/><button type="submit">Enviar leitura da balança</button></form>
      <form id="production-form" class="grid-form card"><h3>Produção de fórmula padrão</h3><select name="formulaId" required>${state.standardFormulas.map((f) => `<option value="${f.id}">${f.name} (${f.version})</option>`).join('')}</select><input name="batchSize" type="number" min="1" value="1" required/><input name="operator" placeholder="Operador" required/><button type="submit">Criar ordem de produção</button></form>
      <div class="card"><h3>Impressões do orçamento</h3><input id="budget-print-id" placeholder="ID do orçamento (ex: ORC-2025-0001)"/><div class="inline"><button type="button" id="print-manipulation-btn" class="quick-btn">Imprimir Ordem de Manipulação</button><button type="button" id="print-budget-label-btn" class="quick-btn">Imprimir rótulo</button></div><pre id="budget-print-output" class="empty">Sem impressão gerada.</pre></div>
    </div>
    <h3>Lista de orçamentos</h3>
    ${state.budgets.length ? `<table class="table"><thead><tr><th>ID</th><th>Paciente</th><th>Médico</th><th>Itens sugeridos</th><th>Status</th></tr></thead><tbody>${state.budgets.map((b) => `<tr><td>${b.id}</td><td>${b.patientName}</td><td>${b.doctorName || '-'}</td><td>${ensureArray(b.suggestedItems).map((x) => x.medicineName).join(', ')}</td><td>${b.status}</td></tr>`).join('')}</tbody></table>` : '<div class="empty">Nenhum orçamento criado ainda.</div>'}
  `;

  bindCreateForm({ id: 'budget-form', endpoint: '/api/budgets', onSuccess: async () => { await loadBudgets(); renderOrcamentosModule(); } });
  bindCreateForm({ id: 'scale-form', endpoint: '/api/scale/readings' });
  bindCreateForm({ id: 'production-form', endpoint: '/api/production/standard-formula' });

  const printIdInput = byId('budget-print-id');
  const printOutput = byId('budget-print-output');
  const manipBtn = byId('print-manipulation-btn');
  const labelBtn = byId('print-budget-label-btn');

  if (manipBtn) {
    manipBtn.addEventListener('click', async () => {
      try {
        const id = (printIdInput?.value || '').trim();
        if (!id) throw new Error('Informe o ID do orçamento.');
        const data = await apiFetch(`/api/budgets/${id}/manipulation-order`);
        if (printOutput) printOutput.textContent = data.printableText || 'Ordem gerada.';
      } catch (error) {
        alert(error.message || 'Erro ao imprimir ordem de manipulação');
      }
    });
  }

  if (labelBtn) {
    labelBtn.addEventListener('click', async () => {
      try {
        const id = (printIdInput?.value || '').trim();
        if (!id) throw new Error('Informe o ID do orçamento.');
        const data = await apiFetch(`/api/budgets/${id}/labels`);
        if (printOutput) printOutput.textContent = data.printableText || 'Rótulo gerado.';
      } catch (error) {
        alert(error.message || 'Erro ao imprimir rótulo');
      }
    });
  }
}


async function loadHealthPlans() {
  const data = await apiFetch('/api/health-plans');
  state.healthPlans = ensureArray(data.items);
  if (state.selectedHealthPlanId && !state.healthPlans.some((x) => x.id === state.selectedHealthPlanId)) {
    state.selectedHealthPlanId = '';
  }
}

function renderHealthPlansModule() {
  const selected = state.healthPlans.find((x) => x.id === state.selectedHealthPlanId);
  const el = byId('planos-saude');
  if (!el) return;

  el.innerHTML = `
    <h2>Planos de saúde</h2>
    <div class="grid-form" style="grid-template-columns: 1fr 1fr; gap: 16px;">
      <div>
        <h3>Cadastro de plano</h3>
        <form id="health-plan-form" class="grid-form">
          <input name="name" placeholder="Nome do plano" required />
          <input name="providerName" placeholder="Operadora" required />
          <input name="registrationCode" placeholder="Código registro" required />
          <button type="submit">Salvar plano</button>
        </form>
        <h3 style="margin-top:12px">Lista</h3>
        ${state.healthPlans.length ? `<div class="stack">${state.healthPlans.map((x) => `<button class="quick-btn" data-open-plan="${x.id}">${x.name} • ${x.providerName}</button>`).join('')}</div>` : '<div class="empty">Nenhum plano cadastrado.</div>'}
      </div>
      <div>
        <h3>Editar plano</h3>
        ${selected ? `<form id="health-plan-edit-form" class="grid-form" data-health-plan-id="${selected.id}"><input name="name" value="${selected.name}" required /><input name="providerName" value="${selected.providerName}" required /><input name="registrationCode" value="${selected.registrationCode}" required /><button type="submit">Salvar alterações</button></form>` : '<div class="empty">Selecione um plano para editar.</div>'}
      </div>
    </div>
  `;

  document.querySelectorAll('[data-open-plan]').forEach((btn) => {
    btn.addEventListener('click', () => {
      state.selectedHealthPlanId = btn.getAttribute('data-open-plan') || '';
      renderHealthPlansModule();
    });
  });

  const createForm = byId('health-plan-form');
  if (createForm) {
    createForm.addEventListener('submit', async (e) => {
      e.preventDefault();
      const payload = Object.fromEntries(new FormData(createForm).entries());
      try {
        const data = await apiFetch('/api/health-plans', { method: 'POST', body: JSON.stringify(payload) });
        state.healthPlans = [data.item, ...state.healthPlans];
        state.selectedHealthPlanId = data.item.id;
        renderHealthPlansModule();
        alert('Plano de saúde cadastrado com sucesso.');
      } catch (error) {
        alert(error.message || 'Erro ao salvar plano de saúde');
      }
    });
  }

  const editForm = byId('health-plan-edit-form');
  if (editForm) {
    editForm.addEventListener('submit', async (e) => {
      e.preventDefault();
      const id = editForm.getAttribute('data-health-plan-id');
      const payload = Object.fromEntries(new FormData(editForm).entries());
      try {
        await apiFetch(`/api/health-plans/${id}`, { method: 'PATCH', body: JSON.stringify(payload) });
        await loadHealthPlans();
        renderHealthPlansModule();
        renderCustomersModule();
        renderPurchaseForm();
        alert('Plano de saúde atualizado.');
      } catch (error) {
        alert(error.message || 'Erro ao atualizar plano de saúde');
      }
    });
  }
}

function renderPurchaseForm() {
  byId('nova-venda').innerHTML = `
    <h2>Nova compra</h2>
    <form id="sale-form" class="grid-form">
      <select name="customerId" id="sale-customer"><option value="">Selecione um paciente</option>${state.customers.map((c) => `<option value="${c.id}">${c.name} • ${c.patientCode || c.phone}</option>`).join('')}</select>
      <input name="patientName" placeholder="Paciente" required readonly/>
      <input name="email" type="email" placeholder="E-mail" required readonly/>
      <input name="phone" placeholder="Telefone" required readonly/>
      <input name="address" placeholder="Endereço" required readonly/>
      <input name="patientCode" placeholder="Código do paciente" readonly/>
      <input name="insuranceCardCode" placeholder="Carteirinha" readonly/>
      <input name="healthPlanName" placeholder="Plano" readonly/>
      <input name="doctorName" placeholder="Médico" readonly/>
      <input name="diseaseCid" placeholder="CID" readonly/>
      <div class="inline" style="grid-column:1 / -1;">
        <button type="button" id="create-customer-btn" class="quick-btn">Cadastrar paciente com os dados acima</button>
      </div>
      <select name="medicineId" required>${state.medicines.map((m) => `<option value="${m.id}">${m.name} (${money(m.price)})</option>`).join('')}</select>
      <input name="quantity" type="number" min="1" value="1" required/>
      <input name="tabletsPerDay" type="number" min="0.1" step="0.1" placeholder="Comprimidos por dia"/>
      <input name="tabletsPerPackage" type="number" min="1" step="1" value="30" placeholder="Comprimidos por caixa"/>
      <input name="treatmentDays" type="number" min="1" step="1" placeholder="Quantidade de dias do tratamento"/>
      <input name="prescriptionCode" placeholder="Código da receita (controlados)"/>
      <textarea name="prescriptionText" rows="4" placeholder="Cole aqui o texto do pedido médico para identificar remédios automaticamente"></textarea>
      <input name="prescriptionFile" id="prescription-file" type="file" accept="application/pdf,image/*" />
      <div class="inline">
        <button type="button" id="parse-prescription-btn" class="quick-btn">Ler pedido médico (texto)</button>
        <button type="button" id="parse-prescription-file-btn" class="quick-btn">Ler receita por imagem/PDF</button>
      </div>
      <small id="prescription-parse-warning" class="warning-text"></small>
      <div id="prescription-suggestions" class="stack"></div>
      <label><input type="checkbox" name="recurringEnabled"/> Compra recorrente</label>
      <input name="discountPercent" type="number" min="0" max="100" value="5"/>
      <input name="nextBillingDate" type="date"/>
      <button type="submit">Registrar</button>
    </form>
    <section id="sale-forecast" class="stack"></section>
  `;

  const form = byId('sale-form');
  const customerSelect = byId('sale-customer');

  if (customerSelect) {
    if (state.customers.length && !customerSelect.value) customerSelect.value = state.customers[0].id;
    customerSelect.addEventListener('change', () => {
      const selected = state.customers.find((c) => c.id === customerSelect.value);
      if (!selected) return;
      form.querySelector('[name="patientName"]').value = selected.name;
      form.querySelector('[name="email"]').value = selected.email;
      form.querySelector('[name="phone"]').value = selected.phone;
      form.querySelector('[name="address"]').value = selected.address;
      form.querySelector('[name="patientCode"]').value = selected.patientCode || '';
      form.querySelector('[name="insuranceCardCode"]').value = selected.insuranceCardCode || '';
      const hp = state.healthPlans.find((p) => p.id === selected.healthPlanId);
      const dr = state.doctors.find((d) => d.id === selected.doctorId);
      form.querySelector('[name="healthPlanName"]').value = hp ? `${hp.name} • ${hp.providerName}` : (selected.insurancePlanName || '');
      form.querySelector('[name="doctorName"]').value = dr ? dr.name : (selected.primaryDoctorId || '');
      form.querySelector('[name="diseaseCid"]').value = selected.diseaseCid || '';
      renderTreatmentForecast(form);
    });
  }

  customerSelect?.dispatchEvent(new Event('change'));

  byId('create-customer-btn').addEventListener('click', async () => {
    const payload = {
      name: form.querySelector('[name="patientName"]').value,
      email: form.querySelector('[name="email"]').value,
      phone: form.querySelector('[name="phone"]').value,
      address: form.querySelector('[name="address"]').value,
      patientCode: `PAC-${Date.now().toString().slice(-6)}`,
      insuranceCardCode: 'PREENCHER',
      healthPlanId: state.healthPlans[0]?.id || '',
      doctorId: state.doctors[0]?.id || '',
      insurancePlanName: 'PREENCHER',
      insuranceProviderName: 'PREENCHER',
      diseaseCid: 'PREENCHER',
      primaryDoctorId: state.doctors[0]?.id || ''
    };

    try {
      if (!state.healthPlans.length || !state.doctors.length) throw new Error('Cadastre ao menos 1 médico e 1 plano de saúde antes de criar pacientes.');
      const data = await apiFetch('/api/patients', { method: 'POST', body: JSON.stringify(payload) });
      state.customers = [data.item, ...state.customers];
      state.selectedCustomerId = data.item.id;
      const current = data.item.id;
      renderPurchaseForm();
      await loadPatientActivities(current);
      renderCustomersModule();
      byId('sale-customer').value = current;
      alert('Paciente cadastrado com sucesso.');
    } catch (error) {
      alert(error.message || 'Erro ao cadastrar paciente');
    }
  });

  byId('parse-prescription-btn').addEventListener('click', async () => {
    const payload = Object.fromEntries(new FormData(form).entries());
    if (!payload.prescriptionText || String(payload.prescriptionText).trim().length < 8) {
      alert('Adicione um texto de pedido médico com mais detalhes para leitura automática.');
      return;
    }

    try {
      showPrescriptionParseWarning('');
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

  byId('parse-prescription-file-btn').addEventListener('click', async () => {
    const input = byId('prescription-file');
    const file = input?.files?.[0];
    if (!file) {
      alert('Selecione uma imagem ou PDF da receita.');
      return;
    }

    try {
      const contentBase64 = await new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => {
          const result = String(reader.result || '');
          const base64 = result.includes(',') ? result.split(',')[1] : result;
          resolve(base64);
        };
        reader.onerror = () => reject(new Error('Falha ao ler arquivo da receita.'));
        reader.readAsDataURL(file);
      });

      const data = await apiFetch('/api/prescriptions/parse-document', {
        method: 'POST',
        body: JSON.stringify({
          filename: file.name,
          mimeType: file.type || 'application/octet-stream',
          contentBase64
        })
      });

      showPrescriptionParseWarning(data.warning || `Arquivo processado: ${data.filename} (${data.extractionMethod})`);
      renderPrescriptionSuggestions(data.suggestions);
      const top = ensureArray(data.suggestions)[0];
      if (top?.medicineId) {
        form.querySelector('[name="medicineId"]').value = top.medicineId;
      }
    } catch (error) {
      alert(error.message || 'Erro ao ler receita por arquivo');
    }
  });

  ['quantity', 'tabletsPerDay', 'tabletsPerPackage', 'treatmentDays'].forEach((field) => {
    const input = form.querySelector(`[name="${field}"]`);
    if (input) input.addEventListener('input', () => renderTreatmentForecast(form));
  });
  renderTreatmentForecast(form);

  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    const p = Object.fromEntries(new FormData(e.target).entries());
    const payload = {
      customerId: p.customerId || undefined,
      patientName: p.patientName,
      email: p.email,
      phone: p.phone,
      address: p.address,
      prescriptionCode: p.prescriptionCode || undefined,
      items: [{ medicineId: p.medicineId, quantity: Number(p.quantity), tabletsPerDay: p.tabletsPerDay ? Number(p.tabletsPerDay) : undefined, tabletsPerPackage: p.tabletsPerPackage ? Number(p.tabletsPerPackage) : undefined, treatmentDays: p.treatmentDays ? Number(p.treatmentDays) : undefined }],
      recurring: p.recurringEnabled === 'on' ? { discountPercent: Number(p.discountPercent || 0), nextBillingDate: p.nextBillingDate } : undefined
    };
    try {
      const data = await apiFetch('/api/orders', { method: 'POST', body: JSON.stringify(payload) });
      const end = data.order.estimatedTreatmentEndDate ? ` • previsão de término: ${data.order.estimatedTreatmentEndDate}` : '';
      alert(`Pedido ${data.order.id} criado (${money(data.order.total)})${end}`);
      await Promise.all([loadOrders(), loadDeliveries(), loadDashboard(), loadCatalog(), loadInventory(), loadCustomers()]);
      e.target.reset();
      renderTreatmentForecast(form);
    } catch (error) {
      alert(error.message || 'Erro ao criar pedido');
    }
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
  byId('entregas').innerHTML = `<h2>Central de entregas</h2>${deliveryItems.length ? `<table class="table"><thead><tr><th>Pedido</th><th>Paciente</th><th>Status</th><th>Transportadora</th><th>Rastreio</th><th>Sync</th></tr></thead><tbody>${deliveryItems.map((d) => `<tr><td>${d.orderId}</td><td>${d.patientName}</td><td>${d.status}</td><td>${d.shippingProvider || d.carrier || '-'}</td><td>${d.trackingCode || '-'}</td><td>${d.syncStatus || 'ok'}</td></tr>`).join('')}</tbody></table>` : '<div class="empty">Sem entregas.</div>'}`;
}

async function loadTickets() {
  const data = await apiFetch(`/api/tickets/${state.user.id}`);
  const ticketItems = ensureArray(data.items);
  byId('atendimento').innerHTML = `<h2>Atendimento</h2>${ticketItems.length ? ticketItems.map((t) => `<div class="card"><strong>${t.subject}</strong><p>Status: ${t.status}</p></div>`).join('') : '<div class="empty">Sem tickets.</div>'}`;
}
