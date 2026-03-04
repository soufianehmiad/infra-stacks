/**
 * WebSocket connection management with Zustand
 */
import { create } from 'zustand';

interface WSMessage {
  type: string;
  timestamp: string;
  data: Record<string, any>;
}

interface WebSocketState {
  // State
  ws: WebSocket | null;
  connected: boolean;
  reconnecting: boolean;
  messages: WSMessage[];
  reconnectAttempts: number;

  // Actions
  connect: (token: string) => void;
  disconnect: () => void;
  send: (message: any) => void;
  clearMessages: () => void;
}

const MAX_RECONNECT_ATTEMPTS = 10;
const BASE_RECONNECT_DELAY = 1000; // Start with 1 second

export const useWebSocketStore = create<WebSocketState>((set, get) => ({
  // Initial state
  ws: null,
  connected: false,
  reconnecting: false,
  messages: [],
  reconnectAttempts: 0,

  // Connect to WebSocket
  connect: (token: string) => {
    const { ws, reconnectAttempts } = get();

    // Close existing connection
    if (ws) {
      ws.close();
    }

    // WebSocket URL (ws:// for http, wss:// for https)
    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    const wsUrl = `${protocol}//${window.location.host}/api/ws?token=${token}`;

    try {
      const newWs = new WebSocket(wsUrl);

      newWs.onopen = () => {
        console.log('🔌 WebSocket connected');
        set({
          connected: true,
          reconnecting: false,
          reconnectAttempts: 0,
        });

        // Start heartbeat
        const heartbeat = setInterval(() => {
          if (get().connected) {
            get().send({
              type: 'ping',
              timestamp: new Date().toISOString(),
            });
          } else {
            clearInterval(heartbeat);
          }
        }, 30000); // Ping every 30 seconds
      };

      newWs.onmessage = (event) => {
        try {
          const message = JSON.parse(event.data);

          // Add to message history (keep last 100)
          set((state) => ({
            messages: [...state.messages.slice(-99), message],
          }));
        } catch (error) {
          console.error('Failed to parse WebSocket message:', error);
        }
      };

      newWs.onerror = (error) => {
        console.error('WebSocket error:', error);
      };

      newWs.onclose = () => {
        console.log('🔌 WebSocket disconnected');
        set({ connected: false, ws: null });

        // Auto-reconnect with exponential backoff
        if (reconnectAttempts < MAX_RECONNECT_ATTEMPTS) {
          const delay = Math.min(
            BASE_RECONNECT_DELAY * Math.pow(2, reconnectAttempts),
            30000 // Max 30 seconds
          );

          console.log(
            `🔄 Reconnecting in ${delay}ms (attempt ${reconnectAttempts + 1}/${MAX_RECONNECT_ATTEMPTS})`
          );

          set({ reconnecting: true });

          setTimeout(() => {
            set((state) => ({
              reconnectAttempts: state.reconnectAttempts + 1,
            }));
            get().connect(token);
          }, delay);
        } else {
          console.error('❌ Max reconnection attempts reached');
          set({ reconnecting: false });
        }
      };

      set({ ws: newWs });
    } catch (error) {
      console.error('Failed to create WebSocket:', error);
    }
  },

  // Disconnect WebSocket
  disconnect: () => {
    const { ws } = get();
    if (ws) {
      ws.close();
      set({
        ws: null,
        connected: false,
        reconnecting: false,
        reconnectAttempts: 0,
      });
    }
  },

  // Send message
  send: (message: any) => {
    const { ws, connected } = get();
    if (ws && connected && ws.readyState === WebSocket.OPEN) {
      ws.send(JSON.stringify(message));
    } else {
      console.warn('Cannot send message: WebSocket not connected');
    }
  },

  // Clear message history
  clearMessages: () => set({ messages: [] }),
}));
