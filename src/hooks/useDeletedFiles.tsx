import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { toast } from '@/hooks/use-toast';

export function useDeletedFiles() {
  const queryClient = useQueryClient();

  const { data: deletedFiles = [], isLoading } = useQuery({
    queryKey: ['deleted-files'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('project_files')
        .select(`
          *,
          projects!inner(title),
          profiles!project_files_created_by_fkey(first_name, last_name, email)
        `)
        .not('deleted_at', 'is', null)
        .order('deleted_at', { ascending: false });
      
      if (error) throw error;
      return data || [];
    },
  });

  const restoreFile = useMutation({
    mutationFn: async (fileId: string) => {
      const { error } = await supabase
        .from('project_files')
        .update({ deleted_at: null })
        .eq('id', fileId);
      
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['deleted-files'] });
      queryClient.invalidateQueries({ queryKey: ['project-files'] });
      toast({ title: 'Datei wiederhergestellt' });
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
    deletedFiles,
    isLoading,
    restoreFile: restoreFile.mutate,
    isRestoring: restoreFile.isPending,
  };
}
