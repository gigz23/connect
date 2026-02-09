import React, { useState, useEffect, useRef } from 'react';
import MapView from './components/MapView';
import ChatPanel from './components/ChatPanel';
import PlacePreviewModal from './components/PlacePreviewModal';
import AuthModal from './components/AuthModal';
import UserProfileModal from './components/UserProfileModal';
import FriendRequestsList from './components/FriendRequestsList';
import { supabase } from './lib/supabase';
import './App.css';

const getPlaceEmoji = (type) => {
  const icons = {
    school: '\u{1F3EB}', university: '\u{1F393}', college: '\u{1F393}', library: '\u{1F4DA}',
    cafe: '\u{2615}', coffee: '\u{2615}', restaurant: '\u{1F37D}\u{FE0F}', bar: '\u{1F37A}',
    bakery: '\u{1F950}', basketball_court: '\u{1F3C0}', sports_court: '\u{1F3C0}',
    tennis_court: '\u{1F3BE}', gym: '\u{1F4AA}', fitness: '\u{1F4AA}', park: '\u{1F333}',
    playground: '\u{1F3AA}', pool: '\u{1F3CA}', coworking: '\u{1F4BC}', office: '\u{1F3E2}',
    startup_hub: '\u{1F680}', hospital: '\u{1F3E5}', pharmacy: '\u{1F48A}', church: '\u{26EA}',
    museum: '\u{1F3DB}\u{FE0F}', shopping: '\u{1F6CD}\u{FE0F}', hotel: '\u{1F3E8}',
    bank: '\u{1F3E6}', market: '\u{1F3EA}', cinema: '\u{1F3AC}'
  };
  return icons[type] || '\u{1F4CD}';
};

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

  // Search
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState([]);
  const [flyToPlace, setFlyToPlace] = useState(null);

  // Favorites
  const [favorites, setFavorites] = useState(() => {
    try {
      const saved = localStorage.getItem('placeconnect_favorites');
      return saved ? JSON.parse(saved) : [];
    } catch { return []; }
  });
  const [showFavoritesPanel, setShowFavoritesPanel] = useState(false);

  const friendReqChannelRef = useRef(null);
  const notificationRef = useRef(null);
  const searchRef = useRef(null);

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

  // Save favorites to localStorage
  useEffect(() => {
    localStorage.setItem('placeconnect_favorites', JSON.stringify(favorites));
  }, [favorites]);

  // Close notification dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (e) => {
      if (showFriendRequests && notificationRef.current && !notificationRef.current.contains(e.target)) {
        setShowFriendRequests(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [showFriendRequests]);

  // Close search when clicking outside
  useEffect(() => {
    const handleClickOutside = (e) => {
      if (searchRef.current && !searchRef.current.contains(e.target)) {
        setSearchResults([]);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
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

  // Search
  const handleSearchChange = (query) => {
    setSearchQuery(query);
    if (query.trim()) {
      const results = places.filter(p =>
        p.name.toLowerCase().includes(query.toLowerCase())
      );
      setSearchResults(results);
    } else {
      setSearchResults([]);
    }
  };

  const handleSearchSelect = (place) => {
    setSearchQuery('');
    setSearchResults([]);
    setFlyToPlace(place);
    setPreviewedPlace(place);
  };

  // Favorites
  const handleToggleFavorite = (placeId) => {
    setFavorites(prev => {
      if (prev.includes(placeId)) {
        return prev.filter(id => id !== placeId);
      }
      return [...prev, placeId];
    });
  };

  const handleFavoriteClick = (place) => {
    setShowFavoritesPanel(false);
    setFlyToPlace(place);
    setJoinedPlace(place);
  };

  const favoritePlaces = places.filter(p => favorites.includes(p.id));

  const currentUserId = session?.user?.id;

  return (
    <div className="app">
      {showAuthModal && (
        <AuthModal onAuthSuccess={handleAuthSuccess} />
      )}

      <div className="app-header">
        <h1>PlaceConnect</h1>

        {/* Search bar */}
        <div className="search-wrapper" ref={searchRef}>
          <svg className="search-icon" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <circle cx="11" cy="11" r="8"/>
            <line x1="21" y1="21" x2="16.65" y2="16.65"/>
          </svg>
          <input
            type="text"
            className="search-input"
            placeholder="Search places..."
            value={searchQuery}
            onChange={(e) => handleSearchChange(e.target.value)}
          />
          {searchResults.length > 0 && (
            <div className="search-results">
              {searchResults.map(place => (
                <div
                  key={place.id}
                  className="search-result-item"
                  onClick={() => handleSearchSelect(place)}
                >
                  <span className="search-result-emoji">{getPlaceEmoji(place.type)}</span>
                  <div className="search-result-info">
                    <div className="search-result-name">{place.name}</div>
                    <div className="search-result-type">{place.type.replace('_', ' ')}</div>
                  </div>
                </div>
              ))}
            </div>
          )}
          {searchQuery.trim() && searchResults.length === 0 && (
            <div className="search-results">
              <div className="search-no-results">No places found</div>
            </div>
          )}
        </div>

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
              <div className="notification-wrapper" ref={notificationRef}>
                <button
                  className="notification-bell-btn"
                  onClick={() => setShowFriendRequests(prev => !prev)}
                  title="Notifications"
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
          flyToPlace={flyToPlace}
        />

        {previewedPlace && (
          <PlacePreviewModal
            place={previewedPlace}
            onJoin={handleJoinChat}
            onClose={handleClosePreview}
            isFavorite={favorites.includes(previewedPlace.id)}
            onToggleFavorite={handleToggleFavorite}
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

        {/* Favorites FAB */}
        <button
          className="favorites-fab"
          onClick={() => setShowFavoritesPanel(prev => !prev)}
          title="Favorite places"
        >
          {'\u{1F4AC}'}
          {favoritePlaces.length > 0 && (
            <span className="fab-badge">{favoritePlaces.length}</span>
          )}
        </button>

        {/* Favorites panel */}
        {showFavoritesPanel && (
          <div className="favorites-panel">
            <div className="favorites-panel-header">
              <h3>{'\u{2B50}'} Favorite Places</h3>
              <button
                className="favorites-panel-close"
                onClick={() => setShowFavoritesPanel(false)}
              >
                {'\u2715'}
              </button>
            </div>
            <div className="favorites-list">
              {favoritePlaces.length === 0 ? (
                <div className="favorites-empty">
                  <span>{'\u{2606}'}</span>
                  No favorite places yet. Click the star on any place to add it here.
                </div>
              ) : (
                favoritePlaces.map(place => (
                  <div
                    key={place.id}
                    className="favorite-item"
                    onClick={() => handleFavoriteClick(place)}
                  >
                    <div className="favorite-item-emoji">{getPlaceEmoji(place.type)}</div>
                    <div className="favorite-item-info">
                      <div className="favorite-item-name">{place.name}</div>
                      <div className="favorite-item-type">{place.type.replace('_', ' ')}</div>
                    </div>
                    <span className="favorite-item-arrow">{'\u203A'}</span>
                  </div>
                ))
              )}
            </div>
          </div>
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
