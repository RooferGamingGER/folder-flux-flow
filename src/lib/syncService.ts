import { supabase } from '@/integrations/supabase/client';
import { offlineStorage } from './offlineStorage';
import { toast } from '@/hooks/use-toast';

export type SyncStatus = 'synced' | 'pending' | 'syncing' | 'error';

export const syncService = {
  isOnline: navigator.onLine,
  
  async syncFolder(folder: any) {
    console.log('🔄 Syncing folder:', folder.id, 'user_id:', folder.user_id);
    
    if (!this.isOnline) {
      console.log('📴 Offline - adding to queue');
      await offlineStorage.addToSyncQueue({
        id: crypto.randomUUID(),
        operation: 'upsert',
        table: 'folders',
        data: folder,
      });
      return { ...folder, sync_status: 'pending', _queued: true };
    }
    
    try {
      // Session prüfen
      const { data: { session } } = await supabase.auth.getSession();
      console.log('👤 Current auth.uid():', session?.user?.id);
      console.log('📋 Folder user_id:', folder.user_id);
      
      if (!session) {
        throw new Error('Keine aktive Sitzung - bitte neu anmelden');
      }
      
      if (folder.user_id !== session.user.id) {
        console.warn('⚠️ user_id mismatch!', { folder_user_id: folder.user_id, session_user_id: session.user.id });
      }
      
      const { data, error } = await supabase
        .from('folders')
        .upsert({ ...folder, sync_status: 'synced' })
        .select()
        .single();
      
      if (error) {
        console.error('❌ Database error:', {
          message: error.message,
          details: error.details,
          hint: error.hint,
          code: error.code
        });
        throw error;
      }
      
      console.log('✅ Folder synced successfully:', data.id);
      return { ...data, _queued: false };
    } catch (error: any) {
      console.error('❌ Sync error:', error);
      
      toast({
        title: 'Fehler beim Speichern',
        description: error.message || 'Der Ordner konnte nicht gespeichert werden',
        variant: 'destructive',
      });
      
      await offlineStorage.addToSyncQueue({
        id: crypto.randomUUID(),
        operation: 'upsert',
        table: 'folders',
        data: folder,
      });
      return { ...folder, sync_status: 'error', _queued: true, _error: error.message };
    }
  },
  
  async syncProject(project: any) {
    console.log('🔄 Syncing project:', project.id, 'user_id:', project.user_id);
    
    if (!this.isOnline) {
      console.log('📴 Offline - adding to queue');
      await offlineStorage.addToSyncQueue({
        id: crypto.randomUUID(),
        operation: 'upsert',
        table: 'projects',
        data: project,
      });
      return { ...project, sync_status: 'pending', _queued: true };
    }
    
    try {
      // Session prüfen
      const { data: { session } } = await supabase.auth.getSession();
      console.log('👤 Current auth.uid():', session?.user?.id);
      console.log('📋 Project user_id:', project.user_id);
      
      if (!session) {
        throw new Error('Keine aktive Sitzung - bitte neu anmelden');
      }
      
      if (project.user_id !== session.user.id) {
        console.warn('⚠️ user_id mismatch!', { project_user_id: project.user_id, session_user_id: session.user.id });
      }
      
      const { data, error } = await supabase
        .from('projects')
        .upsert({ ...project, sync_status: 'synced' })
        .select()
        .single();
      
      if (error) {
        console.error('❌ Database error:', {
          message: error.message,
          details: error.details,
          hint: error.hint,
          code: error.code
        });
        throw error;
      }
      
      console.log('✅ Project synced successfully:', data.id);
      return { ...data, _queued: false };
    } catch (error: any) {
      console.error('❌ Sync error:', error);
      
      toast({
        title: 'Fehler beim Speichern',
        description: error.message || 'Das Projekt konnte nicht gespeichert werden',
        variant: 'destructive',
      });
      
      await offlineStorage.addToSyncQueue({
        id: crypto.randomUUID(),
        operation: 'upsert',
        table: 'projects',
        data: project,
      });
      return { ...project, sync_status: 'error', _queued: true, _error: error.message };
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
