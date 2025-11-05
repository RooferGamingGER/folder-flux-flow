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
    console.log('🔄 Syncing message:', message.id, 'project_id:', message.project_id);
    
    if (!this.isOnline) {
      console.log('📴 Offline - adding to queue');
      await offlineStorage.addToSyncQueue({
        id: crypto.randomUUID(),
        operation: 'insert',
        table: 'messages',
        data: message,
      });
      return { ...message, sync_status: 'pending', _queued: true };
    }
    
    try {
      // Session prüfen
      const { data: { session } } = await supabase.auth.getSession();
      console.log('👤 Current auth.uid():', session?.user?.id);
      console.log('📋 Message user_id:', message.user_id);
      
      if (!session) {
        throw new Error('Keine aktive Sitzung - bitte neu anmelden');
      }
      
      if (message.user_id !== session.user.id) {
        console.warn('⚠️ user_id mismatch!', { message_user_id: message.user_id, session_user_id: session.user.id });
      }
      
      const { data, error } = await supabase
        .from('messages')
        .insert({ 
          ...message, 
          sync_status: 'synced',
          sender: 'user' // Für UI-Kompatibilität
        })
        .select(`
          *,
          profile:profiles!user_id(
            id,
            first_name,
            last_name,
            email
          )
        `)
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
      
      console.log('✅ Message synced successfully:', data.id);
      return { ...data, _queued: false };
    } catch (error: any) {
      console.error('❌ Sync error:', error);
      
      toast({
        title: 'Fehler beim Senden',
        description: error.message || 'Die Nachricht konnte nicht gesendet werden',
        variant: 'destructive',
      });
      
      await offlineStorage.addToSyncQueue({
        id: crypto.randomUUID(),
        operation: 'insert',
        table: 'messages',
        data: message,
      });
      return { ...message, sync_status: 'error', _queued: true, _error: error.message };
    }
  },
  
  async syncProjectDetails(details: any) {
    console.log('🔄 Syncing project_details:', details.project_id);
    
    if (!this.isOnline) {
      console.log('📴 Offline - adding to queue');
      await offlineStorage.addToSyncQueue({
        id: crypto.randomUUID(),
        operation: 'upsert',
        table: 'project_details',
        data: details,
      });
      return { ...details, sync_status: 'pending', _queued: true };
    }
    
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        throw new Error('Keine aktive Sitzung - bitte neu anmelden');
      }
      
      const { data, error } = await supabase
        .from('project_details')
        .upsert({ ...details, sync_status: 'synced' })
        .select()
        .single();
      
      if (error) throw error;
      
      console.log('✅ Project details synced successfully');
      return { ...data, _queued: false };
    } catch (error: any) {
      console.error('❌ Sync error:', error);
      
      await offlineStorage.addToSyncQueue({
        id: crypto.randomUUID(),
        operation: 'upsert',
        table: 'project_details',
        data: details,
      });
      return { ...details, sync_status: 'error', _queued: true, _error: error.message };
    }
  },
  
  async syncProjectDirectory(directory: any) {
    console.log('🔄 Syncing project_directory:', directory.id);
    
    if (!this.isOnline) {
      console.log('📴 Offline - adding to queue');
      await offlineStorage.addToSyncQueue({
        id: crypto.randomUUID(),
        operation: 'upsert',
        table: 'project_directories',
        data: directory,
      });
      return { ...directory, sync_status: 'pending', _queued: true };
    }
    
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        throw new Error('Keine aktive Sitzung - bitte neu anmelden');
      }
      
      const { data, error } = await supabase
        .from('project_directories')
        .upsert({ ...directory, sync_status: 'synced' })
        .select()
        .single();
      
      if (error) throw error;
      
      console.log('✅ Project directory synced successfully');
      return { ...data, _queued: false };
    } catch (error: any) {
      console.error('❌ Sync error:', error);
      
      await offlineStorage.addToSyncQueue({
        id: crypto.randomUUID(),
        operation: 'upsert',
        table: 'project_directories',
        data: directory,
      });
      return { ...directory, sync_status: 'error', _queued: true, _error: error.message };
    }
  },
  
  async syncNote(note: any) {
    console.log('🔄 Syncing note:', note.id);
    
    if (!this.isOnline) {
      console.log('📴 Offline - adding to queue');
      await offlineStorage.addToSyncQueue({
        id: crypto.randomUUID(),
        operation: 'insert',
        table: 'notes',
        data: note,
      });
      return { ...note, sync_status: 'pending', _queued: true };
    }
    
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        throw new Error('Keine aktive Sitzung - bitte neu anmelden');
      }
      
      const { data, error } = await supabase
        .from('notes')
        .insert({ ...note, sync_status: 'synced' })
        .select()
        .single();
      
      if (error) throw error;
      
      console.log('✅ Note synced successfully');
      return { ...data, _queued: false };
    } catch (error: any) {
      console.error('❌ Sync error:', error);
      
      await offlineStorage.addToSyncQueue({
        id: crypto.randomUUID(),
        operation: 'insert',
        table: 'notes',
        data: note,
      });
      return { ...note, sync_status: 'error', _queued: true, _error: error.message };
    }
  },
  
  async syncContact(contact: any) {
    console.log('🔄 Syncing contact:', contact.id);
    
    if (!this.isOnline) {
      console.log('📴 Offline - adding to queue');
      await offlineStorage.addToSyncQueue({
        id: crypto.randomUUID(),
        operation: 'insert',
        table: 'contacts',
        data: contact,
      });
      return { ...contact, sync_status: 'pending', _queued: true };
    }
    
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        throw new Error('Keine aktive Sitzung - bitte neu anmelden');
      }
      
      const { data, error } = await supabase
        .from('contacts')
        .insert({ ...contact, sync_status: 'synced' })
        .select()
        .single();
      
      if (error) throw error;
      
      console.log('✅ Contact synced successfully');
      return { ...data, _queued: false };
    } catch (error: any) {
      console.error('❌ Sync error:', error);
      
      await offlineStorage.addToSyncQueue({
        id: crypto.randomUUID(),
        operation: 'insert',
        table: 'contacts',
        data: contact,
      });
      return { ...contact, sync_status: 'error', _queued: true, _error: error.message };
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
