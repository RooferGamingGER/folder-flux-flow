/**
 * Bildkompression für optimalen Speicherverbrauch
 * Ziel: DIN A4 Druckqualität (300 DPI) mit < 2MB Dateigröße
 */

const MAX_WIDTH = 2480; // DIN A4 Breite bei 300 DPI
const MAX_HEIGHT = 3508; // DIN A4 Höhe bei 300 DPI
const TARGET_SIZE_MB = 2;
const TARGET_SIZE_BYTES = TARGET_SIZE_MB * 1024 * 1024;
const INITIAL_QUALITY = 0.85;
const MIN_QUALITY = 0.6;

export interface CompressionResult {
  file: File;
  originalSize: number;
  compressedSize: number;
  savingsPercent: number;
}

/**
 * Prüft ob ein Bild komprimiert werden sollte
 */
export function shouldCompressImage(file: File): boolean {
  return file.type.startsWith('image/') && file.size > 500_000; // > 500 KB
}

/**
 * Berechnet optimale Dimensionen unter Beibehaltung des Seitenverhältnisses
 */
export function getOptimalDimensions(
  width: number,
  height: number
): { width: number; height: number } {
  if (width <= MAX_WIDTH && height <= MAX_HEIGHT) {
    return { width, height };
  }

  const widthRatio = MAX_WIDTH / width;
  const heightRatio = MAX_HEIGHT / height;
  const ratio = Math.min(widthRatio, heightRatio);

  return {
    width: Math.round(width * ratio),
    height: Math.round(height * ratio),
  };
}

/**
 * Komprimiert ein Bild für optimalen Upload
 */
export async function compressImageForUpload(
  file: File
): Promise<CompressionResult> {
  const originalSize = file.size;

  return new Promise((resolve, reject) => {
    const img = new Image();
    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d');

    if (!ctx) {
      reject(new Error('Canvas context nicht verfügbar'));
      return;
    }

    img.onload = async () => {
      try {
        // Optimale Dimensionen berechnen
        const { width, height } = getOptimalDimensions(
          img.naturalWidth,
          img.naturalHeight
        );

        canvas.width = width;
        canvas.height = height;

        // Bild zeichnen
        ctx.drawImage(img, 0, 0, width, height);

        // Komprimierung mit adaptiver Qualität
        let quality = INITIAL_QUALITY;
        let compressedBlob: Blob | null = null;

        while (quality >= MIN_QUALITY) {
          compressedBlob = await new Promise<Blob | null>((res) => {
            canvas.toBlob(
              (blob) => res(blob),
              'image/jpeg',
              quality
            );
          });

          if (!compressedBlob) {
            reject(new Error('Komprimierung fehlgeschlagen'));
            return;
          }

          // Wenn Zielgröße erreicht oder Mindestqualität erreicht
          if (compressedBlob.size <= TARGET_SIZE_BYTES || quality <= MIN_QUALITY) {
            break;
          }

          // Qualität reduzieren und erneut versuchen
          quality -= 0.05;
        }

        if (!compressedBlob) {
          reject(new Error('Komprimierung fehlgeschlagen'));
          return;
        }

        // Neuen Dateinamen mit .jpg Extension erstellen
        const fileName = file.name.replace(/\.[^/.]+$/, '.jpg');
        const compressedFile = new File([compressedBlob], fileName, {
          type: 'image/jpeg',
          lastModified: Date.now(),
        });

        const savingsPercent = Math.round(
          ((originalSize - compressedFile.size) / originalSize) * 100
        );

        console.log('✅ Bildkompression erfolgreich:', {
          original: `${(originalSize / 1024 / 1024).toFixed(2)} MB`,
          compressed: `${(compressedFile.size / 1024 / 1024).toFixed(2)} MB`,
          savings: `${savingsPercent}%`,
          quality: quality.toFixed(2),
          dimensions: `${width}x${height}`,
        });

        resolve({
          file: compressedFile,
          originalSize,
          compressedSize: compressedFile.size,
          savingsPercent,
        });
      } catch (error) {
        reject(error);
      } finally {
        URL.revokeObjectURL(img.src);
      }
    };

    img.onerror = () => {
      reject(new Error('Bild konnte nicht geladen werden'));
      URL.revokeObjectURL(img.src);
    };

    img.src = URL.createObjectURL(file);
  });
}

/**
 * Formatiert Bytes in lesbare Größenangabe
 */
export function formatBytes(bytes: number): string {
  if (bytes === 0) return '0 Bytes';
  const k = 1024;
  const sizes = ['Bytes', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return `${parseFloat((bytes / Math.pow(k, i)).toFixed(2))} ${sizes[i]}`;
}
