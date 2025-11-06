// Upload-Größenlimits in Bytes
export const UPLOAD_LIMITS = {
  WARNING_SIZE: 10 * 1024 * 1024,    // 10 MB - Warnung anzeigen
  ERROR_SIZE: 50 * 1024 * 1024,      // 50 MB - Upload blockieren
  MAX_TOTAL_SIZE: 100 * 1024 * 1024, // 100 MB - Maximale Gesamtgröße pro Batch
} as const;

export function formatFileSize(bytes: number): string {
  if (bytes === 0) return '0 Bytes';
  const k = 1024;
  const sizes = ['Bytes', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return `${(bytes / Math.pow(k, i)).toFixed(2)} ${sizes[i]}`;
}

export function validateFileSize(file: File): 'ok' | 'warning' | 'error' {
  if (file.size >= UPLOAD_LIMITS.ERROR_SIZE) return 'error';
  if (file.size >= UPLOAD_LIMITS.WARNING_SIZE) return 'warning';
  return 'ok';
}
