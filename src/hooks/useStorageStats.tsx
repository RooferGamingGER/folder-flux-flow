import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

export function useStorageStats() {
  return useQuery({
    queryKey: ['storage_stats'],
    queryFn: async () => {
      // Alle nicht-gelöschten Dateien abrufen
      const { data: allFiles, error } = await supabase
        .from('project_files')
        .select('size, is_image, project_id')
        .is('deleted_at', null);

      if (error) {
        console.error('Error fetching storage stats:', error);
        throw error;
      }

      // Berechnungen
      const totalBytes = allFiles?.reduce((sum, file) => {
        const sizeInBytes = parseInt(file.size || '0');
        return sum + sizeInBytes;
      }, 0) || 0;

      const totalFiles = allFiles?.length || 0;
      const totalImages = allFiles?.filter(f => f.is_image).length || 0;

      const imageBytes = allFiles
        ?.filter(f => f.is_image)
        .reduce((sum, file) => {
          const sizeInBytes = parseInt(file.size || '0');
          return sum + sizeInBytes;
        }, 0) || 0;

      const documentBytes = totalBytes - imageBytes;

      const projectsWithFiles = new Set(
        allFiles?.map(f => f.project_id) || []
      ).size;

      return {
        totalBytes,
        totalMB: (totalBytes / 1024 / 1024).toFixed(2),
        totalFiles,
        totalImages,
        totalDocuments: totalFiles - totalImages,
        imageBytes,
        imageMB: (imageBytes / 1024 / 1024).toFixed(2),
        documentBytes,
        documentMB: (documentBytes / 1024 / 1024).toFixed(2),
        projectsWithFiles,
      };
    },
    refetchInterval: 30000, // Alle 30 Sekunden aktualisieren
  });
}
