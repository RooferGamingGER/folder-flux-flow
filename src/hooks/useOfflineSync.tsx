import { useState, useEffect } from 'react';
import { syncService } from '@/lib/syncService';
import { toast } from '@/hooks/use-toast';

export function useOfflineSync() {
  const [isOnline, setIsOnline] = useState(navigator.onLine);
  const [isSyncing, setIsSyncing] = useState(false);

  useEffect(() => {
    const handleOnline = async () => {
      setIsOnline(true);
      syncService.isOnline = true;
      
      toast({
        title: 'Online',
        description: 'Verbindung wiederhergestellt. Synchronisiere Daten...',
      });
      
      setIsSyncing(true);
      await syncService.processSyncQueue();
      setIsSyncing(false);
    };

    const handleOffline = () => {
      setIsOnline(false);
      syncService.isOnline = false;
      
      toast({
        title: 'Offline',
        description: 'Keine Verbindung. Änderungen werden lokal gespeichert.',
        variant: 'destructive',
      });
    };

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  return { isOnline, isSyncing };
}
