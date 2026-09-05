import { isTelegramApp, hapticFeedback } from '../lib/telegram';

export function hapticImpact(style: 'light' | 'medium' | 'heavy' | 'rigid' | 'soft' = 'medium') {
  if (!isTelegramApp()) return;
  try { hapticFeedback.impactOccurred(style); } catch {}
}

export function hapticNotification(type: 'success' | 'warning' | 'error' = 'success') {
  if (!isTelegramApp()) return;
  try { hapticFeedback.notificationOccurred(type); } catch {}
}

export function hapticSelection() {
  if (!isTelegramApp()) return;
  try { hapticFeedback.selectionChanged(); } catch {}
}
