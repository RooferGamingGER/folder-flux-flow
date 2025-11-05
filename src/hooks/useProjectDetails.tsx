import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from './useAuth';
import { toast } from '@/hooks/use-toast';

export interface ProjectDetailsData {
  projektname?: string;
  auftragsnummer?: string;
  projektstatus?: string;
  ansprechpartner?: string;
  notiz?: string;
  startdatum?: string;
  enddatum?: string;
  strasse?: string;
  plz?: string;
  stadt?: string;
  land?: string;
}

export function useProjectDetails(projectId?: string) {
  const { user } = useAuth();
  const queryClient = useQueryClient();

  const { data: details, isLoading } = useQuery({
    queryKey: ['project_details', projectId],
    queryFn: async () => {
      if (!projectId) return null;
      
      const { data, error } = await supabase
        .from('project_details')
        .select('*')
        .eq('project_id', projectId)
        .maybeSingle();
      
      if (error) throw error;
      return data;
    },
    enabled: !!projectId && !!user,
  });

  const saveDetails = useMutation({
    mutationFn: async (detailsData: ProjectDetailsData) => {
      if (!user || !projectId) throw new Error('Not authenticated or no project');
      
      // Check if details already exist
      const { data: existing } = await supabase
        .from('project_details')
        .select('id')
        .eq('project_id', projectId)
        .maybeSingle();
      
      if (existing) {
        // Update existing
        const { data, error } = await supabase
          .from('project_details')
          .update(detailsData)
          .eq('id', existing.id)
          .select()
          .single();
        
        if (error) throw error;
        return data;
      } else {
        // Create new
        const { data, error } = await supabase
          .from('project_details')
          .insert({
            project_id: projectId,
            ...detailsData,
          })
          .select()
          .single();
        
        if (error) throw error;
        return data;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['project_details', projectId] });
      toast({ title: 'Projektdetails gespeichert' });
    },
    onError: (error: any) => {
      toast({
        title: 'Fehler beim Speichern',
        description: error.message,
        variant: 'destructive',
      });
    },
  });

  return {
    details,
    isLoading,
    saveDetails: saveDetails.mutate,
    isSaving: saveDetails.isPending,
  };
}
