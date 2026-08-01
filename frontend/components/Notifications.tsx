import React from 'react';
import { useNotifications } from '../context/NotificationsContext';
import { CheckCircleIcon, XCircleIcon, AlertCircleIcon, InfoIcon, XIcon } from 'lucide-react';
import { Button } from '@/components/ui/button';
export const Notifications: React.FC = () => {
  const {
    notifications,
    removeNotification
  } = useNotifications();
  // The live region is always mounted, not conditional: a region inserted at
  // the same moment as its first message is not reliably announced, so
  // notifications passed silently for screen-reader users.
  return <div className="fixed bottom-4 right-4 z-50 flex flex-col space-y-2" role="status" aria-live="polite" aria-atomic="false">
      {notifications.map(notification => <div key={notification.id} className="bg-card border border-border shadow-lg rounded-lg p-4 max-w-md flex items-start">
          <div className="shrink-0 mr-3">
            {notification.type === 'success' && <CheckCircleIcon className="h-5 w-5 text-green-500" aria-hidden="true" />}
            {notification.type === 'error' && <XCircleIcon className="h-5 w-5 text-red-500" aria-hidden="true" />}
            {notification.type === 'warning' && <AlertCircleIcon className="h-5 w-5 text-yellow-500" aria-hidden="true" />}
            {notification.type === 'info' && <InfoIcon className="h-5 w-5 text-blue-500" aria-hidden="true" />}
          </div>
          <div className="flex-1">
            <p className="text-sm text-foreground">
              {notification.message}
            </p>
          </div>
          <Button variant="ghost" size="icon-xs" onClick={() => removeNotification(notification.id)} aria-label="Dismiss notification" className="ml-3 text-muted-foreground">
            <XIcon aria-hidden="true" />
          </Button>
        </div>)}
    </div>;
};