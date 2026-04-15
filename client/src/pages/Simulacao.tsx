import SimulationPanel from '../components/SimulationPanel';

export default function Simulacao() {
  return (
    <>
      <div className="dashboard-header">
        <h2>Simulador de Operações</h2>
        <p style={{ fontSize: 14, color: 'var(--text-muted)', margin: 0 }}>
          Simule atividades de operadores para visualizar o sistema em tempo real
        </p>
      </div>

      <SimulationPanel />
    </>
  );
}
