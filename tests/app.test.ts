import fs from 'node:fs';
import path from 'node:path';
import request from 'supertest';
import { beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { createApp } from '../src/app.js';

const runtimeDir = path.resolve(process.cwd(), '.runtime-data-test');
process.env.RUNTIME_STORE_DIR = runtimeDir;

const app = createApp();

async function loginAs(employeeCode = '4B-101', password = 'operador123') {
  const response = await request(app).post('/api/login').send({ employeeCode, password });
  expect(response.status).toBe(200);
  return response.body.token as string;
}

describe('4bio internal sales app', () => {
  beforeAll(() => {
    if (!fs.existsSync(runtimeDir)) fs.mkdirSync(runtimeDir, { recursive: true });
  });

  beforeEach(() => {
    for (const file of fs.readdirSync(runtimeDir)) fs.rmSync(path.join(runtimeDir, file), { recursive: true, force: true });
  });

  it('retorna index principal', async () => {
    const response = await request(app).get('/');
    expect(response.status).toBe(200);
    expect(response.text).toContain('Sistema Interno de Compras');
  });

  it('protege rotas sem token', async () => {
    const response = await request(app).get('/api/orders');
    expect(response.status).toBe(401);
  });

  it('login inventário funciona com código normalizado', async () => {
    const response = await request(app).post('/api/login').send({ employeeCode: ' 4b-220 ', password: 'inventario123 ' });
    expect(response.status).toBe(200);
    expect(response.body.user.role).toBe('inventario');
  });

  it('permite inventário cadastrar lote e reflete no sumário', async () => {
    const token = await loginAs('4B-220', 'inventario123');
    const lot = await request(app)
      .post('/api/inventory/lots')
      .set('Authorization', `Bearer ${token}`)
      .send({ medicineId: 'm2', batchCode: 'CAR-NEW', expiresAt: '2030-01-01', quantity: 33, unitCost: 50, supplier: 'BioHeart' });

    expect(lot.status).toBe(201);

    const summary = await request(app).get('/api/inventory/summary?page=1&pageSize=50').set('Authorization', `Bearer ${token}`);
    expect(summary.status).toBe(200);
    const cardio = summary.body.items.find((x: { medicineId: string }) => x.medicineId === 'm2');
    expect(cardio.stockTotal).toBeGreaterThanOrEqual(33);
  });



  it('cadastra e lista clientes em banco de dados', async () => {
    const token = await loginAs();

    const created = await request(app)
      .post('/api/patients')
      .set('Authorization', `Bearer ${token}`)
      .send({ name: 'Paciente Teste', patientCode: 'PAC-001', insuranceCardCode: 'CARD-001', insurancePlanName: 'Plano A', insuranceProviderName: 'Operadora A', diseaseCid: 'A00', primaryDoctorId: 'd-temp', email: 'cliente@example.com', phone: '11977776666', address: 'Rua Cliente, 10' });

    expect(created.status).toBe(201);

    const listed = await request(app).get('/api/patients?q=Cliente').set('Authorization', `Bearer ${token}`);
    expect(listed.status).toBe(200);
    expect(listed.body.items.some((x: { email: string }) => x.email === 'cliente@example.com')).toBe(true);
  });



  it('edita cliente cadastrado e retorna dados atualizados', async () => {
    const token = await loginAs();

    const created = await request(app)
      .post('/api/patients')
      .set('Authorization', `Bearer ${token}`)
      .send({ name: 'Paciente Edit', patientCode: 'PAC-002', insuranceCardCode: 'CARD-002', insurancePlanName: 'Plano B', insuranceProviderName: 'Operadora B', diseaseCid: 'B00', primaryDoctorId: 'd-temp', email: 'cliente.edit@example.com', phone: '11933334444', address: 'Rua X, 1' });

    const updated = await request(app)
      .patch(`/api/patients/${created.body.item.id}`)
      .set('Authorization', `Bearer ${token}`)
      .send({ name: 'Paciente Editado', patientCode: 'PAC-002', insuranceCardCode: 'CARD-002-ALT', insurancePlanName: 'Plano B2', insuranceProviderName: 'Operadora B', diseaseCid: 'B01', primaryDoctorId: 'd-temp', email: 'cliente.editado@example.com', phone: '11955556666', address: 'Rua Y, 2' });

    expect(updated.status).toBe(200);
    expect(updated.body.item.name).toBe('Paciente Editado');

    const fetched = await request(app)
      .get(`/api/patients/${created.body.item.id}`)
      .set('Authorization', `Bearer ${token}`);

    expect(fetched.status).toBe(200);
    expect(fetched.body.item.email).toBe('cliente.editado@example.com');
  });


  it('cadastra e lista médicos no menu de médicos', async () => {
    const token = await loginAs();

    const created = await request(app)
      .post('/api/doctors')
      .set('Authorization', `Bearer ${token}`)
      .send({ name: 'Dra. Helena Costa', crm: 'CRM-12345', specialty: 'Cardiologia', email: 'helena@clinic.com', phone: '11999990000' });

    expect(created.status).toBe(201);

    const listed = await request(app).get('/api/doctors?q=Helena').set('Authorization', `Bearer ${token}`);
    expect(listed.status).toBe(200);
    expect(listed.body.items.some((x: { crm: string }) => x.crm === 'CRM-12345')).toBe(true);
  });

  it('edita médico cadastrado e retorna dados atualizados', async () => {
    const token = await loginAs();

    const created = await request(app)
      .post('/api/doctors')
      .set('Authorization', `Bearer ${token}`)
      .send({ name: 'Dr. Bruno Lima', crm: 'CRM-54321', specialty: 'Clínica Geral', email: 'bruno@clinic.com', phone: '11998887766' });

    const updated = await request(app)
      .patch(`/api/doctors/${created.body.item.id}`)
      .set('Authorization', `Bearer ${token}`)
      .send({ name: 'Dr. Bruno Lima', crm: 'CRM-54321', specialty: 'Endocrinologia', email: 'bruno@clinic.com', phone: '11997776655' });

    expect(updated.status).toBe(200);
    expect(updated.body.item.specialty).toBe('Endocrinologia');

    const fetched = await request(app)
      .get(`/api/doctors/${created.body.item.id}`)
      .set('Authorization', `Bearer ${token}`);

    expect(fetched.status).toBe(200);
    expect(fetched.body.item.phone).toBe('11997776655');
  });








  it('gera orçamento inteligente, impressão e produção com leitura de balança', async () => {
    const token = await loginAs('4B-014', 'gerente123');

    const formula = await request(app)
      .post('/api/standard-formulas')
      .set('Authorization', `Bearer ${token}`)
      .send({ name: 'Formula Teste', version: 'v1', productId: 'm2', instructions: 'Misturar conforme POP.' });
    expect(formula.status).toBe(201);

    const budget = await request(app)
      .post('/api/budgets')
      .set('Authorization', `Bearer ${token}`)
      .send({ patientName: 'Paciente Orçamento', doctorName: 'Dr. Teste', prescriptionText: 'CardioPlus 10mg usar por 30 dias', estimatedDays: 30 });
    expect(budget.status).toBe(201);

    const manip = await request(app)
      .get(`/api/budgets/${budget.body.item.id}/manipulation-order`)
      .set('Authorization', `Bearer ${token}`);
    expect(manip.status).toBe(200);
    expect(String(manip.body.printableText)).toContain('Ordem de Manipulação');

    const labels = await request(app)
      .get(`/api/budgets/${budget.body.item.id}/labels`)
      .set('Authorization', `Bearer ${token}`);
    expect(labels.status).toBe(200);

    const scale = await request(app)
      .post('/api/scale/readings')
      .set('Authorization', `Bearer ${token}`)
      .send({ quoteId: budget.body.item.id, medicineId: 'm2', expectedWeightGrams: 100, measuredWeightGrams: 101 });
    expect(scale.status).toBe(201);

    const production = await request(app)
      .post('/api/production/standard-formula')
      .set('Authorization', `Bearer ${token}`)
      .send({ formulaId: formula.body.item.id, batchSize: 2, operator: 'Operador 1' });
    expect(production.status).toBe(201);
  });

  it('processa entrada com conversão, XML NF-e, impressão e atualização automática de preço', async () => {
    const token = await loginAs('4B-014', 'gerente123');

    const conversion = await request(app)
      .post('/api/inventory/entries')
      .set('Authorization', `Bearer ${token}`)
      .send({
        medicineId: 'm2',
        batchCode: 'CONV-001',
        expiresAt: '2031-01-01',
        supplier: 'Fornecedor Conversão',
        sourceUnit: 'caixa',
        targetUnit: 'comprimido',
        sourceQuantity: 2,
        conversionFactor: 30,
        unitCost: 1.2
      });

    expect(conversion.status).toBe(201);
    expect(conversion.body.convertedQuantity).toBe(60);

    const nfeXml = `<nfeProc><NFe><infNFe><det nItem="1"><prod><xProd>CardioPlus 10mg</xProd><qCom>3</qCom><vUnCom>2.5</vUnCom></prod></det></infNFe></NFe></nfeProc>`;
    const nfe = await request(app)
      .post('/api/inventory/entries/nfe-xml')
      .set('Authorization', `Bearer ${token}`)
      .send({ xml: nfeXml, supplier: 'Fornecedor XML', conversionFactor: 10 });

    expect(nfe.status).toBe(201);
    expect(nfe.body.createdLots.length).toBeGreaterThan(0);

    const order = await request(app)
      .post('/api/orders')
      .set('Authorization', `Bearer ${token}`)
      .send({
        patientName: 'Paciente Impressão',
        email: 'print@example.com',
        phone: '11922223333',
        address: 'Rua Impressão, 10',
        items: [{ medicineId: 'm2', quantity: 1 }]
      });

    expect(order.status).toBe(201);

    const labels = await request(app)
      .get(`/api/print/labels/${order.body.order.id}`)
      .set('Authorization', `Bearer ${token}`);

    expect(labels.status).toBe(200);
    expect(labels.body.items.length).toBeGreaterThan(0);

    const quality = await request(app)
      .get(`/api/quality/reports/${order.body.order.id}`)
      .set('Authorization', `Bearer ${token}`);

    expect(quality.status).toBe(200);
    expect(String(quality.body.printableText)).toContain('Laudo');

    const autoPrice = await request(app)
      .post('/api/pricing/auto-update')
      .set('Authorization', `Bearer ${token}`)
      .send({ percent: 5, lab: 'BioHeart', reason: 'Reajuste mensal' });

    expect(autoPrice.status).toBe(200);
    expect(autoPrice.body.updated).toBeGreaterThan(0);
  });

  it('permite cadastrar entidades de cadastros mestres', async () => {
    const token = await loginAs();

    const employee = await request(app).post('/api/employees').set('Authorization', `Bearer ${token}`).send({
      name: 'Ana Estoque', role: 'Inventário', employeeCode: 'EMP-900', email: 'ana@empresa.com', phone: '11900001111'
    });
    expect(employee.status).toBe(201);

    const supplier = await request(app).post('/api/suppliers').set('Authorization', `Bearer ${token}`).send({
      name: 'Fornecedor Alfa', document: '12.345.678/0001-99', email: 'contato@alfa.com', phone: '1133334444', category: 'Medicamentos'
    });
    expect(supplier.status).toBe(201);

    const finishedProduct = await request(app).post('/api/finished-products').set('Authorization', `Bearer ${token}`).send({
      name: 'Xarope Pronto', productType: 'acabado', sku: 'SKU-XP-1', unit: 'frasco', price: 25.5
    });
    expect(finishedProduct.status).toBe(201);

    const rawMaterial = await request(app).post('/api/raw-materials').set('Authorization', `Bearer ${token}`).send({
      name: 'Base Glicerinada', code: 'MAT-100', unit: 'L', cost: 18.2
    });
    expect(rawMaterial.status).toBe(201);

    const standardFormula = await request(app).post('/api/standard-formulas').set('Authorization', `Bearer ${token}`).send({
      name: 'Fórmula X', version: 'v1', productId: finishedProduct.body.item.id, instructions: 'Misturar base e ativo por 5 minutos.'
    });
    expect(standardFormula.status).toBe(201);

    const packagingFormula = await request(app).post('/api/packaging-formulas').set('Authorization', `Bearer ${token}`).send({
      name: 'Embalagem X', productId: finishedProduct.body.item.id, packagingType: 'Frasco 120ml', unitsPerPackage: 1, notes: 'Aplicar lacre térmico.'
    });
    expect(packagingFormula.status).toBe(201);
  });



  it('cadastra, consulta e atualiza paciente via endpoints /api/patients', async () => {
    const token = await loginAs();

    const created = await request(app)
      .post('/api/patients')
      .set('Authorization', `Bearer ${token}`)
      .send({
        name: 'Paciente Master',
        patientCode: 'PAC-900',
        insuranceCardCode: 'CARD-900',
        insurancePlanName: 'Plano Master',
        insuranceProviderName: 'Operadora Master',
        diseaseCid: 'Z99',
        primaryDoctorId: 'd-master',
        email: 'pac.master@example.com',
        phone: '11900000000',
        address: 'Rua Master, 90'
      });

    expect(created.status).toBe(201);

    const listed = await request(app)
      .get('/api/patients?q=PAC-900')
      .set('Authorization', `Bearer ${token}`);

    expect(listed.status).toBe(200);
    expect(listed.body.items[0].insuranceCardCode).toBe('CARD-900');

    const updated = await request(app)
      .patch(`/api/patients/${created.body.item.id}`)
      .set('Authorization', `Bearer ${token}`)
      .send({
        name: 'Paciente Master Atualizado',
        patientCode: 'PAC-900',
        insuranceCardCode: 'CARD-901',
        insurancePlanName: 'Plano Master',
        insuranceProviderName: 'Operadora Master',
        diseaseCid: 'Z98',
        primaryDoctorId: 'd-master',
        email: 'pac.master@example.com',
        phone: '11900000000',
        address: 'Rua Master, 90'
      });

    expect(updated.status).toBe(200);
    expect(updated.body.item.insuranceCardCode).toBe('CARD-901');
  });

  it('permite criar pedido usando customerId cadastrado', async () => {
    const token = await loginAs();
    const createdCustomer = await request(app)
      .post('/api/patients')
      .set('Authorization', `Bearer ${token}`)
      .send({ name: 'Paciente Pedido', patientCode: 'PAC-003', insuranceCardCode: 'CARD-003', insurancePlanName: 'Plano C', insuranceProviderName: 'Operadora C', diseaseCid: 'C00', primaryDoctorId: 'd-temp', email: 'pedido@example.com', phone: '11911112222', address: 'Rua Pedido, 20' });

    const createdOrder = await request(app)
      .post('/api/orders')
      .set('Authorization', `Bearer ${token}`)
      .send({
        customerId: createdCustomer.body.item.id,
        patientName: 'fallback',
        email: 'fallback@example.com',
        phone: '111111111',
        address: 'fallback',
        items: [{ medicineId: 'm2', quantity: 1 }]
      });

    expect(createdOrder.status).toBe(201);
    expect(createdOrder.body.order.patientName).toBe('Paciente Pedido');
    expect(createdOrder.body.order.email).toBe('pedido@example.com');
  });



  it('aplica fallback de transportadora quando provedor primário falha', async () => {
    process.env.SHIPPING_FORCE_FAIL = 'primary';
    const token = await loginAs();

    const createdOrder = await request(app)
      .post('/api/orders')
      .set('Authorization', `Bearer ${token}`)
      .send({
        patientName: 'Paciente Frete',
        email: 'frete@example.com',
        phone: '11910000000',
        address: '01001-000',
        items: [{ medicineId: 'm2', quantity: 1 }]
      });

    expect(createdOrder.status).toBe(201);
    expect(createdOrder.body.shipment.provider).toBe('EcoEntrega');
    expect(createdOrder.body.shipment.fallbackUsed).toBe(true);

    const deliveries = await request(app)
      .get('/api/deliveries?page=1&pageSize=50')
      .set('Authorization', `Bearer ${token}`);
    expect(deliveries.status).toBe(200);
    expect(deliveries.body.items[0].trackingCode).toContain('EE-');

    process.env.SHIPPING_FORCE_FAIL = '';
  });

  it('retorna fallback interno quando todos os provedores falham', async () => {
    process.env.SHIPPING_FORCE_FAIL = 'all';
    const token = await loginAs();

    const quote = await request(app)
      .post('/api/shipping/quote')
      .set('Authorization', `Bearer ${token}`)
      .send({ destinationZip: '01001-000', weightKg: 1.2, declaredValue: 200 });

    expect(quote.status).toBe(200);
    expect(quote.body.item.provider).toBe('Transportadora Interna');
    expect(quote.body.item.syncStatus).toBe('queued_retry');

    process.env.SHIPPING_FORCE_FAIL = '';
  });

  it('reserva estoque na criação de pedido e bloqueia quando falta saldo', async () => {
    const token = await loginAs();

    const ok = await request(app)
      .post('/api/orders')
      .set('Authorization', `Bearer ${token}`)
      .send({
        patientName: 'Paciente Estoque',
        email: 'estoque@example.com',
        phone: '11999999900',
        address: 'Rua E, 1',
        items: [{ medicineId: 'm4', quantity: 2 }]
      });
    expect(ok.status).toBe(201);

    const blocked = await request(app)
      .post('/api/orders')
      .set('Authorization', `Bearer ${token}`)
      .send({
        patientName: 'Paciente Sem Saldo',
        email: 'semsaldo@example.com',
        phone: '11999999888',
        address: 'Rua F, 2',
        items: [{ medicineId: 'm4', quantity: 999 }]
      });
    expect(blocked.status).toBe(400);
    expect(blocked.body.error).toContain('Estoque insuficiente');
  });




  it('interpreta texto de pedido médico e sugere remédios do catálogo', async () => {
    const token = await loginAs();

    const parsed = await request(app)
      .post('/api/prescriptions/parse')
      .set('Authorization', `Bearer ${token}`)
      .send({ text: 'Paciente deve usar CardioPlus 10mg 1 comprimido ao dia. Se necessário, manter OncoRelief.' });

    expect(parsed.status).toBe(200);
    expect(parsed.body.found).toBe(true);
    expect(parsed.body.suggestions.length).toBeGreaterThan(0);
    expect(parsed.body.suggestions.some((x: { name: string }) => x.name.includes('CardioPlus'))).toBe(true);
  });



  it('interpreta receita enviada por arquivo (pdf base64) e retorna sugestões', async () => {
    const token = await loginAs();
    const fakePdfText = Buffer.from('Receita: CardioPlus 10mg 1 comprimido por dia', 'utf8').toString('base64');

    const parsed = await request(app)
      .post('/api/prescriptions/parse-document')
      .set('Authorization', `Bearer ${token}`)
      .send({
        filename: 'receita.pdf',
        mimeType: 'application/pdf',
        contentBase64: fakePdfText
      });

    expect(parsed.status).toBe(200);
    expect(parsed.body.suggestions.length).toBeGreaterThan(0);
    expect(parsed.body.extractionMethod).toContain('pdf');
  });

  it('calcula previsão de término do medicamento com base no consumo diário', async () => {
    const token = await loginAs();
    const response = await request(app)
      .post('/api/orders')
      .set('Authorization', `Bearer ${token}`)
      .send({
        patientName: 'Paciente Fórmula',
        email: 'formula@example.com',
        phone: '11999999666',
        address: 'Rua H',
        items: [{ medicineId: 'm2', quantity: 2, tabletsPerDay: 2, tabletsPerPackage: 30, treatmentDays: 12 }],
        recurring: { discountPercent: 5 }
      });

    expect(response.status).toBe(201);
    expect(response.body.order.items[0].estimatedRunOutDate).toBeTruthy();
    expect(response.body.order.items[0].treatmentDays).toBe(12);
    expect(response.body.order.estimatedTreatmentEndDate).toBeTruthy();
    expect(response.body.order.recurring.nextBillingDate).toBe(response.body.order.estimatedTreatmentEndDate);
  });

  it('mantém recorrência e confirmação', async () => {
    const token = await loginAs();
    const create = await request(app)
      .post('/api/orders')
      .set('Authorization', `Bearer ${token}`)
      .send({
        patientName: 'Paciente Recorrente',
        email: 'rec@example.com',
        phone: '11999999777',
        address: 'Rua G',
        items: [{ medicineId: 'm2', quantity: 1 }],
        recurring: { discountPercent: 5, nextBillingDate: new Date(Date.now() + 2 * 86400000).toISOString().slice(0, 10) }
      });
    expect(create.status).toBe(201);

    const confirm = await request(app)
      .patch(`/api/orders/${create.body.order.id}/recurring/confirm`)
      .set('Authorization', `Bearer ${token}`)
      .send({});
    expect(confirm.status).toBe(200);
    expect(confirm.body.order.recurring.needsConfirmation).toBe(false);
  });
});
