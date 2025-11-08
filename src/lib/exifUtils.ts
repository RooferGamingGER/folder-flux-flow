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
  try {
    // EXIF-Daten lesen
    const exif = await exifr.parse(file, {
      gps: true,
      pick: ['latitude', 'longitude', 'GPSAltitude', 'GPSHPositioningError']
    });

    if (!exif || !exif.latitude || !exif.longitude) {
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

    console.log('📍 GPS-Daten extrahiert:', {
      file: file.name,
      lat: gpsData.latitude.toFixed(6),
      lng: gpsData.longitude.toFixed(6),
      altitude: gpsData.altitude ? `${gpsData.altitude}m` : 'N/A',
      accuracy: gpsData.accuracy ? `${gpsData.accuracy}m` : 'N/A'
    });

    return gpsData;
  } catch (error) {
    console.log('ℹ️ Keine GPS-Daten gefunden:', file.name);
    return null;
  }
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
