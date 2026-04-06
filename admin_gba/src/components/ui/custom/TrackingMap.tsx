'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import type { ActiveDelivery } from '@/lib/services/tracking';

type Props = {
  deliveries: ActiveDelivery[];
  selectedId: string | null;
  onSelectDelivery: (id: string) => void;
};

type LeafletMap = import('leaflet').Map;
type LeafletModule = typeof import('leaflet');

/**
 * Carte livraisons — Leaflet + tuiles OpenStreetMap (gratuit, sans clé API).
 * Gère React 18 Strict Mode : une seule instance par conteneur, cleanup fiable.
 */
export function TrackingMap({ deliveries, selectedId, onSelectDelivery }: Props) {
  const mapRef = useRef<HTMLDivElement>(null);
  const mapInstanceRef = useRef<LeafletMap | null>(null);
  const markersRef = useRef<Record<string, import('leaflet').Layer>>({});
  const [mapReady, setMapReady] = useState(false);

  const clearMarkers = useCallback(() => {
    Object.values(markersRef.current).forEach((layer) => {
      try {
        layer.remove();
      } catch {
        /* ignore */
      }
    });
    markersRef.current = {};
  }, []);

  const syncMarkers = useCallback(
    (L: LeafletModule, map: LeafletMap) => {
      clearMarkers();
      const bounds: [number, number][] = [];

      deliveries.forEach((d) => {
        const loc = d.driver_location;
        if (!loc) return;

        const isSelected = d.id === selectedId;
        const color = isSelected ? '#6366F1' : d.status === 'in_transit' ? '#10B981' : '#F59E0B';

        const driverIcon = L.divIcon({
          html: `<div style="background:${color};width:${isSelected ? 36 : 28}px;height:${isSelected ? 36 : 28}px;border-radius:50%;border:3px solid white;box-shadow:0 2px 8px rgba(0,0,0,0.35);display:flex;align-items:center;justify-content:center;font-size:14px;">🏍</div>`,
          className: '',
          iconSize: [isSelected ? 36 : 28, isSelected ? 36 : 28],
          iconAnchor: [isSelected ? 18 : 14, isSelected ? 18 : 14],
        });

        const marker = L.marker([loc.lat, loc.lng], { icon: driverIcon })
          .addTo(map)
          .bindPopup(`
            <div style="min-width:160px;font-family:system-ui,sans-serif">
              <p style="font-weight:600;margin:0 0 4px">${d.driver_name || 'Livreur'}</p>
              <p style="color:#6b7280;font-size:12px;margin:0">Commande #${d.order_number || '—'}</p>
              <p style="color:#6b7280;font-size:12px;margin:4px 0 0">Client: ${d.client_name || '—'}</p>
              ${loc.speed != null ? `<p style="font-size:11px;color:#6b7280;margin:4px 0 0">Vitesse: ${Math.round(loc.speed)} km/h</p>` : ''}
            </div>
          `);

        marker.on('click', () => onSelectDelivery(d.id));
        markersRef.current[d.id] = marker;
        bounds.push([loc.lat, loc.lng]);

        if (loc.accuracy && loc.accuracy > 0) {
          const circle = L.circle([loc.lat, loc.lng], {
            radius: loc.accuracy,
            color,
            fillColor: color,
            fillOpacity: 0.08,
            weight: 1,
          }).addTo(map);
          markersRef.current[`${d.id}_acc`] = circle;
        }
      });

      if (bounds.length > 0) {
        try {
          map.fitBounds(bounds, { padding: [40, 40], maxZoom: 15 });
        } catch {
          /* ignore */
        }
      }
    },
    [deliveries, selectedId, onSelectDelivery, clearMarkers],
  );

  useEffect(() => {
    const node = mapRef.current;
    if (!node) return;

    let alive = true;

    void import('leaflet').then((L) => {
      if (!alive || !mapRef.current || mapRef.current !== node) return;
      if (mapInstanceRef.current) return;

      delete (L.Icon.Default.prototype as { _getIconUrl?: unknown })._getIconUrl;
      L.Icon.Default.mergeOptions({
        iconRetinaUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png',
        iconUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png',
        shadowUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png',
      });

      const map = L.map(node, {
        center: [14.6937, -17.4441],
        zoom: 12,
        zoomControl: true,
      });

      L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        attribution: '© OpenStreetMap',
        maxZoom: 19,
      }).addTo(map);

      mapInstanceRef.current = map;
      setMapReady(true);
    });

    return () => {
      alive = false;
      setMapReady(false);
      clearMarkers();
      const m = mapInstanceRef.current;
      mapInstanceRef.current = null;
      if (m) {
        try {
          m.remove();
        } catch {
          /* ignore */
        }
      }
    };
  }, [clearMarkers]);

  useEffect(() => {
    if (!mapReady || !mapInstanceRef.current) return;
    void import('leaflet').then((L) => {
      const map = mapInstanceRef.current;
      if (!map) return;
      syncMarkers(L, map);
    });
  }, [mapReady, syncMarkers]);

  useEffect(() => {
    if (!selectedId || !mapInstanceRef.current) return;
    const delivery = deliveries.find((d) => d.id === selectedId);
    if (delivery?.driver_location) {
      const { lat, lng } = delivery.driver_location;
      mapInstanceRef.current.setView([lat, lng], 15, { animate: true });
      const marker = markersRef.current[selectedId];
      if (marker && 'openPopup' in marker && typeof (marker as { openPopup: () => void }).openPopup === 'function') {
        (marker as { openPopup: () => void }).openPopup();
      }
    }
  }, [selectedId, deliveries]);

  return (
    <>
      <link rel="stylesheet" href="https://unpkg.com/leaflet@1.9.4/dist/leaflet.css" />
      <div ref={mapRef} className="h-full w-full min-h-[400px]" />
    </>
  );
}
