import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from './useAuth';
import { toast } from '@/hooks/use-toast';

export function useDeletedProjects() {
  const { user } = useAuth();
  const queryClient = useQueryClient();

  const { data: deletedProjects = [], isLoading } = useQuery({
    queryKey: ['deleted_projects', user?.id],
    queryFn: async () => {
      if (!user) return [];
      
      const { data, error } = await supabase
        .from('projects')
        .select('*')
        .eq('user_id', user.id)
        .not('deleted_at', 'is', null)
        .order('deleted_at', { ascending: false });
      
      if (error) throw error;
      return data || [];
    },
    enabled: !!user,
  });

  const restoreProject = useMutation({
    mutationFn: async (projectId: string) => {
      if (!user) throw new Error('Not authenticated');
      
      const { error } = await supabase
        .from('projects')
        .update({ deleted_at: null })
        .eq('id', projectId);
      
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['deleted_projects'] });
      queryClient.invalidateQueries({ queryKey: ['projects'] });
      toast({ title: 'Projekt wiederhergestellt' });
    },
    onError: (error: any) => {
      toast({
        title: 'Fehler',
        description: error.message,
        variant: 'destructive',
      });
    },
  });

  const permanentlyDeleteProject = useMutation({
    mutationFn: async (projectId: string) => {
      if (!user) throw new Error('Not authenticated');
      
      const { error } = await supabase
        .from('projects')
        .delete()
        .eq('id', projectId);
      
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['deleted_projects'] });
      toast({ title: 'Projekt dauerhaft gelöscht' });
    },
    onError: (error: any) => {
      toast({
        title: 'Fehler',
        description: error.message,
        variant: 'destructive',
      });
    },
  });

  return {
    deletedProjects,
    isLoading,
    restoreProject: restoreProject.mutate,
    permanentlyDeleteProject: permanentlyDeleteProject.mutate,
  };
}
