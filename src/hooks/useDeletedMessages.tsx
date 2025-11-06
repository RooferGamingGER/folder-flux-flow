import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { toast } from '@/hooks/use-toast';

export function useDeletedMessages() {
  const queryClient = useQueryClient();

  const { data: deletedMessages = [], isLoading } = useQuery({
    queryKey: ['deleted-messages'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('messages')
        .select(`
          *,
          projects!inner(title),
          profiles!messages_user_id_fkey(first_name, last_name, email)
        `)
        .not('deleted_at', 'is', null)
        .order('deleted_at', { ascending: false });
      
      if (error) throw error;
      return data || [];
    },
  });

  const restoreMessage = useMutation({
    mutationFn: async (messageId: string) => {
      const { error } = await supabase
        .from('messages')
        .update({ deleted_at: null })
        .eq('id', messageId);
      
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['deleted-messages'] });
      queryClient.invalidateQueries({ queryKey: ['messages'] });
      toast({ title: 'Nachricht wiederhergestellt' });
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
    deletedMessages,
    isLoading,
    restoreMessage: restoreMessage.mutate,
    isRestoring: restoreMessage.isPending,
  };
}
