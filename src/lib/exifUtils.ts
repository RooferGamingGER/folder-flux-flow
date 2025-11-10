import * as exifr from 'exifr';

export interface GPSData {
  latitude: number;
  longitude: number;
  altitude?: number;
  accuracy?: number;
}

/**
 * Extrahiert GPS-Daten aus einem Bild
 */
export async function extractGPSFromImage(file: File): Promise<GPSData | null> {
  console.log('🔍 Starte GPS-Extraktion für:', file.name, 'Type:', file.type, 'Size:', file.size);
  
  try {
    // EXIF-Daten lesen mit ausführlicher Konfiguration
    const exif = await exifr.parse(file, {
      gps: true,
      pick: ['latitude', 'longitude', 'GPSAltitude', 'GPSHPositioningError', 'GPSLatitude', 'GPSLongitude']
    });

    console.log('📊 EXIF-Rohdaten:', exif);

    if (!exif) {
      console.warn('⚠️ Keine EXIF-Daten gefunden in:', file.name);
      return null;
    }

    if (!exif.latitude || !exif.longitude) {
      console.warn('⚠️ GPS-Koordinaten fehlen:', { exif });
      return null;
    }

    // GPS-Daten extrahieren
    const gpsData: GPSData = {
      latitude: exif.latitude,
      longitude: exif.longitude,
    };

    // Optional: Höhe über Meeresspiegel
    if (exif.GPSAltitude) {
      gpsData.altitude = exif.GPSAltitude;
    }

    // Optional: GPS-Genauigkeit (iOS)
    if (exif.GPSHPositioningError) {
      gpsData.accuracy = exif.GPSHPositioningError;
    }

    console.log('✅ GPS-Daten erfolgreich extrahiert:', {
      file: file.name,
      lat: gpsData.latitude.toFixed(6),
      lng: gpsData.longitude.toFixed(6),
      altitude: gpsData.altitude ? `${gpsData.altitude}m` : 'N/A',
      accuracy: gpsData.accuracy ? `${gpsData.accuracy}m` : 'N/A'
    });

    return gpsData;
  } catch (error) {
    console.error('❌ GPS-Extraktion fehlgeschlagen:', file.name, error);
    return null;
  }
}

/**
 * Alternative GPS-Extraktion mit mehreren Fallback-Methoden
 */
export async function extractGPSFromImageWithFallback(file: File): Promise<GPSData | null> {
  console.log('🔍 Versuche GPS-Extraktion mit Fallback-Methoden für:', file.name);
  
  // Methode 1: Vollständiger EXIF-Parse (ausführlich)
  try {
    const allExif = await exifr.parse(file, { 
      gps: true,
      tiff: true,
      xmp: true,
      icc: true,
      iptc: true,
      jfif: true
    });
    
    console.log('📊 Vollständige EXIF-Daten:', allExif);
    
    if (allExif?.latitude && allExif?.longitude) {
      console.log('✅ GPS via Methode 1 gefunden');
      return {
        latitude: allExif.latitude,
        longitude: allExif.longitude,
        altitude: allExif.GPSAltitude,
        accuracy: allExif.GPSHPositioningError
      };
    }
  } catch (error) {
    console.warn('⚠️ Methode 1 fehlgeschlagen:', error);
  }
  
  // Methode 2: Nur GPS-Segment
  try {
    const gpsOnly = await exifr.gps(file);
    console.log('📊 GPS-Only Daten:', gpsOnly);
    
    if (gpsOnly?.latitude && gpsOnly?.longitude) {
      console.log('✅ GPS via Methode 2 gefunden');
      return {
        latitude: gpsOnly.latitude,
        longitude: gpsOnly.longitude,
        altitude: undefined,
        accuracy: undefined
      };
    }
  } catch (error) {
    console.warn('⚠️ Methode 2 fehlgeschlagen:', error);
  }
  
  console.log('❌ Keine GPS-Daten mit allen Methoden gefunden');
  return null;
}

/**
 * Formatiert GPS-Koordinaten für Anzeige
 */
export function formatGPSCoordinates(lat: number, lng: number): string {
  const latDir = lat >= 0 ? 'N' : 'S';
  const lngDir = lng >= 0 ? 'O' : 'W';
  
  return `${Math.abs(lat).toFixed(6)}° ${latDir}, ${Math.abs(lng).toFixed(6)}° ${lngDir}`;
}

/**
 * Berechnet Distanz zwischen zwei GPS-Punkten in Metern (Haversine-Formel)
 */
export function calculateDistance(
  lat1: number,
  lng1: number,
  lat2: number,
  lng2: number
): number {
  const R = 6371e3; // Erdradius in Metern
  const φ1 = (lat1 * Math.PI) / 180;
  const φ2 = (lat2 * Math.PI) / 180;
  const Δφ = ((lat2 - lat1) * Math.PI) / 180;
  const Δλ = ((lng2 - lng1) * Math.PI) / 180;

  const a =
    Math.sin(Δφ / 2) * Math.sin(Δφ / 2) +
    Math.cos(φ1) * Math.cos(φ2) * Math.sin(Δλ / 2) * Math.sin(Δλ / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

  return R * c;
}
