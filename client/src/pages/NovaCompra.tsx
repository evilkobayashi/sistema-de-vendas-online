import { useEffect, useState, useRef } from 'react';
import api from '../api';
import toast from 'react-hot-toast';

const money = (v: number) => `R$ ${Number(v).toFixed(2)}`;

export default function NovaCompra() {
  const [customers, setCustomers] = useState<any[]>([]);
  const [medicines, setMedicines] = useState<any[]>([]);
  const [healthPlans, setHealthPlans] = useState<any[]>([]);
  const [doctors, setDoctors] = useState<any[]>([]);
  const [selectedCustomer, setSelectedCustomer] = useState<any>(null);
  const [eligibility, setEligibility] = useState<any>(null);
  const [forecast, setForecast] = useState<any>(null);
  const formRef = useRef<HTMLFormElement>(null);

  useEffect(() => {
    Promise.all([
      api.get('/patients').catch(() => api.get('/customers')),
      api.get('/medicines'),
      api.get('/health-plans'),
      api.get('/doctors'),
    ]).then(([c, m, h, d]: any) => {
      setCustomers(Array.isArray(c.items) ? c.items : []);
      setMedicines(Array.isArray(m.items) ? m.items : []);
      setHealthPlans(Array.isArray(h.items) ? h.items : []);
      setDoctors(Array.isArray(d.items) ? d.items : []);
    });
  }, []);

  const handleCustomerChange = async (id: string) => {
    const c = customers.find(x => x.id === id);
    setSelectedCustomer(c || null);
    if (c) {
      try {
        const elig: any = await api.get(`/patients/${c.id}/eligibility`);
        setEligibility(elig);
      } catch { setEligibility(null); }
    }
  };

  const calcForecast = () => {
    const f = formRef.current;
    if (!f) return;
    const qty = Number((f.elements as any).quantity?.value || 0);
    const tpd = Number((f.elements as any).tabletsPerDay?.value || 0);
    const tpp = Number((f.elements as any).tabletsPerPackage?.value || 30);
    const td = Number((f.elements as any).treatmentDays?.value || 0);

    if (!tpd || !td || !tpp) { setForecast(null); return; }

    const needed = Math.ceil(tpd * td);
    const boxes = Math.max(1, Math.ceil(needed / tpp));
    const covered = qty > 0 ? Math.floor((qty * tpp) / tpd) : 0;
    setForecast({ needed, boxes, covered: covered || td, td });
  };

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    const p: any = Object.fromEntries(fd.entries());
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
      if (p.customerId && eligibility && !eligibility.canOrderThisMonth) {
        throw new Error(`Paciente bloqueado. Próxima data: ${eligibility.nextEligibleDate}`);
      }
      const data: any = await api.post('/orders', payload);
      toast.success(`Pedido ${data.order.id} criado (${money(data.order.total)})`);
      e.currentTarget.reset();
      setForecast(null);
    } catch (err: any) {
      toast.error(err.message || 'Erro ao criar pedido');
    }
  };

  return (
    <>
      <h2>Nova compra</h2>
      <form ref={formRef} onSubmit={handleSubmit} className="grid-form">
        <select name="customerId" onChange={e => handleCustomerChange(e.target.value)}>
          <option value="">Selecione um paciente</option>
          {customers.map(c => <option key={c.id} value={c.id}>{c.name} • {c.patientCode || c.phone}</option>)}
        </select>

        <input name="patientName" placeholder="Paciente" required readOnly value={selectedCustomer?.name || ''} />
        <input name="email" type="email" placeholder="E-mail" required readOnly value={selectedCustomer?.email || ''} />
        <input name="phone" placeholder="Telefone" required readOnly value={selectedCustomer?.phone || ''} />
        <input name="address" placeholder="Endereço" required readOnly value={selectedCustomer?.address || ''} />
        <input name="patientCode" placeholder="Código do paciente" readOnly value={selectedCustomer?.patientCode || ''} />
        <input name="insuranceCardCode" placeholder="Carteirinha" readOnly value={selectedCustomer?.insuranceCardCode || ''} />
        <input name="healthPlanName" placeholder="Plano" readOnly value={healthPlans.find(p => p.id === selectedCustomer?.healthPlanId)?.name || ''} />
        <input name="doctorName" placeholder="Médico" readOnly value={doctors.find(d => d.id === selectedCustomer?.doctorId)?.name || ''} />
        <input name="diseaseCid" placeholder="CID" readOnly value={selectedCustomer?.diseaseCid || ''} />

        <select name="medicineId" required>
          {medicines.map(m => <option key={m.id} value={m.id}>{m.name} ({money(m.price)})</option>)}
        </select>
        <input name="quantity" type="number" min="1" defaultValue={1} required onInput={calcForecast} />
        <input name="tabletsPerDay" type="number" min="0.1" step="0.1" placeholder="Comprimidos por dia" onInput={calcForecast} />
        <input name="tabletsPerPackage" type="number" min="1" step="1" defaultValue={30} placeholder="Comprimidos por caixa" onInput={calcForecast} />
        <input name="treatmentDays" type="number" min="1" step="1" placeholder="Dias de tratamento" onInput={calcForecast} />
        <input name="prescriptionCode" placeholder="Código da receita (controlados)" />
        <label style={{ display: 'flex', alignItems: 'center', gap: 8 }}><input type="checkbox" name="recurringEnabled" /> Compra recorrente</label>
        <input name="discountPercent" type="number" min="0" max="100" defaultValue={5} />
        <input name="nextBillingDate" type="date" />
        <button type="submit">Registrar</button>
      </form>

      {eligibility && (
        <div className="card" style={{ marginTop: 16, borderLeft: eligibility.canOrderThisMonth ? '4px solid var(--accent)' : '4px solid var(--danger)' }}>
          <strong>Elegibilidade:</strong>{' '}
          {eligibility.canOrderThisMonth
            ? 'Paciente apto para novo pedido nesta competência.'
            : `Bloqueado. Próxima data: ${eligibility.nextEligibleDate || '-'}`}
        </div>
      )}

      {forecast && (
        <div className="card" style={{ marginTop: 12 }}>
          <strong>Previsão para orientação ao cliente</strong><br/>
          Necessário: <strong>{forecast.needed}</strong> comprimidos (~<strong>{forecast.boxes}</strong> caixas).<br/>
          Cobre cerca de <strong>{forecast.covered}</strong> dias.
        </div>
      )}
    </>
  );
}
