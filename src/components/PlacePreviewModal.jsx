import React, { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import './PlacePreviewModal.css';

const PlacePreviewModal = ({ place, onJoin, onClose, isFavorite, onToggleFavorite }) => {
  const [onlineUsers, setOnlineUsers] = useState(0);
  const [totalMembers, setTotalMembers] = useState(0);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    getOnlineUserCount();
    getTotalMembers();
  }, [place.id]);

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

  const getPlaceEmoji = (type) => {
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
          </div>
        )}

        <div className="preview-header">
          <div className="place-emoji">{getPlaceEmoji(place.type)}</div>
          <div>
            <h1 className="place-name">{place.name}</h1>
            <p className="place-type">{place.type.replace('_', ' ')}</p>
          </div>
        </div>

        {place.address && (
          <div className="preview-section">
            <h3>{'\u{1F4CD}'} Location</h3>
            <p className="address">{place.address}</p>
          </div>
        )}

        {place.description && (
          <div className="preview-section">
            <h3>{'\u{2139}\u{FE0F}'} About</h3>
            <p className="description">{place.description}</p>
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
