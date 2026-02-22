const state = {
  token: null,
  user: null,
  medicines: [],
  orders: [],
  deliveries: [],
  tickets: [],
  filters: { specialty: '', lab: '' },
  medicineImageDataUrl: ''
};

const byId = (id) => document.getElementById(id);
const money = (v) => `R$ ${Number(v).toFixed(2)}`;

async function apiFetch(url, options = {}) {
  const headers = { ...(options.headers || {}) };
  if (state.token) headers.Authorization = `Bearer ${state.token}`;
  if (options.body && !headers['Content-Type']) headers['Content-Type'] = 'application/json';

  const response = await fetch(url, { ...options, headers });
  const contentType = response.headers.get('content-type') || '';
  const payload = contentType.includes('application/json') ? await response.json() : await response.text();

  if (!response.ok) {
    const error = typeof payload === 'object' && payload?.error ? payload.error : `Erro HTTP ${response.status}`;
    if (response.status === 401) {
      state.token = null;
      alert('Sessão expirada. Faça login novamente.');
      location.reload();
    }
    throw new Error(typeof error === 'string' ? error : JSON.stringify(error));
  }

  return payload;
}

function activateTab(tab) {
  document.querySelectorAll('.tab').forEach((b) => b.classList.toggle('active', b.dataset.tab === tab));
  document.querySelectorAll('.tab-content').forEach((s) => s.classList.toggle('active', s.id === tab));
}

document.querySelectorAll('.tab').forEach((btn) => btn.addEventListener('click', () => activateTab(btn.dataset.tab)));

byId('login-form').addEventListener('submit', async (e) => {
  e.preventDefault();
  try {
    const payload = Object.fromEntries(new FormData(e.target).entries());
    const data = await apiFetch('/api/login', { method: 'POST', body: JSON.stringify(payload) });

    state.token = data.token;
    state.user = data.user;
    byId('user-badge').textContent = `${state.user.name} • ${state.user.role}`;
    byId('user-badge').classList.remove('hidden');
    byId('login-panel').classList.add('hidden');
    byId('app').classList.remove('hidden');

    await refreshAll();
  } catch (error) {
    alert(error instanceof Error ? error.message : 'Falha no login');
  }
});

async function refreshAll() {
  await Promise.all([loadDashboard(), loadCatalog(), loadOrders(), loadDeliveries(), loadTickets()]);
  renderPurchaseForm();
}

async function loadDashboard() {
  const data = await apiFetch('/api/dashboard');
  byId('dashboard').innerHTML = `
    <h2>Dashboard Operacional</h2>
    <div class="kpis">
      <div class="kpi"><div class="value">${data.indicators.pedidos}</div><div>Pedidos</div></div>
      <div class="kpi"><div class="value">${data.indicators.entregasPendentes}</div><div>Entregas pendentes</div></div>
      <div class="kpi"><div class="value">${data.indicators.ticketsAbertos}</div><div>Tickets abertos</div></div>
      <div class="kpi"><div class="value">${money(data.indicators.totalSales)}</div><div>Total vendido</div></div>
    </div>
    <h3>Lembretes de recorrência (3 dias antes)</h3>
    ${data.reminders.length
      ? data.reminders
          .map(
            (x) => `<div class="card reminder">
              <strong>${x.orderId}</strong> • ${x.patientName}<br/>
              ${x.message} (faturamento: ${x.nextBillingDate})
              <div class="inline" style="margin-top:8px">
                <button data-confirm-order="${x.orderId}" class="quick-btn">Confirmado com o cliente</button>
              </div>
            </div>`
          )
          .join('')
      : '<div class="empty">Sem lembretes para os próximos 3 dias.</div>'}
  `;

  document.querySelectorAll('[data-confirm-order]').forEach((btn) => {
    btn.addEventListener('click', async () => {
      try {
        await apiFetch(`/api/orders/${btn.dataset.confirmOrder}/recurring/confirm`, { method: 'PATCH' });
        await loadDashboard();
        alert('Recorrência confirmada com o cliente com sucesso.');
      } catch (error) {
        alert(error instanceof Error ? error.message : 'Erro ao confirmar recorrência');
      }
    });
  });
}

function renderMedicineImage(medicine) {
  if (medicine.image?.startsWith('http') || medicine.image?.startsWith('data:image/')) {
    return `<img src="${medicine.image}" alt="${medicine.name}" class="medicine-image" loading="lazy"/>`;
  }
  return `<div class="medicine-fallback">💊</div>`;
}

function attachMedicineImagePicker() {
  const fileInput = byId('medicine-image-file');
  const preview = byId('medicine-image-preview');
  const urlInput = byId('medicine-image-url');

  if (urlInput) {
    urlInput.addEventListener('input', () => {
      const value = urlInput.value.trim();
      if (value) {
        state.medicineImageDataUrl = '';
        preview.innerHTML = `<img src="${value}" alt="Preview URL" class="medicine-image"/>`;
      } else if (!state.medicineImageDataUrl) {
        preview.innerHTML = '<div class="empty">Sem imagem selecionada</div>';
      }
    });
  }

  if (fileInput) {
    fileInput.addEventListener('change', () => {
      const file = fileInput.files?.[0];
      if (!file) {
        state.medicineImageDataUrl = '';
        return;
      }
      if (!file.type.startsWith('image/')) {
        alert('Selecione apenas arquivos de imagem.');
        fileInput.value = '';
        return;
      }
      const reader = new FileReader();
      reader.onload = () => {
        const result = typeof reader.result === 'string' ? reader.result : '';
        state.medicineImageDataUrl = result;
        preview.innerHTML = `<img src="${result}" alt="Preview arquivo" class="medicine-image"/>`;
      };
      reader.readAsDataURL(file);
    });
  }
}

async function loadCatalog() {
  const q = new URLSearchParams();
  if (state.filters.specialty) q.set('specialty', state.filters.specialty);
  if (state.filters.lab) q.set('lab', state.filters.lab);
  const data = await apiFetch(`/api/medicines?${q.toString()}`);
  state.medicines = data.items;

  const canManageMedicines = ['admin', 'gerente', 'inventario'].includes(state.user.role);

  byId('catalogo').innerHTML = `
    <h2>Catálogo de medicamentos</h2>
    <form id="catalog-form" class="inline">
      <select name="specialty"><option value="">Todas especialidades</option>${data.specialties.map((s) => `<option ${state.filters.specialty===s?'selected':''}>${s}</option>`).join('')}</select>
      <select name="lab"><option value="">Todos laboratórios</option>${data.labs.map((l) => `<option ${state.filters.lab===l?'selected':''}>${l}</option>`).join('')}</select>
      <button type="submit">Filtrar</button>
      <button type="button" id="clear-filters" class="quick-btn">Limpar</button>
    </form>

    ${canManageMedicines ? `
      <div class="card manager-card">
        <h3>Adicionar medicamento (Inventário)</h3>
        <form id="medicine-form" class="inline form-modern">
          <input name="name" placeholder="Nome do medicamento" required />
          <input name="price" type="number" step="0.01" min="0.01" placeholder="Preço" required />
          <input name="lab" placeholder="Laboratório" required />
          <input name="specialty" placeholder="Especialidade" required />
          <textarea name="description" placeholder="Descrição do medicamento" rows="2" required></textarea>
          <input id="medicine-image-url" name="imageUrl" type="url" placeholder="URL da imagem (opcional)" />
          <label>Ou envie arquivo da imagem<input id="medicine-image-file" name="imageFile" type="file" accept="image/*" /></label>
          <label><input type="checkbox" name="controlled" /> Controlado</label>
          <button type="submit">Adicionar</button>
        </form>
        <div id="medicine-image-preview" class="preview-box"><div class="empty">Sem imagem selecionada</div></div>
      </div>
    ` : ''}

    <div class="grid">
      ${state.medicines.map((m) => `
        <article class="card medicine-card">
          ${renderMedicineImage(m)}
          <h4>${m.name}</h4>
          <p><strong>${money(m.price)}</strong></p>
          <p>${m.lab} • ${m.specialty}</p>
          <p class="description">${m.description || ''}</p>
          ${m.controlled ? '<span class="tag controlled">Controlado (receita obrigatória)</span>' : '<span class="tag">Não controlado</span>'}
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

  if (canManageMedicines) attachMedicineImagePicker();

  const medicineForm = byId('medicine-form');
  if (medicineForm) {
    medicineForm.addEventListener('submit', async (e) => {
      e.preventDefault();
      try {
        const f = Object.fromEntries(new FormData(e.target).entries());
        const image = state.medicineImageDataUrl || f.imageUrl || '';

        await apiFetch('/api/medicines', {
          method: 'POST',
          body: JSON.stringify({
            name: f.name,
            price: Number(f.price),
            lab: f.lab,
            specialty: f.specialty,
            description: f.description,
            image,
            controlled: Boolean(f.controlled)
          })
        });

        state.medicineImageDataUrl = '';
        alert('Medicamento adicionado com sucesso');
        await loadCatalog();
      } catch (error) {
        alert(error instanceof Error ? error.message : 'Erro ao adicionar medicamento');
      }
    });
  }
}

function renderPurchaseForm() {
  byId('nova-venda').innerHTML = `
    <h2>Registrar compra interna</h2>
    <form id="sale-form" class="form-modern">
      <input name="patientName" placeholder="Nome do paciente" required />
      <input name="email" type="email" placeholder="E-mail" required />
      <input name="phone" placeholder="Telefone" required />
      <input name="address" placeholder="Endereço" required />
      <select name="medicineId" required>${state.medicines.map((m) => `<option value="${m.id}">${m.name} (${money(m.price)})</option>`)}</select>
      <input name="quantity" type="number" min="1" value="1" required />
      <input name="prescriptionCode" placeholder="Código da receita (se controlado)" />
      <label><input type="checkbox" name="recurringEnabled" /> Ativar compra por recorrência</label>
      <input name="discountPercent" type="number" min="0" max="100" placeholder="Desconto recorrência (%)" />
      <input name="nextBillingDate" type="date" />
      <button type="submit">Salvar pedido</button>
    </form>
    <small>O valor final é calculado no backend e validado por regra de medicamentos controlados.</small>
  `;

  byId('sale-form').addEventListener('submit', async (e) => {
    e.preventDefault();
    try {
      const f = Object.fromEntries(new FormData(e.target).entries());
      const payload = {
        patientName: f.patientName,
        email: f.email,
        phone: f.phone,
        address: f.address,
        items: [{ medicineId: f.medicineId, quantity: Number(f.quantity) }],
        prescriptionCode: f.prescriptionCode || undefined,
        recurring: f.recurringEnabled && f.nextBillingDate
          ? { discountPercent: Number(f.discountPercent || 0), nextBillingDate: f.nextBillingDate }
          : undefined
      };

      const data = await apiFetch('/api/orders', { method: 'POST', body: JSON.stringify(payload) });
      alert(`Pedido ${data.order.id} criado com total ${money(data.order.total)}`);
      await Promise.all([loadDashboard(), loadOrders(), loadDeliveries()]);
      e.target.reset();
    } catch (error) {
      alert(error instanceof Error ? error.message : 'Erro ao criar pedido');
    }
  });
}

async function loadOrders() {
  const data = await apiFetch('/api/orders?page=1&pageSize=50');
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

function deliveryEditForm(delivery) {
  return `
    <tr class="delivery-edit-row">
      <td colspan="5">
        <form class="inline delivery-edit" data-edit-form="${delivery.orderId}">
          <select name="status">
            <option value="pendente" ${delivery.status === 'pendente' ? 'selected' : ''}>Pendente</option>
            <option value="em_rota" ${delivery.status === 'em_rota' ? 'selected' : ''}>Em rota</option>
            <option value="entregue" ${delivery.status === 'entregue' ? 'selected' : ''}>Entregue</option>
          </select>
          <input name="forecastDate" type="date" value="${delivery.forecastDate}" />
          <input name="carrier" placeholder="Transportadora" value="${delivery.carrier}" />
          <button type="submit">Salvar edição</button>
          <button type="button" class="quick-btn" data-cancel-edit="${delivery.orderId}">Cancelar</button>
        </form>
      </td>
    </tr>
  `;
}

let editingDeliveryId = null;

async function loadDeliveries() {
  const data = await apiFetch('/api/deliveries?page=1&pageSize=50');
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
                <button data-edit-delivery="${d.orderId}">Editar</button>
              </td>
            </tr>
            ${editingDeliveryId === d.orderId ? deliveryEditForm(d) : ''}
          `).join('')}
        </tbody>
      </table>
    ` : '<div class="empty">Sem entregas registradas.</div>'}
  `;

  document.querySelectorAll('[data-did]').forEach((btn) => {
    btn.addEventListener('click', async () => {
      try {
        await apiFetch(`/api/deliveries/${btn.dataset.did}`, { method: 'PATCH', body: JSON.stringify({ status: btn.dataset.status }) });
        await Promise.all([loadDeliveries(), loadDashboard()]);
      } catch (error) {
        alert(error instanceof Error ? error.message : 'Erro ao atualizar entrega');
      }
    });
  });

  document.querySelectorAll('[data-edit-delivery]').forEach((btn) => {
    btn.addEventListener('click', () => {
      editingDeliveryId = btn.dataset.editDelivery;
      loadDeliveries();
    });
  });

  document.querySelectorAll('[data-cancel-edit]').forEach((btn) => {
    btn.addEventListener('click', () => {
      editingDeliveryId = null;
      loadDeliveries();
    });
  });

  document.querySelectorAll('[data-edit-form]').forEach((form) => {
    form.addEventListener('submit', async (e) => {
      e.preventDefault();
      try {
        const orderId = form.getAttribute('data-edit-form');
        const f = Object.fromEntries(new FormData(form).entries());
        await apiFetch(`/api/deliveries/${orderId}`, { method: 'PATCH', body: JSON.stringify(f) });
        editingDeliveryId = null;
        await Promise.all([loadDeliveries(), loadDashboard()]);
      } catch (error) {
        alert(error instanceof Error ? error.message : 'Erro ao salvar edição da entrega');
      }
    });
  });
}

async function loadTickets() {
  const data = await apiFetch(`/api/tickets/${state.user.id}`);
  state.tickets = data.items;
  byId('atendimento').innerHTML = `
    <h2>Atendimento</h2>
    ${state.tickets.length
      ? state.tickets.map((t) => `<div class="card"><strong>${t.subject}</strong><p>Status: ${t.status}</p></div>`).join('')
      : '<div class="empty">Nenhum ticket atribuído ao colaborador atual.</div>'}
  `;
}
