import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { syncService } from '@/lib/syncService';
import { offlineStorage } from '@/lib/offlineStorage';
import { useAuth } from './useAuth';
import { useEffect } from 'react';

export function useMessages(projectId?: string) {
  const { user } = useAuth();
  const queryClient = useQueryClient();

  const { data: messages = [], isLoading } = useQuery({
    queryKey: ['messages', projectId, user?.id],
    queryFn: async () => {
      if (!user || !projectId) return [];
      
      // Try online first
      if (navigator.onLine) {
        const { data, error } = await supabase
          .from('messages')
          .select(`
            *,
            profile:profiles!user_id(
              id,
              first_name,
              last_name,
              email
            )
          `)
          .eq('project_id', projectId)
          .is('deleted_at', null)
          .order('timestamp', { ascending: true });
        
        if (error) throw error;
        
        // Cache offline
        await offlineStorage.setMessages(projectId, data);
        return data;
      }
      
      // Fallback to offline
      return await offlineStorage.getMessages(projectId);
    },
    enabled: !!user && !!projectId,
  });

  // Realtime subscription
  useEffect(() => {
    if (!projectId || !navigator.onLine) return;

    const channel = supabase
      .channel(`messages:${projectId}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'messages',
          filter: `project_id=eq.${projectId}`,
        },
        () => {
          queryClient.invalidateQueries({ queryKey: ['messages', projectId] });
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [projectId, queryClient]);

  const sendMessage = useMutation({
    mutationFn: async ({ type, content }: { type: string; content: any }) => {
      if (!user || !projectId) throw new Error('Not authenticated or no project');
      
      const message = {
        id: crypto.randomUUID(),
        project_id: projectId,
        user_id: user.id,
        type,
        content,
        timestamp: new Date().toISOString(),
      };

      return await syncService.syncMessage(message);
    },
    onSuccess: (data) => {
      if (!data._queued) {
        queryClient.invalidateQueries({ queryKey: ['messages', projectId] });
      }
    },
    onError: (error: any) => {
      console.error('Message send error:', error);
    },
  });

  const deleteMessage = useMutation({
    mutationFn: async (messageId: string) => {
      if (!user) throw new Error('Not authenticated');
      
      const { error } = await supabase
        .from('messages')
        .update({ deleted_at: new Date().toISOString() })
        .eq('id', messageId);
      
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['messages', projectId] });
    },
    onError: (error: any) => {
      console.error('Delete message error:', error);
    },
  });

  return {
    messages,
    isLoading,
    sendMessage: sendMessage.mutate,
    deleteMessage: deleteMessage.mutate,
    isDeleting: deleteMessage.isPending,
  };
}
