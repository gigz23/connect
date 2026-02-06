import React, { useState, useEffect, useRef } from 'react';
import MapView from './components/MapView';
import ChatPanel from './components/ChatPanel';
import PlacePreviewModal from './components/PlacePreviewModal';
import AuthModal from './components/AuthModal';
import UserProfileModal from './components/UserProfileModal';
import FriendRequestsList from './components/FriendRequestsList';
import { supabase } from './lib/supabase';
import './App.css';

function App() {
  const [session, setSession] = useState(null);
  const [username, setUsername] = useState('');
  const [showAuthModal, setShowAuthModal] = useState(true);
  const [places, setPlaces] = useState([]);
  const [previewedPlace, setPreviewedPlace] = useState(null);
  const [joinedPlace, setJoinedPlace] = useState(null);
  const [userProfile, setUserProfile] = useState(null);
  const [profileModalUserId, setProfileModalUserId] = useState(null);
  const [showFriendRequests, setShowFriendRequests] = useState(false);
  const [pendingRequestCount, setPendingRequestCount] = useState(0);
  const friendReqChannelRef = useRef(null);

  useEffect(() => {
    loadPlaces();
    const cleanup = subscribeToActivityUpdates();
    let authSubscription;

    const init = async () => {
      const { data } = await supabase.auth.getSession();
      const currentSession = data?.session ?? null;

      if (currentSession) {
        applySession(currentSession);
      } else {
        setShowAuthModal(true);
      }

      const { data: authListener } = supabase.auth.onAuthStateChange((_event, newSession) => {
        if (newSession) {
          applySession(newSession);
        } else {
          setSession(null);
          setUsername('');
          setUserProfile(null);
          setShowAuthModal(true);
          cleanupFriendReqSubscription();
        }
      });

      authSubscription = authListener?.subscription ?? null;
    };

    init();

    return () => {
      cleanup?.();
      authSubscription?.unsubscribe?.();
      cleanupFriendReqSubscription();
    };
  }, []);

  const cleanupFriendReqSubscription = () => {
    if (friendReqChannelRef.current) {
      supabase.removeChannel(friendReqChannelRef.current);
      friendReqChannelRef.current = null;
    }
  };

  const applySession = async (currentSession) => {
    setSession(currentSession);
    setUsername(extractUsername(currentSession));
    setShowAuthModal(false);
    await upsertProfile(currentSession);
    await fetchFullProfile(currentSession.user.id);
    fetchPendingRequestCount(currentSession.user.id);
    subscribeToPendingRequests(currentSession.user.id);
  };

  const extractUsername = (currentSession) => {
    if (!currentSession?.user) return '';
    const meta = currentSession.user.user_metadata || {};
    return (
      meta.full_name ||
      meta.name ||
      meta.preferred_username ||
      currentSession.user.email ||
      'User'
    );
  };

  const upsertProfile = async (currentSession) => {
    if (!currentSession?.user) return;
    const { user } = currentSession;
    const meta = user.user_metadata || {};

    await supabase
      .from('profiles')
      .upsert({
        id: user.id,
        full_name: meta.full_name || meta.name || null,
        avatar_url: meta.avatar_url || null,
        email: user.email || null,
        updated_at: new Date().toISOString()
      });
  };

  const fetchFullProfile = async (uid) => {
    const { data } = await supabase
      .from('profiles')
      .select('*')
      .eq('id', uid)
      .single();

    if (data) {
      setUserProfile(data);
      if (data.full_name) {
        setUsername(data.full_name);
      }
    }
  };

  const fetchPendingRequestCount = async (uid) => {
    const { count } = await supabase
      .from('friendships')
      .select('*', { count: 'exact', head: true })
      .eq('addressee_id', uid)
      .eq('status', 'pending');

    setPendingRequestCount(count || 0);
  };

  const subscribeToPendingRequests = (uid) => {
    cleanupFriendReqSubscription();

    friendReqChannelRef.current = supabase
      .channel('pending-friend-requests')
      .on('postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'friendships',
          filter: `addressee_id=eq.${uid}`
        },
        () => {
          fetchPendingRequestCount(uid);
        }
      )
      .subscribe();
  };

  const loadPlaces = async () => {
    const { data } = await supabase
      .from('places')
      .select('*');

    if (data) {
      setPlaces(data);
    }
  };

  const subscribeToActivityUpdates = () => {
    const channel = supabase
      .channel('places-activity')
      .on('postgres_changes',
        { event: '*', schema: 'public', table: 'places' },
        (payload) => {
          setPlaces(prev => {
            const updated = [...prev];
            const index = updated.findIndex(p => p.id === payload.new.id);
            if (index >= 0) {
              updated[index] = payload.new;
            }
            return updated;
          });
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  };

  const handleAuthSuccess = () => {};

  const handleSignOut = async () => {
    localStorage.removeItem('guest_username');
    await supabase.auth.signOut();
  };

  const handlePlaceSelect = (place) => {
    setPreviewedPlace(place);
  };

  const handleJoinChat = () => {
    setJoinedPlace(previewedPlace);
    setPreviewedPlace(null);
  };

  const handleClosePreview = () => {
    setPreviewedPlace(null);
  };

  const handleCloseChat = () => {
    setJoinedPlace(null);
  };

  const handleProfileClick = (uid) => {
    setProfileModalUserId(uid);
  };

  const handleProfileUpdate = (updates) => {
    setUserProfile(prev => ({ ...prev, ...updates }));
    if (updates.full_name) {
      setUsername(updates.full_name);
    }
  };

  const currentUserId = session?.user?.id;

  return (
    <div className="app">
      {showAuthModal && (
        <AuthModal onAuthSuccess={handleAuthSuccess} />
      )}

      <div className="app-header">
        <h1>PlaceConnect</h1>
        <div className="user-info">
          {session && (
            <>
              <button
                className="header-avatar-btn"
                onClick={() => handleProfileClick(currentUserId)}
                title="View profile"
              >
                <img
                  src={userProfile?.avatar_url || '/default-avatar.svg'}
                  alt="Profile"
                  className="header-avatar"
                  onError={(e) => { e.target.src = '/default-avatar.svg'; }}
                />
              </button>
              <span>{username}</span>
              <div className="notification-wrapper">
                <button
                  className="notification-bell-btn"
                  onClick={() => setShowFriendRequests(prev => !prev)}
                  title="Friend requests"
                >
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"/>
                    <path d="M13.73 21a2 2 0 0 1-3.46 0"/>
                  </svg>
                  {pendingRequestCount > 0 && (
                    <span className="notification-badge">{pendingRequestCount}</span>
                  )}
                </button>
                {showFriendRequests && (
                  <FriendRequestsList
                    currentUserId={currentUserId}
                    onClose={() => setShowFriendRequests(false)}
                    onProfileClick={handleProfileClick}
                  />
                )}
              </div>
              <button onClick={handleSignOut}>Sign out</button>
            </>
          )}
        </div>
      </div>

      <div className="app-content">
        <MapView
          places={places}
          selectedPlace={joinedPlace}
          onPlaceSelect={handlePlaceSelect}
        />

        {previewedPlace && (
          <PlacePreviewModal
            place={previewedPlace}
            onJoin={handleJoinChat}
            onClose={handleClosePreview}
          />
        )}

        {joinedPlace && (
          <ChatPanel
            place={joinedPlace}
            username={username}
            userId={currentUserId}
            onClose={handleCloseChat}
            onProfileClick={handleProfileClick}
          />
        )}
      </div>

      {profileModalUserId && (
        <UserProfileModal
          userId={profileModalUserId}
          currentUserId={currentUserId}
          onClose={() => setProfileModalUserId(null)}
          onProfileUpdate={handleProfileUpdate}
        />
      )}
    </div>
  );
}

export default App;
