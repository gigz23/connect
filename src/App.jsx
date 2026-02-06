import React, { useState, useEffect } from 'react';
import MapView from './components/MapView';
import ChatPanel from './components/ChatPanel';
import PlacePreviewModal from './components/PlacePreviewModal';
import AuthModal from './components/AuthModal';
import { supabase } from './lib/supabase';
import './App.css';

function App() {
  const [session, setSession] = useState(null);
  const [username, setUsername] = useState('');
  const [showAuthModal, setShowAuthModal] = useState(true);
  const [places, setPlaces] = useState([]);
  const [previewedPlace, setPreviewedPlace] = useState(null);
  const [joinedPlace, setJoinedPlace] = useState(null);

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
          setShowAuthModal(true);
        }
      });

      authSubscription = authListener?.subscription ?? null;
    };

    init();

    return () => {
      cleanup?.();
      authSubscription?.unsubscribe?.();
    };
  }, []);

  const applySession = (currentSession) => {
    setSession(currentSession);
    setUsername(extractUsername(currentSession));
    setShowAuthModal(false);
    upsertProfile(currentSession);
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

  const handleAuthSuccess = () => {
    // Auth was successful, modal will close automatically on session change
  };

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

  return (
    <div className="app">
      {showAuthModal && (
        <AuthModal onAuthSuccess={handleAuthSuccess} />
      )}

      <div className="app-header">
        <h1>PlaceConnect</h1>
        <div className="user-info">
          <span>{username}</span>
          {session && (
            <button onClick={handleSignOut}>Sign out</button>
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
            onClose={handleCloseChat}
          />
        )}
      </div>
    </div>
  );
}

export default App;
