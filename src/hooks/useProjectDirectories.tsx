import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from './useAuth';
import { toast } from '@/hooks/use-toast';

export function useProjectDirectories(projectId?: string) {
  const { user } = useAuth();
  const queryClient = useQueryClient();

  const { data: directories = [], isLoading } = useQuery({
    queryKey: ['project_directories', projectId],
    queryFn: async () => {
      if (!projectId) return [];
      
      const { data, error } = await supabase
        .from('project_directories')
        .select('*')
        .eq('project_id', projectId)
        .is('deleted_at', null)
        .order('order_index', { ascending: true });
      
      if (error) throw error;
      return data;
    },
    enabled: !!projectId && !!user,
  });

  const createDirectory = useMutation({
    mutationFn: async (name: string) => {
      if (!user || !projectId) throw new Error('Not authenticated or no project');
      
      const maxOrder = directories.reduce((max, dir) => Math.max(max, dir.order_index || 0), 0);
      
      const { data, error } = await supabase
        .from('project_directories')
        .insert({
          project_id: projectId,
          name: name.trim(),
          order_index: maxOrder + 1,
        })
        .select()
        .single();
      
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['project_directories', projectId] });
      toast({ title: 'Ordner erstellt' });
    },
    onError: (error: any) => {
      toast({
        title: 'Fehler beim Erstellen',
        description: error.message,
        variant: 'destructive',
      });
    },
  });

  const renameDirectory = useMutation({
    mutationFn: async ({ id, name }: { id: string; name: string }) => {
      const { error } = await supabase
        .from('project_directories')
        .update({ name: name.trim() })
        .eq('id', id);
      
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['project_directories', projectId] });
      toast({ title: 'Ordner umbenannt' });
    },
    onError: (error: any) => {
      toast({
        title: 'Fehler beim Umbenennen',
        description: error.message,
        variant: 'destructive',
      });
    },
  });

  const deleteDirectory = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from('project_directories')
        .update({ deleted_at: new Date().toISOString() })
        .eq('id', id);
      
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['project_directories', projectId] });
      toast({ title: 'Ordner gelöscht' });
    },
    onError: (error: any) => {
      toast({
        title: 'Fehler beim Löschen',
        description: error.message,
        variant: 'destructive',
      });
    },
  });

  return {
    directories,
    isLoading,
    createDirectory: createDirectory.mutate,
    isCreating: createDirectory.isPending,
    renameDirectory: renameDirectory.mutate,
    isRenaming: renameDirectory.isPending,
    deleteDirectory: deleteDirectory.mutate,
    isDeleting: deleteDirectory.isPending,
  };
}
