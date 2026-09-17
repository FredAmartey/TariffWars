import React, { useCallback, useMemo, useState, useContext } from 'react';
import { NotificationsContext, type Notification } from './notifications';
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
  // Same reasoning as ThemeContext: the callbacks are already stable, so the
  // value only needs to change when the list does.
  const value = useMemo(
    () => ({ notifications, addNotification, removeNotification }),
    [notifications, addNotification, removeNotification]
  );
  return <NotificationsContext.Provider value={value}>{children}</NotificationsContext.Provider>;
};
export const useNotifications = () => useContext(NotificationsContext);