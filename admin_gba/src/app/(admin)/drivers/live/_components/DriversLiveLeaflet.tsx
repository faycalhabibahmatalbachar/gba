'use client';

import * as React from 'react';
import type { GeoJsonObject } from 'geojson';
import { cn } from '@/lib/utils';
import type { LiveMapMarker } from './types';

type ZoneRow = {
  id: string;
  name: string;
  color: string;
  geojson: unknown;
  is_active: boolean;
};

export type DriversLiveMapControls = {
  fitAll: () => void;
};

type Props = {
  markers: LiveMapMarker[];
  zones: ZoneRow[];
  heatPoints: [number, number, number][];
  showHeat: boolean;
  showZones: boolean;
  selectedId: string | null;
  /** UUID driver — centre la carte et ouvre le popup */
  highlightDriverId?: string | null;
  /** Trajet replay : polyline violette */
  replayLatLngs?: [number, number][];
  /** Position courante pendant le replay (marqueur animé) */
  replayPlayhead?: [number, number] | null;
  /** Trajet client (segment statique) pendant replay */
  replayClientLatLngs?: [number, number][];
  /** Style de contour des polygones de zone */
  zoneOutlineStyle?: 'dash' | 'round';
  onSelect: (m: LiveMapMarker | null) => void;
  className?: string;
  /** Rempli par le composant pour boutons flottants « Centrer tout » */
  mapControlsRef?: React.MutableRefObject<DriversLiveMapControls | null>;
};

function statusRing(status: string): string {
  if (status === 'online') return '#10b981';
  if (status === 'delivering' || status === 'busy') return '#3b82f6';
  if (status === 'inactive') return '#f59e0b';
  if (status === 'idle') return '#f97316';
  return '#94a3b8';
}

export function DriversLiveLeaflet({
  markers,
  zones,
  heatPoints,
  showHeat,
  showZones,
  selectedId,
  highlightDriverId,
  replayLatLngs,
  replayPlayhead,
  replayClientLatLngs,
  zoneOutlineStyle = 'dash',
  onSelect,
  className,
  mapControlsRef,
}: Props) {
  const containerRef = React.useRef<HTMLDivElement>(null);
  const mapRef = React.useRef<import('leaflet').Map | null>(null);
  const clusterRef = React.useRef<import('leaflet').LayerGroup | null>(null);
  const zonesRef = React.useRef<import('leaflet').LayerGroup | null>(null);
  const companionRef = React.useRef<import('leaflet').LayerGroup | null>(null);
  const heatRef = React.useRef<import('leaflet').Layer | null>(null);
  const replayRef = React.useRef<import('leaflet').Polyline | null>(null);
  const replayClientRef = React.useRef<import('leaflet').Polyline | null>(null);
  const replayHeadRef = React.useRef<import('leaflet').Marker | null>(null);
  const didFitRef = React.useRef(false);
  const [ready, setReady] = React.useState(false);
  const leafletRef = React.useRef<typeof import('leaflet') | null>(null);
  const markerByDriverRef = React.useRef<Map<string, import('leaflet').Marker>>(new Map());
  const onSelectRef = React.useRef(onSelect);
  React.useEffect(() => {
    onSelectRef.current = onSelect;
  }, [onSelect]);

  React.useEffect(() => {
    const el = containerRef.current;
    if (!el) return;

    let cancelled = false;
    let map: import('leaflet').Map | null = null;

    void (async () => {
      const L = (await import('leaflet')).default;
      leafletRef.current = L;
      await import('leaflet/dist/leaflet.css');
      await import('leaflet.markercluster/dist/MarkerCluster.css');
      await import('leaflet.markercluster/dist/MarkerCluster.Default.css');
      await import('leaflet.markercluster');

      if (cancelled || !containerRef.current) return;

      delete (L.Icon.Default.prototype as unknown as { _getIconUrl?: unknown })._getIconUrl;
      L.Icon.Default.mergeOptions({
        iconRetinaUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-icon-2x.png',
        iconUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-icon.png',
        shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-shadow.png',
      });

      map = L.map(containerRef.current, { zoomControl: true }).setView([12.1048, 15.0445], 13);

      const carto = L.tileLayer(
        'https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png',
        {
          attribution: '',
          maxZoom: 19,
        },
      );
      const osm = L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        attribution: '',
        maxZoom: 19,
      });
      const satellite = L.tileLayer(
        'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}',
        { attribution: '', maxZoom: 18 },
      );

      carto.addTo(map);
      L.control
        .layers(
          {
            'Carte (CARTO Voyager)': carto,
            'OpenStreetMap': osm,
            'Satellite (Esri)': satellite,
          },
          {},
          { position: 'topright' },
        )
        .addTo(map);

      const cluster = (
        L as unknown as { markerClusterGroup: (o?: object) => import('leaflet').LayerGroup }
      ).markerClusterGroup({
        chunkedLoading: true,
        maxClusterRadius: 50,
      });
      map.addLayer(cluster);
      clusterRef.current = cluster;

      const zg = L.layerGroup();
      map.addLayer(zg);
      zonesRef.current = zg;
      const cg = L.layerGroup();
      map.addLayer(cg);
      companionRef.current = cg;

      mapRef.current = map;
      setReady(true);

      map.on('click', () => onSelectRef.current(null));
    })();

    return () => {
      cancelled = true;
      setReady(false);
      heatRef.current = null;
      clusterRef.current = null;
      zonesRef.current = null;
      companionRef.current = null;
      mapRef.current = null;
      markerByDriverRef.current.clear();
      map?.remove();
    };
  }, []);

  React.useEffect(() => {
    if (!mapControlsRef) return;
    mapControlsRef.current = {
      fitAll: () => {
        const m = mapRef.current;
        const L = leafletRef.current;
        if (!m || !L || markers.length === 0) return;
        const bounds = L.latLngBounds(markers.map((x) => [x.lat, x.lng] as [number, number]));
        m.fitBounds(bounds, { padding: [48, 48], maxZoom: 15 });
      },
    };
    return () => {
      mapControlsRef.current = null;
    };
  }, [mapControlsRef, markers, ready]);

  React.useEffect(() => {
    if (!ready || !mapRef.current || !clusterRef.current || !leafletRef.current) return;
    const L = leafletRef.current;
    const cluster = clusterRef.current;
    cluster.clearLayers();
    markerByDriverRef.current.clear();

    companionRef.current?.clearLayers();
    for (const m of markers) {
      const color = statusRing(m.status);
      const selected = selectedId === m.driver_id;
      const lowBat = m.battery_level != null && m.battery_level < 15;
      const idlePulse = (m.inactive_minutes ?? 0) > 20;
      const img =
        m.avatar_url && m.avatar_url.startsWith('http')
          ? `<img src="${escapeAttr(m.avatar_url)}" alt="" style="width:32px;height:32px;border-radius:50%;object-fit:cover"/>`
          : `<span style="font-size:11px;font-weight:700;color:${color}">${
              escapeHtml(m.display_name.slice(0, 2).toUpperCase()) || 'L'
            }</span>`;

      const motionStyle =
        selected && !m.stale_position
          ? 'animation: gba-driver-selected-blink 1.1s ease-in-out infinite;'
          : idlePulse
            ? 'animation: gba-driver-idle-pulse 1.6s ease-in-out infinite;'
            : '';
      const selectedRing = selected ? 'box-shadow:0 0 0 3px rgba(108,71,255,0.45), 0 2px 10px rgba(0,0,0,.22);' : 'box-shadow:0 2px 10px rgba(0,0,0,.22);';
      const batBadge = lowBat
        ? `<span style="position:absolute;top:-2px;right:-2px;width:11px;height:11px;border-radius:50%;background:#ef4444;border:2px solid #fff"></span>`
        : '';

      const html = `
        <div style="position:relative;width:44px;height:44px;border-radius:50%;border:3px solid ${color};background:#fff;display:flex;align-items:center;justify-content:center;${selectedRing}${motionStyle}">
          ${img}
          ${batBadge}
        </div>`;

      const icon = L.divIcon({
        className: 'gba-driver-marker',
        html,
        iconSize: [44, 44],
        iconAnchor: [22, 22],
        popupAnchor: [0, -22],
      });

      const marker = L.marker([m.lat, m.lng], { icon });

      const parts = [
        `<strong>${escapeHtml(m.display_name)}</strong>`,
        `<div style="font-size:11px;margin-top:2px;color:#64748b">Dernière mise à jour : ${escapeHtml(
          new Date(m.at).toLocaleString('fr-FR'),
        )}</div>`,
        `<div style="font-size:12px;margin-top:4px">Statut : ${escapeHtml(m.status)}</div>`,
      ];
      if (m.speed_kmh != null) parts.push(`<div style="font-size:12px">Vitesse : ${m.speed_kmh} km/h</div>`);
      if (m.battery_level != null) parts.push(`<div style="font-size:12px">Batterie : ${m.battery_level}%</div>`);
      if (m.order_id) parts.push(`<div style="font-size:12px">Livraison en cours</div>`);
      if (m.delivery_address) {
        parts.push(`<div style="font-size:11px;margin-top:4px;max-width:220px">${escapeHtml(m.delivery_address)}</div>`);
      }
      if (m.source === 'live' && !m.stale_position) {
        parts.push(`<div style="font-size:11px;color:#059669">🟢 Temps réel</div>`);
      } else if (m.source === 'live' && m.stale_position) {
        parts.push(`<div style="font-size:11px;color:#b45309">🟡 Dernière position connue</div>`);
      } else if (m.source === 'db_fallback') {
        parts.push(`<div style="font-size:11px;color:#2563eb">🔵 Dernière position enregistrée</div>`);
      }
      if (m.companion?.source === 'order_delivery') {
        parts.push(`<div style="font-size:11px;color:#64748b">📍 Client · position commande</div>`);
      } else if (m.companion?.source === 'user_current_location') {
        parts.push(`<div style="font-size:11px;color:#059669">📍 Client · suivi temps réel</div>`);
      }
      const mapsStreetViewUrl = `https://www.google.com/maps/search/?api=1&query=${m.lat},${m.lng}&layer=c`;
      parts.push(`<div style="margin-top:8px"><a style="font-size:12px;color:#6C47FF;font-weight:600" href="${mapsStreetViewUrl}" target="_blank" rel="noopener">Vue immersive (Street View)</a></div>`);

      marker.bindPopup(`<div style="min-width:180px">${parts.join('')}</div>`);
      marker.on('click', (e) => {
        L.DomEvent.stopPropagation(e);
        onSelectRef.current(m);
      });
      cluster.addLayer(marker);
      markerByDriverRef.current.set(m.driver_id, marker);

      if (m.companion && companionRef.current) {
        const companionIcon = L.divIcon({
          className: 'gba-client-marker',
          html: `<div style="width:18px;height:18px;border-radius:50%;border:2px solid #ffffff;background:#ef4444;box-shadow:0 2px 8px rgba(0,0,0,.28)"></div>`,
          iconSize: [18, 18],
          iconAnchor: [9, 9],
        });
        const companionMarker = L.marker([m.companion.lat, m.companion.lng], { icon: companionIcon });
        companionMarker.bindPopup(
          `<div style="min-width:160px"><strong>Client</strong><div style="font-size:12px;margin-top:4px">${escapeHtml(
            m.companion.source === 'user_current_location' ? 'Position mise à jour en direct' : 'Position au moment de la commande',
          )}</div></div>`,
        );
        companionRef.current.addLayer(companionMarker);

        const link = L.polyline(
          [
            [m.lat, m.lng],
            [m.companion.lat, m.companion.lng],
          ],
          { color: '#ef4444', weight: 2, opacity: 0.8, dashArray: '5 4' },
        );
        companionRef.current.addLayer(link);
      }
    }

    if (markers.length > 0 && mapRef.current && !didFitRef.current) {
      const bounds = L.latLngBounds(markers.map((x) => [x.lat, x.lng] as [number, number]));
      mapRef.current.fitBounds(bounds, { padding: [40, 40], maxZoom: 14 });
      didFitRef.current = true;
    }
    if (markers.length === 0) didFitRef.current = false;
  }, [ready, markers, selectedId]);

  React.useEffect(() => {
    if (!highlightDriverId || !ready || !mapRef.current) return;
    const mk = markerByDriverRef.current.get(highlightDriverId);
    if (!mk) return;
    const ll = mk.getLatLng();
    mapRef.current.setView(ll, Math.max(mapRef.current.getZoom(), 15), { animate: true });
    mk.openPopup();
  }, [highlightDriverId, ready, markers]);

  const lastPanSelectedRef = React.useRef<string | null>(null);
  /** Clic liste latérale : centrer + popup (évite re-pan à chaque refetch markers) */
  React.useEffect(() => {
    if (!ready || !mapRef.current) return;
    if (!selectedId) {
      lastPanSelectedRef.current = null;
      return;
    }
    if (lastPanSelectedRef.current === selectedId) return;
    const mk = markerByDriverRef.current.get(selectedId);
    if (!mk) return;
    lastPanSelectedRef.current = selectedId;
    const ll = mk.getLatLng();
    mapRef.current.setView(ll, Math.max(mapRef.current.getZoom(), 15), { animate: true });
    mk.openPopup();
  }, [selectedId, ready, markers]);

  React.useEffect(() => {
    if (!ready || !mapRef.current || !zonesRef.current || !leafletRef.current) return;
    const L = leafletRef.current;
    const zg = zonesRef.current;
    zg.clearLayers();
    if (!showZones) return;

    const dash = zoneOutlineStyle === 'round' ? undefined : '6 4';
    const lineJoin = zoneOutlineStyle === 'round' ? ('round' as const) : ('miter' as const);
    for (const z of zones) {
      if (!z.is_active) continue;
      try {
        if (zoneOutlineStyle === 'round') {
          const tmp = L.geoJSON(z.geojson as GeoJsonObject);
          const b = tmp.getBounds();
          if (!b.isValid()) {
            tmp.remove();
            continue;
          }
          const center = b.getCenter();
          const ne = b.getNorthEast();
          const sw = b.getSouthWest();
          const radius = Math.max(120, ne.distanceTo(sw) / 2);
          tmp.remove();
          const circle = L.circle(center, {
            radius,
            color: z.color,
            weight: 3,
            fillColor: z.color,
            fillOpacity: 0.14,
          });
          circle.bindPopup(`<strong>${escapeHtml(z.name)}</strong><div class="text-xs mt-1">Zone (cercle approximatif du polygone)</div>`);
          zg.addLayer(circle);
        } else {
          const layer = L.geoJSON(z.geojson as GeoJsonObject, {
            style: {
              color: z.color,
              weight: 2,
              fillColor: z.color,
              fillOpacity: 0.12,
              dashArray: dash,
              lineJoin,
            },
          });
          layer.bindPopup(`<strong>${escapeHtml(z.name)}</strong>`);
          zg.addLayer(layer);
        }
      } catch {
        /* geojson invalide */
      }
    }
  }, [ready, zones, showZones, zoneOutlineStyle]);

  React.useEffect(() => {
    if (!ready || !mapRef.current || !leafletRef.current) return;
    const map = mapRef.current;
    const L = leafletRef.current;

    if (replayRef.current) {
      map.removeLayer(replayRef.current);
      replayRef.current = null;
    }
    if (replayClientRef.current) {
      map.removeLayer(replayClientRef.current);
      replayClientRef.current = null;
    }

    if (replayLatLngs && replayLatLngs.length >= 2) {
      const pl = L.polyline(replayLatLngs, {
        color: '#6C47FF',
        weight: 5,
        opacity: 0.92,
        lineJoin: 'round',
        lineCap: 'round',
        smoothFactor: 1,
      }).addTo(map);
      replayRef.current = pl;
      map.fitBounds(pl.getBounds(), { padding: [48, 48], maxZoom: 16 });
    }

    if (replayClientLatLngs && replayClientLatLngs.length >= 2) {
      const cl = L.polyline(replayClientLatLngs, {
        color: '#94a3b8',
        weight: 3,
        opacity: 0.75,
        dashArray: '6 6',
        lineJoin: 'round',
      }).addTo(map);
      replayClientRef.current = cl;
    }
  }, [ready, replayLatLngs, replayClientLatLngs]);

  React.useEffect(() => {
    if (!ready || !mapRef.current || !leafletRef.current) return;
    const map = mapRef.current;
    const L = leafletRef.current;
    if (replayHeadRef.current) {
      map.removeLayer(replayHeadRef.current);
      replayHeadRef.current = null;
    }
    if (!replayPlayhead) return;
    const [lat, lng] = replayPlayhead;
    if (!Number.isFinite(lat) || !Number.isFinite(lng)) return;
    const icon = L.divIcon({
      className: 'gba-replay-head',
      html: `<div style="width:22px;height:22px;border-radius:50%;background:#6C47FF;border:3px solid #fff;box-shadow:0 2px 10px rgba(0,0,0,.35)"></div>`,
      iconSize: [22, 22],
      iconAnchor: [11, 11],
    });
    const mk = L.marker([lat, lng], { icon, zIndexOffset: 2000 }).addTo(map);
    mk.bindPopup('<strong>Livreur (replay)</strong>');
    replayHeadRef.current = mk;
  }, [ready, replayPlayhead]);

  React.useEffect(() => {
    if (!ready || !mapRef.current || !leafletRef.current) return;
    const map = mapRef.current;
    const L = leafletRef.current;

    if (heatRef.current) {
      map.removeLayer(heatRef.current);
      heatRef.current = null;
    }

    if (!showHeat || heatPoints.length === 0) return;

    void (async () => {
      const mapInner = mapRef.current;
      const Lm = leafletRef.current;
      if (!mapInner || !Lm) return;
      if (typeof window !== 'undefined') {
        (window as unknown as { L: typeof Lm }).L = Lm;
      }
      await import('leaflet.heat');
      const heatLayer = (
        Lm as unknown as {
          heatLayer?: (p: [number, number, number][], o: object) => import('leaflet').Layer;
        }
      ).heatLayer;
      if (typeof heatLayer !== 'function' || !mapRef.current) return;
      const layer = heatLayer(
        heatPoints.map(([lat, lng, w]) => [lat, lng, Math.max(0.05, w)] as [number, number, number]),
        { radius: 28, blur: 18, maxZoom: 17 },
      );
      layer.addTo(mapRef.current);
      heatRef.current = layer;
    })();
  }, [ready, showHeat, heatPoints]);

  return (
    <div className={cn('gba-live-map relative min-h-0 w-full', className)}>
      <div ref={containerRef} className="absolute inset-0 z-0 min-h-[400px] rounded-xl" />
    </div>
  );
}

function escapeHtml(s: string) {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function escapeAttr(s: string) {
  return escapeHtml(s).replace(/'/g, '&#39;');
}
