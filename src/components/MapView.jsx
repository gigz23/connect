import React, { useEffect, useRef } from 'react';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import './MapView.css';

const MapView = ({ places, selectedPlace, onPlaceSelect }) => {
  const mapRef = useRef(null);
  const mapInstanceRef = useRef(null);
  const markersRef = useRef({});

  useEffect(() => {
    // Initialize map
    if (!mapInstanceRef.current) {
      mapInstanceRef.current = L.map(mapRef.current).setView([41.7151, 44.8271], 13); // Tbilisi center
      
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
    if (!mapInstanceRef.current) return;

    // Clear existing markers
    Object.values(markersRef.current).forEach(marker => marker.remove());
    markersRef.current = {};

    // Add markers for each place
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
    if (level === 0) return '#94a3b8'; // gray - inactive
    if (level <= 5) return '#22c55e'; // green - low
    if (level <= 15) return '#eab308'; // yellow - medium
    return '#ef4444'; // red - high
  };

  const getPlaceIcon = (type) => {
    const icons = {
      // Education
      school: '🏫',
      university: '🎓',
      college: '🎓',
      library: '📚',
      
      // Food & Beverage
      cafe: '☕',
      coffee: '☕',
      restaurant: '🍽️',
      bar: '🍺',
      bakery: '🥐',
      
      // Sports & Recreation
      basketball_court: '🏀',
      sports_court: '🏀',
      tennis_court: '🎾',
      gym: '💪',
      fitness: '💪',
      park: '🌳',
      playground: '🎪',
      pool: '🏊',
      
      // Work & Study
      coworking: '💼',
      office: '🏢',
      startup_hub: '🚀',
      
      // Other
      hospital: '🏥',
      pharmacy: '💊',
      church: '⛪',
      museum: '🏛️',
      shopping: '🛍️',
      hotel: '🏨',
      bank: '🏦',
      market: '🏪',
      cinema: '🎬'
    };
    return icons[type] || '📍'; // Default to location pin
  };

  return (
    <div className="map-container">
      <div ref={mapRef} className="map" />
      <div className="map-legend">
        <div className="legend-item">
          <div className="legend-dot" style={{backgroundColor: '#94a3b8'}}></div>
          <span>Inactive</span>
        </div>
        <div className="legend-item">
          <div className="legend-dot" style={{backgroundColor: '#22c55e'}}></div>
          <span>Low activity</span>
        </div>
        <div className="legend-item">
          <div className="legend-dot" style={{backgroundColor: '#eab308'}}></div>
          <span>Medium</span>
        </div>
        <div className="legend-item">
          <div className="legend-dot" style={{backgroundColor: '#ef4444'}}></div>
          <span>High activity</span>
        </div>
      </div>
    </div>
  );
};

export default MapView;
