import { BACKEND_URL, resolveVersionedEndpoint } from './client';
import { getStoredToken } from '../auth/auth-mobile';

export type TaskWsStatus = 'done' | 'failed';

export interface TaskWsUpdate {
  status: TaskWsStatus;
  result?: Record<string, unknown>;
  error?: string;
}

type Callback = (update: TaskWsUpdate) => void;

type Subscription = {
  onUpdate: Callback;
  onFallback: () => void;
};

function buildWsUrl(): string {
  const path = resolveVersionedEndpoint('/api/tasks/ws');
  if (BACKEND_URL.startsWith('https://')) return BACKEND_URL.replace('https://', 'wss://') + path;
  if (BACKEND_URL.startsWith('http://')) return BACKEND_URL.replace('http://', 'ws://') + path;
  return `wss://${BACKEND_URL}${path}`;
}

const HEARTBEAT_INTERVAL_MS = 15_000;
const HEARTBEAT_TIMEOUT_MS = 35_000;
const MAX_RECONNECT_ATTEMPTS = 6;
const MAX_RECONNECT_DELAY_MS = 20_000;

let socket: WebSocket | null = null;
let isAuthenticated = false;
let reconnectAttempts = 0;
let reconnectTimer: ReturnType<typeof setTimeout> | null = null;
let heartbeatTimer: ReturnType<typeof setInterval> | null = null;
let lastPongAt = 0;
let tokenPromise: Promise<string | null> | null = null;
const subscriptions = new Map<string, Set<Subscription>>();

function clearReconnectTimer(): void {
  if (!reconnectTimer) return;
  clearTimeout(reconnectTimer);
  reconnectTimer = null;
}

function clearHeartbeat(): void {
  if (!heartbeatTimer) return;
  clearInterval(heartbeatTimer);
  heartbeatTimer = null;
}

function disconnectSocket(): void {
  clearReconnectTimer();
  clearHeartbeat();
  isAuthenticated = false;
  if (socket) {
    try { socket.close(); } catch {}
  }
  socket = null;
}

function maybeCloseWhenIdle(): void {
  if (subscriptions.size > 0) return;
  disconnectSocket();
}

function runFallbackForAllAndReset(): void {
  for (const [, subs] of subscriptions) {
    for (const sub of subs) {
      try { sub.onFallback(); } catch {}
    }
  }
  subscriptions.clear();
  disconnectSocket();
}

function getReconnectDelayMs(attempt: number): number {
  const exp = Math.min(MAX_RECONNECT_DELAY_MS, 1000 * (2 ** attempt));
  const jitter = Math.floor(Math.random() * 400);
  return exp + jitter;
}

function ensureToken(): Promise<string | null> {
  if (!tokenPromise) tokenPromise = getStoredToken();
  return tokenPromise;
}

function startHeartbeat(): void {
  clearHeartbeat();
  lastPongAt = Date.now();
  heartbeatTimer = setInterval(() => {
    if (!socket || socket.readyState !== WebSocket.OPEN) return;
    if (Date.now() - lastPongAt > HEARTBEAT_TIMEOUT_MS) {
      try { socket.close(); } catch {}
      return;
    }
    try {
      socket.send(JSON.stringify({ type: 'ping' }));
    } catch {}
  }, HEARTBEAT_INTERVAL_MS);
}

function subscribeAllPendingTasks(): void {
  if (!socket || !isAuthenticated || socket.readyState !== WebSocket.OPEN) return;
  for (const taskId of subscriptions.keys()) {
    try {
      socket.send(JSON.stringify({ type: 'subscribe_task', taskId }));
    } catch {}
  }
}

function scheduleReconnect(): void {
  if (subscriptions.size === 0) return;
  if (reconnectAttempts >= MAX_RECONNECT_ATTEMPTS) {
    runFallbackForAllAndReset();
    return;
  }
  clearReconnectTimer();
  const delay = getReconnectDelayMs(reconnectAttempts);
  reconnectAttempts += 1;
  reconnectTimer = setTimeout(() => {
    connectSharedSocket();
  }, delay);
}

async function connectSharedSocket(): Promise<void> {
  if (socket && (socket.readyState === WebSocket.OPEN || socket.readyState === WebSocket.CONNECTING)) return;
  if (subscriptions.size === 0) return;

  const token = await ensureToken();
  if (!token) {
    runFallbackForAllAndReset();
    return;
  }

  const ws = new WebSocket(buildWsUrl());
  socket = ws;
  isAuthenticated = false;

  ws.onopen = () => {
    try {
      ws.send(JSON.stringify({ type: 'auth', token }));
    } catch {}
  };

  ws.onmessage = (event) => {
    let data: Record<string, unknown>;
    try {
      data = JSON.parse(event.data as string) as Record<string, unknown>;
    } catch {
      return;
    }

    switch (data.type) {
      case 'connected':
        // no-op: auth is sent from onopen
        return;
      case 'authenticated':
        reconnectAttempts = 0;
        isAuthenticated = true;
        startHeartbeat();
        subscribeAllPendingTasks();
        return;
      case 'pong':
        lastPongAt = Date.now();
        return;
      case 'task_update': {
        const taskId = data.taskId as string | undefined;
        if (!taskId) return;
        const subs = subscriptions.get(taskId);
        if (!subs) return;

        const update: TaskWsUpdate = {
          status: data.status as TaskWsStatus,
          result: data.result as Record<string, unknown> | undefined,
          error: data.error as string | undefined,
        };

        for (const sub of subs) {
          try { sub.onUpdate(update); } catch {}
        }
        subscriptions.delete(taskId);
        maybeCloseWhenIdle();
        return;
      }
      case 'error':
        // keep socket alive unless transport closes; reconnect/fallback handled by onclose
        return;
      default:
        return;
    }
  };

  ws.onerror = () => {
    // onclose handles reconnect
  };

  ws.onclose = () => {
    clearHeartbeat();
    isAuthenticated = false;
    if (socket === ws) socket = null;
    scheduleReconnect();
  };
}

export function subscribeTaskViaWs(
  taskId: string,
  onUpdate: Callback,
  onFallback: () => void,
): () => void {
  const sub: Subscription = { onUpdate, onFallback };
  if (!subscriptions.has(taskId)) subscriptions.set(taskId, new Set());
  subscriptions.get(taskId)!.add(sub);

  void connectSharedSocket();

  if (socket && isAuthenticated && socket.readyState === WebSocket.OPEN) {
    try { socket.send(JSON.stringify({ type: 'subscribe_task', taskId })); } catch {}
  }

  return () => {
    const subs = subscriptions.get(taskId);
    if (!subs) return;
    subs.delete(sub);
    if (subs.size === 0) subscriptions.delete(taskId);
    maybeCloseWhenIdle();
  };
}
