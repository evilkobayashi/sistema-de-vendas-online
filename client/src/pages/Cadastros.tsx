import { useEffect, useState } from 'react';
import api from '../api';
import toast from 'react-hot-toast';

export default function Cadastros() {
  const [stats, setStats] = useState<any>({});
  const [loading, setLoading] = useState(true);

  const load = async () => {
    const [emp, sup, fp, rm, sf, pf] = await Promise.all([
      api.get('/employees'), api.get('/suppliers'), api.get('/finished-products'),
      api.get('/raw-materials'), api.get('/standard-formulas'), api.get('/packaging-formulas'),
    ]) as any[];
    setStats({
      employees: Array.isArray(emp.items) ? emp.items.length : 0,
      suppliers: Array.isArray(sup.items) ? sup.items.length : 0,
      finishedProducts: Array.isArray(fp.items) ? fp.items.length : 0,
      rawMaterials: Array.isArray(rm.items) ? rm.items.length : 0,
      standardFormulas: Array.isArray(sf.items) ? sf.items.length : 0,
      packagingFormulas: Array.isArray(pf.items) ? pf.items.length : 0,
    });
    setLoading(false);
  };

  useEffect(() => { load(); }, []);

  const submit = (endpoint: string) => async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const payload: any = Object.fromEntries(new FormData(e.currentTarget).entries());
    // Convert numeric fields
    if (payload.price) payload.price = Number(payload.price);
    if (payload.cost) payload.cost = Number(payload.cost);
    if (payload.unitsPerPackage) payload.unitsPerPackage = Number(payload.unitsPerPackage);
    await api.post(endpoint, payload);
    toast.success('Cadastro salvo!');
    e.currentTarget.reset();
    load();
  };

  if (loading) return <div className="empty">Carregando cadastros...</div>;

  return (
    <>
      <div className="dashboard-header">
        <h2>Cadastros Mestres</h2>
      </div>

      <div className="kpis-grid">
        <div className="kpi-card" style={{ background: 'linear-gradient(135deg, #0ea5e9, #0284c7)' }}>
          <div className="kpi-header">
            <i className="ph ph-users-three" style={{ fontSize: '24px', color: 'white' }}></i>
            <div className="kpi-label" style={{ color: 'rgba(255,255,255,0.9)' }}>Funcionários</div>
          </div>
          <div className="kpi-value" style={{ color: 'white', fontSize: '28px', fontWeight: '700' }}>
            {stats.employees ?? 0}
          </div>
        </div>

        <div className="kpi-card" style={{ background: 'linear-gradient(135deg, #8b5cf6, #7c3aed)' }}>
          <div className="kpi-header">
            <i className="ph ph-buildings" style={{ fontSize: '24px', color: 'white' }}></i>
            <div className="kpi-label" style={{ color: 'rgba(255,255,255,0.9)' }}>Fornecedores</div>
          </div>
          <div className="kpi-value" style={{ color: 'white', fontSize: '28px', fontWeight: '700' }}>
            {stats.suppliers ?? 0}
          </div>
        </div>

        <div className="kpi-card" style={{ background: 'linear-gradient(135deg, #10b981, #059669)' }}>
          <div className="kpi-header">
            <i className="ph ph-package" style={{ fontSize: '24px', color: 'white' }}></i>
            <div className="kpi-label" style={{ color: 'rgba(255,255,255,0.9)' }}>Produtos acabados</div>
          </div>
          <div className="kpi-value" style={{ color: 'white', fontSize: '28px', fontWeight: '700' }}>
            {stats.finishedProducts ?? 0}
          </div>
        </div>

        <div className="kpi-card" style={{ background: 'linear-gradient(135deg, #f59e0b, #d97706)' }}>
          <div className="kpi-header">
            <i className="ph ph-dna" style={{ fontSize: '24px', color: 'white' }}></i>
            <div className="kpi-label" style={{ color: 'rgba(255,255,255,0.9)' }}>Matérias-primas</div>
          </div>
          <div className="kpi-value" style={{ color: 'white', fontSize: '28px', fontWeight: '700' }}>
            {stats.rawMaterials ?? 0}
          </div>
        </div>

        <div className="kpi-card" style={{ background: 'linear-gradient(135deg, #ec4899, #db2777)' }}>
          <div className="kpi-header">
            <i className="ph ph-file-text" style={{ fontSize: '24px', color: 'white' }}></i>
            <div className="kpi-label" style={{ color: 'rgba(255,255,255,0.9)' }}>Fórmulas padrão</div>
          </div>
          <div className="kpi-value" style={{ color: 'white', fontSize: '28px', fontWeight: '700' }}>
            {stats.standardFormulas ?? 0}
          </div>
        </div>

        <div className="kpi-card" style={{ background: 'linear-gradient(135deg, #6366f1, #4f46e5)' }}>
          <div className="kpi-header">
            <i className="ph ph-package" style={{ fontSize: '24px', color: 'white' }}></i>
            <div className="kpi-label" style={{ color: 'rgba(255,255,255,0.9)' }}>Fórmulas embalagem</div>
          </div>
          <div className="kpi-value" style={{ color: 'white', fontSize: '28px', fontWeight: '700' }}>
            {stats.packagingFormulas ?? 0}
          </div>
        </div>
      </div>

      <div className="panel">
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, minmax(280px, 1fr))', gap: 16, marginTop: 16 }}>
          <form onSubmit={submit('/employees')} className="grid-form card">
            <h3>Funcionários</h3>
            <input name="name" placeholder="Nome" required/><input name="role" placeholder="Função" required/>
            <input name="employeeCode" placeholder="Código" required/><input name="email" type="email" placeholder="E-mail" required/>
            <input name="phone" placeholder="Telefone" required/><button type="submit">Salvar</button>
          </form>
          <form onSubmit={submit('/suppliers')} className="grid-form card">
            <h3>Fornecedores</h3>
            <input name="name" placeholder="Nome" required/><input name="document" placeholder="CNPJ/Documento" required/>
            <input name="email" type="email" placeholder="E-mail" required/><input name="phone" placeholder="Telefone" required/>
            <input name="category" placeholder="Categoria" required/><button type="submit">Salvar</button>
          </form>
          <form onSubmit={submit('/finished-products')} className="grid-form card">
            <h3>Produtos Acabados</h3>
            <input name="name" placeholder="Nome" required/>
            <select name="productType"><option value="acabado">Acabado</option><option value="revenda">Revenda</option></select>
            <input name="sku" placeholder="SKU" required/><input name="unit" placeholder="Unidade" required/>
            <input name="price" type="number" step="0.01" min="0.01" placeholder="Preço" required/><button type="submit">Salvar</button>
          </form>
          <form onSubmit={submit('/raw-materials')} className="grid-form card">
            <h3>Matéria-prima</h3>
            <input name="name" placeholder="Nome" required/><input name="code" placeholder="Código" required/>
            <input name="unit" placeholder="Unidade" required/><input name="cost" type="number" step="0.01" min="0.01" placeholder="Custo" required/>
            <button type="submit">Salvar</button>
          </form>
          <form onSubmit={submit('/standard-formulas')} className="grid-form card">
            <h3>Fórmulas Padrão</h3>
            <input name="name" placeholder="Nome" required/><input name="version" placeholder="Versão" required/>
            <input name="productId" placeholder="ID do produto" required/><input name="instructions" placeholder="Instruções" required/>
            <button type="submit">Salvar</button>
          </form>
          <form onSubmit={submit('/packaging-formulas')} className="grid-form card">
            <h3>Fórmulas de Embalagem</h3>
            <input name="name" placeholder="Nome" required/><input name="productId" placeholder="ID do produto" required/>
            <input name="packagingType" placeholder="Tipo de embalagem" required/><input name="unitsPerPackage" type="number" min="1" placeholder="Unidades/emb." required/>
            <input name="notes" placeholder="Observações" required/><button type="submit">Salvar</button>
          </form>
        </div>
      </div>
    </>
  );
}
