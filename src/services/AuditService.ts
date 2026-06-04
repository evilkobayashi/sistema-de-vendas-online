// src/services/AuditService.ts
import { Request } from 'express';

export interface AuditEvent {
  id: string;
  userId: string;
  userName: string;
  action: string;
  resource: string;
  resourceId?: string;
  details: Record<string, unknown>;
  timestamp: string;
  ip: string;
  userAgent: string;
}

class AuditService {
  private auditLog: AuditEvent[] = [];

  public logAction(
    req: Request,
    userId: string,
    userName: string,
    action: string,
    resource: string,
    resourceId?: string,
    details: Record<string, unknown> = {}
  ): void {
    const auditEvent: AuditEvent = {
      id: `audit-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      userId,
      userName,
      action,
      resource,
      resourceId,
      details,
      timestamp: new Date().toISOString(),
      ip: req.ip || 'unknown',
      userAgent: req.get('User-Agent') || 'unknown'
    };

    this.auditLog.push(auditEvent);

    // Em um sistema real, isso seria gravado em um banco de dados dedicado ou serviço de logs
    console.log(`AUDIT: ${JSON.stringify(auditEvent)}`);
  }

  public getAuditTrail(userId?: string, action?: string, limit: number = 100): AuditEvent[] {
    let filtered = this.auditLog;

    if (userId) {
      filtered = filtered.filter(event => event.userId === userId);
    }

    if (action) {
      filtered = filtered.filter(event => event.action === action);
    }

    return filtered.slice(-limit).reverse(); // Retorna os mais recentes
  }
}

export const auditService = new AuditService();