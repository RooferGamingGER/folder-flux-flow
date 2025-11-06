import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

// Speicher-Limits
const PRO_TIER_GB = 100;
const PRO_TIER_MB = PRO_TIER_GB * 1024; // 102,400 MB

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
        totalGB: (totalBytes / 1024 / 1024 / 1024).toFixed(2),
        totalFiles,
        totalImages,
        totalDocuments: totalFiles - totalImages,
        imageBytes,
        imageMB: (imageBytes / 1024 / 1024).toFixed(2),
        documentBytes,
        documentMB: (documentBytes / 1024 / 1024).toFixed(2),
        projectsWithFiles,
        maxStorageGB: PRO_TIER_GB,
        maxStorageMB: PRO_TIER_MB,
        usagePercentage: ((totalBytes / 1024 / 1024) / PRO_TIER_MB * 100).toFixed(1),
      };
    },
    refetchInterval: 30000, // Alle 30 Sekunden aktualisieren
  });
}
