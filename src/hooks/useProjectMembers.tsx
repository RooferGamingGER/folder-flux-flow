import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from './useAuth';
import { toast } from '@/hooks/use-toast';

export function useProjectMembers(projectId?: string) {
  const { user } = useAuth();
  const queryClient = useQueryClient();

  // Query to check access type for the current user
  const { data: accessInfo } = useQuery({
    queryKey: ['project-access-info', projectId, user?.id],
    queryFn: async () => {
      if (!projectId || !user) return null;
      
      // Check all access paths
      const [projectData, folderMemberData, userRoleData] = await Promise.all([
        // Is user the project owner?
        supabase
          .from('projects')
          .select('user_id, folder_id')
          .eq('id', projectId)
          .maybeSingle(),
        
        // Does user have access via folder_members?
        supabase
          .from('projects')
          .select(`
            folder_id,
            folders!inner(
              folder_members!inner(user_id)
            )
          `)
          .eq('id', projectId)
          .eq('folders.folder_members.user_id', user.id)
          .maybeSingle(),
        
        // Does user have has_full_access?
        supabase
          .from('user_roles')
          .select('role')
          .eq('user_id', user.id)
          .maybeSingle()
      ]);
      
      const isOwner = projectData.data?.user_id === user.id;
      const hasFullAccess = ['geschaeftsfuehrer', 'buerokraft'].includes(
        userRoleData.data?.role
      );
      const hasFolderAccess = !!folderMemberData.data;
      
      return {
        isOwner,
        hasFullAccess,
        hasFolderAccess,
        canLeave: !isOwner && !hasFullAccess
      };
    },
    enabled: !!projectId && !!user,
  });

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

  // Query for folder members (indirect access)
  const { data: folderMembers = [] } = useQuery({
    queryKey: ['project-folder-members', projectId],
    queryFn: async () => {
      if (!projectId) return [];
      
      // 1. Get folder_id of the project
      const { data: project } = await supabase
        .from('projects')
        .select('folder_id')
        .eq('id', projectId)
        .maybeSingle();
      
      if (!project?.folder_id) return [];
      
      // 2. Get all folder members
      const { data, error } = await supabase
        .from('folder_members')
        .select('user_id, added_at')
        .eq('folder_id', project.folder_id);
      
      if (error) throw error;
      
      // 3. Load profiles separately
      const memberData = await Promise.all(
        (data || []).map(async (member: any) => {
          const { data: profile } = await supabase
            .from('profiles')
            .select('id, first_name, last_name, email')
            .eq('id', member.user_id)
            .maybeSingle();
          
          return { 
            ...member, 
            profile,
            isFromFolder: true,
            id: `folder-${member.user_id}`
          };
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

  const leaveProject = useMutation({
    mutationFn: async () => {
      if (!projectId || !user) throw new Error('Keine Projekt-ID oder User');

      // Prüfen ob User direktes Mitglied ist
      const { data: memberData } = await supabase
        .from('project_members')
        .select('id')
        .eq('project_id', projectId)
        .eq('user_id', user.id)
        .maybeSingle();
      
      const isMember = !!memberData;
      
      if (isMember) {
        // Direktes Mitglied: Aus project_members entfernen
        const { error } = await supabase
          .from('project_members')
          .delete()
          .eq('project_id', projectId)
          .eq('user_id', user.id);
        
        if (error) throw error;
      } else {
        // Nur Ordner-Zugriff: In project_exclusions eintragen
        const { error } = await supabase
          .from('project_exclusions')
          .insert({
            project_id: projectId,
            user_id: user.id,
          });
        
        if (error) throw error;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['project-members'] });
      queryClient.invalidateQueries({ queryKey: ['projects'] });
      queryClient.invalidateQueries({ queryKey: ['folders'] });
      toast({
        title: 'Projekt verlassen',
        description: 'Du hast das Projekt verlassen.',
      });
      
      // Seite neu laden nach 1,5 Sekunden damit Projekt verschwindet
      setTimeout(() => {
        window.location.reload();
      }, 1500);
    },
    onError: (error: any) => {
      console.error('Fehler beim Verlassen:', error);
      toast({
        title: 'Fehler',
        description: error.message || 'Projekt konnte nicht verlassen werden.',
        variant: 'destructive',
      });
    },
  });

  return {
    members: [...members, ...folderMembers],
    directMembers: members,
    folderMembers: folderMembers,
    isLoading,
    accessInfo,
    addMember: addMember.mutate,
    removeMember: removeMember.mutate,
    leaveProject: leaveProject.mutate,
    isAdding: addMember.isPending,
    isRemoving: removeMember.isPending,
    isLeaving: leaveProject.isPending,
  };
}
