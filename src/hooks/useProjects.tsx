import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { syncService } from '@/lib/syncService';
import { offlineStorage } from '@/lib/offlineStorage';
import { useAuth } from './useAuth';
import { toast } from '@/hooks/use-toast';

export function useProjects(folderId?: string) {
  const { user } = useAuth();
  const queryClient = useQueryClient();

  const { data: projects = [], isLoading } = useQuery({
    queryKey: ['projects', folderId, user?.id],
    queryFn: async () => {
      if (!user) return [];
      
      // Try online first
      if (navigator.onLine) {
        let query = supabase
          .from('projects')
          .select('*')
          .eq('user_id', user.id)
          .is('deleted_at', null);
        
        if (folderId) {
          query = query.eq('folder_id', folderId);
        }
        
        const { data, error } = await query.order('created_at', { ascending: false });
        
        if (error) throw error;
        
        // Cache offline
        await offlineStorage.setProjects(data);
        return data;
      }
      
      // Fallback to offline
      const cached = await offlineStorage.getProjects();
      return folderId ? cached.filter((p: any) => p.folder_id === folderId) : cached;
    },
    enabled: !!user,
  });

  const createProject = useMutation({
    mutationFn: async ({ title, folderId }: { title: string; folderId: string }) => {
      if (!user) throw new Error('Not authenticated');
      
      const projectId = crypto.randomUUID();
      const project = {
        id: projectId,
        title,
        folder_id: folderId,
        archived: false,
        user_id: user.id,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      };

      const syncedProject = await syncService.syncProject(project);
      
      // Create default directories
      if (navigator.onLine) {
        const dirs = ['Bilder', 'Dokumente'];
        for (let i = 0; i < dirs.length; i++) {
          await supabase.from('project_directories').insert({
            project_id: projectId,
            name: dirs[i],
            order_index: i,
          });
        }
        
        // Create default details
        await supabase.from('project_details').insert({
          project_id: projectId,
          projektname: title,
        });
      }
      
      return syncedProject;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['projects'] });
      toast({ title: 'Projekt erstellt' });
    },
  });

  const deleteProject = useMutation({
    mutationFn: async (projectId: string) => {
      if (!user) throw new Error('Not authenticated');
      
      if (navigator.onLine) {
        const { error } = await supabase
          .from('projects')
          .update({ deleted_at: new Date().toISOString() })
          .eq('id', projectId);
        
        if (error) throw error;
      } else {
        await offlineStorage.addToSyncQueue({
          id: crypto.randomUUID(),
          operation: 'update',
          table: 'projects',
          data: { id: projectId, deleted_at: new Date().toISOString() },
        });
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['projects'] });
      toast({ title: 'Projekt gelöscht' });
    },
  });

  const toggleArchive = useMutation({
    mutationFn: async ({ id, archived }: { id: string; archived: boolean }) => {
      if (!user) throw new Error('Not authenticated');
      
      const project = { id, archived: !archived, updated_at: new Date().toISOString() };
      return await syncService.syncProject(project);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['projects'] });
    },
  });

  return {
    projects,
    isLoading,
    createProject: createProject.mutate,
    deleteProject: deleteProject.mutate,
    toggleArchive: toggleArchive.mutate,
  };
}
