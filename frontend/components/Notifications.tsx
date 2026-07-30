import React, { useContext } from 'react';
import { ThemeContext } from '../App';
import { useNotifications } from '../context/NotificationsContext';
import { CheckCircleIcon, XCircleIcon, AlertCircleIcon, InfoIcon, XIcon } from 'lucide-react';
export const Notifications: React.FC = () => {
  const {
    isDarkMode
  } = useContext(ThemeContext);
  const {
    notifications,
    removeNotification
  } = useNotifications();
  // The live region is always mounted, not conditional: a region inserted at
  // the same moment as its first message is not reliably announced, so
  // notifications passed silently for screen-reader users.
  return <div className="fixed bottom-4 right-4 z-50 flex flex-col space-y-2" role="status" aria-live="polite" aria-atomic="false">
      {notifications.map(notification => <div key={notification.id} className={`${isDarkMode ? 'bg-gray-800 border-gray-700 shadow-lg' : 'bg-white border-gray-200 shadow-md'} border rounded-lg p-4 max-w-md transition-all transform animate-fade-in-up flex items-start`}>
          <div className="flex-shrink-0 mr-3">
            {notification.type === 'success' && <CheckCircleIcon className="h-5 w-5 text-green-500" aria-hidden="true" />}
            {notification.type === 'error' && <XCircleIcon className="h-5 w-5 text-red-500" aria-hidden="true" />}
            {notification.type === 'warning' && <AlertCircleIcon className="h-5 w-5 text-yellow-500" aria-hidden="true" />}
            {notification.type === 'info' && <InfoIcon className="h-5 w-5 text-blue-500" aria-hidden="true" />}
          </div>
          <div className="flex-1">
            <p className={`text-sm ${isDarkMode ? 'text-gray-200' : 'text-gray-800'}`}>
              {notification.message}
            </p>
          </div>
          <button onClick={() => removeNotification(notification.id)} aria-label="Dismiss notification" className={`ml-3 ${isDarkMode ? 'text-gray-400 hover:text-gray-300' : 'text-gray-500 hover:text-gray-700'}`}>
            <XIcon className="h-4 w-4" aria-hidden="true" />
          </button>
        </div>)}
    </div>;
};