/**
 * UI state management with Zustand
 */
import { create } from 'zustand';
import { persist } from 'zustand/middleware';

type Theme = 'brutalist' | 'dark' | 'light';
type NotificationLevel = 'info' | 'success' | 'warning' | 'error';

interface Notification {
  id: string;
  level: NotificationLevel;
  title: string;
  message: string;
  timestamp: Date;
}

interface UIState {
  // State
  theme: Theme;
  sidebarCollapsed: boolean;
  notifications: Notification[];
  loading: Record<string, boolean>;

  // Actions
  setTheme: (theme: Theme) => void;
  toggleSidebar: () => void;
  addNotification: (
    level: NotificationLevel,
    title: string,
    message: string
  ) => void;
  removeNotification: (id: string) => void;
  clearNotifications: () => void;
  setLoading: (key: string, loading: boolean) => void;
}

export const useUIStore = create<UIState>()(
  persist(
    (set) => ({
      // Initial state
      theme: 'brutalist',
      sidebarCollapsed: false,
      notifications: [],
      loading: {},

      // Set theme
      setTheme: (theme) => set({ theme }),

      // Toggle sidebar
      toggleSidebar: () =>
        set((state) => ({ sidebarCollapsed: !state.sidebarCollapsed })),

      // Add notification
      addNotification: (level, title, message) =>
        set((state) => ({
          notifications: [
            ...state.notifications,
            {
              id: Math.random().toString(36).substring(7),
              level,
              title,
              message,
              timestamp: new Date(),
            },
          ],
        })),

      // Remove notification
      removeNotification: (id) =>
        set((state) => ({
          notifications: state.notifications.filter((n) => n.id !== id),
        })),

      // Clear all notifications
      clearNotifications: () => set({ notifications: [] }),

      // Set loading state for a key
      setLoading: (key, loading) =>
        set((state) => ({
          loading: {
            ...state.loading,
            [key]: loading,
          },
        })),
    }),
    {
      name: 'unidash-ui',
      partialize: (state) => ({
        theme: state.theme,
        sidebarCollapsed: state.sidebarCollapsed,
      }),
    }
  )
);
