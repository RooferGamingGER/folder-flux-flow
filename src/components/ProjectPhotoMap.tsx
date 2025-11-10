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
  modified?: string;
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

  // Marker mit Clustering aktualisieren
  useEffect(() => {
    if (!map.current || !mapReady || photos.length === 0) return;

    console.log('📍 Füge', photos.length, 'Marker mit Clustering zur Karte hinzu');

    const sourceId = 'photos';
    const clustersLayerId = 'clusters';
    const clusterCountLayerId = 'cluster-count';
    const unclusteredLayerId = 'unclustered-point';

    // GeoJSON FeatureCollection erstellen
    const geojsonData = {
      type: 'FeatureCollection' as const,
      features: photos.map((photo, index) => ({
        type: 'Feature' as const,
        properties: {
          id: photo.id,
          name: photo.name,
          url: photo.url,
          altitude: photo.altitude,
          index: index + 1
        },
        geometry: {
          type: 'Point' as const,
          coordinates: [photo.longitude, photo.latitude]
        }
      }))
    };

    // Source hinzufügen/aktualisieren
    if (map.current.getSource(sourceId)) {
      (map.current.getSource(sourceId) as mapboxgl.GeoJSONSource).setData(geojsonData);
    } else {
      map.current.addSource(sourceId, {
        type: 'geojson',
        data: geojsonData,
        cluster: true,
        clusterMaxZoom: 16,
        clusterRadius: 50
      });

      // Cluster-Kreise
      map.current.addLayer({
        id: clustersLayerId,
        type: 'circle',
        source: sourceId,
        filter: ['has', 'point_count'],
        paint: {
          'circle-color': [
            'step',
            ['get', 'point_count'],
            '#3b82f6',
            5,
            '#8b5cf6',
            10,
            '#ec4899'
          ],
          'circle-radius': [
            'step',
            ['get', 'point_count'],
            20,
            5,
            25,
            10,
            30
          ],
          'circle-stroke-width': 3,
          'circle-stroke-color': '#ffffff'
        }
      });

      // Cluster-Anzahl
      map.current.addLayer({
        id: clusterCountLayerId,
        type: 'symbol',
        source: sourceId,
        filter: ['has', 'point_count'],
        layout: {
          'text-field': '{point_count_abbreviated}',
          'text-font': ['DIN Offc Pro Bold', 'Arial Unicode MS Bold'],
          'text-size': 14
        },
        paint: {
          'text-color': '#ffffff'
        }
      });

      // Ungeclusterte Punkte (Platzhalter für custom Marker)
      map.current.addLayer({
        id: unclusteredLayerId,
        type: 'circle',
        source: sourceId,
        filter: ['!', ['has', 'point_count']],
        paint: {
          'circle-radius': 0
        }
      });

      // Click-Handler für Cluster (Zoom)
      map.current.on('click', clustersLayerId, (e) => {
        if (!map.current || !e.features || !e.features[0]) return;
        
        const features = map.current.queryRenderedFeatures(e.point, {
          layers: [clustersLayerId]
        });
        
        if (features[0]) {
          const clusterId = features[0].properties?.cluster_id;
          const source = map.current.getSource(sourceId) as mapboxgl.GeoJSONSource;
          
          source.getClusterExpansionZoom(clusterId, (err, zoom) => {
            if (err || !map.current) return;
            
            const coordinates = (features[0].geometry as any).coordinates;
            map.current.easeTo({
              center: coordinates,
              zoom: zoom
            });
          });
        }
      });

      // Cursor-Änderung für Cluster
      map.current.on('mouseenter', clustersLayerId, () => {
        if (map.current) map.current.getCanvas().style.cursor = 'pointer';
      });
      map.current.on('mouseleave', clustersLayerId, () => {
        if (map.current) map.current.getCanvas().style.cursor = '';
      });
    }

    // Custom Marker für ungeclusterte Punkte
    const renderMarkers = () => {
      if (!map.current || !map.current.isSourceLoaded(sourceId)) return;

      const features = map.current.querySourceFeatures(sourceId);
      const unclusteredFeatures = features.filter(f => !f.properties?.cluster);

      // Bestehende Marker, die nicht mehr gebraucht werden, entfernen
      const featureIds = new Set(unclusteredFeatures.map(f => f.properties?.id));
      markers.current = markers.current.filter(marker => {
        const keepMarker = featureIds.has((marker as any)._photoId);
        if (!keepMarker) marker.remove();
        return keepMarker;
      });

      // Neue Marker für ungeclusterte Features hinzufügen
      unclusteredFeatures.forEach(feature => {
        const photoId = feature.properties?.id;
        if (!photoId) return;

        // Prüfen ob Marker bereits existiert
        const exists = markers.current.some(m => (m as any)._photoId === photoId);
        if (exists) return;

        const photo = photos.find(p => p.id === photoId);
        if (!photo) return;

        const coordinates = (feature.geometry as any).coordinates;
        const index = feature.properties?.index || 0;

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
        el.style.backgroundImage = `url(${photo.url})`;
        el.style.backgroundSize = 'cover';
        el.style.backgroundPosition = 'center';

        // Nummer-Badge
        const badge = document.createElement('div');
        badge.textContent = String(index);
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
          if (onPhotoClick) onPhotoClick(photo);
        });

        // Popup mit Foto-Vorschau
        const popupContent = `
          <div style="padding: 8px; min-width: 200px;">
            <img 
              src="${photo.url}" 
              alt="${photo.name}"
              style="width: 100%; height: 120px; object-fit: cover; border-radius: 6px; margin-bottom: 8px;"
            />
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

        const marker = new mapboxgl.Marker({
          element: el,
          anchor: 'bottom'
        })
          .setLngLat(coordinates)
          .setPopup(popup)
          .addTo(map.current!);

        (marker as any)._photoId = photoId;
        markers.current.push(marker);
      });
    };

    // Initial render und bei jedem Map-Update
    map.current.on('render', renderMarkers);
    map.current.on('sourcedata', renderMarkers);

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

    return () => {
      // Cleanup
      markers.current.forEach(marker => marker.remove());
      markers.current = [];
      
      if (map.current) {
        map.current.off('render', renderMarkers);
        map.current.off('sourcedata', renderMarkers);
        
        if (map.current.getLayer(unclusteredLayerId)) map.current.removeLayer(unclusteredLayerId);
        if (map.current.getLayer(clusterCountLayerId)) map.current.removeLayer(clusterCountLayerId);
        if (map.current.getLayer(clustersLayerId)) map.current.removeLayer(clustersLayerId);
        if (map.current.getSource(sourceId)) map.current.removeSource(sourceId);
      }
    };
  }, [photos, mapReady, onPhotoClick]);

  // Route zwischen Fotos zeichnen (chronologisch)
  useEffect(() => {
    if (!map.current || !mapReady || photos.length < 2) return;

    const sourceId = 'photo-route';
    const layerId = 'photo-route-line';

    // Fotos nach Zeit sortieren
    const sortedPhotos = [...photos].sort((a, b) => {
      const timeA = a.modified ? new Date(a.modified).getTime() : 0;
      const timeB = b.modified ? new Date(b.modified).getTime() : 0;
      return timeA - timeB;
    });

    // GeoJSON LineString erstellen
    const coordinates = sortedPhotos.map(p => [p.longitude, p.latitude]);
    
    const routeGeoJSON = {
      type: 'Feature' as const,
      properties: {},
      geometry: {
        type: 'LineString' as const,
        coordinates
      }
    };

    // Source hinzufügen/aktualisieren
    if (map.current.getSource(sourceId)) {
      (map.current.getSource(sourceId) as mapboxgl.GeoJSONSource).setData(routeGeoJSON);
    } else {
      map.current.addSource(sourceId, {
        type: 'geojson',
        data: routeGeoJSON
      });

      // Animierte Linie (gestrichelt)
      map.current.addLayer({
        id: layerId,
        type: 'line',
        source: sourceId,
        layout: {
          'line-join': 'round',
          'line-cap': 'round'
        },
        paint: {
          'line-color': '#3b82f6',
          'line-width': 3,
          'line-dasharray': [0, 4, 3]
        }
      });

      // Animation
      const dashArraySequence = [
        [0, 4, 3],
        [0.5, 4, 2.5],
        [1, 4, 2],
        [1.5, 4, 1.5],
        [2, 4, 1],
        [2.5, 4, 0.5],
        [3, 4, 0],
        [0, 0.5, 3, 3.5],
        [0, 1, 3, 3],
        [0, 1.5, 3, 2.5],
        [0, 2, 3, 2],
        [0, 2.5, 3, 1.5],
        [0, 3, 3, 1],
        [0, 3.5, 3, 0.5]
      ];

      let step = 0;
      const animateDashArray = () => {
        if (!map.current || !map.current.getLayer(layerId)) return;
        
        step = (step + 1) % dashArraySequence.length;
        map.current.setPaintProperty(
          layerId,
          'line-dasharray',
          dashArraySequence[step]
        );
        setTimeout(animateDashArray, 100);
      };

      animateDashArray();
    }

    return () => {
      if (map.current && map.current.getLayer(layerId)) {
        map.current.removeLayer(layerId);
      }
      if (map.current && map.current.getSource(sourceId)) {
        map.current.removeSource(sourceId);
      }
    };
  }, [photos, mapReady]);

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
    <div className="flex-1 relative min-h-0">
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
