import React, { useState, useEffect, useRef } from 'react';
import { supabase } from '../lib/supabase';
import './ChatPanel.css';

const MAX_MESSAGE_LENGTH = 500;
const QUICK_EMOJIS = ['\u{1F44D}', '\u{2764}\u{FE0F}', '\u{1F602}', '\u{1F62E}', '\u{1F622}', '\u{1F621}'];

const ChatPanel = ({ place, username, userId, onClose, onProfileClick }) => {
  const [messages, setMessages] = useState([]);
  const [reactions, setReactions] = useState({});
  const [newMessage, setNewMessage] = useState('');
  const [onlineUsers, setOnlineUsers] = useState(0);
  const [onlineUsersList, setOnlineUsersList] = useState([]);
  const [showOnlineUsers, setShowOnlineUsers] = useState(false);
  const [onlineSearchQuery, setOnlineSearchQuery] = useState('');
  const [showCameraMenu, setShowCameraMenu] = useState(false);
  const [hoveredMessage, setHoveredMessage] = useState(null);
  const [showMessageMenu, setShowMessageMenu] = useState(null);
  const [showReactionPicker, setShowReactionPicker] = useState(null);
  const messagesEndRef = useRef(null);
  const channelRef = useRef(null);
  const profileCacheRef = useRef({});
  const cameraInputRef = useRef(null);
  const libraryInputRef = useRef(null);

  useEffect(() => {
    loadMessages();
    subscribeToMessages();
    joinRoom();

    return () => {
      leaveRoom();
      if (channelRef.current) {
        supabase.removeChannel(channelRef.current);
      }
    };
  }, [place.id]);

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  useEffect(() => {
    if (messages.length > 0) {
      loadReactions();
    }
  }, [messages.length]);

  // Close popups when clicking elsewhere
  useEffect(() => {
    const handleClick = () => {
      setShowMessageMenu(null);
      setShowReactionPicker(null);
      setShowCameraMenu(false);
    };
    document.addEventListener('click', handleClick);
    return () => document.removeEventListener('click', handleClick);
  }, []);

  const loadMessages = async () => {
    const { data } = await supabase
      .from('messages')
      .select('*, profile:profiles!messages_profile_fkey(full_name, avatar_url)')
      .eq('place_id', place.id)
      .order('created_at', { ascending: true })
      .limit(50);

    if (data) {
      data.forEach(msg => {
        if (msg.user_id && msg.profile) {
          profileCacheRef.current[msg.user_id] = msg.profile;
        }
      });
      setMessages(data);
    }
  };

  const loadReactions = async () => {
    try {
      const messageIds = messages.map(m => m.id).filter(Boolean);
      if (messageIds.length === 0) return;

      const { data } = await supabase
        .from('message_reactions')
        .select('*')
        .in('message_id', messageIds);

      if (data) {
        const grouped = {};
        data.forEach(r => {
          if (!grouped[r.message_id]) grouped[r.message_id] = [];
          grouped[r.message_id].push(r);
        });
        setReactions(grouped);
      }
    } catch (e) {
      // Table might not exist yet - that's ok
    }
  };

  const fetchProfileForMessage = async (msg) => {
    if (!msg.user_id || profileCacheRef.current[msg.user_id]) return;

    const { data } = await supabase
      .from('profiles')
      .select('full_name, avatar_url')
      .eq('id', msg.user_id)
      .single();

    if (data) {
      profileCacheRef.current[msg.user_id] = data;
      setMessages(prev =>
        prev.map(m =>
          m.id === msg.id ? { ...m, profile: data } : m
        )
      );
    }
  };

  const subscribeToMessages = () => {
    channelRef.current = supabase
      .channel(`place-${place.id}`)
      .on('postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'messages',
          filter: `place_id=eq.${place.id}`
        },
        (payload) => {
          const newMsg = payload.new;
          if (newMsg.user_id && profileCacheRef.current[newMsg.user_id]) {
            newMsg.profile = profileCacheRef.current[newMsg.user_id];
          }
          setMessages(prev => [...prev, newMsg]);

          if (newMsg.user_id && !newMsg.profile) {
            fetchProfileForMessage(newMsg);
          }
        }
      )
      .on('postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'messages',
          filter: `place_id=eq.${place.id}`
        },
        (payload) => {
          setMessages(prev =>
            prev.map(m => m.id === payload.new.id
              ? { ...m, content: payload.new.content }
              : m
            )
          );
        }
      )
      .on('presence', { event: 'sync' }, () => {
        const state = channelRef.current.presenceState();
        const users = Object.values(state).flat();
        setOnlineUsers(users.length);
        setOnlineUsersList(users);
      })
      .subscribe();

    channelRef.current.track({
      user: username,
      userId: userId,
      online_at: new Date().toISOString()
    });
  };

  const joinRoom = async () => {};
  const leaveRoom = async () => {};

  const handleSendMessage = async (e) => {
    e.preventDefault();
    const trimmed = newMessage.trim();
    if (!trimmed || trimmed.length > MAX_MESSAGE_LENGTH) return;

    const { error } = await supabase
      .from('messages')
      .insert({
        place_id: place.id,
        user_id: userId || null,
        username: username,
        content: trimmed,
        created_at: new Date().toISOString()
      });

    if (!error) {
      setNewMessage('');
    }
  };

  const handleUnsend = async (messageId) => {
    await supabase
      .from('messages')
      .update({ content: '__UNSENT__' })
      .eq('id', messageId)
      .eq('user_id', userId);

    setShowMessageMenu(null);
  };

  const handleReaction = async (messageId, emoji) => {
    const existing = reactions[messageId]?.find(
      r => r.user_id === userId && r.emoji === emoji
    );

    if (existing) {
      // Remove reaction
      setReactions(prev => {
        const updated = { ...prev };
        updated[messageId] = (updated[messageId] || []).filter(
          r => !(r.user_id === userId && r.emoji === emoji)
        );
        if (updated[messageId].length === 0) delete updated[messageId];
        return updated;
      });
      try {
        await supabase.from('message_reactions').delete()
          .eq('message_id', messageId)
          .eq('user_id', userId)
          .eq('emoji', emoji);
      } catch (e) { /* table might not exist */ }
    } else {
      // Add reaction
      const newReaction = { user_id: userId, emoji, username, message_id: messageId };
      setReactions(prev => ({
        ...prev,
        [messageId]: [...(prev[messageId] || []), newReaction]
      }));
      try {
        await supabase.from('message_reactions').insert({
          message_id: messageId,
          user_id: userId,
          emoji: emoji,
          username: username
        });
      } catch (e) { /* table might not exist */ }
    }

    setShowReactionPicker(null);
    setShowMessageMenu(null);
  };

  const handleMediaUpload = async (file) => {
    if (!file) return;

    const isImage = file.type.startsWith('image/');
    const isVideo = file.type.startsWith('video/');

    if (!isImage && !isVideo) {
      alert('Please select an image or video file');
      return;
    }

    if (file.size > 10 * 1024 * 1024) {
      alert('File size must be under 10MB');
      return;
    }

    const ext = file.name.split('.').pop();
    const filePath = `chat-media/${place.id}/${userId}/${Date.now()}.${ext}`;

    const { error: uploadError } = await supabase.storage
      .from('avatars')
      .upload(filePath, file);

    if (uploadError) {
      alert('Upload failed: ' + uploadError.message);
      return;
    }

    const { data: urlData } = supabase.storage
      .from('avatars')
      .getPublicUrl(filePath);

    const mediaUrl = urlData.publicUrl;
    const mediaType = isImage ? 'image' : 'video';
    const content = `__MEDIA__${JSON.stringify({ type: mediaType, url: mediaUrl })}`;

    await supabase.from('messages').insert({
      place_id: place.id,
      user_id: userId || null,
      username: username,
      content: content,
      created_at: new Date().toISOString()
    });

    setShowCameraMenu(false);
  };

  const groupReactions = (reactionsList) => {
    if (!reactionsList) return [];
    const groups = {};
    reactionsList.forEach(r => {
      if (!groups[r.emoji]) {
        groups[r.emoji] = { emoji: r.emoji, count: 0, hasOwn: false, users: [] };
      }
      groups[r.emoji].count++;
      groups[r.emoji].users.push(r.username);
      if (r.user_id === userId) groups[r.emoji].hasOwn = true;
    });
    return Object.values(groups);
  };

  const renderMessageContent = (msg) => {
    if (msg.content === '__UNSENT__') {
      return <span className="unsent-message">{'\u{1F6AB}'} Message was unsent</span>;
    }

    if (msg.content.startsWith('__MEDIA__')) {
      try {
        const mediaData = JSON.parse(msg.content.replace('__MEDIA__', ''));
        if (mediaData.type === 'image') {
          return (
            <img
              src={mediaData.url}
              alt="Shared image"
              className="chat-media-image"
              onClick={() => window.open(mediaData.url, '_blank')}
            />
          );
        }
        if (mediaData.type === 'video') {
          return <video src={mediaData.url} controls className="chat-media-video" />;
        }
      } catch (e) {
        return msg.content;
      }
    }

    return msg.content;
  };

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  const formatTime = (timestamp) => {
    const date = new Date(timestamp);
    return date.toLocaleTimeString('en-US', {
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  const getMessageAvatar = (msg) => {
    if (msg.profile?.avatar_url) return msg.profile.avatar_url;
    if (msg.user_id && profileCacheRef.current[msg.user_id]?.avatar_url) {
      return profileCacheRef.current[msg.user_id].avatar_url;
    }
    return '/default-avatar.svg';
  };

  const getMessageDisplayName = (msg) => {
    if (msg.profile?.full_name) return msg.profile.full_name;
    if (msg.user_id && profileCacheRef.current[msg.user_id]?.full_name) {
      return profileCacheRef.current[msg.user_id].full_name;
    }
    return msg.username;
  };

  const filteredOnlineUsers = onlineUsersList.filter(u =>
    (u.user || '').toLowerCase().includes(onlineSearchQuery.toLowerCase())
  );

  return (
    <div className="chat-panel">
      <div className="chat-header">
        <div className="chat-header-info">
          <h2>{place.name}</h2>
          <span className="chat-subtitle">{place.type.replace('_', ' ')}</span>
          <span
            className="online-indicator"
            onClick={() => setShowOnlineUsers(true)}
            title="Click to see who's online"
          >
            {'\u{1F7E2}'} {onlineUsers} online
          </span>
        </div>
        <button className="close-btn" onClick={onClose}>{'\u2715'}</button>
      </div>

      {/* Online Users Popup */}
      {showOnlineUsers && (
        <div className="online-users-popup-overlay" onClick={() => setShowOnlineUsers(false)}>
          <div className="online-users-popup" onClick={e => e.stopPropagation()}>
            <div className="online-popup-header">
              <h3>{'\u{1F7E2}'} Online ({onlineUsers})</h3>
              <button
                className="online-popup-close"
                onClick={() => setShowOnlineUsers(false)}
              >
                {'\u2715'}
              </button>
            </div>
            <div className="online-search">
              <input
                type="text"
                placeholder="Search online users..."
                value={onlineSearchQuery}
                onChange={e => setOnlineSearchQuery(e.target.value)}
                autoFocus
              />
            </div>
            <div className="online-users-list">
              {filteredOnlineUsers.length === 0 ? (
                <div className="online-users-empty">
                  {onlineSearchQuery ? 'No users found' : 'No one else online'}
                </div>
              ) : (
                filteredOnlineUsers.map((user, idx) => (
                  <div key={idx} className="online-user-item">
                    <div className="online-user-avatar" style={{
                      width: 36, height: 36, borderRadius: '50%',
                      background: '#f1f5f9', display: 'flex', alignItems: 'center',
                      justifyContent: 'center', fontSize: '1rem', color: '#64748b'
                    }}>
                      {(user.user || '?')[0]?.toUpperCase()}
                    </div>
                    <span className="online-user-name">{user.user || 'Anonymous'}</span>
                    <div className="online-user-status" />
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      )}

      <div className="messages-container">
        {messages.length === 0 ? (
          <div className="empty-state">
            <p>No messages yet. Start the conversation!</p>
          </div>
        ) : (
          messages.map((msg, index) => {
            const isOwn = msg.user_id ? msg.user_id === userId : msg.username === username;
            const isUnsent = msg.content === '__UNSENT__';
            const msgReactions = groupReactions(reactions[msg.id]);

            return (
              <div
                key={msg.id || index}
                className={`message-wrapper ${isOwn ? 'own' : ''}`}
                onMouseEnter={() => !isUnsent && setHoveredMessage(msg.id)}
                onMouseLeave={() => {
                  setHoveredMessage(null);
                }}
              >
                <div className={`message ${isOwn ? 'own-message' : ''}`}>
                  {!isOwn && (
                    <img
                      src={getMessageAvatar(msg)}
                      alt=""
                      className="message-avatar"
                      onClick={() => msg.user_id && onProfileClick?.(msg.user_id)}
                      onError={(e) => { e.target.src = '/default-avatar.svg'; }}
                    />
                  )}
                  <div className="message-body">
                    <div className="message-header">
                      <span className="message-username">{getMessageDisplayName(msg)}</span>
                      <span className="message-time">{formatTime(msg.created_at)}</span>
                    </div>
                    <div className="message-content">
                      {renderMessageContent(msg)}
                    </div>
                    {msgReactions.length > 0 && (
                      <div className="message-reactions">
                        {msgReactions.map(({ emoji, count, hasOwn }) => (
                          <span
                            key={emoji}
                            className={`reaction-badge ${hasOwn ? 'own-reaction' : ''}`}
                            onClick={(e) => {
                              e.stopPropagation();
                              handleReaction(msg.id, emoji);
                            }}
                            title={`React with ${emoji}`}
                          >
                            {emoji}
                            {count > 1 && <span className="reaction-count">{count}</span>}
                          </span>
                        ))}
                      </div>
                    )}
                  </div>
                </div>

                {/* Action buttons on hover */}
                {hoveredMessage === msg.id && !isUnsent && (
                  <div className="message-actions" onClick={e => e.stopPropagation()}>
                    <button
                      className="action-btn"
                      onClick={(e) => {
                        e.stopPropagation();
                        setShowReactionPicker(showReactionPicker === msg.id ? null : msg.id);
                        setShowMessageMenu(null);
                      }}
                      title="React"
                    >
                      {'\u{1F600}'}
                    </button>
                    {isOwn && (
                      <button
                        className="action-btn"
                        onClick={(e) => {
                          e.stopPropagation();
                          setShowMessageMenu(showMessageMenu === msg.id ? null : msg.id);
                          setShowReactionPicker(null);
                        }}
                        title="More options"
                      >
                        {'\u22EF'}
                      </button>
                    )}
                  </div>
                )}

                {/* Reaction picker popup */}
                {showReactionPicker === msg.id && (
                  <div className="reaction-picker" onClick={e => e.stopPropagation()}>
                    {QUICK_EMOJIS.map(emoji => (
                      <button
                        key={emoji}
                        onClick={() => handleReaction(msg.id, emoji)}
                      >
                        {emoji}
                      </button>
                    ))}
                  </div>
                )}

                {/* Three-dots menu for own messages */}
                {showMessageMenu === msg.id && (
                  <div className="message-menu" onClick={e => e.stopPropagation()}>
                    <button onClick={() => {
                      setShowReactionPicker(msg.id);
                      setShowMessageMenu(null);
                    }}>
                      {'\u{1F600}'} React
                    </button>
                    <button
                      className="unsend-btn"
                      onClick={() => handleUnsend(msg.id)}
                    >
                      {'\u{1F6AB}'} Unsend
                    </button>
                  </div>
                )}
              </div>
            );
          })
        )}
        <div ref={messagesEndRef} />
      </div>

      <form className="message-input-container" onSubmit={handleSendMessage}>
        <div style={{ position: 'relative' }}>
          <button
            type="button"
            className="camera-btn"
            onClick={(e) => {
              e.stopPropagation();
              setShowCameraMenu(!showCameraMenu);
            }}
            title="Send photo or video"
          >
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z"/>
              <circle cx="12" cy="13" r="4"/>
            </svg>
          </button>

          {showCameraMenu && (
            <div className="camera-menu" onClick={e => e.stopPropagation()}>
              <button
                type="button"
                className="camera-menu-item"
                onClick={() => cameraInputRef.current?.click()}
              >
                <span className="camera-menu-icon">
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z"/>
                    <circle cx="12" cy="13" r="4"/>
                  </svg>
                </span>
                Take a Photo/Video
              </button>
              <button
                type="button"
                className="camera-menu-item"
                onClick={() => libraryInputRef.current?.click()}
              >
                <span className="camera-menu-icon">
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <rect x="3" y="3" width="18" height="18" rx="2" ry="2"/>
                    <circle cx="8.5" cy="8.5" r="1.5"/>
                    <polyline points="21 15 16 10 5 21"/>
                  </svg>
                </span>
                Photo Library
              </button>
            </div>
          )}
        </div>

        {/* Hidden file inputs */}
        <input
          ref={cameraInputRef}
          type="file"
          accept="image/*,video/*"
          capture="environment"
          style={{ display: 'none' }}
          onChange={(e) => {
            handleMediaUpload(e.target.files?.[0]);
            e.target.value = '';
          }}
        />
        <input
          ref={libraryInputRef}
          type="file"
          accept="image/*,video/*"
          style={{ display: 'none' }}
          onChange={(e) => {
            handleMediaUpload(e.target.files?.[0]);
            e.target.value = '';
          }}
        />

        <div className="input-wrapper">
          <input
            type="text"
            value={newMessage}
            onChange={(e) => setNewMessage(e.target.value)}
            placeholder={`Message ${place.name}...`}
            className="message-input"
            maxLength={MAX_MESSAGE_LENGTH}
          />
          {newMessage.length > MAX_MESSAGE_LENGTH * 0.8 && (
            <span className="char-count">
              {newMessage.length}/{MAX_MESSAGE_LENGTH}
            </span>
          )}
        </div>
        <button type="submit" className="send-btn" disabled={!newMessage.trim()}>
          Send
        </button>
      </form>
    </div>
  );
};

export default ChatPanel;
