import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from './useAuth';
import { useUserRole } from './useUserRole';
import { toast } from '@/hooks/use-toast';

export function useOrganizationUsers() {
  const { user } = useAuth();
  const { organizationId, isAdmin } = useUserRole();
  const queryClient = useQueryClient();

  const { data: users = [], isLoading } = useQuery({
    queryKey: ['organization-users', organizationId],
    queryFn: async () => {
      if (!organizationId) return [];
      
      const { data, error } = await supabase
        .from('user_roles')
        .select('*')
        .eq('organization_id', organizationId)
        .order('created_at', { ascending: false });
      
      if (error) throw error;
      
      // Fetch profiles separately
      const userData = await Promise.all(
        (data || []).map(async (userRole: any) => {
          const { data: profile } = await supabase
            .from('profiles')
            .select('id, first_name, last_name, email')
            .eq('id', userRole.user_id)
            .single();
          
          return { ...userRole, profile };
        })
      );

      return userData;
    },
    enabled: !!user && !!organizationId && isAdmin,
  });

  const inviteUser = useMutation({
    mutationFn: async ({ email, role }: { email: string; role: string }) => {
      const { data: profile } = await supabase
        .from('profiles')
        .select('id')
        .eq('email', email)
        .maybeSingle();

      if (!profile) {
        throw new Error('Benutzer nicht gefunden. Benutzer muss sich zuerst registrieren.');
      }

      const { error } = await supabase
        .from('user_roles')
        .insert([{
          user_id: profile.id,
          role: role as any,
          organization_id: organizationId,
          created_by: user?.id,
        }]);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['organization-users'] });
      toast({
        title: 'Benutzer eingeladen',
        description: 'Der Benutzer wurde erfolgreich zur Organisation hinzugefügt.',
      });
    },
    onError: (error: any) => {
      console.error('Fehler beim Einladen:', error);
      toast({
        title: 'Fehler',
        description: error.message || 'Benutzer konnte nicht eingeladen werden.',
        variant: 'destructive',
      });
    },
  });

  const removeUser = useMutation({
    mutationFn: async (userId: string) => {
      const { error } = await supabase
        .from('user_roles')
        .delete()
        .eq('user_id', userId)
        .eq('organization_id', organizationId);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['organization-users'] });
      toast({
        title: 'Benutzer entfernt',
        description: 'Der Benutzer wurde erfolgreich aus der Organisation entfernt.',
      });
    },
    onError: (error: any) => {
      console.error('Fehler beim Entfernen:', error);
      toast({
        title: 'Fehler',
        description: error.message || 'Benutzer konnte nicht entfernt werden.',
        variant: 'destructive',
      });
    },
  });

  return {
    users,
    isLoading,
    inviteUser: inviteUser.mutate,
    removeUser: removeUser.mutate,
    isInviting: inviteUser.isPending,
    isRemoving: removeUser.isPending,
  };
}
