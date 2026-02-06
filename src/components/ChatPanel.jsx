import React, { useState, useEffect, useRef } from 'react';
import { supabase } from '../lib/supabase';
import './ChatPanel.css';

const MAX_MESSAGE_LENGTH = 500;

const ChatPanel = ({ place, username, userId, onClose, onProfileClick }) => {
  const [messages, setMessages] = useState([]);
  const [newMessage, setNewMessage] = useState('');
  const [onlineUsers, setOnlineUsers] = useState(0);
  const messagesEndRef = useRef(null);
  const channelRef = useRef(null);
  const profileCacheRef = useRef({});

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
      .on('presence', { event: 'sync' }, () => {
        const state = channelRef.current.presenceState();
        setOnlineUsers(Object.keys(state).length);
      })
      .subscribe();

    channelRef.current.track({
      user: username,
      online_at: new Date().toISOString()
    });
  };

  const joinRoom = async () => {};
  const leaveRoom = async () => {};

  const updateActivityLevel = async (messageCount) => {
    await supabase
      .from('places')
      .update({
        activity_level: Math.min(messageCount, 20),
        last_activity: new Date().toISOString()
      })
      .eq('id', place.id);
  };

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

  return (
    <div className="chat-panel">
      <div className="chat-header">
        <div className="chat-header-info">
          <h2>{place.name}</h2>
          <span className="chat-subtitle">{place.type.replace('_', ' ')}</span>
          <span className="online-indicator">
            {'\u{1F7E2}'} {onlineUsers} online
          </span>
        </div>
        <button className="close-btn" onClick={onClose}>{'\u2715'}</button>
      </div>

      <div className="messages-container">
        {messages.length === 0 ? (
          <div className="empty-state">
            <p>No messages yet. Start the conversation!</p>
          </div>
        ) : (
          messages.map((msg, index) => {
            const isOwn = msg.user_id ? msg.user_id === userId : msg.username === username;
            return (
              <div
                key={msg.id || index}
                className={`message ${isOwn ? 'own-message' : ''}`}
              >
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
                  <div className="message-content">{msg.content}</div>
                </div>
              </div>
            );
          })
        )}
        <div ref={messagesEndRef} />
      </div>

      <form className="message-input-container" onSubmit={handleSendMessage}>
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
