export class InternalNotifier {
  constructor(channels = []) {
    this.channels = channels;
  }

  async notify(payload) {
    const results = [];
    for (const channel of this.channels) {
      const delivery = await channel.send(payload);
      results.push(delivery ?? { channel: channel.name, status: 'sent' });
    }
    return results;
  }
}

export const consoleChannels = [
  {
    name: 'email',
    send: async ({ collaboratorId, order }) => {
      console.log(`[email] Aviso enviado para ${collaboratorId} sobre pedido ${order.id}`);
      return { channel: 'email', status: 'sent' };
    }
  },
  {
    name: 'teams',
    send: async ({ collaboratorId, order }) => {
      console.log(`[teams] Aviso enviado para ${collaboratorId} sobre pedido ${order.id}`);
      return { channel: 'teams', status: 'sent' };
    }
  },
  {
    name: 'slack',
    send: async ({ collaboratorId, order }) => {
      console.log(`[slack] Aviso enviado para ${collaboratorId} sobre pedido ${order.id}`);
      return { channel: 'slack', status: 'sent' };
    }
  },
  {
    name: 'task-system',
    send: async ({ collaboratorId, order }) => {
      console.log(`[task-system] Tarefa criada para ${collaboratorId} no pedido ${order.id}`);
      return { channel: 'task-system', status: 'sent' };
    }
  }
];
