import React, { useState, useEffect, useRef } from 'react';
import { supabase } from '../lib/supabase';
import './FriendRequestsList.css';

const FriendRequestsList = ({ currentUserId, onClose, onProfileClick }) => {
  const [requests, setRequests] = useState([]);
  const [loading, setLoading] = useState(true);
  const panelRef = useRef(null);

  useEffect(() => {
    fetchRequests();
    const cleanup = subscribeToRequests();

    const handleClickOutside = (e) => {
      if (panelRef.current && !panelRef.current.contains(e.target)) {
        onClose();
      }
    };
    document.addEventListener('mousedown', handleClickOutside);

    return () => {
      cleanup();
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, []);

  const fetchRequests = async () => {
    const { data } = await supabase
      .from('friendships')
      .select('*, requester:profiles!friendships_requester_id_fkey(id, full_name, avatar_url)')
      .eq('addressee_id', currentUserId)
      .eq('status', 'pending')
      .order('created_at', { ascending: false });

    setRequests(data || []);
    setLoading(false);
  };

  const subscribeToRequests = () => {
    const channel = supabase
      .channel('friend-requests')
      .on('postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'friendships',
          filter: `addressee_id=eq.${currentUserId}`
        },
        () => {
          fetchRequests();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  };

  const handleAccept = async (friendshipId) => {
    await supabase
      .from('friendships')
      .update({ status: 'accepted', updated_at: new Date().toISOString() })
      .eq('id', friendshipId);

    setRequests(prev => prev.filter(r => r.id !== friendshipId));
  };

  const handleReject = async (friendshipId) => {
    await supabase
      .from('friendships')
      .delete()
      .eq('id', friendshipId);

    setRequests(prev => prev.filter(r => r.id !== friendshipId));
  };

  return (
    <div className="friend-requests-dropdown" ref={panelRef}>
      <div className="friend-requests-header">
        <h3>Friend Requests</h3>
      </div>

      <div className="friend-requests-list">
        {loading ? (
          <div className="friend-requests-empty">Loading...</div>
        ) : requests.length === 0 ? (
          <div className="friend-requests-empty">No pending requests</div>
        ) : (
          requests.map(request => (
            <div key={request.id} className="friend-request-item">
              <img
                src={request.requester?.avatar_url || '/default-avatar.svg'}
                alt={request.requester?.full_name || 'User'}
                className="friend-request-avatar"
                onClick={() => {
                  onProfileClick(request.requester_id);
                  onClose();
                }}
                onError={(e) => { e.target.src = '/default-avatar.svg'; }}
              />
              <div className="friend-request-info">
                <span
                  className="friend-request-name"
                  onClick={() => {
                    onProfileClick(request.requester_id);
                    onClose();
                  }}
                >
                  {request.requester?.full_name || 'Anonymous'}
                </span>
              </div>
              <div className="friend-request-actions">
                <button
                  className="friend-accept-btn"
                  onClick={() => handleAccept(request.id)}
                  title="Accept"
                >
                  &#10003;
                </button>
                <button
                  className="friend-reject-btn"
                  onClick={() => handleReject(request.id)}
                  title="Reject"
                >
                  &#10005;
                </button>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
};

export default FriendRequestsList;
