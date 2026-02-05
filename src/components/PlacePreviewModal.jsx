import React, { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import './PlacePreviewModal.css';

const PlacePreviewModal = ({ place, onJoin, onClose }) => {
  const [onlineUsers, setOnlineUsers] = useState(0);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    getOnlineUserCount();
  }, [place.id]);

  const getOnlineUserCount = async () => {
    try {
      // Create a temporary channel to check presence
      const tempChannel = supabase
        .channel(`preview-${place.id}`)
        .on('presence', { event: 'sync' }, () => {
          const state = tempChannel.presenceState();
          setOnlineUsers(Object.keys(state).length);
        })
        .subscribe();

      // Cleanup after a moment
      setTimeout(() => {
        supabase.removeChannel(tempChannel);
        setLoading(false);
      }, 500);
    } catch (error) {
      console.error('Error getting online users:', error);
      setLoading(false);
    }
  };

  const getPlaceEmoji = (type) => {
    const icons = {
      school: '🏫',
      university: '🎓',
      college: '🎓',
      library: '📚',
      cafe: '☕',
      coffee: '☕',
      restaurant: '🍽️',
      bar: '🍺',
      bakery: '🥐',
      basketball_court: '🏀',
      sports_court: '🏀',
      tennis_court: '🎾',
      gym: '💪',
      fitness: '💪',
      park: '🌳',
      playground: '🎪',
      pool: '🏊',
      coworking: '💼',
      office: '🏢',
      startup_hub: '🚀',
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
    return icons[type] || '📍';
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="place-preview-modal" onClick={(e) => e.stopPropagation()}>
        {/* Close Button */}
        <button className="close-btn" onClick={onClose}>✕</button>

        {/* Image */}
        {place.image_url && (
          <div className="preview-image-container">
            <img 
              src={place.image_url} 
              alt={place.name}
              className="preview-image"
              onError={(e) => {
                e.target.style.display = 'none';
              }}
            />
          </div>
        )}

        {/* Header with Emoji */}
        <div className="preview-header">
          <div className="place-emoji">{getPlaceEmoji(place.type)}</div>
          <div>
            <h1 className="place-name">{place.name}</h1>
            <p className="place-type">{place.type.replace('_', ' ')}</p>
          </div>
        </div>

        {/* Location Info */}
        {place.address && (
          <div className="preview-section">
            <h3>📍 Location</h3>
            <p className="address">{place.address}</p>
          </div>
        )}

        {/* Description */}
        {place.description && (
          <div className="preview-section">
            <h3>ℹ️ About</h3>
            <p className="description">{place.description}</p>
          </div>
        )}

        {/* Online Users */}
        <div className="preview-section">
          <h3>👥 Community</h3>
          <div className="online-info">
            <div className="user-count">
              <span className="online-indicator">🟢</span>
              <span className="count-text">
                {loading ? 'Loading...' : `${onlineUsers} ${onlineUsers === 1 ? 'person' : 'people'} online`}
              </span>
            </div>
          </div>
        </div>

        {/* Activity Level */}
        <div className="preview-section">
          <h3>⚡ Activity</h3>
          <div className="activity-bars">
            {Array.from({ length: 20 }).map((_, i) => (
              <div
                key={i}
                className={`activity-bar ${i < (place.activity_level || 0) ? 'active' : ''}`}
              />
            ))}
          </div>
          <p className="activity-label">
            {place.activity_level === 0 && 'Quiet'}
            {place.activity_level > 0 && place.activity_level <= 5 && 'Low activity'}
            {place.activity_level > 5 && place.activity_level <= 15 && 'Moderate activity'}
            {place.activity_level > 15 && 'Busy'}
          </p>
        </div>

        {/* Join Button */}
        <button className="join-btn" onClick={onJoin}>
          💬 Join the Chat
        </button>
      </div>
    </div>
  );
};

export default PlacePreviewModal;
