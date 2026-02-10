import React, { useState, useEffect, useRef } from 'react';
import MapView from './components/MapView';
import ChatPanel from './components/ChatPanel';
import PlacePreviewModal from './components/PlacePreviewModal';
import AuthModal from './components/AuthModal';
import UserProfileModal from './components/UserProfileModal';
import FriendRequestsList from './components/FriendRequestsList';
import CreatePlaceModal from './components/CreatePlaceModal';
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

  // Create place mode
  const [createMode, setCreateMode] = useState(false);
  const [pendingPin, setPendingPin] = useState(null);
  const [showCreateModal, setShowCreateModal] = useState(false);

  const friendReqChannelRef = useRef(null);
  const notificationRef = useRef(null);
  const searchRef = useRef(null);
  const expiryIntervalRef = useRef(null);

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

    // Periodic cleanup of expired temporary places (client-side filter)
    expiryIntervalRef.current = setInterval(() => {
      setPlaces(prev => prev.filter(p => {
        if (!p.is_temporary || !p.expires_at) return true;
        return new Date(p.expires_at) > new Date();
      }));
    }, 60000);

    return () => {
      cleanup?.();
      authSubscription?.unsubscribe?.();
      cleanupFriendReqSubscription();
      if (expiryIntervalRef.current) clearInterval(expiryIntervalRef.current);
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
      // Filter out expired temporary places
      const active = data.filter(p => {
        if (!p.is_temporary || !p.expires_at) return true;
        return new Date(p.expires_at) > new Date();
      });
      setPlaces(active);
    }
  };

  const subscribeToActivityUpdates = () => {
    const channel = supabase
      .channel('places-activity')
      .on('postgres_changes',
        { event: '*', schema: 'public', table: 'places' },
        (payload) => {
          if (payload.eventType === 'INSERT') {
            // New place created - add it
            const newPlace = payload.new;
            if (newPlace.is_temporary && newPlace.expires_at && new Date(newPlace.expires_at) <= new Date()) return;
            setPlaces(prev => {
              if (prev.find(p => p.id === newPlace.id)) return prev;
              return [...prev, newPlace];
            });
          } else if (payload.eventType === 'DELETE') {
            setPlaces(prev => prev.filter(p => p.id !== payload.old.id));
          } else {
            setPlaces(prev => {
              const updated = [...prev];
              const index = updated.findIndex(p => p.id === payload.new.id);
              if (index >= 0) {
                updated[index] = payload.new;
              }
              return updated;
            });
          }
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

  // Create place
  const handleStartCreateMode = () => {
    if (!session) {
      setShowAuthModal(true);
      return;
    }
    setCreateMode(true);
    setPendingPin(null);
    setShowCreateModal(false);
  };

  const handleMapClick = (latlng) => {
    if (createMode) {
      setPendingPin(latlng);
      setShowCreateModal(true);
      setCreateMode(false);
    }
  };

  const handleCancelCreate = () => {
    setCreateMode(false);
    setPendingPin(null);
    setShowCreateModal(false);
  };

  const handlePlaceCreated = (newPlace) => {
    setShowCreateModal(false);
    setPendingPin(null);
    setCreateMode(false);
    // Place will be added via realtime subscription, but add immediately for responsiveness
    setPlaces(prev => {
      if (prev.find(p => p.id === newPlace.id)) return prev;
      return [...prev, newPlace];
    });
    setFlyToPlace(newPlace);
    setPreviewedPlace(newPlace);
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
                  <div className="search-result-thumb">
                    {place.image_url ? (
                      <img src={place.image_url} alt="" onError={(e) => { e.target.style.display = 'none'; }} />
                    ) : (
                      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#94a3b8" strokeWidth="2"><path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"/><circle cx="12" cy="10" r="3"/></svg>
                    )}
                  </div>
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
          createMode={createMode}
          onMapClick={handleMapClick}
          pendingPin={pendingPin}
        />

        {/* Create place banner */}
        {!createMode && !showCreateModal && session && (
          <div className="create-place-banner" onClick={handleStartCreateMode}>
            <span className="create-place-text">Create your own place</span>
          </div>
        )}

        {/* Create mode instructions */}
        {createMode && (
          <div className="create-mode-banner">
            <span>Click anywhere on the map to place your pin</span>
            <button className="create-mode-cancel" onClick={handleCancelCreate}>Cancel</button>
          </div>
        )}

        {previewedPlace && (
          <PlacePreviewModal
            place={previewedPlace}
            onJoin={handleJoinChat}
            onClose={handleClosePreview}
            isFavorite={favorites.includes(previewedPlace.id)}
            onToggleFavorite={handleToggleFavorite}
            currentUserId={currentUserId}
            onPlaceUpdate={(placeId, updates) => {
              setPlaces(prev => prev.map(p =>
                p.id === placeId ? { ...p, ...updates } : p
              ));
              setPreviewedPlace(prev => prev && prev.id === placeId ? { ...prev, ...updates } : prev);
            }}
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

        {showCreateModal && pendingPin && (
          <CreatePlaceModal
            latlng={pendingPin}
            userId={currentUserId}
            onClose={handleCancelCreate}
            onPlaceCreated={handlePlaceCreated}
          />
        )}

        {/* Favorites FAB - redesigned: round with building icon, no badge count */}
        <button
          className="favorites-fab"
          onClick={() => setShowFavoritesPanel(prev => !prev)}
          title="Favorite places"
        >
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M3 21h18"/>
            <path d="M5 21V7l8-4v18"/>
            <path d="M19 21V11l-6-4"/>
            <path d="M9 9v.01"/>
            <path d="M9 12v.01"/>
            <path d="M9 15v.01"/>
          </svg>
        </button>

        {/* Favorites panel */}
        {showFavoritesPanel && (
          <div className="favorites-panel">
            <div className="favorites-panel-header">
              <h3>Favorite Places</h3>
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
                    <div className="favorite-item-thumb">
                      {place.image_url ? (
                        <img src={place.image_url} alt="" onError={(e) => { e.target.src = ''; e.target.style.display = 'none'; }} />
                      ) : (
                        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#94a3b8" strokeWidth="2"><path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"/><circle cx="12" cy="10" r="3"/></svg>
                      )}
                    </div>
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
