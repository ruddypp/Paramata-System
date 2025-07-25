import React, { createContext, useContext, useState, useEffect, useRef } from 'react';
import { toast } from 'react-hot-toast';
import { Notification } from '@/lib/types';
import { canShowNotification, recordNotificationTrigger } from '@/lib/notification-tracker';
import { differenceInDays } from 'date-fns';

type NotificationContextType = {
  notifications: Notification[];
  unreadCount: number;
  loading: boolean;
  error: string | null;
  fetchNotifications: (showToast?: boolean) => Promise<void>;
  markAsRead: (id: string) => Promise<boolean>;
  markAllAsRead: () => Promise<boolean>;
  deleteNotification: (id: string) => Promise<boolean>;
  deleteAllRead: () => Promise<boolean>;
  triggerCronCheck: (showToast?: boolean) => Promise<any>;
};

const NotificationContext = createContext<NotificationContextType | undefined>(undefined);

export function NotificationProvider({ children, role }: { children: React.ReactNode, role: 'ADMIN' | 'USER' }) {
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const isMounted = useRef(true);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const lastSoundPlayedTime = useRef<number>(0);
  const isFetching = useRef(false); // The "lock"
  const processedNotifications = useRef(new Set<string>()); // Track notifications that have been processed
  const toastShownCount = useRef<number>(0); // Track number of toasts shown in current session

  const baseUrl = role === 'ADMIN' ? '/api/admin/notifications' : '/api/user/notifications';

  useEffect(() => {
    isMounted.current = true;
    return () => {
      isMounted.current = false;
    };
  }, []);

  useEffect(() => {
    if (typeof window !== 'undefined') {
      audioRef.current = new Audio('/notification-sound.mp3');
      audioRef.current.load();
    }
    
    return () => {
      if (audioRef.current) {
        audioRef.current.pause();
        audioRef.current = null;
      }
    };
  }, []);

  // Reset toast count after 1 minute of inactivity
  useEffect(() => {
    let resetTimer: NodeJS.Timeout;
    
    const resetToastCount = () => {
      toastShownCount.current = 0;
    };
    
    // Reset the counter after 1 minute
    const scheduleReset = () => {
      clearTimeout(resetTimer);
      resetTimer = setTimeout(resetToastCount, 60000); // 1 minute
    };
    
    // Initialize the reset timer
    scheduleReset();
    
    return () => clearTimeout(resetTimer);
  }, []);

  const playSoundAndShowToast = (notification: Notification) => {
    // Skip if notification doesn't have required data
    if (!notification.reminder?.dueDate || !notification.reminder?.type) return;

    // Skip if we've already processed this notification in the current session
    if (processedNotifications.current.has(notification.id)) return;
    
    // Only process new unread notifications
    if (notification.isRead) return;
    
    // Check if we should show this notification based on tracking
    if (!canShowNotification(notification.id, notification.reminder.dueDate, notification.reminder.type)) return;
    
    // Limit the number of toasts shown at once (max 3 per session)
    if (toastShownCount.current >= 3) return;

    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const dueDate = new Date(notification.reminder.dueDate);
    const daysDiff = differenceInDays(dueDate, today);

    // Rate limit sound playback (at most once every 5 seconds)
    const now = Date.now();
    if (now - lastSoundPlayedTime.current < 5000) return;
    
    // Mark this notification as processed to prevent showing it again
    processedNotifications.current.add(notification.id);
    toastShownCount.current += 1;
    
    if (audioRef.current) {
      const playPromise = audioRef.current.play();
      if (playPromise !== undefined) {
        playPromise.then(() => {
          lastSoundPlayedTime.current = now;
          recordNotificationTrigger(notification.id);

    toast(
            (t) => (
        <div className="flex items-start">
          <div className="flex-1">
                  <p className="font-medium text-orange-600">{notification.title}</p>
                  <p className="text-sm">{notification.message}</p>
          </div>
          <div className="ml-4">
            <button 
              onClick={() => {
                toast.dismiss(t.id);
                if (typeof window !== 'undefined') {
                  window.location.href = `/${role.toLowerCase()}/notifications`;
                }
              }}
              className="bg-blue-500 text-white px-3 py-1 rounded-md text-xs"
            >
              Lihat Semua
            </button>
          </div>
        </div>
      ),
            { duration: 10000, icon: '🔔' }
    );
        }).catch(error => {
          console.error(`Error playing sound for notification ${notification.id}:`, error);
        });
      }
    }
  };

  const _internalFetch = async (showToast = false) => {
    try {
      const response = await fetch(baseUrl, {
        credentials: 'include',
        cache: 'no-store',
        headers: { 'Cache-Control': 'no-cache, no-store, must-revalidate' }
      });
      
      if (response.status === 401) {
        // Handle unauthorized error gracefully - likely not logged in
        console.log("User not authenticated for notifications");
        
        // Jangan tampilkan pesan error jika pengguna belum login
        // Hanya bersihkan notifikasi agar tidak error
        if (isMounted.current) {
          setNotifications([]);
          setUnreadCount(0);
        }
        return;
      }
      
      if (!response.ok) throw new Error(`Failed to fetch: ${response.status}`);
      
      const data = await response.json();
      const allNotifications = data.notifications || [];
      
      // Only show toasts for unread notifications if requested
      if (showToast) {
        // Sort notifications by priority (overdue first)
        const prioritizedNotifications = [...allNotifications]
          .filter(n => !n.isRead && n.reminder?.dueDate)
          .sort((a, b) => {
            // First sort by read status (unread first)
            if (a.isRead !== b.isRead) return a.isRead ? 1 : -1;
            
            // Then by due date (earlier date = higher priority)
            const dateA = new Date(a.reminder?.dueDate || '');
            const dateB = new Date(b.reminder?.dueDate || '');
            return dateA.getTime() - dateB.getTime();
          });
        
        // Limit to most important notifications (max 3)
        const toShow = prioritizedNotifications.slice(0, 3);
        
        // Show toasts one by one with a small delay to avoid overwhelming the user
        toShow.forEach((notification, index) => {
          setTimeout(() => {
            if (isMounted.current) {
          playSoundAndShowToast(notification);
            }
          }, index * 1000); // 1 second delay between toasts
        });
      }
      
      if (isMounted.current) {
        setNotifications(allNotifications);
        setUnreadCount(allNotifications.filter((n: Notification) => !n.isRead).length);
      }
    } catch (err) {
      console.error('Error fetching notifications:', err);
      
      // Jangan tampilkan error saat aplikasi pertama kali dimuat
      // Tetapi tetap simpan error untuk debugging
      if (isMounted.current) {
        setError(err instanceof Error ? err.message : 'Error occurred');
        // Jangan bersihkan notifikasi yang ada untuk menghindari UI berkedip
      }
    }
  };

  const fetchNotifications = async (showToast = false) => {
    if (isFetching.current) return;
    
    isFetching.current = true;
    setLoading(true);
    try {
      await _internalFetch(showToast);
    } finally {
      if (isMounted.current) setLoading(false);
      isFetching.current = false;
    }
  };

  const triggerCronCheck = async (showToast = false) => {
    if (isFetching.current) return null;

    isFetching.current = true;
    setLoading(true);
    try {
      const response = await fetch('/api/cron/reminders?force=true', {
        credentials: 'include',
        cache: 'no-store',
      });
      
      if (response.status === 401) {
        // Handle unauthorized error gracefully
        console.log('User not authenticated for cron check');
        return null;
      }
      
      if (!response.ok) throw new Error('Failed to trigger cron');
      
      const data = await response.json();
      await _internalFetch(showToast && data.created > 0);
      return data;
    } catch (error) {
      console.error('Error triggering cron:', error);
      return null;
    } finally {
      if (isMounted.current) setLoading(false);
      isFetching.current = false;
    }
  };

  const markAsRead = async (id: string) => {
    try {
      const response = await fetch(`${baseUrl}/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ isRead: true }),
      });
      if (!response.ok) throw new Error('Failed to mark as read');
      
      if (isMounted.current) {
        setNotifications(prev => prev.map(n => n.id === id ? { ...n, isRead: true } : n));
        setUnreadCount(prev => Math.max(0, prev - 1));
      }
      return true;
    } catch (error) {
      console.error('Error marking as read:', error);
      return false;
    }
  };

  const markAllAsRead = async () => {
    try {
      const response = await fetch(baseUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ action: 'markAllRead' }),
      });
      if (!response.ok) throw new Error('Failed to mark all as read');
      
      if (isMounted.current) {
        setNotifications(prev => prev.map(n => ({ ...n, isRead: true })));
        setUnreadCount(0);
      }
      return true;
    } catch (error) {
      console.error('Error marking all as read:', error);
      return false;
    }
  };

  const deleteNotification = async (id: string) => {
    try {
      const response = await fetch(`${baseUrl}/${id}`, {
        method: 'DELETE',
        credentials: 'include',
      });
      if (!response.ok) throw new Error('Failed to delete');
      
      if (isMounted.current) {
        const wasUnread = notifications.find(n => n.id === id)?.isRead === false;
        setNotifications(prev => prev.filter(n => n.id !== id));
        if (wasUnread) {
          setUnreadCount(prev => Math.max(0, prev - 1));
        }
      }
      return true;
    } catch (error) {
      console.error('Error deleting notification:', error);
      return false;
    }
  };

  const deleteAllRead = async () => {
    try {
      const response = await fetch(baseUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ action: 'deleteAllRead' }),
      });
      if (!response.ok) throw new Error('Failed to delete all read');
      
      if (isMounted.current) {
        setNotifications(prev => prev.filter(n => !n.isRead));
      }
      return true;
    } catch (error) {
      console.error('Error deleting all read:', error);
      return false;
    }
  };

  useEffect(() => {
    if (!role) return;
    
    // Initial fetch without showing toast
    fetchNotifications(false).catch(err => console.error('Initial fetch error:', err));
    
    // Use a slightly longer interval to reduce server load
    const interval = setInterval(() => {
      triggerCronCheck(true).catch(err => console.error('Interval check error:', err));
    }, 45 * 1000); // Poll every 45 seconds instead of 30
    
    return () => clearInterval(interval);
  }, [role]);

  const value: NotificationContextType = {
    notifications,
    unreadCount,
    loading,
    error,
    fetchNotifications,
    markAsRead,
    markAllAsRead,
    deleteNotification,
    deleteAllRead,
    triggerCronCheck,
  };

  return (
    <NotificationContext.Provider value={value}>
      {children}
    </NotificationContext.Provider>
  );
}

export function useNotifications() {
  const context = useContext(NotificationContext);
  if (context === undefined) {
    throw new Error('useNotifications must be used within a NotificationProvider');
  }
  return context;
} 