const pendingList = document.getElementById('pendingList');
const collaboratorFilter = document.getElementById('collaboratorFilter');
const priorityFilter = document.getElementById('priorityFilter');
const refreshBtn = document.getElementById('refreshBtn');

function render(items) {
  pendingList.innerHTML = '';
  for (const item of items) {
    const div = document.createElement('div');
    div.className = item.priority === 'alta' ? 'high-priority' : 'normal-priority';
    div.innerHTML = `
      <strong>${item.id}</strong> - ${item.customer}<br>
      Colaborador: ${item.collaboratorId}<br>
      Cobrança em: ${new Date(item.nextBillingDate).toLocaleString('pt-BR')} (${item.daysUntilBilling} dia(s))
    `;
    pendingList.appendChild(div);
  }

  if (items.length === 0) {
    pendingList.innerHTML = '<p>Nenhuma pendência encontrada para os filtros atuais.</p>';
  }
}

async function loadPending() {
  const collaboratorId = collaboratorFilter.value.trim();
  const params = new URLSearchParams();
  if (collaboratorId) params.set('collaboratorId', collaboratorId);

  const response = await fetch(`/api/recurrences/pending?${params.toString()}`);
  const payload = await response.json();

  let items = payload.data;
  if (priorityFilter.checked) {
    items = items.filter((item) => item.priority === 'alta');
  }

  render(items);
}

refreshBtn.addEventListener('click', loadPending);
priorityFilter.addEventListener('change', loadPending);

loadPending();
