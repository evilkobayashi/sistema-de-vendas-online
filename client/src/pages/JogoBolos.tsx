import { useMemo, useState } from 'react';

import '../App.css';

type IngredienteId = 'farinha' | 'ovos' | 'leite' | 'acucar' | 'chocolate';
type UtensilioId = 'forma' | 'batedeira' | 'forno' | 'fouet' | 'espatula';
type FeedbackTipo = 'info' | 'success' | 'warning' | 'danger';

type Feedback = {
  tipo: FeedbackTipo;
  texto: string;
};

interface Ingrediente {
  id: IngredienteId;
  nome: string;
  emoji: string;
  preco: number;
}

interface Utensilio {
  id: UtensilioId;
  nome: string;
  emoji: string;
  preco: number;
}

interface Receita {
  id: string;
  nome: string;
  emoji: string;
  descricao: string;
  precoVenda: number;
  ingredientes: Record<IngredienteId, number>;
  utensilios: UtensilioId[];
}

interface Competicao {
  id: string;
  nome: string;
  rival: string;
  emoji: string;
  receitaId: string;
  dificuldade: number;
  premioMoedas: number;
  premioTrofeus: number;
}

interface Funcionario {
  id: string;
  nome: string;
  cargo: string;
  emoji: string;
  salarioContratacao: number;
  producaoExtra: number;
  pontosCompeticao: number;
  descricao: string;
}

interface PedidoCliente {
  id: string;
  cliente: string;
  emoji: string;
  receitaId: string;
  quantidade: number;
  gorjeta: number;
  paciencia: number;
}

const ingredientesCatalogo: Ingrediente[] = [
  { id: 'farinha', nome: 'Farinha', emoji: '🌾', preco: 4 },
  { id: 'ovos', nome: 'Ovos', emoji: '🥚', preco: 3 },
  { id: 'leite', nome: 'Leite', emoji: '🥛', preco: 5 },
  { id: 'acucar', nome: 'Açúcar', emoji: '🍚', preco: 4 },
  { id: 'chocolate', nome: 'Chocolate', emoji: '🍫', preco: 7 },
];

const utensiliosCatalogo: Utensilio[] = [
  { id: 'forma', nome: 'Forma', emoji: '🥧', preco: 18 },
  { id: 'batedeira', nome: 'Batedeira', emoji: '⚙️', preco: 36 },
  { id: 'forno', nome: 'Forno', emoji: '🔥', preco: 48 },
  { id: 'fouet', nome: 'Fouet', emoji: '🥄', preco: 14 },
  { id: 'espatula', nome: 'Espátula', emoji: '🍴', preco: 12 },
];

const receitas: Receita[] = [
  {
    id: 'simples',
    nome: 'Bolo Simples',
    emoji: '🍰',
    descricao: 'Receita inicial perfeita para começar a confeitaria.',
    precoVenda: 34,
    ingredientes: { farinha: 2, ovos: 2, leite: 1, acucar: 1, chocolate: 0 },
    utensilios: ['forma', 'forno', 'fouet'],
  },
  {
    id: 'chocolate',
    nome: 'Bolo de Chocolate',
    emoji: '🎂',
    descricao: 'Mais caro, exige chocolate e uma mistura bem cremosa.',
    precoVenda: 58,
    ingredientes: { farinha: 2, ovos: 3, leite: 1, acucar: 2, chocolate: 2 },
    utensilios: ['forma', 'forno', 'batedeira', 'espatula'],
  },
  {
    id: 'premium',
    nome: 'Bolo Premium da Casa',
    emoji: '🧁',
    descricao: 'Combina todos os equipamentos para maior lucro por venda.',
    precoVenda: 82,
    ingredientes: { farinha: 3, ovos: 3, leite: 2, acucar: 2, chocolate: 3 },
    utensilios: ['forma', 'forno', 'batedeira', 'fouet', 'espatula'],
  },
];

const competicoes: Competicao[] = [
  {
    id: 'bairro',
    nome: 'Festival do Bairro',
    rival: 'Dona Cacau',
    emoji: '🏅',
    receitaId: 'simples',
    dificuldade: 8,
    premioMoedas: 45,
    premioTrofeus: 1,
  },
  {
    id: 'confeiteiros',
    nome: 'Duelo dos Confeiteiros',
    rival: 'Chef Brigadeiro',
    emoji: '🏆',
    receitaId: 'chocolate',
    dificuldade: 16,
    premioMoedas: 85,
    premioTrofeus: 2,
  },
  {
    id: 'nacional',
    nome: 'Copa Nacional de Bolos',
    rival: 'Mestre Ganache',
    emoji: '👑',
    receitaId: 'premium',
    dificuldade: 28,
    premioMoedas: 150,
    premioTrofeus: 4,
  },
];

const funcionariosCatalogo: Funcionario[] = [
  {
    id: 'ajudante',
    nome: 'Lia',
    cargo: 'Ajudante de cozinha',
    emoji: '🧑‍🍳',
    salarioContratacao: 40,
    producaoExtra: 1,
    pontosCompeticao: 3,
    descricao: 'Prepara um bolo extra por rodada e ajuda na apresentação.',
  },
  {
    id: 'decorador',
    nome: 'Nico',
    cargo: 'Decorador',
    emoji: '🎨',
    salarioContratacao: 65,
    producaoExtra: 1,
    pontosCompeticao: 7,
    descricao: 'Capricha nos detalhes para impressionar jurados.',
  },
  {
    id: 'gerente',
    nome: 'Mara',
    cargo: 'Gerente da confeitaria',
    emoji: '📋',
    salarioContratacao: 90,
    producaoExtra: 2,
    pontosCompeticao: 10,
    descricao: 'Organiza a equipe e acelera a produção em escala.',
  },
];

const pedidosBase: Omit<PedidoCliente, 'id'>[] = [
  { cliente: 'Ana da floricultura', emoji: '💐', receitaId: 'simples', quantidade: 1, gorjeta: 8, paciencia: 3 },
  { cliente: 'Sr. Bento', emoji: '🧓', receitaId: 'chocolate', quantidade: 1, gorjeta: 14, paciencia: 2 },
  { cliente: 'Escola do bairro', emoji: '🎒', receitaId: 'simples', quantidade: 2, gorjeta: 18, paciencia: 4 },
  { cliente: 'Influencer Mel', emoji: '📸', receitaId: 'premium', quantidade: 1, gorjeta: 30, paciencia: 2 },
];

const criarPedidosDoDia = (dia: number, reputacao: number): PedidoCliente[] => {
  const totalPedidos = Math.min(4, 2 + Math.floor(reputacao / 35));

  return Array.from({ length: totalPedidos }, (_, index) => {
    const base = pedidosBase[(dia + index - 1) % pedidosBase.length];
    return {
      ...base,
      id: `dia-${dia}-pedido-${index + 1}`,
      gorjeta: base.gorjeta + Math.floor(reputacao / 20),
    };
  });
};

const estoqueInicial: Record<IngredienteId, number> = {
  farinha: 2,
  ovos: 2,
  leite: 1,
  acucar: 1,
  chocolate: 0,
};

const utensiliosIniciais: Record<UtensilioId, boolean> = {
  forma: true,
  batedeira: false,
  forno: false,
  fouet: true,
  espatula: false,
};

const formatarMoedas = (valor: number) => `${valor} moedas`;

function criarFeedback(tipo: FeedbackTipo, texto: string): Feedback {
  return { tipo, texto };
}

export default function JogoBolos() {
  const [moedas, setMoedas] = useState(160);
  const [trofeus, setTrofeus] = useState(0);
  const [dia, setDia] = useState(1);
  const [reputacao, setReputacao] = useState(12);
  const [clientesAtendidos, setClientesAtendidos] = useState(0);
  const [ingredientes, setIngredientes] = useState<Record<IngredienteId, number>>(estoqueInicial);
  const [ingredientesIlimitados, setIngredientesIlimitados] = useState(true);
  const [utensilios, setUtensilios] = useState<Record<UtensilioId, boolean>>(utensiliosIniciais);
  const [receitaSelecionadaId, setReceitaSelecionadaId] = useState(receitas[0].id);
  const [bolosProntos, setBolosProntos] = useState<Record<string, number>>({});
  const [funcionarios, setFuncionarios] = useState<Record<string, number>>({});
  const [pedidos, setPedidos] = useState<PedidoCliente[]>(() => criarPedidosDoDia(1, 12));
  const [feedback, setFeedback] = useState(
    criarFeedback('info', 'Ingredientes ilimitados estão ativos. Contrate funcionários e dispute competições para ganhar troféus.'),
  );

  const receitaSelecionada = useMemo(
    () => receitas.find((receita) => receita.id === receitaSelecionadaId) ?? receitas[0],
    [receitaSelecionadaId],
  );

  const totalFuncionarios = useMemo(
    () => Object.values(funcionarios).reduce((total, quantidade) => total + quantidade, 0),
    [funcionarios],
  );

  const bolosExtrasPorRodada = useMemo(
    () => funcionariosCatalogo.reduce((total, funcionario) => total + (funcionarios[funcionario.id] ?? 0) * funcionario.producaoExtra, 0),
    [funcionarios],
  );

  const pontosEquipe = useMemo(
    () => funcionariosCatalogo.reduce((total, funcionario) => total + (funcionarios[funcionario.id] ?? 0) * funcionario.pontosCompeticao, 0),
    [funcionarios],
  );

  const capacidadeProducao = 1 + bolosExtrasPorRodada;
  const custoDiario = 12 + totalFuncionarios * 9;
  const pedidosPendentes = pedidos.length;

  const comprarIngrediente = (ingrediente: Ingrediente) => {
    if (ingredientesIlimitados) {
      setIngredientes((estoque) => ({ ...estoque, [ingrediente.id]: estoque[ingrediente.id] + 10 }));
      setFeedback(criarFeedback('success', `${ingrediente.nome} reabastecido com +10 unidades. O modo sem limites continua ativo.`));
      return;
    }

    if (moedas < ingrediente.preco) {
      setFeedback(criarFeedback('danger', `Dinheiro insuficiente para comprar ${ingrediente.nome}.`));
      return;
    }

    setMoedas((valor) => valor - ingrediente.preco);
    setIngredientes((estoque) => ({ ...estoque, [ingrediente.id]: estoque[ingrediente.id] + 1 }));
    setFeedback(criarFeedback('success', `${ingrediente.nome} comprado e adicionado ao estoque.`));
  };

  const alternarIngredientesIlimitados = () => {
    setIngredientesIlimitados((ativo) => !ativo);
    setFeedback(
      criarFeedback(
        'info',
        ingredientesIlimitados
          ? 'Ingredientes ilimitados desativados. Agora o preparo volta a consumir estoque.'
          : 'Ingredientes ilimitados ativados. Prepare bolos sem bloquear por estoque.',
      ),
    );
  };

  const comprarUtensilio = (utensilio: Utensilio) => {
    if (utensilios[utensilio.id]) {
      setFeedback(criarFeedback('info', `${utensilio.nome} já está disponível na cozinha.`));
      return;
    }

    if (moedas < utensilio.preco) {
      setFeedback(criarFeedback('danger', `Dinheiro insuficiente para comprar ${utensilio.nome}.`));
      return;
    }

    setMoedas((valor) => valor - utensilio.preco);
    setUtensilios((cozinha) => ({ ...cozinha, [utensilio.id]: true }));
    setFeedback(criarFeedback('success', `${utensilio.nome} comprado para a cozinha.`));
  };

  const contratarFuncionario = (funcionario: Funcionario) => {
    if (moedas < funcionario.salarioContratacao) {
      setFeedback(criarFeedback('danger', `Dinheiro insuficiente para contratar ${funcionario.nome}.`));
      return;
    }

    setMoedas((valor) => valor - funcionario.salarioContratacao);
    setFuncionarios((equipe) => ({ ...equipe, [funcionario.id]: (equipe[funcionario.id] ?? 0) + 1 }));
    setFeedback(
      criarFeedback(
        'success',
        `${funcionario.nome} contratado(a)! Sua confeitaria agora tem ${totalFuncionarios + 1} funcionário(s).`,
      ),
    );
  };

  const selecionarReceita = (receitaId: string) => {
    const receita = receitas.find((item) => item.id === receitaId);
    if (!receita) return;

    setReceitaSelecionadaId(receita.id);
    setFeedback(criarFeedback('info', `${receita.nome} selecionado. Confira os requisitos antes de preparar.`));
  };

  const validarUtensilios = (receita: Receita) => {
    const utensiliosFaltantes = receita.utensilios.filter((utensilio) => !utensilios[utensilio]);
    if (utensiliosFaltantes.length === 0) return true;

    const nomes = utensiliosFaltantes.map((id) => utensiliosCatalogo.find((item) => item.id === id)?.nome ?? id);
    setFeedback(criarFeedback('warning', `Utensílio obrigatório ausente: ${nomes.join(', ')}.`));
    return false;
  };

  const validarIngredientes = (receita: Receita) => {
    if (ingredientesIlimitados) return true;

    const ingredientesFaltantes = ingredientesCatalogo
      .filter((ingrediente) => ingredientes[ingrediente.id] < receita.ingredientes[ingrediente.id])
      .map((ingrediente) => ingrediente.nome);

    if (ingredientesFaltantes.length === 0) return true;

    setFeedback(criarFeedback('warning', `Ingrediente faltando: ${ingredientesFaltantes.join(', ')}.`));
    return false;
  };

  const consumirIngredientes = (receita: Receita) => {
    if (ingredientesIlimitados) return;

    setIngredientes((estoque) => {
      const proximoEstoque = { ...estoque };
      ingredientesCatalogo.forEach((ingrediente) => {
        proximoEstoque[ingrediente.id] -= receita.ingredientes[ingrediente.id];
      });
      return proximoEstoque;
    });
  };

  const prepararBolo = () => {
    if (!validarUtensilios(receitaSelecionada) || !validarIngredientes(receitaSelecionada)) return;

    consumirIngredientes(receitaSelecionada);
    setBolosProntos((bolos) => ({
      ...bolos,
      [receitaSelecionada.id]: (bolos[receitaSelecionada.id] ?? 0) + capacidadeProducao,
    }));
    setFeedback(
      criarFeedback(
        'success',
        `${receitaSelecionada.nome} feito com sucesso! A equipe produziu ${capacidadeProducao} bolo(s).`,
      ),
    );
  };

  const venderBolo = () => {
    const quantidade = bolosProntos[receitaSelecionada.id] ?? 0;
    if (quantidade <= 0) {
      setFeedback(criarFeedback('warning', `Prepare um ${receitaSelecionada.nome} antes de vender.`));
      return;
    }

    setBolosProntos((bolos) => ({ ...bolos, [receitaSelecionada.id]: quantidade - 1 }));
    setMoedas((valor) => valor + receitaSelecionada.precoVenda);
    setReputacao((valor) => Math.min(100, valor + 1));
    setFeedback(criarFeedback('success', `Venda de balcão concluída! Você recebeu ${formatarMoedas(receitaSelecionada.precoVenda)}.`));
  };

  const atenderPedido = (pedido: PedidoCliente) => {
    const receitaPedido = receitas.find((receita) => receita.id === pedido.receitaId) ?? receitas[0];
    const quantidadePronta = bolosProntos[pedido.receitaId] ?? 0;

    if (quantidadePronta < pedido.quantidade) {
      setFeedback(
        criarFeedback(
          'warning',
          `${pedido.cliente} ainda espera ${pedido.quantidade} ${receitaPedido.nome}. Prepare mais bolos para entregar o pedido.`,
        ),
      );
      return;
    }

    const valorPedido = receitaPedido.precoVenda * pedido.quantidade + pedido.gorjeta;
    setBolosProntos((bolos) => ({ ...bolos, [pedido.receitaId]: quantidadePronta - pedido.quantidade }));
    setPedidos((fila) => fila.filter((item) => item.id !== pedido.id));
    setMoedas((valor) => valor + valorPedido);
    setReputacao((valor) => Math.min(100, valor + 4 + pedido.paciencia));
    setClientesAtendidos((valor) => valor + 1);
    setFeedback(criarFeedback('success', `Pedido entregue para ${pedido.cliente}! Receita + gorjeta: ${formatarMoedas(valorPedido)}.`));
  };

  const abrirNovoDia = () => {
    const proximoDia = dia + 1;
    const penalidadePedidos = pedidos.length * 3;
    const proximaReputacao = Math.max(0, reputacao - penalidadePedidos);

    setDia(proximoDia);
    setMoedas((valor) => valor - custoDiario);
    setReputacao(proximaReputacao);
    setPedidos(criarPedidosDoDia(proximoDia, proximaReputacao));
    setFeedback(
      criarFeedback(
        penalidadePedidos > 0 ? 'warning' : 'info',
        `Dia ${proximoDia} aberto. Custos pagos: ${formatarMoedas(custoDiario)}${penalidadePedidos > 0 ? `; pedidos atrasados reduziram ${penalidadePedidos} de reputação.` : '.'}`,
      ),
    );
  };

  const participarCompeticao = (competicao: Competicao) => {
    const receitaCompeticao = receitas.find((receita) => receita.id === competicao.receitaId) ?? receitas[0];

    if (!validarUtensilios(receitaCompeticao) || !validarIngredientes(receitaCompeticao)) return;

    const pontosReceita = receitaCompeticao.precoVenda / 4;
    const pontosUtensilios = receitaCompeticao.utensilios.length * 2;
    const pontuacao = Math.round(pontosReceita + pontosUtensilios + pontosEquipe + totalFuncionarios);

    if (pontuacao < competicao.dificuldade) {
      setFeedback(
        criarFeedback(
          'warning',
          `${competicao.rival} venceu por pouco. Pontuação ${pontuacao}/${competicao.dificuldade}; contrate mais funcionários.`,
        ),
      );
      return;
    }

    consumirIngredientes(receitaCompeticao);
    setMoedas((valor) => valor + competicao.premioMoedas);
    setTrofeus((valor) => valor + competicao.premioTrofeus);
    setFeedback(
      criarFeedback(
        'success',
        `Você venceu ${competicao.rival} em ${competicao.nome}! Ganhou ${competicao.premioTrofeus} troféu(s).`,
      ),
    );
  };

  return (
    <div className="cake-game">
      <div className="cake-game__hero">
        <div>
          <span className="tag">Mini-jogo</span>
          <h2>Jogo de Bolos</h2>
          <p>
            Simule uma confeitaria: abra o dia, prepare vitrines, atenda clientes, pague custos e cresça com equipe e troféus.
          </p>
        </div>
        <div className="cake-game__stats" aria-label="Resumo da confeitaria">
          <div className="cake-game__wallet">
            <span>💰</span>
            <strong>{formatarMoedas(moedas)}</strong>
          </div>
          <div className="cake-game__wallet cake-game__wallet--trophy">
            <span>🏆</span>
            <strong>{trofeus} troféu(s)</strong>
          </div>
          <div className="cake-game__wallet cake-game__wallet--day">
            <span>🗓️</span>
            <strong>Dia {dia}</strong>
          </div>
        </div>
      </div>

      <div className={`cake-game__feedback cake-game__feedback--${feedback.tipo}`} role="status">
        {feedback.texto}
      </div>

      <section className="cake-game__bakery-floor" aria-label="Painel da confeitaria">
        <div>
          <span>⭐ Reputação</span>
          <strong>{reputacao}/100</strong>
        </div>
        <div>
          <span>🧾 Pedidos pendentes</span>
          <strong>{pedidosPendentes}</strong>
        </div>
        <div>
          <span>👥 Clientes atendidos</span>
          <strong>{clientesAtendidos}</strong>
        </div>
        <div>
          <span>🏪 Custo diário</span>
          <strong>{formatarMoedas(custoDiario)}</strong>
        </div>
        <button type="button" onClick={abrirNovoDia}>Abrir próximo dia</button>
      </section>

      <section className="cake-game__section cake-game__counter">
        <div className="cake-game__section-title">
          <h3>Balcão de pedidos</h3>
          <span>Entregue encomendas para ganhar reputação e gorjetas</span>
        </div>
        {pedidos.length ? (
          <div className="cake-game__recipe-list">
            {pedidos.map((pedido) => {
              const receitaPedido = receitas.find((receita) => receita.id === pedido.receitaId) ?? receitas[0];
              return (
                <article className="cake-game__recipe" key={pedido.id}>
                  <div className="cake-game__employee-heading">
                    <span>{pedido.emoji}</span>
                    <div>
                      <strong>{pedido.cliente}</strong>
                      <small>{pedido.quantidade}x {receitaPedido.nome} • paciência {pedido.paciencia}</small>
                    </div>
                  </div>
                  <div className="cake-game__requirements">
                    <span>Pagamento: {formatarMoedas(receitaPedido.precoVenda * pedido.quantidade)}</span>
                    <span>Gorjeta: {formatarMoedas(pedido.gorjeta)}</span>
                    <span>Prontos: {bolosProntos[pedido.receitaId] ?? 0}</span>
                  </div>
                  <button type="button" onClick={() => atenderPedido(pedido)}>Entregar pedido</button>
                </article>
              );
            })}
          </div>
        ) : (
          <div className="empty">Todos os pedidos do dia foram atendidos. Abra o próximo dia para receber novos clientes.</div>
        )}
      </section>

      <div className="cake-game__grid">
        <section className="cake-game__section">
          <div className="cake-game__section-title">
            <h3>Ingredientes</h3>
            <span>{ingredientesIlimitados ? 'Modo sem limites ativo' : 'Compre unidades para montar receitas'}</span>
          </div>
          <div className="cake-game__unlimited">
            <strong>{ingredientesIlimitados ? '♾️ Ingredientes ilimitados' : '📦 Estoque limitado'}</strong>
            <button type="button" className="quick-btn" onClick={alternarIngredientesIlimitados}>
              {ingredientesIlimitados ? 'Usar estoque limitado' : 'Ativar sem limites'}
            </button>
          </div>
          <div className="cake-game__items">
            {ingredientesCatalogo.map((ingrediente) => (
              <article className="cake-game__item" key={ingrediente.id}>
                <div>
                  <strong>{ingrediente.emoji} {ingrediente.nome}</strong>
                  <small>Estoque: {ingredientesIlimitados ? '∞' : ingredientes[ingrediente.id]}</small>
                </div>
                <button type="button" onClick={() => comprarIngrediente(ingrediente)}>
                  {ingredientesIlimitados ? 'Reabastecer +10' : `Comprar • ${formatarMoedas(ingrediente.preco)}`}
                </button>
              </article>
            ))}
          </div>
        </section>

        <section className="cake-game__section">
          <div className="cake-game__section-title">
            <h3>Utensílios</h3>
            <span>Itens permanentes para desbloquear bolos</span>
          </div>
          <div className="cake-game__items">
            {utensiliosCatalogo.map((utensilio) => (
              <article className={`cake-game__item ${utensilios[utensilio.id] ? 'cake-game__item--owned' : ''}`} key={utensilio.id}>
                <div>
                  <strong>{utensilio.emoji} {utensilio.nome}</strong>
                  <small>{utensilios[utensilio.id] ? 'Disponível' : `Custa ${formatarMoedas(utensilio.preco)}`}</small>
                </div>
                <button
                  className="quick-btn"
                  type="button"
                  onClick={() => comprarUtensilio(utensilio)}
                  disabled={utensilios[utensilio.id]}
                >
                  {utensilios[utensilio.id] ? 'Comprado' : 'Comprar utensílio'}
                </button>
              </article>
            ))}
          </div>
        </section>
      </div>

      <section className="cake-game__section">
        <div className="cake-game__section-title">
          <h3>Funcionários e expansão</h3>
          <span>{totalFuncionarios} contratado(s) • produção de {capacidadeProducao} bolo(s) por preparo</span>
        </div>
        <div className="cake-game__recipe-list">
          {funcionariosCatalogo.map((funcionario) => (
            <article className="cake-game__recipe" key={funcionario.id}>
              <div className="cake-game__employee-heading">
                <span>{funcionario.emoji}</span>
                <div>
                  <strong>{funcionario.nome}</strong>
                  <small>{funcionario.cargo}</small>
                </div>
              </div>
              <p>{funcionario.descricao}</p>
              <div className="cake-game__requirements">
                <span>+{funcionario.producaoExtra} bolo(s)/preparo</span>
                <span>+{funcionario.pontosCompeticao} pontos</span>
                <span>Na equipe: {funcionarios[funcionario.id] ?? 0}</span>
              </div>
              <button type="button" onClick={() => contratarFuncionario(funcionario)}>
                Contratar • {formatarMoedas(funcionario.salarioContratacao)}
              </button>
            </article>
          ))}
        </div>
      </section>

      <section className="cake-game__section cake-game__recipes">
        <div className="cake-game__section-title">
          <h3>Receitas</h3>
          <span>Selecione, prepare e venda bolos prontos</span>
        </div>
        <div className="cake-game__recipe-list">
          {receitas.map((receita) => (
            <article
              className={`cake-game__recipe ${receita.id === receitaSelecionada.id ? 'cake-game__recipe--selected' : ''}`}
              key={receita.id}
            >
              <button type="button" className="cake-game__recipe-button" onClick={() => selecionarReceita(receita.id)}>
                <span>{receita.emoji}</span>
                <strong>{receita.nome}</strong>
              </button>
              <p>{receita.descricao}</p>
              <div className="cake-game__requirements">
                <strong>Ingredientes:</strong>
                {ingredientesCatalogo
                  .filter((ingrediente) => receita.ingredientes[ingrediente.id] > 0)
                  .map((ingrediente) => (
                    <span key={ingrediente.id}>{ingrediente.nome}: {receita.ingredientes[ingrediente.id]}</span>
                  ))}
              </div>
              <div className="cake-game__requirements">
                <strong>Utensílios:</strong>
                {receita.utensilios.map((id) => (
                  <span key={id}>{utensiliosCatalogo.find((utensilio) => utensilio.id === id)?.nome}</span>
                ))}
              </div>
              <small>Venda: {formatarMoedas(receita.precoVenda)} • Prontos: {bolosProntos[receita.id] ?? 0}</small>
            </article>
          ))}
        </div>

        <div className="cake-game__actions">
          <div>
            <strong>Receita selecionada: {receitaSelecionada.nome}</strong>
            <span>{bolosProntos[receitaSelecionada.id] ?? 0} bolo(s) pronto(s) para venda.</span>
          </div>
          <button type="button" onClick={prepararBolo}>Preparar bolo</button>
          <button type="button" className="quick-btn" onClick={venderBolo}>Vender bolo pronto</button>
        </div>
      </section>

      <section className="cake-game__section cake-game__competitions">
        <div className="cake-game__section-title">
          <h3>Competições de confeitaria</h3>
          <span>Enfrente personagens, ganhe moedas e acumule troféus</span>
        </div>
        <div className="cake-game__recipe-list">
          {competicoes.map((competicao) => {
            const receitaCompeticao = receitas.find((receita) => receita.id === competicao.receitaId) ?? receitas[0];
            return (
              <article className="cake-game__recipe" key={competicao.id}>
                <div className="cake-game__employee-heading">
                  <span>{competicao.emoji}</span>
                  <div>
                    <strong>{competicao.nome}</strong>
                    <small>Rival: {competicao.rival}</small>
                  </div>
                </div>
                <p>Prepare {receitaCompeticao.nome} para superar a dificuldade {competicao.dificuldade}.</p>
                <div className="cake-game__requirements">
                  <span>Prêmio: {formatarMoedas(competicao.premioMoedas)}</span>
                  <span>{competicao.premioTrofeus} troféu(s)</span>
                  <span>Sua força: {Math.round(receitaCompeticao.precoVenda / 4 + receitaCompeticao.utensilios.length * 2 + pontosEquipe + totalFuncionarios)}</span>
                </div>
                <button type="button" onClick={() => participarCompeticao(competicao)}>
                  Competir contra {competicao.rival}
                </button>
              </article>
            );
          })}
        </div>
      </section>
    </div>
  );
}
