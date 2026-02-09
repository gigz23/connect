import React, { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import './FriendRequestsList.css';

const FriendRequestsList = ({ currentUserId, onClose, onProfileClick }) => {
  const [requests, setRequests] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchRequests();
    const cleanup = subscribeToRequests();
    return () => { cleanup(); };
  }, []);

  const fetchRequests = async () => {
    // Fetch friendships first
    const { data: friendshipData } = await supabase
      .from('friendships')
      .select('*')
      .eq('addressee_id', currentUserId)
      .eq('status', 'pending')
      .order('created_at', { ascending: false });

    if (!friendshipData || friendshipData.length === 0) {
      setRequests([]);
      setLoading(false);
      return;
    }

    // Fetch profiles for all requesters separately
    const requesterIds = friendshipData.map(f => f.requester_id);
    const { data: profilesData } = await supabase
      .from('profiles')
      .select('id, full_name, avatar_url')
      .in('id', requesterIds);

    const profileMap = {};
    (profilesData || []).forEach(p => { profileMap[p.id] = p; });

    const enriched = friendshipData.map(f => ({
      ...f,
      requester: profileMap[f.requester_id] || null
    }));

    setRequests(enriched);
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
        () => { fetchRequests(); }
      )
      .subscribe();

    return () => { supabase.removeChannel(channel); };
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

  const handleClearAll = async () => {
    // Reject all pending requests
    for (const req of requests) {
      await supabase.from('friendships').delete().eq('id', req.id);
    }
    setRequests([]);
  };

  return (
    <div className="friend-requests-dropdown">
      <div className="friend-requests-header">
        <h3>Notifications</h3>
        {requests.length > 0 && (
          <button className="clear-all-btn" onClick={handleClearAll}>
            Clear all
          </button>
        )}
      </div>

      <div className="friend-requests-list">
        {loading ? (
          <div className="friend-requests-empty">Loading...</div>
        ) : requests.length === 0 ? (
          <div className="friend-requests-empty">No new notifications</div>
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
                <span className="friend-request-text">
                  <strong
                    className="friend-request-name-link"
                    onClick={() => {
                      onProfileClick(request.requester_id);
                      onClose();
                    }}
                  >
                    {request.requester?.full_name || 'Someone'}
                  </strong>
                  {' '}has sent you a friend request
                </span>
                <div className="friend-request-actions-row">
                  <button
                    className="friend-action-accept"
                    onClick={() => handleAccept(request.id)}
                  >
                    Accept
                  </button>
                  <button
                    className="friend-action-decline"
                    onClick={() => handleReject(request.id)}
                  >
                    Decline
                  </button>
                </div>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
};

export default FriendRequestsList;
