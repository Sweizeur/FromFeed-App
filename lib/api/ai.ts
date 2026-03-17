import { apiRequest, BACKEND_URL, devLog, devError, devWarn } from './client';
import { getStoredToken } from '../auth-mobile';

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

  let wsUrl: string;
  if (BACKEND_URL.startsWith('https://')) {
    wsUrl = BACKEND_URL.replace('https://', 'wss://') + '/api/ai/chat/ws?token=' + encodeURIComponent(token);
  } else if (BACKEND_URL.startsWith('http://')) {
    wsUrl = BACKEND_URL.replace('http://', 'ws://') + '/api/ai/chat/ws?token=' + encodeURIComponent(token);
  } else {
    wsUrl = `wss://${BACKEND_URL}/api/ai/chat/ws?token=${encodeURIComponent(token)}`;
  }

  return new Promise((resolve) => {
    try {
      isStreamingActive = true;
      devLog('[API] Connexion WebSocket:', wsUrl.replace(token, 'TOKEN_HIDDEN'));

      if (currentWebSocket) {
        currentWebSocket.close();
      }

      const ws = new WebSocket(wsUrl);
      currentWebSocket = ws;

      let fullResponse = '';
      let isComplete = false;
      let resolved = false;

      const cleanup = () => {
        isStreamingActive = false;
        if (currentWebSocket === ws) currentWebSocket = null;
        if (!resolved) resolved = true;
      };

      ws.onopen = () => {
        devLog('[API] WebSocket connecté, en attente du message de bienvenue...');
      };

      ws.onmessage = (event) => {
        try {
          if (!event.data || typeof event.data !== 'string') {
            devWarn('[API] Message WebSocket avec type invalide:', typeof event.data);
            return;
          }
          if (event.data.length > 100000) {
            devError('[API] Message WebSocket trop volumineux:', event.data.length);
            cleanup();
            ws.close();
            return;
          }

          let data: { type: string; content?: string; response?: string; conversationId?: string; message?: string };
          try {
            data = JSON.parse(event.data);
          } catch {
            devError('[API] Erreur de parsing JSON:', event.data.substring(0, 100));
            if (!isComplete) { cleanup(); ws.close(); }
            return;
          }

          if (!data || typeof data !== 'object' || !data.type) {
            devWarn('[API] Message WebSocket sans type:', data);
            return;
          }

          if (data.type === 'connected') {
            devLog('[API] WebSocket:', data.message);
            devLog('[API] Envoi du message de chat au serveur...');
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
            cleanup();
            const finalResponse = typeof data.response === 'string' ? data.response : fullResponse;
            const finalConversationId = typeof data.conversationId === 'string' ? data.conversationId : conversationId || '';
            onComplete(finalResponse, finalConversationId);
            ws.close();
            resolve();
          } else if (data.type === 'error') {
            cleanup();
            ws.close();
          } else {
            devWarn('[API] Type de message WebSocket inconnu:', data.type);
          }
        } catch (e) {
          devError('[API] Erreur lors du traitement du message WebSocket:', e);
          if (!isComplete) { cleanup(); ws.close(); }
        }
      };

      ws.onerror = (error) => {
        devError('[API] Erreur WebSocket:', error);
        if (!isComplete && !resolved) cleanup();
      };

      ws.onclose = (event) => {
        devLog('[API] WebSocket fermé, code:', event.code, 'reason:', event.reason);
        cleanup();
      };

      setTimeout(() => {
        if (!isComplete && !resolved) { cleanup(); ws.close(); }
      }, 5 * 60 * 1000);
    } catch (error) {
      isStreamingActive = false;
      currentWebSocket = null;
      devError("[API] Erreur lors de l'initialisation WebSocket:", error);
    }
  });
}

export async function sendAIMessage(
  prompt: string,
  conversationId?: string
): Promise<{ success: boolean; response: string; conversationId: string } | null> {
  return apiRequest('/api/ai/chat', {
    method: 'POST',
    body: JSON.stringify({ prompt, conversationId }),
  });
}

export async function validateDraftPlan(
  conversationId: string,
  draftPlan: Record<string, unknown>,
  messageId?: string
): Promise<{ success: boolean; plan?: Record<string, unknown>; error?: string } | null> {
  return apiRequest('/api/ai/draft-plan/validate', {
    method: 'POST',
    body: JSON.stringify({ conversationId, draftPlan, messageId }),
  });
}

export async function rejectDraftPlan(
  conversationId: string,
  messageId: string
): Promise<{ success: boolean; message?: string; error?: string } | null> {
  return apiRequest('/api/ai/draft-plan/reject', {
    method: 'POST',
    body: JSON.stringify({ conversationId, messageId }),
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
  return apiRequest(`/api/ai/conversations/${conversationId}`);
}

export async function createConversation(title?: string): Promise<{
  success: boolean;
  conversation: { id: string; title: string | null; createdAt: string; updatedAt: string };
} | null> {
  return apiRequest('/api/ai/conversations', {
    method: 'POST',
    body: JSON.stringify({ title }),
  });
}

export async function deleteConversation(conversationId: string): Promise<{
  success: boolean;
  message: string;
} | null> {
  return apiRequest(`/api/ai/conversations/${conversationId}`, { method: 'DELETE' });
}
