'use client';

import { useEffect, useState } from 'react';
import dynamic from 'next/dynamic';
import type { LatLngTuple } from 'leaflet';

// Types for props that will be passed to the client component
interface GeoLocation {
  country: string;
  city: string;
  sessions: number;
  unique_visitors: number;
  lat?: number;
  lng?: number;
}

interface MapProps {
  data: GeoLocation[];
}

function formatNumber(num: number): string {
  if (num >= 1000000) return `${(num / 1000000).toFixed(1)}M`;
  if (num >= 1000) return `${(num / 1000).toFixed(1)}K`;
  return num.toString();
}

// Create a client-side only component for the actual map
function ClientSideMap({ data }: MapProps) {
  // Import Leaflet components only on client side
  const { MapContainer, TileLayer, Circle, Tooltip } = require('react-leaflet');
  require('leaflet/dist/leaflet.css');

  // Filter out locations without coordinates
  const validLocations = data.filter(loc => 
    loc.lat != null && 
    loc.lng != null && 
    !isNaN(loc.lat) && 
    !isNaN(loc.lng) &&
    (loc.country !== 'Unknown' || loc.city !== 'Unknown')
  );

  if (validLocations.length === 0) {
    return (
      <div className="h-[400px] bg-gray-50 rounded-lg flex items-center justify-center">
        <div className="text-gray-500">No geographic data available</div>
      </div>
    );
  }

  // Calculate center based on available data or use default
  const center: LatLngTuple = validLocations.length > 0
    ? [validLocations[0].lat!, validLocations[0].lng!]
    : [20, 0];

  // Calculate max sessions for relative circle sizes
  const maxSessions = Math.max(...validLocations.map(loc => loc.sessions));

  return (
    <MapContainer
      center={center}
      zoom={2}
      scrollWheelZoom={false}
      style={{ height: '400px', width: '100%', borderRadius: '0.5rem' }}
    >
      <TileLayer
        url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
      />
      {validLocations.map((location, index) => {
        const radius = Math.max(20000, (location.sessions / maxSessions) * 500000);
        const position: LatLngTuple = [location.lat!, location.lng!];
        return (
          <Circle
            key={index}
            center={position}
            pathOptions={{
              fillColor: '#3b82f6',
              fillOpacity: 0.2,
              color: '#3b82f6',
              weight: 1
            }}
            radius={radius}
          >
            <Tooltip>
              <div className="text-sm font-medium">
                {location.city !== 'Unknown' ? location.city : location.country}
              </div>
              <div className="text-xs text-gray-500">
                {formatNumber(location.sessions)} sessions
              </div>
              <div className="text-xs text-gray-500">
                {formatNumber(location.unique_visitors)} unique visitors
              </div>
            </Tooltip>
          </Circle>
        );
      })}
    </MapContainer>
  );
}

// Create a dynamic import for the client-side map
const DynamicMap = dynamic(() => Promise.resolve(ClientSideMap), {
  ssr: false,
  loading: () => (
    <div className="h-[400px] bg-gray-50 rounded-lg flex items-center justify-center">
      <div className="text-gray-500">Loading map...</div>
    </div>
  )
});

// Export the dynamic map as the default component
export default function Map(props: MapProps) {
  return <DynamicMap {...props} />;
} 