import type { WSEvent } from '@shared/types';
import { logger } from '../utils/logger';

type EventHandler = (event: WSEvent) => void;

class WebSocketService {
  private ws: WebSocket | null = null;
  private url: string;
  private handlers: Set<EventHandler> = new Set();
  private reconnectTimer: ReturnType<typeof setTimeout> | null = null;
  private reconnectAttempts = 0;
  private maxReconnectAttempts = 10;
  private pingInterval: ReturnType<typeof setInterval> | null = null;
  private currentToken: string | null = null;

  constructor() {
    this.url = import.meta.env.VITE_WS_URL || 'ws://localhost:3001';
  }

  connect(token: string) {
    if (this.currentToken && this.currentToken !== token) {
      logger.info('WS', 'Token changed, reconnecting with new token');
      this.disconnect();
    }
    this.currentToken = token;

    if (this.ws?.readyState === WebSocket.OPEN || this.ws?.readyState === WebSocket.CONNECTING) return;

    try {
      const base = this.url.replace(/\/$/, '');
      logger.info('WS', 'Connecting', { url: base });
      this.ws = new WebSocket(`${base}/ws?token=${token}`);

      this.ws.onopen = () => {
        logger.info('WS', 'Connected');
        this.reconnectAttempts = 0;
        this.startPing();
      };

      this.ws.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data) as WSEvent;
          if ((data as any).type !== 'pong') {
            logger.debug('WS', `Received: ${data.type}`, data.data ? { data: data.data } : undefined);
          }
          this.handlers.forEach((handler) => handler(data));
        } catch (err) {
          logger.error('WS', 'Parse error', { error: String(err) });
        }
      };

      this.ws.onclose = () => {
        logger.info('WS', 'Disconnected');
        this.stopPing();
        this.scheduleReconnect(token);
      };

      this.ws.onerror = (error) => {
        logger.error('WS', 'Connection error', { error: String(error) });
      };
    } catch (err) {
      logger.error('WS', 'Connection failed', { error: String(err) });
      this.scheduleReconnect(token);
    }
  }

  private scheduleReconnect(token: string) {
    if (this.reconnectAttempts >= this.maxReconnectAttempts) {
      logger.warn('WS', 'Max reconnect attempts reached', { attempts: this.reconnectAttempts });
      return;
    }

    const delay = Math.min(1000 * Math.pow(2, this.reconnectAttempts), 30000);
    this.reconnectAttempts++;

    logger.info('WS', `Reconnecting in ${delay}ms`, { attempt: this.reconnectAttempts });

    this.reconnectTimer = setTimeout(() => {
      this.connect(token);
    }, delay);
  }

  private startPing() {
    this.stopPing();
    this.pingInterval = setInterval(() => {
      if (this.ws?.readyState === WebSocket.OPEN) {
        this.ws.send(JSON.stringify({ type: 'ping' }));
      }
    }, 25000);
  }

  private stopPing() {
    if (this.pingInterval) {
      clearInterval(this.pingInterval);
      this.pingInterval = null;
    }
  }

  disconnect() {
    logger.info('WS', 'Disconnecting');
    this.stopPing();
    this.currentToken = null;
    this.reconnectAttempts = 0;
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }
    if (this.ws) {
      this.ws.onclose = null;
      this.ws.close();
      this.ws = null;
    }
  }

  subscribe(handler: EventHandler) {
    this.handlers.add(handler);
    return () => {
      this.handlers.delete(handler);
    };
  }

  send(data: unknown) {
    if (this.ws?.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify(data));
    }
  }
}

export const wsService = new WebSocketService();
