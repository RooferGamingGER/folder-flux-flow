import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from './useAuth';
import { toast } from '@/hooks/use-toast';

export function useProjectMembers(projectId?: string) {
  const { user } = useAuth();
  const queryClient = useQueryClient();

  const { data: members = [], isLoading } = useQuery({
    queryKey: ['project-members', projectId],
    queryFn: async () => {
      if (!projectId) return [];
      
      const { data, error } = await supabase
        .from('project_members')
        .select('*')
        .eq('project_id', projectId)
        .order('added_at', { ascending: false });
      
      if (error) throw error;
      
      // Fetch profiles separately
      const memberData = await Promise.all(
        (data || []).map(async (member: any) => {
          const { data: profile } = await supabase
            .from('profiles')
            .select('id, first_name, last_name, email')
            .eq('id', member.user_id)
            .single();
          
          return { ...member, profile };
        })
      );

      return memberData;
    },
    enabled: !!projectId && !!user,
  });

  const addMember = useMutation({
    mutationFn: async (userId: string) => {
      if (!projectId) throw new Error('Keine Projekt-ID');

      const { error } = await supabase
        .from('project_members')
        .insert({
          project_id: projectId,
          user_id: userId,
          added_by: user?.id,
        });

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['project-members', projectId] });
      toast({
        title: 'Mitglied hinzugefügt',
        description: 'Das Mitglied wurde erfolgreich zum Projekt hinzugefügt.',
      });
    },
    onError: (error: any) => {
      console.error('Fehler beim Hinzufügen:', error);
      toast({
        title: 'Fehler',
        description: error.message || 'Mitglied konnte nicht hinzugefügt werden.',
        variant: 'destructive',
      });
    },
  });

  const removeMember = useMutation({
    mutationFn: async (userId: string) => {
      if (!projectId) throw new Error('Keine Projekt-ID');

      const { error } = await supabase
        .from('project_members')
        .delete()
        .eq('project_id', projectId)
        .eq('user_id', userId);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['project-members', projectId] });
      toast({
        title: 'Mitglied entfernt',
        description: 'Das Mitglied wurde erfolgreich vom Projekt entfernt.',
      });
    },
    onError: (error: any) => {
      console.error('Fehler beim Entfernen:', error);
      toast({
        title: 'Fehler',
        description: error.message || 'Mitglied konnte nicht entfernt werden.',
        variant: 'destructive',
      });
    },
  });

  return {
    members,
    isLoading,
    addMember: addMember.mutate,
    removeMember: removeMember.mutate,
    isAdding: addMember.isPending,
    isRemoving: removeMember.isPending,
  };
}
