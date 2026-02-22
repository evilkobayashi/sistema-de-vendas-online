export type Role = 'admin' | 'gerente' | 'operador';

export type Permission =
  | 'confirmar_recorrencia'
  | 'atualizar_entregas'
  | 'acessar_dados_operacionais_sensiveis';

export const permissionsByRole: Record<Role, readonly Permission[]> = {
  admin: [
    'confirmar_recorrencia',
    'atualizar_entregas',
    'acessar_dados_operacionais_sensiveis',
  ],
  gerente: ['confirmar_recorrencia', 'atualizar_entregas'],
  operador: ['confirmar_recorrencia'],
};

export function hasPermission(role: Role, permission: Permission): boolean {
  return permissionsByRole[role].includes(permission);
}
