import React, { useState, useEffect, useRef } from 'react';
import { supabase } from '../lib/supabase';
import './UserProfileModal.css';

const UserProfileModal = ({ userId, currentUserId, onClose, onProfileUpdate }) => {
  const [profile, setProfile] = useState(null);
  const [loading, setLoading] = useState(true);
  const [editingName, setEditingName] = useState(false);
  const [nameInput, setNameInput] = useState('');
  const [uploading, setUploading] = useState(false);
  const [friendStatus, setFriendStatus] = useState(null); // null | 'pending_sent' | 'pending_received' | 'accepted'
  const [friendshipId, setFriendshipId] = useState(null);
  const [friendCount, setFriendCount] = useState(0);
  const fileInputRef = useRef(null);

  const isOwnProfile = userId === currentUserId;

  useEffect(() => {
    fetchProfile();
    fetchFriendship();
    fetchFriendCount();
  }, [userId]);

  const fetchProfile = async () => {
    setLoading(true);
    const { data } = await supabase
      .from('profiles')
      .select('*')
      .eq('id', userId)
      .single();

    if (data) {
      setProfile(data);
      setNameInput(data.full_name || '');
    }
    setLoading(false);
  };

  const fetchFriendship = async () => {
    if (isOwnProfile) return;

    const { data } = await supabase
      .from('friendships')
      .select('*')
      .or(
        `and(requester_id.eq.${currentUserId},addressee_id.eq.${userId}),and(requester_id.eq.${userId},addressee_id.eq.${currentUserId})`
      )
      .limit(1);

    if (data && data.length > 0) {
      const friendship = data[0];
      setFriendshipId(friendship.id);
      if (friendship.status === 'accepted') {
        setFriendStatus('accepted');
      } else if (friendship.requester_id === currentUserId) {
        setFriendStatus('pending_sent');
      } else {
        setFriendStatus('pending_received');
      }
    } else {
      setFriendStatus(null);
      setFriendshipId(null);
    }
  };

  const fetchFriendCount = async () => {
    const { count } = await supabase
      .from('friendships')
      .select('*', { count: 'exact', head: true })
      .eq('status', 'accepted')
      .or(`requester_id.eq.${userId},addressee_id.eq.${userId}`);

    setFriendCount(count || 0);
  };

  const handleAvatarClick = () => {
    if (isOwnProfile) {
      fileInputRef.current?.click();
    }
  };

  const handleAvatarUpload = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (file.size > 2 * 1024 * 1024) {
      alert('File size must be under 2MB');
      return;
    }

    if (!file.type.startsWith('image/')) {
      alert('Please select an image file');
      return;
    }

    setUploading(true);

    const ext = file.name.split('.').pop();
    const filePath = `${currentUserId}/avatar-${Date.now()}.${ext}`;

    const { error: uploadError } = await supabase.storage
      .from('avatars')
      .upload(filePath, file, { upsert: true });

    if (uploadError) {
      alert('Upload failed: ' + uploadError.message);
      setUploading(false);
      return;
    }

    const { data: urlData } = supabase.storage
      .from('avatars')
      .getPublicUrl(filePath);

    const avatarUrl = urlData.publicUrl;

    await supabase
      .from('profiles')
      .update({ avatar_url: avatarUrl, updated_at: new Date().toISOString() })
      .eq('id', currentUserId);

    setProfile(prev => ({ ...prev, avatar_url: avatarUrl }));
    onProfileUpdate?.({ avatar_url: avatarUrl });
    setUploading(false);
  };

  const handleSaveName = async () => {
    const trimmed = nameInput.trim();
    if (!trimmed) return;

    await supabase
      .from('profiles')
      .update({ full_name: trimmed, updated_at: new Date().toISOString() })
      .eq('id', currentUserId);

    setProfile(prev => ({ ...prev, full_name: trimmed }));
    onProfileUpdate?.({ full_name: trimmed });
    setEditingName(false);
  };

  const handleSendFriendRequest = async () => {
    const { error } = await supabase
      .from('friendships')
      .insert({
        requester_id: currentUserId,
        addressee_id: userId
      });

    if (!error) {
      setFriendStatus('pending_sent');
    }
  };

  const handleAcceptFriendRequest = async () => {
    if (!friendshipId) return;

    await supabase
      .from('friendships')
      .update({ status: 'accepted', updated_at: new Date().toISOString() })
      .eq('id', friendshipId);

    setFriendStatus('accepted');
    setFriendCount(prev => prev + 1);
  };

  const handleRemoveFriend = async () => {
    if (!friendshipId) return;

    await supabase
      .from('friendships')
      .delete()
      .eq('id', friendshipId);

    setFriendStatus(null);
    setFriendshipId(null);
    setFriendCount(prev => Math.max(0, prev - 1));
  };

  const formatDate = (dateStr) => {
    if (!dateStr) return 'Unknown';
    return new Date(dateStr).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    });
  };

  const renderFriendButton = () => {
    if (isOwnProfile) return null;

    switch (friendStatus) {
      case 'accepted':
        return (
          <button className="profile-friend-btn friends" onClick={handleRemoveFriend}>
            Friends
          </button>
        );
      case 'pending_sent':
        return (
          <button className="profile-friend-btn pending" disabled>
            Request Sent
          </button>
        );
      case 'pending_received':
        return (
          <button className="profile-friend-btn accept" onClick={handleAcceptFriendRequest}>
            Accept Request
          </button>
        );
      default:
        return (
          <button className="profile-friend-btn add" onClick={handleSendFriendRequest}>
            Add Friend
          </button>
        );
    }
  };

  if (loading) {
    return (
      <div className="profile-modal-overlay" onClick={onClose}>
        <div className="profile-modal" onClick={e => e.stopPropagation()}>
          <div className="profile-loading">Loading...</div>
        </div>
      </div>
    );
  }

  if (!profile) {
    return (
      <div className="profile-modal-overlay" onClick={onClose}>
        <div className="profile-modal" onClick={e => e.stopPropagation()}>
          <div className="profile-loading">User not found</div>
          <button className="profile-close-btn" onClick={onClose}>Close</button>
        </div>
      </div>
    );
  }

  return (
    <div className="profile-modal-overlay" onClick={onClose}>
      <div className="profile-modal" onClick={e => e.stopPropagation()}>
        <button className="profile-close-btn" onClick={onClose}>&#10005;</button>

        <div className="profile-avatar-section">
          <div
            className={`profile-avatar-wrapper ${isOwnProfile ? 'editable' : ''}`}
            onClick={handleAvatarClick}
          >
            <img
              src={profile.avatar_url || '/default-avatar.svg'}
              alt={profile.full_name || 'User'}
              className="profile-avatar"
              onError={(e) => { e.target.src = '/default-avatar.svg'; }}
            />
            {isOwnProfile && (
              <div className="avatar-upload-overlay">
                {uploading ? 'Uploading...' : 'Change'}
              </div>
            )}
          </div>
          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            onChange={handleAvatarUpload}
            style={{ display: 'none' }}
          />
        </div>

        <div className="profile-info">
          {isOwnProfile && editingName ? (
            <div className="profile-name-edit">
              <input
                type="text"
                value={nameInput}
                onChange={(e) => setNameInput(e.target.value)}
                className="profile-name-input"
                maxLength={50}
                autoFocus
              />
              <div className="profile-name-actions">
                <button onClick={handleSaveName} className="profile-save-btn">Save</button>
                <button onClick={() => { setEditingName(false); setNameInput(profile.full_name || ''); }} className="profile-cancel-btn">Cancel</button>
              </div>
            </div>
          ) : (
            <h2 className="profile-name" onClick={() => isOwnProfile && setEditingName(true)}>
              {profile.full_name || 'Anonymous'}
              {isOwnProfile && <span className="edit-icon" title="Edit name">&#9998;</span>}
            </h2>
          )}

          {isOwnProfile && (
            <p className="profile-email">{profile.email}</p>
          )}

          <div className="profile-meta">
            <div className="profile-meta-item">
              <span className="meta-label">Member since</span>
              <span className="meta-value">{formatDate(profile.created_at)}</span>
            </div>
            <div className="profile-meta-item">
              <span className="meta-label">Friends</span>
              <span className="meta-value">{friendCount}</span>
            </div>
          </div>

          {renderFriendButton()}
        </div>
      </div>
    </div>
  );
};

export default UserProfileModal;
