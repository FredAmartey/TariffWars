import { createContext } from 'react';

export interface Notification {
  id: string;
  message: string;
  type: 'success' | 'error' | 'info' | 'warning';
}

export interface NotificationsContextType {
  notifications: Notification[];
  addNotification: (message: string, type: Notification['type']) => void;
  removeNotification: (id: string) => void;
}

// Same split as theme.ts: the context object here, the provider component in
// NotificationsContext.tsx.
export const NotificationsContext = createContext<NotificationsContextType>({
  notifications: [],
  addNotification: () => {},
  removeNotification: () => {},
});
