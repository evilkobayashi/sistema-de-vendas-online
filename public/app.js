const DISCOUNT_LIMITS = {
  min: 0,
  max: 50,
};

const orderForm = document.getElementById('orderForm');
const recurringEnabled = document.getElementById('recurringEnabled');
const recurringSection = document.getElementById('recurringSection');
const recurringFields = document.getElementById('recurringFields');
const discountPercentInput = document.getElementById('discountPercent');
const nextBillingDateInput = document.getElementById('nextBillingDate');
const grossTotalInput = document.getElementById('grossTotal');
const discountRangeLabel = document.getElementById('discountRangeLabel');
const summaryPanel = document.getElementById('summaryPanel');
const confirmationPanel = document.getElementById('confirmationPanel');
const previewButton = document.getElementById('previewButton');

let previewReady = false;
let latestSummary = null;

discountRangeLabel.textContent = `${DISCOUNT_LIMITS.min}% a ${DISCOUNT_LIMITS.max}%`;

function formatCurrency(value) {
  return new Intl.NumberFormat('pt-BR', {
    style: 'currency',
    currency: 'BRL',
  }).format(value);
}

function toggleRecurringVisibility() {
  const isActive = recurringEnabled.checked;
  recurringFields.classList.toggle('hidden', !isActive);
  recurringSection.classList.toggle('active', isActive);

  if (!isActive) {
    discountPercentInput.value = '';
    nextBillingDateInput.value = '';
  }

  previewReady = false;
  summaryPanel.classList.add('hidden');
}

function parseDate(value) {
  if (!value) return null;
  const date = new Date(`${value}T00:00:00`);
  return Number.isNaN(date.getTime()) ? null : date;
}

function clearErrors() {
  orderForm.querySelectorAll('.error').forEach((node) => node.remove());
}

function addError(input, message) {
  const error = document.createElement('p');
  error.className = 'error';
  error.textContent = message;
  input.insertAdjacentElement('afterend', error);
}

function collectAndValidate() {
  clearErrors();

  const grossTotal = Number.parseFloat(grossTotalInput.value);
  const recurring = recurringEnabled.checked;
  const discountPercent = Number.parseFloat(discountPercentInput.value || '0');
  const nextBillingDate = parseDate(nextBillingDateInput.value);

  let valid = true;

  if (!Number.isFinite(grossTotal) || grossTotal < 0) {
    addError(grossTotalInput, 'Informe um total bruto válido.');
    valid = false;
  }

  if (recurring) {
    if (!Number.isFinite(discountPercent) || discountPercent < DISCOUNT_LIMITS.min || discountPercent > DISCOUNT_LIMITS.max) {
      addError(
        discountPercentInput,
        `Com recorrência ativa, o desconto deve estar entre ${DISCOUNT_LIMITS.min}% e ${DISCOUNT_LIMITS.max}%.`,
      );
      valid = false;
    }

    if (!nextBillingDate) {
      addError(nextBillingDateInput, 'Com recorrência ativa, informe uma data válida para o próximo faturamento.');
      valid = false;
    }
  }

  if (!valid) {
    return null;
  }

  const discountAmount = recurring ? (grossTotal * discountPercent) / 100 : 0;
  const finalTotal = grossTotal - discountAmount;

  return {
    recurring,
    grossTotal,
    discountPercent,
    discountAmount,
    finalTotal,
    nextBillingDate: nextBillingDateInput.value,
  };
}

function renderSummary(summary) {
  const nextBillingText = summary.recurring ? summary.nextBillingDate : 'Não se aplica';

  summaryPanel.innerHTML = `
    <h2>Resumo antes de salvar</h2>
    <p><strong>Total bruto:</strong> ${formatCurrency(summary.grossTotal)}</p>
    <p><strong>Desconto aplicado:</strong> ${formatCurrency(summary.discountAmount)} (${summary.discountPercent || 0}%)</p>
    <p><strong>Total final:</strong> ${formatCurrency(summary.finalTotal)}</p>
    <p><strong>Próximo faturamento:</strong> ${nextBillingText}</p>
  `;
  summaryPanel.classList.remove('hidden');
}

function renderConfirmation(summary) {
  if (summary.recurring) {
    confirmationPanel.innerHTML = `
      <h2>Pedido salvo com sucesso</h2>
      <p><strong>Recorrência ativada</strong> para o próximo faturamento em <strong>${summary.nextBillingDate}</strong>.</p>
      <p>Fique atento: você receberá uma confirmação futura antes da próxima cobrança.</p>
    `;
  } else {
    confirmationPanel.innerHTML = '<h2>Pedido salvo com sucesso</h2><p>Recorrência não ativada para este pedido.</p>';
  }

  confirmationPanel.classList.remove('hidden');
}

previewButton.addEventListener('click', () => {
  const summary = collectAndValidate();
  if (!summary) {
    previewReady = false;
    return;
  }

  latestSummary = summary;
  previewReady = true;
  renderSummary(summary);
  confirmationPanel.classList.add('hidden');
});

orderForm.addEventListener('submit', (event) => {
  event.preventDefault();

  const summary = collectAndValidate();
  if (!summary) {
    previewReady = false;
    return;
  }

  if (!previewReady) {
    latestSummary = summary;
    renderSummary(summary);
    alert('Confira o resumo antes de salvar. Clique novamente em "Salvar pedido" para confirmar.');
    previewReady = true;
    return;
  }

  renderConfirmation(latestSummary || summary);
  orderForm.reset();
  toggleRecurringVisibility();
  previewReady = false;
  latestSummary = null;
});

recurringEnabled.addEventListener('change', toggleRecurringVisibility);
toggleRecurringVisibility();
