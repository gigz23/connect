import React, { useState, useEffect } from 'react';
import MapView from './components/MapView';
import ChatPanel from './components/ChatPanel';
import PlacePreviewModal from './components/PlacePreviewModal';
import UsernameModal from './components/UsernameModal';
import { supabase } from './lib/supabase';
import './App.css';

function App() {
  const [username, setUsername] = useState(localStorage.getItem('username') || '');
  const [showUsernameModal, setShowUsernameModal] = useState(!username);
  const [places, setPlaces] = useState([]);
  const [previewedPlace, setPreviewedPlace] = useState(null);
  const [joinedPlace, setJoinedPlace] = useState(null);

  useEffect(() => {
    loadPlaces();
    subscribeToActivityUpdates();
  }, []);

  const loadPlaces = async () => {
    const { data, error } = await supabase
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

  const handleUsernameSubmit = (name) => {
    setUsername(name);
    localStorage.setItem('username', name);
    setShowUsernameModal(false);
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
      {showUsernameModal && (
        <UsernameModal onSubmit={handleUsernameSubmit} />
      )}
      
      <div className="app-header">
        <h1>PlaceConnect</h1>
        <div className="user-info">
          <span>👤 {username}</span>
          <button onClick={() => setShowUsernameModal(true)}>Change</button>
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
