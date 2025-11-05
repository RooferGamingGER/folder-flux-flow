import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from './useAuth';
import { toast } from '@/hooks/use-toast';

export interface Contact {
  id: string;
  project_id: string;
  name?: string;
  email?: string;
  phone?: string;
  created_at: string;
  deleted_at?: string;
  sync_status?: 'synced' | 'pending' | 'error';
}

export function useContacts(projectId?: string) {
  const { user } = useAuth();
  const queryClient = useQueryClient();

  const { data: contacts = [], isLoading } = useQuery({
    queryKey: ['contacts', projectId],
    queryFn: async () => {
      if (!projectId) return [];
      
      const { data, error } = await supabase
        .from('contacts')
        .select('*')
        .eq('project_id', projectId)
        .is('deleted_at', null)
        .order('created_at', { ascending: false });
      
      if (error) throw error;
      return data as Contact[];
    },
    enabled: !!projectId && !!user,
  });

  const addContact = useMutation({
    mutationFn: async (contact: { name?: string; email?: string; phone?: string }) => {
      if (!user || !projectId) throw new Error('Not authenticated or no project');
      
      // Validierung: mindestens ein Feld muss ausgefüllt sein
      if (!contact.name?.trim() && !contact.email?.trim() && !contact.phone?.trim()) {
        throw new Error('Bitte mindestens ein Feld ausfüllen');
      }
      
      const { data, error } = await supabase
        .from('contacts')
        .insert({
          project_id: projectId,
          name: contact.name?.trim() || null,
          email: contact.email?.trim() || null,
          phone: contact.phone?.trim() || null,
        })
        .select()
        .single();
      
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['contacts', projectId] });
      toast({ title: 'Kontakt hinzugefügt' });
    },
    onError: (error: any) => {
      toast({
        title: 'Fehler beim Hinzufügen',
        description: error.message,
        variant: 'destructive',
      });
    },
  });

  const updateContact = useMutation({
    mutationFn: async ({ id, ...updates }: Partial<Contact> & { id: string }) => {
      const { error } = await supabase
        .from('contacts')
        .update(updates)
        .eq('id', id);
      
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['contacts', projectId] });
      toast({ title: 'Kontakt aktualisiert' });
    },
    onError: (error: any) => {
      toast({
        title: 'Fehler beim Aktualisieren',
        description: error.message,
        variant: 'destructive',
      });
    },
  });

  const deleteContact = useMutation({
    mutationFn: async (contactId: string) => {
      const { error } = await supabase
        .from('contacts')
        .update({ deleted_at: new Date().toISOString() })
        .eq('id', contactId);
      
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['contacts', projectId] });
      toast({ title: 'Kontakt gelöscht' });
    },
    onError: (error: any) => {
      toast({
        title: 'Fehler beim Löschen',
        description: error.message,
        variant: 'destructive',
      });
    },
  });

  return {
    contacts,
    isLoading,
    addContact: addContact.mutate,
    isAdding: addContact.isPending,
    updateContact: updateContact.mutate,
    isUpdating: updateContact.isPending,
    deleteContact: deleteContact.mutate,
    isDeleting: deleteContact.isPending,
  };
}
