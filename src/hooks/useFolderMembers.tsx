import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from './useAuth';
import { toast } from '@/hooks/use-toast';

export function useFolderMembers(folderId?: string) {
  const { user } = useAuth();
  const queryClient = useQueryClient();

  // Query to check access type for the current user
  const { data: accessInfo } = useQuery({
    queryKey: ['folder-access-info', folderId, user?.id],
    queryFn: async () => {
      if (!folderId || !user) return null;
      
      // Check all access paths
      const [folderData, userRoleData] = await Promise.all([
        // Is user the folder owner?
        supabase
          .from('folders')
          .select('user_id')
          .eq('id', folderId)
          .maybeSingle(),
        
        // Does user have has_full_access?
        supabase
          .from('user_roles')
          .select('role')
          .eq('user_id', user.id)
          .maybeSingle()
      ]);
      
      const isOwner = folderData.data?.user_id === user.id;
      const hasFullAccess = ['geschaeftsfuehrer', 'buerokraft'].includes(
        userRoleData.data?.role
      );
      
      return {
        isOwner,
        hasFullAccess,
        canLeave: !isOwner && !hasFullAccess
      };
    },
    enabled: !!folderId && !!user,
  });

  const { data: members = [], isLoading } = useQuery({
    queryKey: ['folder-members', folderId],
    queryFn: async () => {
      if (!folderId) return [];
      
      const { data, error } = await supabase
        .from('folder_members')
        .select('*')
        .eq('folder_id', folderId)
        .order('added_at', { ascending: false });
      
      if (error) throw error;

      // Profile separat laden
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
    enabled: !!folderId && !!user,
  });

  const addMember = useMutation({
    mutationFn: async (userId: string) => {
      if (!folderId) throw new Error('Keine Ordner-ID');

      const { error } = await supabase
        .from('folder_members')
        .insert({
          folder_id: folderId,
          user_id: userId,
          added_by: user?.id,
        });

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['folder-members', folderId] });
      toast({
        title: 'Mitglied hinzugefügt',
        description: 'Das Mitglied hat jetzt Zugriff auf alle Projekte in diesem Ordner.',
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
      if (!folderId) throw new Error('Keine Ordner-ID');

      const { error } = await supabase
        .from('folder_members')
        .delete()
        .eq('folder_id', folderId)
        .eq('user_id', userId);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['folder-members', folderId] });
      toast({
        title: 'Mitglied entfernt',
        description: 'Der Zugriff auf die Projekte in diesem Ordner wurde entfernt.',
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

  const leaveFolder = useMutation({
    mutationFn: async () => {
      if (!folderId || !user) throw new Error('Keine Ordner-ID oder User');

      const { error } = await supabase
        .from('folder_members')
        .delete()
        .eq('folder_id', folderId)
        .eq('user_id', user.id);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['folder-members'] });
      queryClient.invalidateQueries({ queryKey: ['folders'] });
      toast({
        title: 'Ordner verlassen',
        description: 'Du hast den Ordner verlassen.',
      });
    },
    onError: (error: any) => {
      console.error('Fehler beim Verlassen:', error);
      toast({
        title: 'Fehler',
        description: error.message || 'Ordner konnte nicht verlassen werden.',
        variant: 'destructive',
      });
    },
  });

  return {
    members,
    isLoading,
    accessInfo,
    addMember: addMember.mutate,
    removeMember: removeMember.mutate,
    leaveFolder: leaveFolder.mutate,
    isAdding: addMember.isPending,
    isRemoving: removeMember.isPending,
    isLeaving: leaveFolder.isPending,
  };
}
