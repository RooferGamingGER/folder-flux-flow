import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { syncService } from '@/lib/syncService';
import { offlineStorage } from '@/lib/offlineStorage';
import { useAuth } from './useAuth';
import { toast } from '@/hooks/use-toast';

export function useFolders() {
  const { user } = useAuth();
  const queryClient = useQueryClient();

  const { data: folders = [], isLoading } = useQuery({
    queryKey: ['folders', user?.id],
    queryFn: async () => {
      if (!user) return [];
      
      // Try online first
      if (navigator.onLine) {
        const { data, error } = await supabase
          .from('folders')
          .select('*')
          .eq('user_id', user.id)
          .is('deleted_at', null)
          .order('created_at', { ascending: false });
        
        if (error) throw error;
        
        // Cache offline
        await offlineStorage.setFolders(data);
        return data;
      }
      
      // Fallback to offline
      return await offlineStorage.getFolders();
    },
    enabled: !!user,
  });

  const createFolder = useMutation({
    mutationFn: async (name: string) => {
      if (!user) throw new Error('Not authenticated');
      
      const folder = {
        id: crypto.randomUUID(),
        name,
        archived: false,
        user_id: user.id,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      };

      return await syncService.syncFolder(folder);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['folders'] });
      toast({ title: 'Ordner erstellt' });
    },
  });

  const deleteFolder = useMutation({
    mutationFn: async (folderId: string) => {
      if (!user) throw new Error('Not authenticated');
      
      if (navigator.onLine) {
        const { error } = await supabase
          .from('folders')
          .update({ deleted_at: new Date().toISOString() })
          .eq('id', folderId);
        
        if (error) throw error;
      } else {
        await offlineStorage.addToSyncQueue({
          id: crypto.randomUUID(),
          operation: 'update',
          table: 'folders',
          data: { id: folderId, deleted_at: new Date().toISOString() },
        });
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['folders'] });
      toast({ title: 'Ordner gelöscht' });
    },
  });

  const toggleArchive = useMutation({
    mutationFn: async ({ id, archived }: { id: string; archived: boolean }) => {
      if (!user) throw new Error('Not authenticated');
      
      const folder = { id, archived: !archived, updated_at: new Date().toISOString() };
      return await syncService.syncFolder(folder);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['folders'] });
    },
  });

  return {
    folders,
    isLoading,
    createFolder: createFolder.mutate,
    deleteFolder: deleteFolder.mutate,
    toggleArchive: toggleArchive.mutate,
  };
}
