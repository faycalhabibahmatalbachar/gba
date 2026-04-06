'use client';

import * as React from 'react';
import { MapPinOff } from 'lucide-react';
import { cn } from '@/lib/utils';

export type MapWrapperMarker = {
  id: string;
  lat: number;
  lng: number;
  /** Couleur bordure / point */
  tone?: 'online' | 'pending' | 'offline' | 'suspended' | 'neutral';
  onClick?: () => void;
};

export interface MapWrapperProps {
  height?: number;
  className?: string;
  /** Marqueurs Leaflet (OpenStreetMap / CARTO — aucune clé API) */
  markers?: MapWrapperMarker[];
  initialViewState?: {
    latitude: number;
    longitude: number;
    zoom: number;
  };
}

const TONE_HEX: Record<NonNullable<MapWrapperMarker['tone']>, string> = {
  online: '#10b981',
  pending: '#f59e0b',
  offline: '#94a3b8',
  suspended: '#ef4444',
  neutral: '#6C47FF',
};

export function MapWrapper({
  height = 360,
  className,
  markers = [],
  initialViewState = { latitude: 12.1348, longitude: 15.0444, zoom: 11 },
}: MapWrapperProps) {
  const containerRef = React.useRef<HTMLDivElement>(null);
  const mapRef = React.useRef<import('leaflet').Map | null>(null);
  const layerRef = React.useRef<import('leaflet').LayerGroup | null>(null);
  const leafletRef = React.useRef<typeof import('leaflet') | null>(null);
  const [mapReady, setMapReady] = React.useState(false);

  React.useEffect(() => {
    const el = containerRef.current;
    if (!el) return;

    let cancelled = false;
    let map: import('leaflet').Map | null = null;

    void (async () => {
      const L = (await import('leaflet')).default;
      await import('leaflet/dist/leaflet.css');
      if (cancelled || !containerRef.current) return;

      delete (L.Icon.Default.prototype as unknown as { _getIconUrl?: unknown })._getIconUrl;
      L.Icon.Default.mergeOptions({
        iconRetinaUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-icon-2x.png',
        iconUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-icon.png',
        shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-shadow.png',
      });

      map = L.map(containerRef.current, { zoomControl: true }).setView(
        [initialViewState.latitude, initialViewState.longitude],
        initialViewState.zoom,
      );

      L.tileLayer('https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png', {
        attribution: '© OpenStreetMap · © CARTO',
        maxZoom: 19,
      }).addTo(map);

      const group = L.layerGroup().addTo(map);
      layerRef.current = group;
      mapRef.current = map;
      leafletRef.current = L;
      setMapReady(true);
    })();

    return () => {
      cancelled = true;
      setMapReady(false);
      layerRef.current = null;
      mapRef.current = null;
      leafletRef.current = null;
      map?.remove();
    };
  }, [initialViewState.latitude, initialViewState.longitude, initialViewState.zoom]);

  React.useEffect(() => {
    if (!mapReady || !mapRef.current || !layerRef.current || !leafletRef.current) return;
    const L = leafletRef.current;
    const group = layerRef.current;
    const map = mapRef.current;
    group.clearLayers();

    for (const m of markers) {
      const color = TONE_HEX[m.tone ?? 'neutral'];
      const icon = L.divIcon({
        className: 'gba-mini-marker',
        html: `<div style="width:14px;height:14px;border-radius:50%;background:${color};border:2px solid #fff;box-shadow:0 1px 4px rgba(0,0,0,.25)"></div>`,
        iconSize: [14, 14],
        iconAnchor: [7, 7],
      });
      const marker = L.marker([m.lat, m.lng], { icon });
      if (m.onClick) {
        marker.on('click', () => {
          m.onClick?.();
        });
      }
      marker.addTo(group);
    }

    if (markers.length > 1) {
      const bounds = L.latLngBounds(markers.map((x) => [x.lat, x.lng] as [number, number]));
      map.fitBounds(bounds, { padding: [32, 32], maxZoom: 14 });
    } else if (markers.length === 1) {
      map.setView([markers[0].lat, markers[0].lng], Math.max(map.getZoom(), 12));
    }
  }, [mapReady, markers]);

  return (
    <div
      className={cn('relative rounded-xl border border-border overflow-hidden bg-muted/20', className)}
      style={{ height }}
    >
      <div ref={containerRef} className="relative z-0 h-full w-full" />
      {markers.length === 0 ? (
        <div className="pointer-events-none absolute inset-0 z-[400] flex flex-col items-center justify-center gap-2 bg-background/70 text-center text-sm text-muted-foreground backdrop-blur-[1px]">
          <MapPinOff className="h-8 w-8 opacity-50" />
          <p>Aucune position GPS à afficher</p>
        </div>
      ) : null}
    </div>
  );
}
