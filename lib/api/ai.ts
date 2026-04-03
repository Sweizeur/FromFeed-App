import { apiRequest, BACKEND_URL, resolveVersionedEndpoint, devLog, devError, devWarn } from './client';
import { getStoredToken } from '../auth/auth-mobile';

let isStreamingActive = false;
let currentWebSocket: WebSocket | null = null;

export async function sendAIMessageStreaming(
  prompt: string,
  conversationId: string | undefined,
  onChunk: (chunk: string) => void,
  onComplete: (fullResponse: string, conversationId: string) => void,
  onError: (error: Error) => void
): Promise<void> {
  if (isStreamingActive) {
    devWarn('[API] Un stream est déjà actif, annulation de la nouvelle requête');
    return;
  }

  const token = await getStoredToken();
  if (!token) {
    devError("[API] Token d'authentification manquant");
    return;
  }

  const chatWsPath = resolveVersionedEndpoint('/api/ai/chat/ws');
  let wsUrl: string;
  if (BACKEND_URL.startsWith('https://')) {
    wsUrl = BACKEND_URL.replace('https://', 'wss://') + chatWsPath;
  } else if (BACKEND_URL.startsWith('http://')) {
    wsUrl = BACKEND_URL.replace('http://', 'ws://') + chatWsPath;
  } else {
    wsUrl = `wss://${BACKEND_URL}${chatWsPath}`;
  }

  return new Promise<void>((resolve, reject) => {
    try {
      isStreamingActive = true;
      devLog('[API] Connexion WebSocket:', wsUrl);

      if (currentWebSocket) {
        currentWebSocket.close();
      }

      const ws = new WebSocket(wsUrl);
      currentWebSocket = ws;

      let fullResponse = '';
      let isComplete = false;
      let settled = false;

      const cleanup = () => {
        isStreamingActive = false;
        if (currentWebSocket === ws) currentWebSocket = null;
      };

      const settle = (outcome: 'resolve' | 'reject', error?: Error) => {
        if (settled) return;
        settled = true;
        cleanup();
        if (outcome === 'resolve') resolve();
        else reject(error);
      };

      ws.onopen = () => {
        devLog('[API] WebSocket connecté, envoi du token d\'authentification...');
        try {
          ws.send(JSON.stringify({ type: 'auth', token }));
        } catch (e) {
          const err = e instanceof Error ? e : new Error('Impossible d\'envoyer auth via WebSocket');
          onError(err);
          settle('reject', err);
        }
      };

      ws.onmessage = (event) => {
        try {
          if (!event.data) {
            devWarn('[API] Message WebSocket vide');
            return;
          }
          const raw = typeof event.data === 'string' ? event.data : String(event.data);
          if (raw.length > 100000) {
            devError('[API] Message WebSocket trop volumineux:', raw.length);
            const err = new Error('Message WebSocket trop volumineux');
            onError(err);
            ws.close();
            settle('reject', err);
            return;
          }

          let data: { type: string; content?: string; response?: string; conversationId?: string; message?: string };
          try {
            data = JSON.parse(raw);
          } catch {
            devError('[API] Erreur de parsing JSON:', raw.substring(0, 100));
            if (!isComplete) {
              const err = new Error('Erreur de parsing JSON WebSocket');
              onError(err);
              ws.close();
              settle('reject', err);
            }
            return;
          }

          if (!data || typeof data !== 'object' || !data.type) {
            devWarn('[API] Message WebSocket sans type:', data);
            return;
          }

          if (data.type === 'connected') {
            devLog('[API] WebSocket:', data.message);
            return;
          }

          if (data.type === 'authenticated') {
            devLog('[API] Authentifié, envoi du message de chat...');
            ws.send(JSON.stringify({ type: 'chat', prompt, conversationId }));
            return;
          }

          if (data.type === 'chunk') {
            if (typeof data.content === 'string') {
              fullResponse += data.content;
              onChunk(data.content);
            } else {
              devWarn('[API] Chunk sans contenu valide:', data);
            }
          } else if (data.type === 'complete') {
            isComplete = true;
            const finalResponse = typeof data.response === 'string' ? data.response : fullResponse;
            const finalConversationId = typeof data.conversationId === 'string' ? data.conversationId : conversationId || '';
            onComplete(finalResponse, finalConversationId);
            ws.close();
            settle('resolve');
          } else if (data.type === 'error') {
            const err = new Error(data.message || 'Erreur serveur WebSocket');
            devError('[API] Erreur serveur:', data.message);
            onError(err);
            ws.close();
            settle('reject', err);
          } else {
            devWarn('[API] Type de message WebSocket inconnu:', data.type);
          }
        } catch (e) {
          devError('[API] Erreur lors du traitement du message WebSocket:', e);
          if (!isComplete) {
            const err = e instanceof Error ? e : new Error('Erreur interne WebSocket');
            onError(err);
            ws.close();
            settle('reject', err);
          }
        }
      };

      ws.onerror = (event) => {
        devError('[API] Erreur WebSocket:', event);
        const err = new Error('Erreur de connexion WebSocket');
        if (!isComplete) onError(err);
        settle('reject', err);
      };

      ws.onclose = (event) => {
        devLog('[API] WebSocket fermé, code:', event.code, 'reason:', event.reason);
        if (!settled && !isComplete) {
          const err = new Error(`WebSocket fermé prématurément (code: ${event.code})`);
          onError(err);
          settle('reject', err);
        }
      };

      setTimeout(() => {
        if (!settled) {
          const err = new Error('WebSocket timeout (5 min)');
          onError(err);
          ws.close();
          settle('reject', err);
        }
      }, 5 * 60 * 1000);
    } catch (error) {
      isStreamingActive = false;
      currentWebSocket = null;
      const err = error instanceof Error ? error : new Error("Erreur d'initialisation WebSocket");
      devError("[API] Erreur lors de l'initialisation WebSocket:", error);
      onError(err);
      reject(err);
    }
  });
}


export interface ConversationSummary {
  id: string;
  title: string | null;
  createdAt: string;
  updatedAt: string;
  _count: { messages: number };
}

export interface ConversationMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  createdAt: string;
}

export interface ConversationDetail {
  id: string;
  title: string | null;
  createdAt: string;
  updatedAt: string;
  messages: ConversationMessage[];
}

export async function getConversations(): Promise<{
  success: boolean;
  conversations: ConversationSummary[];
} | null> {
  return apiRequest('/api/ai/conversations');
}

export async function getConversation(conversationId: string): Promise<{
  success: boolean;
  conversation: ConversationDetail;
} | null> {
  return apiRequest(`/api/ai/conversations/${encodeURIComponent(conversationId)}`);
}


export async function deleteConversation(conversationId: string): Promise<{
  success: boolean;
  message: string;
} | null> {
  return apiRequest(`/api/ai/conversations/${encodeURIComponent(conversationId)}`, { method: 'DELETE' });
}
