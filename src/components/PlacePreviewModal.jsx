import React, { useState, useEffect, useRef } from 'react';
import { supabase } from '../lib/supabase';
import './PlacePreviewModal.css';

const ADMIN_USER_ID = '2ad81a31-80c4-457d-983b-a71ccb417b4f';

const PlacePreviewModal = ({ place, onJoin, onClose, isFavorite, onToggleFavorite, currentUserId, onPlaceUpdate }) => {
  const [onlineUsers, setOnlineUsers] = useState(0);
  const [totalMembers, setTotalMembers] = useState(0);
  const [loading, setLoading] = useState(true);
  const [timeLeft, setTimeLeft] = useState(null);
  const [currentImageUrl, setCurrentImageUrl] = useState(place.image_url);
  const [uploading, setUploading] = useState(false);
  const imageInputRef = useRef(null);

  const isAdmin = currentUserId === ADMIN_USER_ID;
  const isCreator = place.created_by && place.created_by === currentUserId;
  const canEditImage = isAdmin || isCreator;

  useEffect(() => {
    getOnlineUserCount();
    getTotalMembers();
  }, [place.id]);

  useEffect(() => {
    setCurrentImageUrl(place.image_url);
  }, [place.image_url]);

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

  const handleImageChange = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith('image/')) {
      alert('Please select an image file');
      return;
    }

    if (file.size > 5 * 1024 * 1024) {
      alert('Image must be under 5MB');
      return;
    }

    setUploading(true);

    try {
      const ext = file.name.split('.').pop();
      const filePath = `place-images/${place.id}/${Date.now()}.${ext}`;

      const { error: uploadError } = await supabase.storage
        .from('avatars')
        .upload(filePath, file);

      if (uploadError) {
        alert('Upload failed: ' + uploadError.message);
        setUploading(false);
        return;
      }

      const { data: urlData } = supabase.storage
        .from('avatars')
        .getPublicUrl(filePath);

      const newUrl = urlData.publicUrl;

      const { error: updateError } = await supabase
        .from('places')
        .update({ image_url: newUrl })
        .eq('id', place.id);

      if (updateError) {
        alert('Failed to update image: ' + updateError.message);
        setUploading(false);
        return;
      }

      setCurrentImageUrl(newUrl);
      if (onPlaceUpdate) {
        onPlaceUpdate(place.id, { image_url: newUrl });
      }
    } catch (err) {
      alert('Something went wrong');
    }

    setUploading(false);
    if (imageInputRef.current) imageInputRef.current.value = '';
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="place-preview-modal" onClick={(e) => e.stopPropagation()}>
        <button className="close-btn" onClick={onClose}>{'\u2715'}</button>

        <div className="preview-image-container">
          {currentImageUrl ? (
            <img
              src={currentImageUrl}
              alt={place.name}
              className="preview-image"
              onError={(e) => {
                e.target.style.display = 'none';
              }}
            />
          ) : (
            <div className="preview-image-placeholder">
              <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="#cbd5e1" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                <rect x="3" y="3" width="18" height="18" rx="2" ry="2"/>
                <circle cx="8.5" cy="8.5" r="1.5"/>
                <polyline points="21 15 16 10 5 21"/>
              </svg>
            </div>
          )}
          {place.is_temporary && timeLeft && (
            <div className="preview-temp-badge">
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <circle cx="12" cy="12" r="10"/>
                <polyline points="12 6 12 12 16 14"/>
              </svg>
              {timeLeft}
            </div>
          )}
          {canEditImage && (
            <button
              className="edit-image-btn"
              onClick={() => imageInputRef.current?.click()}
              disabled={uploading}
              title="Change image"
            >
              {uploading ? (
                <span className="edit-image-spinner" />
              ) : (
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/>
                  <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/>
                </svg>
              )}
            </button>
          )}
          <input
            ref={imageInputRef}
            type="file"
            accept="image/*"
            style={{ display: 'none' }}
            onChange={handleImageChange}
          />
        </div>

        {/* Pencil edit button below image for visibility */}
        {canEditImage && (
          <div className="edit-image-row">
            <button
              className="edit-image-text-btn"
              onClick={() => imageInputRef.current?.click()}
              disabled={uploading}
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/>
                <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/>
              </svg>
              {uploading ? 'Uploading...' : 'Change picture'}
            </button>
          </div>
        )}

        <div className="preview-header">
          {currentImageUrl ? (
            <div className="place-thumb">
              <img
                src={currentImageUrl}
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
