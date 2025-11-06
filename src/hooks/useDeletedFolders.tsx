import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from './useAuth';
import { toast } from '@/hooks/use-toast';

export function useDeletedFolders() {
  const { user } = useAuth();
  const queryClient = useQueryClient();

  const { data: deletedFolders = [], isLoading } = useQuery({
    queryKey: ['deleted_folders', user?.id],
    queryFn: async () => {
      if (!user) return [];
      
      const { data, error } = await supabase
        .from('folders')
        .select('*')
        .not('deleted_at', 'is', null)
        .order('deleted_at', { ascending: false });
      
      if (error) throw error;
      return data || [];
    },
    enabled: !!user,
  });

  const restoreFolder = useMutation({
    mutationFn: async (folderId: string) => {
      if (!user) throw new Error('Not authenticated');
      
      const { error } = await supabase
        .from('folders')
        .update({ deleted_at: null })
        .eq('id', folderId);
      
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['deleted_folders'] });
      queryClient.invalidateQueries({ queryKey: ['folders'] });
      toast({ title: 'Ordner wiederhergestellt' });
    },
    onError: (error: any) => {
      toast({
        title: 'Fehler',
        description: error.message,
        variant: 'destructive',
      });
    },
  });

  const permanentlyDeleteFolder = useMutation({
    mutationFn: async (folderId: string) => {
      if (!user) throw new Error('Not authenticated');
      
      const { error } = await supabase
        .from('folders')
        .delete()
        .eq('id', folderId);
      
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['deleted_folders'] });
      toast({ title: 'Ordner dauerhaft gelöscht' });
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
    deletedFolders,
    isLoading,
    restoreFolder: restoreFolder.mutate,
    permanentlyDeleteFolder: permanentlyDeleteFolder.mutate,
  };
}
