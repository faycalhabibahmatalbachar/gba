'use client';

import * as React from 'react';
import { cn } from '@/lib/utils';

export type MapWrapperMarker = {
  lat: number;
  lng: number;
  label?: string;
  /** stroke + fill hint */
  color?: string;
  /** point animé pour attirer l'attention */
  pulse?: boolean;
};

export interface MapWrapperProps {
  height?: number | string;
  className?: string;
  /** Centre [lat, lng] */
  freeMapCenter?: [number, number];
  freeMapZoom?: number;
  /** Points à tracer (ex. connexions géolocalisées approximativement) */
  markers?: MapWrapperMarker[];
}

/** Carte Leaflet (tuiles CARTO / OSM). */
export function MapWrapper({
  height = 320,
  className,
  freeMapCenter = [12.1048, 15.0445],
  freeMapZoom = 13,
  markers,
}: MapWrapperProps) {
  const containerRef = React.useRef<HTMLDivElement>(null);
  const mapRef = React.useRef<import('leaflet').Map | null>(null);
  const leafletRef = React.useRef<typeof import('leaflet') | null>(null);
  const markersLayerRef = React.useRef<import('leaflet').LayerGroup | null>(null);

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

      const map = L.map(node, { center: freeMapCenter, zoom: freeMapZoom, zoomControl: true });
      L.tileLayer('https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png', {
        attribution: '© OpenStreetMap · © CARTO',
        maxZoom: 19,
      }).addTo(map);
      mapRef.current = map;
      leafletRef.current = L;
      requestAnimationFrame(() => {
        try {
          map.invalidateSize();
        } catch {
          /* ignore */
        }
      });
    });

    return () => {
      alive = false;
      markersLayerRef.current = null;
      const m = mapRef.current;
      mapRef.current = null;
      leafletRef.current = null;
      if (m) {
        try {
          m.remove();
        } catch {
          /* ignore */
        }
      }
    };
  }, [freeMapCenter, freeMapZoom]);

  React.useEffect(() => {
    const map = mapRef.current;
    const L = leafletRef.current;
    if (!map || !L) return;

    if (markersLayerRef.current) {
      try {
        map.removeLayer(markersLayerRef.current);
      } catch {
        /* ignore */
      }
      markersLayerRef.current = null;
    }

    if (!markers?.length) return;

    const g = L.layerGroup();
    const bounds: [number, number][] = [];
    for (const m of markers) {
      const color = m.color || '#22c55e';
      const cm = L.circleMarker([m.lat, m.lng], {
        radius: 7,
        color,
        weight: 2,
        fillColor: color,
        fillOpacity: 0.35,
        className: m.pulse ? 'gba-map-pulse' : undefined,
      });
      if (m.label) cm.bindPopup(m.label);
      cm.addTo(g);
      bounds.push([m.lat, m.lng]);
    }
    g.addTo(map);
    markersLayerRef.current = g;

    if (bounds.length === 1) {
      map.setView(bounds[0], Math.max(map.getZoom(), 10));
    } else if (bounds.length > 1) {
      try {
        const ll = bounds.map(([la, ln]) => L.latLng(la, ln));
        map.fitBounds(L.latLngBounds(ll), { padding: [24, 24], maxZoom: 12 });
      } catch {
        /* ignore */
      }
    }
    requestAnimationFrame(() => {
      try {
        map.invalidateSize();
      } catch {
        /* ignore */
      }
    });
  }, [markers, height]);

  React.useEffect(() => {
    const node = containerRef.current;
    const map = mapRef.current;
    if (!node || !map) return;
    const ro = new ResizeObserver(() => {
      try {
        map.invalidateSize();
      } catch {
        /* ignore */
      }
    });
    ro.observe(node);
    return () => ro.disconnect();
  }, [markers, height]);

  return (
    <div className="relative z-0 isolate">
      <style>{`
        .gba-map-pulse {
          animation: gbaMapPulse 1.15s ease-in-out infinite;
          transform-origin: center;
        }
        @keyframes gbaMapPulse {
          0% { opacity: 1; }
          50% { opacity: .25; }
          100% { opacity: 1; }
        }
      `}</style>
      <div
        ref={containerRef}
        className={cn('min-h-[200px] w-full rounded-xl border border-border', className)}
        style={{ height }}
      />
    </div>
  );
}
