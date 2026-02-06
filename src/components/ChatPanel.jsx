import React, { useState, useEffect, useRef } from 'react';
import { supabase } from '../lib/supabase';
import './ChatPanel.css';

const MAX_MESSAGE_LENGTH = 500;

const ChatPanel = ({ place, username, onClose }) => {
  const [messages, setMessages] = useState([]);
  const [newMessage, setNewMessage] = useState('');
  const [onlineUsers, setOnlineUsers] = useState(0);
  const messagesEndRef = useRef(null);
  const channelRef = useRef(null);

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
    const { data, error } = await supabase
      .from('messages')
      .select('*')
      .eq('place_id', place.id)
      .order('created_at', { ascending: true })
      .limit(50);

    if (data) {
      setMessages(data);
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
          setMessages(prev => [...prev, payload.new]);
          updateActivityLevel(prev.length + 1);
        }
      )
      .on('presence', { event: 'sync' }, () => {
        const state = channelRef.current.presenceState();
        setOnlineUsers(Object.keys(state).length);
      })
      .subscribe();

    // Track presence
    channelRef.current.track({
      user: username,
      online_at: new Date().toISOString()
    });
  };

  const joinRoom = async () => {
    // Optional: track room joins in database
  };

  const leaveRoom = async () => {
    // Optional: track room leaves in database
  };

  const updateActivityLevel = async (messageCount) => {
    // Update activity level based on recent messages
    const { error } = await supabase
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

  return (
    <div className="chat-panel">
      <div className="chat-header">
        <div className="chat-header-info">
          <h2>{place.name}</h2>
          <span className="chat-subtitle">{place.type.replace('_', ' ')}</span>
          <span className="online-indicator">
            🟢 {onlineUsers} online
          </span>
        </div>
        <button className="close-btn" onClick={onClose}>✕</button>
      </div>

      <div className="messages-container">
        {messages.length === 0 ? (
          <div className="empty-state">
            <p>No messages yet. Start the conversation!</p>
          </div>
        ) : (
          messages.map((msg, index) => (
            <div 
              key={msg.id || index} 
              className={`message ${msg.username === username ? 'own-message' : ''}`}
            >
              <div className="message-header">
                <span className="message-username">{msg.username}</span>
                <span className="message-time">{formatTime(msg.created_at)}</span>
              </div>
              <div className="message-content">{msg.content}</div>
            </div>
          ))
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
