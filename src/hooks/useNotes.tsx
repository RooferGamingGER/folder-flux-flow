import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from './useAuth';
import { toast } from '@/hooks/use-toast';

export interface Note {
  id: string;
  project_id: string;
  text: string;
  created_at: string;
  deleted_at?: string;
  sync_status?: 'synced' | 'pending' | 'error';
}

export function useNotes(projectId?: string) {
  const { user } = useAuth();
  const queryClient = useQueryClient();

  const { data: notes = [], isLoading } = useQuery({
    queryKey: ['notes', projectId],
    queryFn: async () => {
      if (!projectId) return [];
      
      const { data, error } = await supabase
        .from('notes')
        .select('*')
        .eq('project_id', projectId)
        .is('deleted_at', null)
        .order('created_at', { ascending: false });
      
      if (error) throw error;
      return data as Note[];
    },
    enabled: !!projectId && !!user,
  });

  const addNote = useMutation({
    mutationFn: async (text: string) => {
      if (!user || !projectId) throw new Error('Not authenticated or no project');
      
      const { data, error } = await supabase
        .from('notes')
        .insert({
          project_id: projectId,
          text: text.trim(),
        })
        .select()
        .single();
      
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['notes', projectId] });
      toast({ title: 'Notiz hinzugefügt' });
    },
    onError: (error: any) => {
      toast({
        title: 'Fehler beim Hinzufügen',
        description: error.message,
        variant: 'destructive',
      });
    },
  });

  const deleteNote = useMutation({
    mutationFn: async (noteId: string) => {
      const { error } = await supabase
        .from('notes')
        .update({ deleted_at: new Date().toISOString() })
        .eq('id', noteId);
      
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['notes', projectId] });
      toast({ title: 'Notiz gelöscht' });
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
    notes,
    isLoading,
    addNote: addNote.mutate,
    isAdding: addNote.isPending,
    deleteNote: deleteNote.mutate,
    isDeleting: deleteNote.isPending,
  };
}
