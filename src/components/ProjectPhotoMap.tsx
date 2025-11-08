import React, { useEffect, useRef, useState } from 'react';
import mapboxgl from 'mapbox-gl';
import 'mapbox-gl/dist/mapbox-gl.css';
import { formatGPSCoordinates } from '@/lib/exifUtils';

interface Photo {
  id: string;
  name: string;
  url: string;
  latitude: number;
  longitude: number;
  altitude?: number;
}

interface ProjectPhotoMapProps {
  photos: Photo[];
  onPhotoClick?: (photo: Photo) => void;
}

export function ProjectPhotoMap({ photos, onPhotoClick }: ProjectPhotoMapProps) {
  const mapContainer = useRef<HTMLDivElement>(null);
  const map = useRef<mapboxgl.Map | null>(null);
  const markers = useRef<mapboxgl.Marker[]>([]);
  const [mapReady, setMapReady] = useState(false);
  const [mapError, setMapError] = useState<string | null>(null);

  // Mapbox initialisieren
  useEffect(() => {
    if (!mapContainer.current || map.current) return;

    const token = import.meta.env.VITE_MAPBOX_PUBLIC_TOKEN;
    
    if (!token) {
      console.error('❌ VITE_MAPBOX_PUBLIC_TOKEN nicht konfiguriert');
      setMapError('Mapbox Access Token fehlt');
      return;
    }

    console.log('🗺️ Initialisiere Mapbox mit Token...');
    mapboxgl.accessToken = token;

    try {
      map.current = new mapboxgl.Map({
        container: mapContainer.current,
        style: 'mapbox://styles/mapbox/satellite-streets-v12',
        center: [10.447683, 51.163375], // Deutschland Zentrum
        zoom: 6,
        pitch: 0,
      });

      map.current.addControl(
        new mapboxgl.NavigationControl({
          visualizePitch: true,
        }),
        'top-right'
      );

      map.current.addControl(
        new mapboxgl.FullscreenControl(),
        'top-right'
      );

      map.current.on('load', () => {
        console.log('✅ Mapbox erfolgreich geladen');
        setMapReady(true);
      });

      map.current.on('error', (e) => {
        console.error('❌ Mapbox-Fehler:', e);
        setMapError('Fehler beim Laden der Karte');
      });

    } catch (error) {
      console.error('❌ Fehler bei Mapbox-Initialisierung:', error);
      setMapError('Fehler bei der Karten-Initialisierung');
    }

    return () => {
      map.current?.remove();
      map.current = null;
    };
  }, []);

  // Marker aktualisieren wenn Fotos sich ändern
  useEffect(() => {
    if (!map.current || !mapReady || photos.length === 0) return;

    console.log('📍 Füge', photos.length, 'Marker zur Karte hinzu');

    // Alte Marker entfernen
    markers.current.forEach(marker => marker.remove());
    markers.current = [];

    // Neue Marker erstellen
    photos.forEach((photo, index) => {
      // Custom Marker Element mit Foto-Vorschau
      const el = document.createElement('div');
      el.className = 'photo-marker';
      el.style.width = '60px';
      el.style.height = '60px';
      el.style.borderRadius = '8px';
      el.style.overflow = 'hidden';
      el.style.border = '3px solid white';
      el.style.boxShadow = '0 4px 8px rgba(0,0,0,0.3)';
      el.style.cursor = 'pointer';
      el.style.position = 'relative';
      el.style.transition = 'transform 0.2s';

      // Foto als Hintergrund
      el.style.backgroundImage = `url(${photo.url})`;
      el.style.backgroundSize = 'cover';
      el.style.backgroundPosition = 'center';

      // Nummer-Badge
      const badge = document.createElement('div');
      badge.textContent = String(index + 1);
      badge.style.position = 'absolute';
      badge.style.top = '2px';
      badge.style.right = '2px';
      badge.style.backgroundColor = 'rgba(0,0,0,0.7)';
      badge.style.color = 'white';
      badge.style.fontSize = '11px';
      badge.style.fontWeight = 'bold';
      badge.style.padding = '2px 6px';
      badge.style.borderRadius = '10px';
      badge.style.lineHeight = '1';
      el.appendChild(badge);

      // Hover-Effekt
      el.addEventListener('mouseenter', () => {
        el.style.transform = 'scale(1.15)';
        el.style.zIndex = '1000';
      });
      el.addEventListener('mouseleave', () => {
        el.style.transform = 'scale(1)';
        el.style.zIndex = '1';
      });

      // Click-Handler
      el.addEventListener('click', () => {
        if (onPhotoClick) {
          onPhotoClick(photo);
        }
      });

      // Popup mit Info
      const popupContent = `
        <div style="padding: 8px; min-width: 150px;">
          <div style="font-weight: bold; margin-bottom: 4px; font-size: 13px;">${photo.name}</div>
          <div style="font-size: 11px; color: #666; margin-bottom: 6px;">
            ${formatGPSCoordinates(photo.latitude, photo.longitude)}
          </div>
          ${photo.altitude ? `<div style="font-size: 11px; color: #666;">Höhe: ${Math.round(photo.altitude)}m</div>` : ''}
          <div style="font-size: 11px; color: #999; margin-top: 6px; font-style: italic;">Klick zum Öffnen</div>
        </div>
      `;

      const popup = new mapboxgl.Popup({
        offset: 35,
        closeButton: false,
        maxWidth: '300px'
      }).setHTML(popupContent);

      // Marker erstellen
      const marker = new mapboxgl.Marker({
        element: el,
        anchor: 'bottom'
      })
        .setLngLat([photo.longitude, photo.latitude])
        .setPopup(popup)
        .addTo(map.current!);

      markers.current.push(marker);
    });

    // Kamera auf alle Marker ausrichten
    if (photos.length > 0) {
      const bounds = new mapboxgl.LngLatBounds();
      photos.forEach(photo => {
        bounds.extend([photo.longitude, photo.latitude]);
      });

      map.current.fitBounds(bounds, {
        padding: { top: 80, bottom: 80, left: 80, right: 80 },
        maxZoom: 16,
        duration: 1000
      });
    }

  }, [photos, mapReady, onPhotoClick]);

  // Fehler-Fallback wenn Token fehlt oder Karte nicht lädt
  if (mapError) {
    return (
      <div className="flex-1 flex items-center justify-center p-6">
        <div className="text-center space-y-4 max-w-md">
          <div className="text-6xl">🗺️</div>
          <h3 className="text-xl font-semibold text-destructive">
            Karten-Konfiguration fehlt
          </h3>
          <p className="text-muted-foreground">
            {mapError}: VITE_MAPBOX_PUBLIC_TOKEN
          </p>
          <div className="pt-4 text-sm bg-muted rounded-lg p-4 text-left space-y-2">
            <p className="font-semibold">So richten Sie Mapbox ein:</p>
            <ol className="list-decimal list-inside space-y-1 text-muted-foreground">
              <li>Erstellen Sie ein kostenloses Konto auf <a href="https://mapbox.com" target="_blank" rel="noopener noreferrer" className="text-primary underline">mapbox.com</a></li>
              <li>Kopieren Sie Ihren Public Token (beginnt mit "pk.")</li>
              <li>Fügen Sie den Token in den Projekt-Einstellungen hinzu</li>
            </ol>
          </div>
        </div>
      </div>
    );
  }

  // Fallback wenn keine GPS-Daten
  if (photos.length === 0) {
    return (
      <div className="flex-1 flex items-center justify-center p-6">
        <div className="text-center space-y-4 max-w-md">
          <div className="text-6xl">📍</div>
          <h3 className="text-xl font-semibold">
            Keine georeferenzierten Fotos
          </h3>
          <p className="text-muted-foreground">
            Fotos mit GPS-Daten werden automatisch auf der Karte angezeigt.
            Laden Sie Fotos hoch, die mit einem Smartphone aufgenommen wurden.
          </p>
          <div className="pt-2 text-sm text-muted-foreground">
            <p>💡 Tipp: Aktivieren Sie die Standort-Berechtigung in Ihrer Kamera-App</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="flex-1 relative">
      <div ref={mapContainer} className="absolute inset-0" />
      
      {/* Info-Badge */}
      <div className="absolute top-4 left-4 bg-card border border-border rounded-lg shadow-lg px-4 py-2 text-sm z-10">
        <div className="flex items-center gap-2">
          <span className="text-2xl">📍</span>
          <div>
            <div className="font-semibold">{photos.length} Foto{photos.length !== 1 ? 's' : ''} georeferenziert</div>
            <div className="text-xs text-muted-foreground">Klick auf Marker zum Öffnen</div>
          </div>
        </div>
      </div>
    </div>
  );
}
