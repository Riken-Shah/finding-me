'use client';

import { useEffect, useState } from 'react';
import { Map as PigeonMap, Marker, ZoomControl } from 'pigeon-maps';

// Types for props that will be passed to the client component
interface GeoLocation {
  country: string;
  city: string;
  sessions: number;
  returning_visitors: number;
  bounce_rate: number;
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

export default function Map({ data }: MapProps) {
  const [isClient, setIsClient] = useState(false);
  const [selectedLocation, setSelectedLocation] = useState<GeoLocation | null>(null);

  useEffect(() => {
    setIsClient(true);
  }, []);

  // Filter out locations without coordinates
  const validLocations = data.filter(loc => 
    loc.lat != null && 
    loc.lng != null && 
    !isNaN(loc.lat) && 
    !isNaN(loc.lng) &&
    loc.lat !== 0 && 
    loc.lng !== 0 &&
    loc.sessions > 0
  );

  // Default center to US if no data



  // Calculate max sessions for relative marker sizes
  const maxSessions = Math.max(...validLocations.map(loc => loc.sessions), 1);

  if (!isClient) {
    return (
      <div className="h-[400px] bg-gray-50 rounded-lg flex items-center justify-center">
        <div className="text-gray-500">Loading map...</div>
      </div>
    );
  }

  return (
    <div className="relative h-[400px] rounded-lg overflow-hidden">
      <PigeonMap
        defaultZoom={validLocations.length > 0 ? 2 : 3}
        attribution={false}
        metaWheelZoom={true}
        twoFingerDrag={false}
      >
        <ZoomControl />
        {validLocations.map((location, index) => {
          const size = Math.max(24, Math.min(48, (location.sessions / maxSessions) * 60));
          return (
            <Marker
              key={index}
              width={size}
              anchor={[location.lat!, location.lng!]}
              onClick={() => setSelectedLocation(location)}
              color="#3b82f6"
            />
          );
        })}
      </PigeonMap>
      
      {validLocations.length === 0 && (
        <div className="absolute inset-0 flex items-center justify-center bg-white bg-opacity-90">
          <div className="text-center p-4">
            <div className="text-gray-500 font-medium">No geographic data available</div>
            <div className="text-gray-400 text-sm mt-1">Visit data will appear here as users browse your site</div>
          </div>
        </div>
      )}
      
      {/* Tooltip */}
      {selectedLocation && (
        <div className="absolute bottom-4 left-4 bg-white p-3 rounded-lg shadow-lg z-10">
          <div className="text-sm font-medium">
            {selectedLocation.city !== 'Unknown' 
              ? `${selectedLocation.city}, ${selectedLocation.country}` 
              : selectedLocation.country}
          </div>
          <div className="text-xs text-gray-500 mt-1">
            {formatNumber(selectedLocation.sessions)} sessions
          </div>
          <div className="text-xs text-gray-500">
            {formatNumber(selectedLocation.returning_visitors)} returning visitors
          </div>
          <div className="text-xs text-gray-500">
            {selectedLocation.bounce_rate.toFixed(1)}% bounce rate
          </div>
          <button
            onClick={() => setSelectedLocation(null)}
            className="absolute top-1 right-1 text-gray-400 hover:text-gray-600 text-xs p-1"
            aria-label="Close"
          >
            ×
          </button>
        </div>
      )}
    </div>
  );
} 