import React, { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import './PlacePreviewModal.css';

const PlacePreviewModal = ({ place, onJoin, onClose, isFavorite, onToggleFavorite }) => {
  const [onlineUsers, setOnlineUsers] = useState(0);
  const [totalMembers, setTotalMembers] = useState(0);
  const [loading, setLoading] = useState(true);
  const [timeLeft, setTimeLeft] = useState(null);

  useEffect(() => {
    getOnlineUserCount();
    getTotalMembers();
  }, [place.id]);

  // Countdown timer for temporary places
  useEffect(() => {
    if (!place.is_temporary || !place.expires_at) return;

    const updateTimer = () => {
      const now = new Date();
      const expires = new Date(place.expires_at);
      const diff = expires - now;

      if (diff <= 0) {
        setTimeLeft('Expired');
        return;
      }

      const hours = Math.floor(diff / (1000 * 60 * 60));
      const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));

      if (hours > 0) {
        setTimeLeft(`${hours}h ${minutes}m left`);
      } else {
        setTimeLeft(`${minutes}m left`);
      }
    };

    updateTimer();
    const interval = setInterval(updateTimer, 60000);
    return () => clearInterval(interval);
  }, [place.is_temporary, place.expires_at]);

  const getOnlineUserCount = async () => {
    try {
      const tempChannel = supabase
        .channel(`preview-${place.id}`)
        .on('presence', { event: 'sync' }, () => {
          const state = tempChannel.presenceState();
          setOnlineUsers(Object.keys(state).length);
        })
        .subscribe();

      setTimeout(() => {
        supabase.removeChannel(tempChannel);
        setLoading(false);
      }, 500);
    } catch (error) {
      console.error('Error getting online users:', error);
      setLoading(false);
    }
  };

  const getTotalMembers = async () => {
    try {
      const { data } = await supabase
        .from('messages')
        .select('user_id')
        .eq('place_id', place.id)
        .not('user_id', 'is', null);

      if (data) {
        const uniqueUsers = new Set(data.map(m => m.user_id));
        setTotalMembers(uniqueUsers.size);
      }
    } catch (error) {
      console.error('Error getting total members:', error);
    }
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="place-preview-modal" onClick={(e) => e.stopPropagation()}>
        <button className="close-btn" onClick={onClose}>{'\u2715'}</button>

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
            {place.is_temporary && timeLeft && (
              <div className="preview-temp-badge">
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                  <circle cx="12" cy="12" r="10"/>
                  <polyline points="12 6 12 12 16 14"/>
                </svg>
                {timeLeft}
              </div>
            )}
          </div>
        )}

        <div className="preview-header">
          {place.image_url ? (
            <div className="place-thumb">
              <img
                src={place.image_url}
                alt={place.name}
                onError={(e) => { e.target.style.display = 'none'; }}
              />
            </div>
          ) : (
            <div className="place-thumb place-thumb-default">
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#94a3b8" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"/>
                <circle cx="12" cy="10" r="3"/>
              </svg>
            </div>
          )}
          <div>
            <h1 className="place-name">{place.name}</h1>
            <p className="place-type">
              {place.type.replace('_', ' ')}
              {place.is_temporary && <span className="place-type-temp"> &middot; Temporary</span>}
            </p>
          </div>
        </div>

        {place.address && (
          <div className="preview-section">
            <h3>{'\u{1F4CD}'} Location</h3>
            <p className="address">{place.address}</p>
          </div>
        )}

        {(place.description || place.bio) && (
          <div className="preview-section">
            <h3>{'\u{2139}\u{FE0F}'} About</h3>
            <p className="description">{place.description || place.bio}</p>
          </div>
        )}

        <div className="preview-section">
          <h3>{'\u{1F465}'} Community</h3>
          <div className="community-stats">
            <div className="user-count">
              <span className="online-indicator">{'\u{1F7E2}'}</span>
              <span className="count-text">
                {loading ? 'Loading...' : `${onlineUsers} ${onlineUsers === 1 ? 'person' : 'people'} online`}
              </span>
            </div>
            <div className="total-members">
              <span className="members-icon">{'\u{1F465}'}</span>
              <span className="members-text">
                {totalMembers} {totalMembers === 1 ? 'person has' : 'people have'} joined this chat
              </span>
            </div>
          </div>
        </div>

        <div className="preview-section favorite-section">
          <button
            className={`favorite-btn ${isFavorite ? 'favorited' : ''}`}
            onClick={() => onToggleFavorite(place.id)}
          >
            <span className="favorite-star">{isFavorite ? '\u{2605}' : '\u{2606}'}</span>
            <span>{isFavorite ? 'Added to Favorites' : 'Add as a Favorite'}</span>
          </button>
        </div>

        <button className="join-btn" onClick={onJoin}>
          {'\u{1F4AC}'} Join the Chat
        </button>
      </div>
    </div>
  );
};

export default PlacePreviewModal;
