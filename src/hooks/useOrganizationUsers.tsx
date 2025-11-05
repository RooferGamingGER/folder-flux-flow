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

  const createUser = useMutation({
    mutationFn: async ({ 
      firstName, 
      lastName, 
      email, 
      role 
    }: { 
      firstName: string; 
      lastName: string; 
      email: string; 
      role: string; 
    }) => {
      const { data, error } = await supabase.functions.invoke('create-user', {
        body: {
          firstName,
          lastName,
          email,
          role,
          organizationId
        }
      });

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['organization-users'] });
    },
    onError: (error: any) => {
      console.error('Fehler beim Erstellen:', error);
      toast({
        title: 'Fehler',
        description: error.message || 'Benutzer konnte nicht erstellt werden.',
        variant: 'destructive',
      });
    },
  });

  const updateUser = useMutation({
    mutationFn: async ({
      userId,
      firstName,
      lastName,
      role
    }: {
      userId: string;
      firstName?: string;
      lastName?: string;
      role?: string;
    }) => {
      const { data, error } = await supabase.functions.invoke('update-user', {
        body: {
          userId,
          firstName,
          lastName,
          role,
          organizationId
        }
      });

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['organization-users'] });
      toast({
        title: 'Benutzer aktualisiert',
        description: 'Die Änderungen wurden gespeichert.',
      });
    },
    onError: (error: any) => {
      console.error('Fehler beim Aktualisieren:', error);
      toast({
        title: 'Fehler',
        description: error.message || 'Benutzer konnte nicht aktualisiert werden.',
        variant: 'destructive',
      });
    },
  });

  const deleteUser = useMutation({
    mutationFn: async (userId: string) => {
      const { error } = await supabase.functions.invoke('delete-user', {
        body: { userId }
      });

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['organization-users'] });
      toast({
        title: 'Benutzer gelöscht',
        description: 'Der Benutzer wurde vollständig entfernt.',
      });
    },
    onError: (error: any) => {
      console.error('Fehler beim Löschen:', error);
      toast({
        title: 'Fehler',
        description: error.message || 'Benutzer konnte nicht gelöscht werden.',
        variant: 'destructive',
      });
    },
  });

  return {
    users,
    isLoading,
    createUser: createUser.mutateAsync,
    updateUser: updateUser.mutate,
    deleteUser: deleteUser.mutate,
    isCreating: createUser.isPending,
    isUpdating: updateUser.isPending,
    isDeleting: deleteUser.isPending,
  };
}
