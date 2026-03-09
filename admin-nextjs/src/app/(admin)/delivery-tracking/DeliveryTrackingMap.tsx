'use client';

import React, { useEffect, useState } from 'react';
import { MapContainer, Marker, Polyline, Popup, TileLayer, useMap } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { DriverPopup } from '@/components/delivery/DriverPopup';
import { ClientPopup } from '@/components/delivery/ClientPopup';

type LocRow = { latitude: number; longitude: number; accuracy?: number | null; speed?: number | null; captured_at?: string | null };

type Props = {
  driverLoc: LocRow;
  clientLoc: LocRow | null;
  trail: [number, number][];
  fitterPos: { latitude: number; longitude: number }[];
  selectedDriver: any;
  selectedOrder?: any;
  orders?: any[];
  mapName: (d: any) => string;
};

const MapContainerAny = MapContainer as any;
const TileLayerAny = TileLayer as any;
const MarkerAny = Marker as any;
const PopupAny = Popup as any;
const PolylineAny = Polyline as any;

type DivIconLike = any;

function MapFitter({ positions }: { positions: { latitude: number; longitude: number }[] }) {
  const map = useMap();
  useEffect(() => {
    if (!positions.length) return;
    if (positions.length === 1) {
      map.setView([positions[0].latitude, positions[0].longitude], 15);
      return;
    }
    const bounds = L.latLngBounds(positions.map((p) => [p.latitude, p.longitude]));
    map.fitBounds(bounds, { padding: [60, 60], maxZoom: 16 });
  }, [positions, map]);
  return null;
}

export default function DeliveryTrackingMap({ driverLoc, clientLoc, trail, fitterPos, selectedDriver, selectedOrder, orders, mapName }: Props) {
  const [driverIcon, setDriverIcon] = useState<DivIconLike | null>(null);
  const [clientIcon, setClientIcon] = useState<DivIconLike | null>(null);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    try {
      setDriverIcon(
        L.divIcon({
          className: '',
          html: `<div style="
            width:38px;height:38px;border-radius:50%;
            background:linear-gradient(135deg,#667eea,#764ba2);
            display:flex;align-items:center;justify-content:center;
            box-shadow:0 0 0 6px rgba(102,126,234,.25);
            font-size:18px;border:2px solid #fff;">🚚</div>`,
          iconSize: [38, 38],
          iconAnchor: [19, 19],
          popupAnchor: [0, -22],
        }),
      );
      setClientIcon(
        L.divIcon({
          className: '',
          html: `<div style="
            width:34px;height:34px;border-radius:50%;
            background:linear-gradient(135deg,#3b82f6,#1d4ed8);
            display:flex;align-items:center;justify-content:center;
            box-shadow:0 0 0 5px rgba(59,130,246,.25);
            font-size:16px;border:2px solid #fff;">👤</div>`,
          iconSize: [34, 34],
          iconAnchor: [17, 17],
          popupAnchor: [0, -20],
        }),
      );
    } catch {
      // ignore
    }
  }, []);

  return (
    <MapContainerAny center={[driverLoc.latitude, driverLoc.longitude]} zoom={14} style={{ width: '100%', height: '100%' }}>
      <TileLayerAny
        attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
        url="https://tile.openstreetmap.org/{z}/{x}/{y}.png"
      />
      <MapFitter positions={fitterPos} />
      {trail.length > 1 ? (
        <PolylineAny positions={trail} pathOptions={{ color: '#667eea', weight: 3, opacity: 0.6, dashArray: '6 4' }} />
      ) : null}

      <MarkerAny position={[driverLoc.latitude, driverLoc.longitude]} {...(driverIcon ? { icon: driverIcon } : {})}>
        <PopupAny>
          <DriverPopup 
            driver={selectedDriver} 
            location={driverLoc} 
            orders={orders || []} 
            mapName={mapName} 
          />
        </PopupAny>
      </MarkerAny>

      {clientLoc ? (
        <MarkerAny position={[clientLoc.latitude, clientLoc.longitude]} {...(clientIcon ? { icon: clientIcon } : {})}>
          <PopupAny>
            <ClientPopup 
              location={clientLoc} 
              order={selectedOrder} 
            />
          </PopupAny>
        </MarkerAny>
      ) : null}
    </MapContainerAny>
  );
}
