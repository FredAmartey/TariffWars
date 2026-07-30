import React, { useCallback, useState, createContext, useContext } from 'react';
interface Notification {
  id: string;
  message: string;
  type: 'success' | 'error' | 'info' | 'warning';
}
interface NotificationsContextType {
  notifications: Notification[];
  addNotification: (message: string, type: Notification['type']) => void;
  removeNotification: (id: string) => void;
}
export const NotificationsContext = createContext<NotificationsContextType>({
  notifications: [],
  addNotification: () => {},
  removeNotification: () => {}
});
export const NotificationsProvider: React.FC<{
  children: React.ReactNode;
}> = ({
  children
}) => {
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const removeNotification = useCallback((id: string) => {
    setNotifications(prev => prev.filter(notification => notification.id !== id));
  }, []);
  const addNotification = useCallback((message: string, type: Notification['type'] = 'info') => {
    // Date.now() collides when two notifications are raised in the same
    // millisecond: React warns about duplicate keys, and dismissing one
    // removed both.
    const id =
      typeof crypto !== 'undefined' && 'randomUUID' in crypto
        ? crypto.randomUUID()
        : `${Date.now()}-${Math.random().toString(36).slice(2)}`;
    setNotifications(prev => [...prev, {
      id,
      message,
      type
    }]);
    // Auto-remove after 5 seconds
    setTimeout(() => {
      removeNotification(id);
    }, 5000);
  }, [removeNotification]);
  return <NotificationsContext.Provider value={{
    notifications,
    addNotification,
    removeNotification
  }}>
      {children}
    </NotificationsContext.Provider>;
};
export const useNotifications = () => useContext(NotificationsContext);