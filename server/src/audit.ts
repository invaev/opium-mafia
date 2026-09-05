import { prisma } from './prisma';

export type AuditAction =
  | 'auth.telegram.success'
  | 'auth.telegram.failed'
  | 'auth.telegram.banned'
  | 'auth.ipad.success'
  | 'auth.ipad.failed'
  | 'auth.gm_activate.success'
  | 'auth.gm_activate.failed'
  | 'user.registered'
  | 'user.profile.updated'
  | 'user.account.deleted'
  | 'user.banned'
  | 'user.unbanned'
  | 'user.share.clicked'
  | 'user.app.opened'
  | 'game.created'
  | 'game.updated'
  | 'game.deleted'
  | 'game.started'
  | 'game.finished'
  | 'game.cloned'
  | 'game.player.joined'
  | 'game.player.left'
  | 'game.player.banned'
  | 'game.player.unbanned'
  | 'game.roles.assigned'
  | 'game.night.resolved'
  | 'game.day.event'
  | 'game.state.saved'
  | 'rating.calculated'
  | 'rating.applied'
  | 'bot.start'
  | 'bot.about'
  | 'bot.partners'
  | 'bot.stats'
  | 'bot.rating';

export interface AuditEntry {
  action: AuditAction;
  userId?: number | null;
  targetId?: number | null;
  gameId?: number | null;
  ip?: string;
  source?: 'mini_app' | 'bot' | 'gm_app';
  meta?: Record<string, unknown>;
}

const buffer: AuditEntry[] = [];
let flushTimer: ReturnType<typeof setInterval> | null = null;

export function audit(entry: AuditEntry): void {
  buffer.push(entry);
  if (buffer.length >= 50) {
    flushAuditLog();
  }
}

async function flushAuditLog(): Promise<void> {
  if (buffer.length === 0) return;
  const batch = buffer.splice(0, buffer.length);

  try {
    await prisma.auditLog.createMany({
      data: batch.map((e) => ({
        action: e.action,
        userId: e.userId ?? null,
        targetId: e.targetId ?? null,
        gameId: e.gameId ?? null,
        ip: e.ip ?? null,
        source: e.source ?? null,
        meta: (e.meta ?? {}) as any,
        createdAt: new Date(),
      })),
    });
  } catch (err) {
    console.error('[AUDIT] Failed to flush to DB, logging to console:', err);
    for (const e of batch) {
      console.log(`[AUDIT] ${e.action} userId=${e.userId} gameId=${e.gameId} source=${e.source} meta=${JSON.stringify(e.meta)}`);
    }
  }
}

export function startAuditFlush(): void {
  if (flushTimer) return;
  flushTimer = setInterval(() => flushAuditLog(), 5000);
}

export function stopAuditFlush(): void {
  if (flushTimer) {
    clearInterval(flushTimer);
    flushTimer = null;
  }
  flushAuditLog();
}
