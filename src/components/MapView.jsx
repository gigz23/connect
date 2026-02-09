import React, { useEffect, useRef } from 'react';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import './MapView.css';

const MapView = ({ places, selectedPlace, onPlaceSelect, flyToPlace }) => {
  const mapRef = useRef(null);
  const mapInstanceRef = useRef(null);
  const markersRef = useRef({});
  const onPlaceSelectRef = useRef(onPlaceSelect);

  // Keep the callback ref up to date without re-creating markers
  useEffect(() => {
    onPlaceSelectRef.current = onPlaceSelect;
  }, [onPlaceSelect]);

  useEffect(() => {
    if (!mapInstanceRef.current) {
      mapInstanceRef.current = L.map(mapRef.current).setView([41.7151, 44.8271], 13);

      L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        attribution: '© OpenStreetMap contributors'
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
        .on('click', () => onPlaceSelectRef.current(place));

      markersRef.current[place.id] = marker;
    });
  }, [places, selectedPlace]);

  const getActivityColor = (level) => {
    if (level === 0) return '#94a3b8';
    if (level <= 5) return '#22c55e';
    if (level <= 15) return '#eab308';
    return '#ef4444';
  };

  const getPlaceIcon = (type) => {
    const icons = {
      school: '🏫', university: '🎓', college: '🎓', library: '📚',
      cafe: '☕', coffee: '☕', restaurant: '🍽️', bar: '🍺', bakery: '🥐',
      basketball_court: '🏀', sports_court: '🏀', tennis_court: '🎾',
      gym: '💪', fitness: '💪', park: '🌳', playground: '🎪', pool: '🏊',
      coworking: '💼', office: '🏢', startup_hub: '🚀',
      hospital: '🏥', pharmacy: '💊', church: '⛪', museum: '🏛️',
      shopping: '🛍️', hotel: '🏨', bank: '🏦', market: '🏪', cinema: '🎬'
    };
    return icons[type] || '📍';
  };

  return (
    <div className="map-container">
      <div ref={mapRef} className="map" />
    </div>
  );
};

export default MapView;
