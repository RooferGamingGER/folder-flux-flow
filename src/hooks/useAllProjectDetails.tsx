import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from './useAuth';

export function useAllProjectDetails() {
  const { user } = useAuth();

  const { data: allDetails = [], isLoading } = useQuery({
    queryKey: ['all_project_details', user?.id],
    queryFn: async () => {
      if (!user) return [];
      
      // Lade alle project_details für die Projekte des Users
      const { data: projects } = await supabase
        .from('projects')
        .select('id')
        .eq('user_id', user.id);
      
      if (!projects || projects.length === 0) return [];
      
      const projectIds = projects.map(p => p.id);
      
      const { data, error } = await supabase
        .from('project_details')
        .select('project_id, projektname, auftragsnummer, projektstatus, ansprechpartner, strasse, plz, stadt, startdatum, enddatum')
        .in('project_id', projectIds);
      
      if (error) throw error;
      return data || [];
    },
    enabled: !!user,
  });

  // Hilfsfunktion um Details für ein bestimmtes Projekt zu finden
  const getDetailsForProject = (projectId: string) => {
    return allDetails.find(d => d.project_id === projectId);
  };

  return {
    allDetails,
    isLoading,
    getDetailsForProject,
  };
}
