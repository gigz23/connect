import React, { useEffect, useRef } from 'react';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import './MapView.css';

const MapView = ({ places, selectedPlace, onPlaceSelect, flyToPlace }) => {
  const mapRef = useRef(null);
  const mapInstanceRef = useRef(null);
  const markersRef = useRef({});

  useEffect(() => {
    if (!mapInstanceRef.current) {
      mapInstanceRef.current = L.map(mapRef.current).setView([41.7151, 44.8271], 13);

      L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        attribution: '&copy; OpenStreetMap contributors'
      }).addTo(mapInstanceRef.current);
    }

    return () => {
      if (mapInstanceRef.current) {
        mapInstanceRef.current.remove();
        mapInstanceRef.current = null;
      }
    };
  }, []);

  useEffect(() => {
    if (!mapInstanceRef.current || !flyToPlace) return;
    mapInstanceRef.current.flyTo(
      [flyToPlace.latitude, flyToPlace.longitude],
      16,
      { duration: 1.2 }
    );
  }, [flyToPlace]);

  useEffect(() => {
    if (!mapInstanceRef.current) return;

    Object.values(markersRef.current).forEach(marker => marker.remove());
    markersRef.current = {};

    places.forEach(place => {
      const activityLevel = place.activity_level || 0;
      const color = getActivityColor(activityLevel);

      const icon = L.divIcon({
        className: 'custom-marker',
        html: `
          <div class="marker-wrapper ${selectedPlace?.id === place.id ? 'selected' : ''}">
            <div class="marker-pulse" style="background-color: ${color}"></div>
            <div class="marker-icon" style="background-color: ${color}">
              ${getPlaceIcon(place.type)}
            </div>
            <div class="marker-label">${place.name}</div>
          </div>
        `,
        iconSize: [40, 40],
        iconAnchor: [20, 40]
      });

      const marker = L.marker([place.latitude, place.longitude], { icon })
        .addTo(mapInstanceRef.current)
        .on('click', () => onPlaceSelect(place));

      markersRef.current[place.id] = marker;
    });
  }, [places, selectedPlace, onPlaceSelect]);

  const getActivityColor = (level) => {
    if (level === 0) return '#94a3b8';
    if (level <= 5) return '#22c55e';
    if (level <= 15) return '#eab308';
    return '#ef4444';
  };

  const getPlaceIcon = (type) => {
    const icons = {
      school: '\u{1F3EB}',
      university: '\u{1F393}',
      college: '\u{1F393}',
      library: '\u{1F4DA}',
      cafe: '\u{2615}',
      coffee: '\u{2615}',
      restaurant: '\u{1F37D}\u{FE0F}',
      bar: '\u{1F37A}',
      bakery: '\u{1F950}',
      basketball_court: '\u{1F3C0}',
      sports_court: '\u{1F3C0}',
      tennis_court: '\u{1F3BE}',
      gym: '\u{1F4AA}',
      fitness: '\u{1F4AA}',
      park: '\u{1F333}',
      playground: '\u{1F3AA}',
      pool: '\u{1F3CA}',
      coworking: '\u{1F4BC}',
      office: '\u{1F3E2}',
      startup_hub: '\u{1F680}',
      hospital: '\u{1F3E5}',
      pharmacy: '\u{1F48A}',
      church: '\u{26EA}',
      museum: '\u{1F3DB}\u{FE0F}',
      shopping: '\u{1F6CD}\u{FE0F}',
      hotel: '\u{1F3E8}',
      bank: '\u{1F3E6}',
      market: '\u{1F3EA}',
      cinema: '\u{1F3AC}'
    };
    return icons[type] || '\u{1F4CD}';
  };

  return (
    <div className="map-container">
      <div ref={mapRef} className="map" />
    </div>
  );
};

export default MapView;
