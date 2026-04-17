import React, { useEffect, useRef, useState } from 'react';
import { useJsApiLoader } from '@react-google-maps/api';

const center = {
  lat: 18.9388,
  lng: 72.8258
};

// AdvancedMarkerElement requires a Map ID (it can be any string ID configured in Cloud Console, 
// or a mock string like this if no styling is needed yet)
const MAP_ID = 'DEMO_WANKHEDE_MAP';

export default function LiveMap() {
  const mapRef = useRef(null);
  const markerRef = useRef(null);
  const [mapInstance, setMapInstance] = useState(null);

  // Requirement 2: load the 'marker' library explicitly
  const [libraries] = useState(['marker']);

  const { isLoaded } = useJsApiLoader({
    id: 'google-map-script',
    googleMapsApiKey: import.meta.env.VITE_MAPS_API_KEY,
    libraries
  });

  // Requirement 4: Provide updated React-compatible code using hooks
  useEffect(() => {
    let active = true;

    const initMap = async () => {
      if (!isLoaded || !mapRef.current || mapInstance) return;

      try {
        // Requirement 3: Use dynamic imports for "maps" and "marker"
        const { Map } = await window.google.maps.importLibrary("maps");
        const { AdvancedMarkerElement } = await window.google.maps.importLibrary("marker");

        if (!active || !mapRef.current) return;

        const dynamicMap = new Map(mapRef.current, {
          center,
          zoom: 16,
          mapId: MAP_ID, // Map ID is mandatory for AdvancedMarkerElement
          disableDefaultUI: false,
          zoomControl: true,
          mapTypeControl: false,
          streetViewControl: false,
          fullscreenControl: false,
        });

        // Requirement 1: Replace google.maps.Marker with AdvancedMarkerElement
        const advancedMarker = new AdvancedMarkerElement({
          map: dynamicMap,
          position: center,
          title: "Wankhede Stadium"
        });

        markerRef.current = advancedMarker;
        setMapInstance(dynamicMap);

      } catch (err) {
        console.error("Failed to initialize Google Map:", err);
      }
    };

    initMap();

    return () => {
      active = false;
      // Cleanup marker if unmounting
      if (markerRef.current) {
        markerRef.current.map = null;
      }
    };
  }, [isLoaded, mapInstance]);

  if (!isLoaded) {
    return (
      <div className="min-h-[80vh] w-full rounded-2xl bg-surface-container flex items-center justify-center text-on-surface-variant font-medium text-sm animate-pulse">
        Loading Massive Map...
      </div>
    );
  }

  return (
    <div className="w-full flex-grow min-h-[80vh] rounded-3xl overflow-hidden border border-outline-variant relative isolate shadow-xl">
      <div ref={mapRef} style={{ width: '100%', height: '100%' }} />
    </div>
  );
}
