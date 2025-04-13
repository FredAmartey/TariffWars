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
  const addNotification = useCallback((message: string, type: Notification['type'] = 'info') => {
    const id = Date.now().toString();
    setNotifications(prev => [...prev, {
      id,
      message,
      type
    }]);
    // Auto-remove after 5 seconds
    setTimeout(() => {
      removeNotification(id);
    }, 5000);
  }, []);
  const removeNotification = useCallback((id: string) => {
    setNotifications(prev => prev.filter(notification => notification.id !== id));
  }, []);
  return <NotificationsContext.Provider value={{
    notifications,
    addNotification,
    removeNotification
  }}>
      {children}
    </NotificationsContext.Provider>;
};
export const useNotifications = () => useContext(NotificationsContext);