import React, { useState } from 'react';
import './UsernameModal.css';

const UsernameModal = ({ onSubmit }) => {
  const [name, setName] = useState('');
  const [error, setError] = useState('');

  const handleSubmit = (e) => {
    e.preventDefault();
    
    if (!name.trim()) {
      setError('Please enter a username');
      return;
    }

    if (name.trim().length < 2) {
      setError('Username must be at least 2 characters');
      return;
    }

    if (name.trim().length > 20) {
      setError('Username must be less than 20 characters');
      return;
    }

    onSubmit(name.trim());
  };

  return (
    <div className="modal-overlay">
      <div className="modal-content">
        <h2>Welcome to PlaceConnect</h2>
        <p>Choose a username to start chatting</p>
        
        <form onSubmit={handleSubmit}>
          <input
            type="text"
            value={name}
            onChange={(e) => {
              setName(e.target.value);
              setError('');
            }}
            placeholder="Enter your username"
            className="username-input"
            autoFocus
          />
          
          {error && <div className="error-message">{error}</div>}
          
          <button type="submit" className="submit-btn">
            Continue
          </button>
        </form>
        
        <p className="disclaimer">
          No account needed. Your username is stored locally.
        </p>
      </div>
    </div>
  );
};

export default UsernameModal;
