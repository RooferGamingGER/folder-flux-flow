import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from './useAuth';
import { toast } from '@/hooks/use-toast';
import { compressImageForUpload, shouldCompressImage, formatBytes } from '@/lib/imageCompression';

export function useProjectFiles(projectId?: string) {
  const { user } = useAuth();
  const queryClient = useQueryClient();

  const { data: files = [], isLoading } = useQuery({
    queryKey: ['project_files', projectId],
    queryFn: async () => {
      if (!projectId) return [];
      
      const { data, error } = await supabase
        .from('project_files')
        .select('*')
        .eq('project_id', projectId)
        .is('deleted_at', null)
        .order('modified', { ascending: false });
      
      if (error) {
        console.error('❌ [useProjectFiles] Query error:', error);
        throw error;
      }
      
      return data;
    },
    enabled: !!projectId && !!user,
  });

  const uploadFile = useMutation({
    mutationFn: async ({ file, folder }: { file: File; folder: string }) => {
      if (!user || !projectId) throw new Error('Not authenticated or no project');
      
      // Server-seitige Validierung als Fallback
      if (file.size > 50 * 1024 * 1024) {
        throw new Error(`Datei zu groß: ${file.name} (${formatBytes(file.size)}). Maximum: 50 MB`);
      }
      
      const originalSize = file.size;
      const originalName = file.name;
      
      // GPS-Daten extrahieren VOR der Kompression (da EXIF-Daten verloren gehen können)
      let gpsData: { latitude?: number; longitude?: number; altitude?: number; accuracy?: number } | null = null;
      
      if (file.type.startsWith('image/')) {
        console.log('🖼️ Bild erkannt, starte GPS-Extraktion...');
        try {
          const { extractGPSFromImageWithFallback } = await import('@/lib/exifUtils');
          gpsData = await extractGPSFromImageWithFallback(file);
          
          if (gpsData) {
            console.log('✅ GPS-Daten erfolgreich extrahiert:', gpsData);
          } else {
            console.warn('⚠️ Keine GPS-Daten im Bild gefunden');
          }
        } catch (error) {
          console.error('❌ GPS-Extraktion fehlgeschlagen:', error);
        }
      } else {
        console.log('ℹ️ Kein Bild, überspringe GPS-Extraktion');
      }
      
      // Bildkompression vor Upload
      if (shouldCompressImage(file)) {
        console.log('🖼️ Komprimiere Bild:', file.name, 'Original:', formatBytes(file.size));
        const compressionResult = await compressImageForUpload(file);
        file = compressionResult.file;
        console.log('✅ Komprimiert:', formatBytes(file.size), 
          'Ersparnis:', compressionResult.savingsPercent + '%'
        );
      }
      
      const fileId = crypto.randomUUID();
      const ext = file.name.split('.').pop() || '';
      const isImage = file.type.startsWith('image/');
      
      // 1. Upload zu Storage
      const bucket = isImage ? 'project-images' : 'project-files';
      const filePath = `${projectId}/${fileId}.${ext}`;
      
      console.log('📤 Uploading file to storage:', { bucket, filePath, type: file.type });
      
      const { error: uploadError } = await supabase.storage
        .from(bucket)
        .upload(filePath, file, {
          contentType: file.type,
          upsert: false,
        });
      
      if (uploadError) {
        console.error('Storage upload error:', uploadError);
        throw uploadError;
      }
      
      // 2. Eintrag in project_files erstellen
      const { data, error: dbError } = await supabase
        .from('project_files')
        .insert({
          id: fileId,
          project_id: projectId,
          name: originalName, // Original-Name beibehalten
          storage_path: filePath,
          folder,
          is_image: isImage,
          size: file.size.toString(),
          ext,
          mime: file.type,
          modified: new Date().toISOString(),
          latitude: gpsData?.latitude,
          longitude: gpsData?.longitude,
          gps_altitude: gpsData?.altitude,
          gps_accuracy: gpsData?.accuracy,
        })
        .select()
        .single();
      
      if (dbError) {
        console.error('Database insert error:', dbError);
        // Rollback: Storage-Datei löschen bei DB-Fehler
        await supabase.storage.from(bucket).remove([filePath]);
        throw dbError;
      }
      
      console.log('✅ File uploaded successfully:', data.id);
      return { data, originalSize, compressedSize: file.size };
    },
    onSuccess: (result, variables) => {
      queryClient.invalidateQueries({ queryKey: ['project_files', projectId] });
      
      const savedPercent = Math.round(
        ((result.originalSize - result.compressedSize) / result.originalSize) * 100
      );
      
      const hasGPS = result.data.latitude && result.data.longitude;
      
      console.log('📊 Upload-Ergebnis:', {
        hasGPS,
        latitude: result.data.latitude,
        longitude: result.data.longitude,
        savedPercent
      });

      if (hasGPS && savedPercent > 30) {
        toast({ 
          title: '✅ Datei mit GPS hochgeladen',
          description: `📍 GPS-Daten gefunden (${result.data.latitude.toFixed(4)}, ${result.data.longitude.toFixed(4)}) • ${savedPercent}% Speicherplatz gespart`,
          duration: 5000
        });
      } else if (hasGPS) {
        toast({ 
          title: '✅ Datei hochgeladen',
          description: `📍 GPS-Daten erfolgreich extrahiert: ${result.data.latitude.toFixed(4)}, ${result.data.longitude.toFixed(4)}`,
          duration: 5000
        });
      } else if (variables.file.type.startsWith('image/')) {
        // Explizite Warnung wenn Bild OHNE GPS hochgeladen wurde
        toast({ 
          title: '⚠️ Bild ohne GPS-Daten',
          description: 'Das Foto enthält keine Standortinformationen. Aktivieren Sie den Standort in Ihrer Kamera-App.',
          duration: 6000
        });
      } else if (savedPercent > 30) {
        toast({ 
          title: 'Datei hochgeladen & komprimiert',
          description: `${savedPercent}% Speicherplatz gespart (${formatBytes(result.originalSize)} → ${formatBytes(result.compressedSize)})`
        });
      } else {
        toast({ title: 'Datei hochgeladen' });
      }
    },
    onError: (error: any) => {
      console.error('Upload failed:', error);
      toast({
        title: 'Upload fehlgeschlagen',
        description: error.message || 'Die Datei konnte nicht hochgeladen werden',
        variant: 'destructive',
      });
    },
  });

  const deleteFile = useMutation({
    mutationFn: async (fileId: string) => {
      const { error } = await supabase
        .from('project_files')
        .update({ deleted_at: new Date().toISOString() })
        .eq('id', fileId);
      
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['project_files', projectId] });
      toast({ title: 'Datei gelöscht' });
    },
    onError: (error: any) => {
      toast({
        title: 'Löschen fehlgeschlagen',
        description: error.message,
        variant: 'destructive',
      });
    },
  });

  const moveFile = useMutation({
    mutationFn: async ({ fileId, newFolder }: { fileId: string; newFolder: string }) => {
      console.log('📁 Moving file:', fileId, 'to folder:', newFolder);
      
      const { error } = await supabase
        .from('project_files')
        .update({ folder: newFolder })
        .eq('id', fileId);
      
      if (error) {
        console.error('Move file error:', error);
        throw error;
      }
      
      console.log('✅ File moved successfully');
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['project_files', projectId] });
      toast({ title: 'Datei verschoben' });
    },
    onError: (error: any) => {
      toast({
        title: 'Verschieben fehlgeschlagen',
        description: error.message,
        variant: 'destructive',
      });
    },
  });

  const getFileUrl = (file: any) => {
    if (!file.storage_path) return '';
    const bucket = file.is_image ? 'project-images' : 'project-files';
    const { data } = supabase.storage.from(bucket).getPublicUrl(file.storage_path);
    return data.publicUrl;
  };

  return {
    files,
    isLoading,
    uploadFile: uploadFile.mutate,
    isUploading: uploadFile.isPending,
    deleteFile: deleteFile.mutate,
    moveFile: moveFile.mutate,
    isMoving: moveFile.isPending,
    getFileUrl,
  };
}
