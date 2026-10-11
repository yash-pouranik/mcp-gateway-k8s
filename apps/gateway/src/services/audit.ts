import { prisma } from '../db.js';

interface AuditLogParams {
  userId?: string | null;
  serverId?: string | null;
  toolName: string;
  inputSummary: Record<string, any>;
  durationMs: number;
  success: boolean;
  errorMsg?: string | null;
}

export async function recordAuditLog(params: AuditLogParams): Promise<void> {
  try {
    await prisma.auditLog.create({
      data: {
        userId: params.userId || null,
        serverId: params.serverId || null,
        toolName: params.toolName,
        inputSummary: params.inputSummary,
        durationMs: Math.max(0, Math.round(params.durationMs)),
        success: params.success,
        errorMsg: params.errorMsg || null,
      },
    });
  } catch (err) {
    console.error('Failed to write audit log:', err);
  }
}
