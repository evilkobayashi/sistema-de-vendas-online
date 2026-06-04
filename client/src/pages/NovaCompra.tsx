import { useEffect, useState, useRef } from 'react';
import api from '../api';
import toast from 'react-hot-toast';
import Tesseract from 'tesseract.js';
import * as pdfjsLib from 'pdfjs-dist';

pdfjsLib.GlobalWorkerOptions.workerSrc = `https://cdnjs.cloudflare.com/ajax/libs/pdf.js/${pdfjsLib.version}/pdf.worker.min.js`;

const money = (v: number) => `R$ ${Number(v).toFixed(2)}`;

interface IdentifiedMedicine {
  name: string;
  quantity: number;
  dosage?: string;
  frequency?: string;
}

export default function NovaCompra() {
  const [customers, setCustomers] = useState<any[]>([]);
  const [medicines, setMedicines] = useState<any[]>([]);
  const [healthPlans, setHealthPlans] = useState<any[]>([]);
  const [doctors, setDoctors] = useState<any[]>([]);
  const [selectedCustomer, setSelectedCustomer] = useState<any>(null);
  const [eligibility, setEligibility] = useState<any>(null);
  const [forecast, setForecast] = useState<any>(null);
  const [prescriptionText, setPrescriptionText] = useState('');
  const [identifiedMedicines, setIdentifiedMedicines] = useState<IdentifiedMedicine[]>([]);
  const [isProcessingPrescription, setIsProcessingPrescription] = useState(false);
  const [prescriptionPreview, setPrescriptionPreview] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
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
    const c = customers.find((x) => x.id === id);
    setSelectedCustomer(c || null);
    if (c) {
      try {
        const elig: any = await api.get(`/patients/${c.id}/eligibility`);
        setEligibility(elig);
      } catch {
        setEligibility(null);
      }
    }
  };

  const calcForecast = () => {
    const f = formRef.current;
    if (!f) return;
    const qty = Number((f.elements as any).quantity?.value || 0);
    const tpd = Number((f.elements as any).tabletsPerDay?.value || 0);
    const tpp = Number((f.elements as any).tabletsPerPackage?.value || 30);
    const td = Number((f.elements as any).treatmentDays?.value || 0);

    if (!tpd || !td || !tpp) {
      setForecast(null);
      return;
    }

    const needed = Math.ceil(tpd * td);
    const boxes = Math.max(1, Math.ceil(needed / tpp));
    const covered = qty > 0 ? Math.floor((qty * tpp) / tpd) : 0;
    setForecast({ needed, boxes, covered: covered || td, td });
  };

  const extractTextFromPDF = async (file: File): Promise<string> => {
    const arrayBuffer = await file.arrayBuffer();
    const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;
    let fullText = '';

    for (let i = 1; i <= pdf.numPages; i++) {
      const page = await pdf.getPage(i);
      const textContent = await page.getTextContent();
      const pageText = textContent.items.map((item: any) => item.str).join(' ');
      fullText += pageText + '\n';
    }

    return fullText;
  };

  const extractTextFromImage = async (file: File): Promise<string> => {
    const result = await Tesseract.recognize(file, 'por+eng', {
      logger: (m) => {
        if (m.status === 'recognizing text') {
          // Progress tracking if needed
        }
      },
    });
    return result.data.text;
  };

  const parsePrescriptionText = (text: string): IdentifiedMedicine[] => {
    const medicines: IdentifiedMedicine[] = [];
    const lines = text.split('\n').filter((line) => line.trim());

    const patterns = [
      /(\d+[,\.]?\d*)\s*(?:cp[s]?|comprimid[oa]s?|capsulas?|unidades?)\s+(?:de\s+)?([A-Za-zÀ-ÿ\s]+?)(?:\s+\d+\s*(?:mg|mcg|g|ml|UI)|$)/gi,
      /([A-Za-zÀ-ÿ\s]+?)\s*(\d+[,\.]?\d*)\s*(?:mg|mcg|g|ml|UI)/gi,
      /(\d+)\s*(?:x|por)\s*(?:dia|semana|mês)/gi,
      /([A-Za-zÀ-ÿ\s]+?)\s*-\s*(\d+)/gi,
    ];

    const commonMedicines = [
      'metformina',
      'cloridrato de metformina',
      'glibenclamida',
      'insulina',
      'losartana',
      'atorvastatina',
      'sinvastatina',
      'rosuvastatina',
      'amlodipina',
      'besilato de amlodipina',
      'enalapril',
      'maleato de enalapril',
      'omeprazol',
      'pantoprazol',
      'esomeprazol',
      'carvedilol',
      'bisoprolol',
      'atenolol',
      'propranolol',
      'levotiroxina',
      'tiroxina',
      'prednisona',
      'dexametasona',
      'hidrocortisona',
      'ibuprofeno',
      'paracetamol',
      'dipirona',
      /azitromicina/i,
      /amoxicilina/i,
      /cefalexina/i,
      /ciprofloxacino/i,
      /diclofenaco/i,
      /naproxeno/i,
      /celecoxibe/i,
      /etoricoxibe/i,
      /sertralina/i,
      /fluoxetina/i,
      /escitalopram/i,
      /paroxetina/i,
      /clonazepam/i,
      /alprazolam/i,
      /donepezila/i,
      /memantina/i,
      /rivastigmina/i,
      /escitalopram/i,
      /duloxetina/i,
      /venlafaxina/i,
      /bupropiona/i,
    ];

    for (const line of lines) {
      for (const pattern of patterns) {
        const matches = [...line.matchAll(new RegExp(pattern.source, pattern.flags))];
        for (const match of matches) {
          let name = '';
          let quantity = 1;

          if (match.length >= 2) {
            const maybeName = match[match.length - 1]?.toString().trim() || '';
            const maybeNum = match[match.length - 2]?.toString().trim() || '';

            if (/^\d+[,\.]?\d*$/.test(maybeNum)) {
              quantity = parseFloat(maybeNum.replace(',', '.'));
              name = maybeName;
            } else {
              name = maybeNum + ' ' + maybeNum;
            }
          }

          if (name.length > 2) {
            const cleanName = name.replace(/^\d+\s*/, '').trim();
            if (cleanName.length > 2) {
              medicines.push({
                name: cleanName,
                quantity: Math.max(1, quantity),
              });
            }
          }
        }
      }

      const lowerLine = line.toLowerCase();
      for (const med of commonMedicines) {
        const medName = typeof med === 'string' ? med : med.source.replace(/\\/g, '');
        const medRegex = new RegExp(medName, 'i');
        if (medRegex.test(lowerLine)) {
          const numMatch = line.match(/(\d+)/);
          medicines.push({
            name: line.replace(/\d+/g, '').trim().substring(0, 50),
            quantity: numMatch ? parseInt(numMatch[1]) : 30,
          });
        }
      }
    }

    const uniqueMedicines = medicines.reduce((acc: IdentifiedMedicine[], med) => {
      const existing = acc.find(
        (m) =>
          m.name.toLowerCase().includes(med.name.toLowerCase().substring(0, 10)) ||
          med.name.toLowerCase().includes(m.name.toLowerCase().substring(0, 10))
      );
      if (!existing) {
        acc.push(med);
      }
      return acc;
    }, []);

    return uniqueMedicines.slice(0, 10);
  };

  const processPrescription = async (file?: File, text?: string) => {
    setIsProcessingPrescription(true);
    setIdentifiedMedicines([]);

    try {
      let extractedText = '';

      if (file) {
        if (file.type === 'application/pdf') {
          extractedText = await extractTextFromPDF(file);
        } else if (file.type.startsWith('image/')) {
          extractedText = await extractTextFromImage(file);
        }
      }

      if (text && text.trim()) {
        extractedText += '\n' + text;
      }

      if (!extractedText.trim()) {
        toast.error('Nenhum texto encontrado na receita');
        return;
      }

      setPrescriptionText(extractedText);
      const parsed = parsePrescriptionText(extractedText);
      setIdentifiedMedicines(parsed);

      if (parsed.length > 0) {
        toast.success(`Encontrados ${parsed.length} medicamento(s) na receita`);
      } else {
        toast.success('Texto extraído. Adicione os medicamentos manualmente.');
      }
    } catch (error) {
      console.error('Erro ao processar receita:', error);
      toast.error('Erro ao processar a receita');
    } finally {
      setIsProcessingPrescription(false);
    }
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (file.size > 10 * 1024 * 1024) {
      toast.error('Arquivo muito grande (máximo 10MB)');
      return;
    }

    const validTypes = ['application/pdf', 'image/jpeg', 'image/png', 'image/webp'];
    if (!validTypes.includes(file.type)) {
      toast.error('Tipo de arquivo inválido. Use PDF, JPG, PNG ou WEBP');
      return;
    }

    const reader = new FileReader();
    reader.onload = (e) => {
      if (file.type.startsWith('image/')) {
        setPrescriptionPreview(e.target?.result as string);
      } else {
        setPrescriptionPreview(null);
      }
    };
    reader.readAsDataURL(file);

    await processPrescription(file);
  };

  const handleManualTextProcess = () => {
    processPrescription(undefined, prescriptionText);
  };

  const addIdentifiedToForm = (med: IdentifiedMedicine) => {
    const f = formRef.current;
    if (!f) return;

    const medicineSelect = f.elements.namedItem('medicineId') as HTMLSelectElement;
    if (medicineSelect) {
      const match = medicines.find(
        (m) =>
          m.name.toLowerCase().includes(med.name.toLowerCase().substring(0, 10)) ||
          med.name.toLowerCase().includes(m.name.toLowerCase().substring(0, 10))
      );
      if (match) {
        medicineSelect.value = match.id;
        const qtyInput = f.elements.namedItem('quantity') as HTMLInputElement;
        if (qtyInput) qtyInput.value = String(med.quantity);
        toast.success(`${match.name} adicionado ao formulário`);
      } else {
        toast.error(`Medicamento "${med.name}" não encontrado no catálogo`);
      }
    }
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
      items: [
        {
          medicineId: p.medicineId,
          quantity: Number(p.quantity),
          tabletsPerDay: p.tabletsPerDay ? Number(p.tabletsPerDay) : undefined,
          tabletsPerPackage: p.tabletsPerPackage ? Number(p.tabletsPerPackage) : undefined,
          treatmentDays: p.treatmentDays ? Number(p.treatmentDays) : undefined,
        },
      ],
      recurring:
        p.recurringEnabled === 'on'
          ? { discountPercent: Number(p.discountPercent || 0), nextBillingDate: p.nextBillingDate }
          : undefined,
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
      <div className="dashboard-header">
        <h2>Nova compra</h2>
      </div>

      <div className="panel">
        <div className="prescription-section">
          <h3>
            <i className="ph ph-prescription"></i> Leitura de Receita
          </h3>

          <div className="prescription-upload-area">
            <input
              ref={fileInputRef}
              type="file"
              accept=".pdf,image/*"
              onChange={handleFileUpload}
              style={{ display: 'none' }}
            />

            <div className="prescription-dropzone" onClick={() => fileInputRef.current?.click()}>
              <i className="ph ph-file-pdf" style={{ fontSize: '48px', color: 'var(--primary)' }}></i>
              <p>Arraste ou clique para enviar PDF ou imagem da receita</p>
              <small>Formatos: PDF, JPG, PNG, WEBP (máx. 10MB)</small>
            </div>

            {prescriptionPreview && (
              <div className="prescription-preview">
                <img src={prescriptionPreview} alt="Preview da receita" />
              </div>
            )}
          </div>

          <div className="prescription-text-area">
            <label>Ou digite/paste o texto da receita:</label>
            <textarea
              value={prescriptionText}
              onChange={(e) => setPrescriptionText(e.target.value)}
              placeholder="Cole aqui o texto da receita ou descreva os medicamentos..."
              rows={4}
            />
            <button
              type="button"
              onClick={handleManualTextProcess}
              disabled={isProcessingPrescription || !prescriptionText.trim()}
              className="process-btn"
            >
              {isProcessingPrescription ? (
                <>
                  <i className="ph ph-spinner"></i> Processando...
                </>
              ) : (
                <>
                  <i className="ph ph-magnifying-glass"></i> Identificar medicamentos
                </>
              )}
            </button>
          </div>

          {identifiedMedicines.length > 0 && (
            <div className="identified-medicines">
              <h4>
                <i className="ph ph-check-circle"></i> Medicamentos identificados ({identifiedMedicines.length})
              </h4>
              <div className="medicine-list">
                {identifiedMedicines.map((med, idx) => (
                  <div key={idx} className="medicine-item">
                    <div className="medicine-info">
                      <strong>{med.name}</strong>
                      <span>Qtd: {med.quantity}</span>
                    </div>
                    <button
                      type="button"
                      className="add-to-form-btn"
                      onClick={() => addIdentifiedToForm(med)}
                      title="Adicionar ao formulário"
                    >
                      <i className="ph ph-plus"></i>
                    </button>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        <form ref={formRef} onSubmit={handleSubmit} className="grid-form">
          <select name="customerId" onChange={(e) => handleCustomerChange(e.target.value)}>
            <option value="">Selecione um paciente</option>
            {customers.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name} • {c.patientCode || c.phone}
              </option>
            ))}
          </select>

          <input name="patientName" placeholder="Paciente" required readOnly value={selectedCustomer?.name || ''} />
          <input
            name="email"
            type="email"
            placeholder="E-mail"
            required
            readOnly
            value={selectedCustomer?.email || ''}
          />
          <input name="phone" placeholder="Telefone" required readOnly value={selectedCustomer?.phone || ''} />
          <input name="address" placeholder="Endereço" required readOnly value={selectedCustomer?.address || ''} />
          <input
            name="patientCode"
            placeholder="Código do paciente"
            readOnly
            value={selectedCustomer?.patientCode || ''}
          />
          <input
            name="insuranceCardCode"
            placeholder="Carteirinha"
            readOnly
            value={selectedCustomer?.insuranceCardCode || ''}
          />
          <input
            name="healthPlanName"
            placeholder="Plano"
            readOnly
            value={healthPlans.find((p) => p.id === selectedCustomer?.healthPlanId)?.name || ''}
          />
          <input
            name="doctorName"
            placeholder="Médico"
            readOnly
            value={doctors.find((d) => d.id === selectedCustomer?.doctorId)?.name || ''}
          />
          <input name="diseaseCid" placeholder="CID" readOnly value={selectedCustomer?.diseaseCid || ''} />

          <select name="medicineId" required>
            {medicines.map((m) => (
              <option key={m.id} value={m.id}>
                {m.name} ({money(m.price)})
              </option>
            ))}
          </select>
          <input name="quantity" type="number" min="1" defaultValue={1} required onInput={calcForecast} />
          <input
            name="tabletsPerDay"
            type="number"
            min="0.1"
            step="0.1"
            placeholder="Comprimidos por dia"
            onInput={calcForecast}
          />
          <input
            name="tabletsPerPackage"
            type="number"
            min="1"
            step="1"
            defaultValue={30}
            placeholder="Comprimidos por caixa"
            onInput={calcForecast}
          />
          <input
            name="treatmentDays"
            type="number"
            min="1"
            step="1"
            placeholder="Dias de tratamento"
            onInput={calcForecast}
          />
          <input name="prescriptionCode" placeholder="Código da receita (controlados)" />
          <label className="controlled-toggle">
            <input type="checkbox" name="recurringEnabled" />
            <span>Compra recorrente</span>
          </label>
          <input name="discountPercent" type="number" min="0" max="100" defaultValue={5} />
          <input name="nextBillingDate" type="date" />
          <button type="submit">Registrar</button>
        </form>

        {eligibility && (
          <div
            className="card"
            style={{
              marginTop: 16,
              borderLeft: eligibility.canOrderThisMonth ? '4px solid var(--accent)' : '4px solid var(--danger)',
            }}
          >
            <strong>Elegibilidade:</strong>{' '}
            {eligibility.canOrderThisMonth
              ? 'Paciente apto para novo pedido nesta competência.'
              : `Bloqueado. Próxima data: ${eligibility.nextEligibleDate || '-'}`}
          </div>
        )}

        {forecast && (
          <div className="card" style={{ marginTop: 12 }}>
            <strong>Previsão para orientação ao cliente</strong>
            <br />
            Necessário: <strong>{forecast.needed}</strong> comprimidos (~<strong>{forecast.boxes}</strong> caixas).
            <br />
            Cobra cerca de <strong>{forecast.covered}</strong> dias.
          </div>
        )}
      </div>
    </>
  );
}
