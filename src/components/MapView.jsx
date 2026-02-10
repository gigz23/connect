import React, { useEffect, useRef, useState } from 'react';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import './MapView.css';

const DEFAULT_PLACE_IMAGE = 'https://images.unsplash.com/photo-1486325212027-8081e485255e?w=200&h=200&fit=crop';

const MapView = ({ places, selectedPlace, onPlaceSelect, flyToPlace, createMode, onMapClick, pendingPin }) => {
  const mapRef = useRef(null);
  const mapInstanceRef = useRef(null);
  const markersRef = useRef({});
  const pendingPinRef = useRef(null);
  const onPlaceSelectRef = useRef(onPlaceSelect);
  const onMapClickRef = useRef(onMapClick);

  useEffect(() => {
    onPlaceSelectRef.current = onPlaceSelect;
  }, [onPlaceSelect]);

  useEffect(() => {
    onMapClickRef.current = onMapClick;
  }, [onMapClick]);

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

  // Handle create mode map clicks
  useEffect(() => {
    if (!mapInstanceRef.current) return;

    const handleClick = (e) => {
      if (createMode && onMapClickRef.current) {
        onMapClickRef.current(e.latlng);
      }
    };

    if (createMode) {
      mapInstanceRef.current.on('click', handleClick);
      mapInstanceRef.current.getContainer().style.cursor = 'crosshair';
    } else {
      mapInstanceRef.current.off('click', handleClick);
      mapInstanceRef.current.getContainer().style.cursor = '';
    }

    return () => {
      if (mapInstanceRef.current) {
        mapInstanceRef.current.off('click', handleClick);
        mapInstanceRef.current.getContainer().style.cursor = '';
      }
    };
  }, [createMode]);

  // Handle pending pin marker
  useEffect(() => {
    if (!mapInstanceRef.current) return;

    if (pendingPinRef.current) {
      pendingPinRef.current.remove();
      pendingPinRef.current = null;
    }

    if (pendingPin) {
      const pinIcon = L.divIcon({
        className: 'custom-marker',
        html: `
          <div class="pending-pin-wrapper">
            <div class="pending-pin-icon">
              <svg width="24" height="24" viewBox="0 0 24 24" fill="white" stroke="none">
                <path d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7zm0 9.5c-1.38 0-2.5-1.12-2.5-2.5s1.12-2.5 2.5-2.5 2.5 1.12 2.5 2.5-1.12 2.5-2.5 2.5z"/>
              </svg>
            </div>
            <div class="pending-pin-shadow"></div>
          </div>
        `,
        iconSize: [40, 52],
        iconAnchor: [20, 52]
      });

      pendingPinRef.current = L.marker([pendingPin.lat, pendingPin.lng], { icon: pinIcon })
        .addTo(mapInstanceRef.current);
    }
  }, [pendingPin]);

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
      const imageUrl = place.image_url || DEFAULT_PLACE_IMAGE;
      const isSelected = selectedPlace?.id === place.id;
      const isTemporary = place.is_temporary;

      let timerHtml = '';
      if (isTemporary && place.expires_at) {
        timerHtml = '<div class="marker-temp-badge">TEMP</div>';
      }

      const icon = L.divIcon({
        className: 'custom-marker',
        html: `
          <div class="marker-wrapper ${isSelected ? 'selected' : ''} ${isTemporary ? 'temporary' : ''}">
            <div class="marker-pulse" style="background-color: ${color}"></div>
            <div class="marker-icon-img" style="border-color: ${color}">
              <img src="${imageUrl}" alt="${place.name}" onerror="this.src='${DEFAULT_PLACE_IMAGE}'" />
            </div>
            ${timerHtml}
            <div class="marker-label">${place.name}</div>
          </div>
        `,
        iconSize: [44, 44],
        iconAnchor: [22, 44]
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

  return (
    <div className="map-container">
      <div ref={mapRef} className="map" />
    </div>
  );
};

export default MapView;
