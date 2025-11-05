import { supabase } from '@/integrations/supabase/client';
import { offlineStorage } from './offlineStorage';
import { toast } from '@/hooks/use-toast';

export type SyncStatus = 'synced' | 'pending' | 'syncing' | 'error';

export const syncService = {
  isOnline: navigator.onLine,
  
  async syncFolder(folder: any) {
    if (!this.isOnline) {
      await offlineStorage.addToSyncQueue({
        id: crypto.randomUUID(),
        operation: 'upsert',
        table: 'folders',
        data: folder,
      });
      return { ...folder, sync_status: 'pending' };
    }
    
    try {
      const { data, error } = await supabase
        .from('folders')
        .upsert({ ...folder, sync_status: 'synced' })
        .select()
        .single();
      
      if (error) throw error;
      return data;
    } catch (error) {
      console.error('Sync error:', error);
      await offlineStorage.addToSyncQueue({
        id: crypto.randomUUID(),
        operation: 'upsert',
        table: 'folders',
        data: folder,
      });
      return { ...folder, sync_status: 'error' };
    }
  },
  
  async syncProject(project: any) {
    if (!this.isOnline) {
      await offlineStorage.addToSyncQueue({
        id: crypto.randomUUID(),
        operation: 'upsert',
        table: 'projects',
        data: project,
      });
      return { ...project, sync_status: 'pending' };
    }
    
    try {
      const { data, error } = await supabase
        .from('projects')
        .upsert({ ...project, sync_status: 'synced' })
        .select()
        .single();
      
      if (error) throw error;
      return data;
    } catch (error) {
      console.error('Sync error:', error);
      await offlineStorage.addToSyncQueue({
        id: crypto.randomUUID(),
        operation: 'upsert',
        table: 'projects',
        data: project,
      });
      return { ...project, sync_status: 'error' };
    }
  },
  
  async syncMessage(message: any) {
    if (!this.isOnline) {
      await offlineStorage.addToSyncQueue({
        id: crypto.randomUUID(),
        operation: 'insert',
        table: 'messages',
        data: message,
      });
      return { ...message, sync_status: 'pending' };
    }
    
    try {
      const { data, error } = await supabase
        .from('messages')
        .insert({ ...message, sync_status: 'synced' })
        .select()
        .single();
      
      if (error) throw error;
      return data;
    } catch (error) {
      console.error('Sync error:', error);
      await offlineStorage.addToSyncQueue({
        id: crypto.randomUUID(),
        operation: 'insert',
        table: 'messages',
        data: message,
      });
      return { ...message, sync_status: 'error' };
    }
  },
  
  async processSyncQueue() {
    if (!this.isOnline) return;
    
    const queue = await offlineStorage.getSyncQueue();
    if (queue.length === 0) return;
    
    toast({
      title: 'Synchronisierung',
      description: `${queue.length} Elemente werden synchronisiert...`,
    });
    
    for (const item of queue) {
      try {
        if (item.operation === 'upsert') {
          await supabase.from(item.table).upsert(item.data);
        } else if (item.operation === 'insert') {
          await supabase.from(item.table).insert(item.data);
        } else if (item.operation === 'delete') {
          await supabase.from(item.table).delete().eq('id', item.data.id);
        }
        await offlineStorage.removeFromSyncQueue(item.id);
      } catch (error) {
        console.error('Queue processing error:', error);
      }
    }
    
    toast({
      title: 'Synchronisierung abgeschlossen',
      description: 'Alle Änderungen wurden synchronisiert.',
    });
  },
};
