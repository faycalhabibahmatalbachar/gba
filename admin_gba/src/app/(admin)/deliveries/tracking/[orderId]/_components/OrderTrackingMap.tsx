'use client';

import * as React from 'react';

type Props = {
  driver?: { lat: number; lng: number } | null;
  height?: number;
};

const DEFAULT_CENTER: [number, number] = [12.1048, 15.0445];

export function OrderTrackingMap({ driver, height = 360 }: Props) {
  const containerRef = React.useRef<HTMLDivElement>(null);
  const mapRef = React.useRef<import('leaflet').Map | null>(null);
  const markersRef = React.useRef<import('leaflet').Layer[]>([]);

  React.useEffect(() => {
    const node = containerRef.current;
    if (!node) return;
    let alive = true;

    void import('leaflet').then((L) => {
      if (!alive || !containerRef.current || containerRef.current !== node) return;
      if (mapRef.current) return;

      void import('leaflet/dist/leaflet.css');

      delete (L.Icon.Default.prototype as { _getIconUrl?: unknown })._getIconUrl;
      L.Icon.Default.mergeOptions({
        iconRetinaUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png',
        iconUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png',
        shadowUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png',
      });

      const center: [number, number] = driver ? [driver.lat, driver.lng] : DEFAULT_CENTER;
      const map = L.map(node, { center, zoom: driver ? 14 : 12, zoomControl: true });
      L.tileLayer('https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png', {
        attribution: '© OpenStreetMap · © CARTO',
        maxZoom: 19,
      }).addTo(map);
      mapRef.current = map;

      const clearMarkers = () => {
        markersRef.current.forEach((layer) => {
          try {
            layer.remove();
          } catch {
            /* ignore */
          }
        });
        markersRef.current = [];
      };

      clearMarkers();
      if (driver) {
        const m = L.marker([driver.lat, driver.lng]).addTo(map).bindPopup('Livreur');
        markersRef.current.push(m);
      }
    });

    return () => {
      alive = false;
      const m = mapRef.current;
      mapRef.current = null;
      markersRef.current = [];
      if (m) {
        try {
          m.remove();
        } catch {
          /* ignore */
        }
      }
    };
  }, [driver?.lat, driver?.lng]);

  return <div ref={containerRef} className="h-full w-full min-h-[280px] rounded-[14px] bg-muted/30" style={{ height }} />;
}
