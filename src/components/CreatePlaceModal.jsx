import React, { useState, useRef } from 'react';
import { supabase } from '../lib/supabase';
import './CreatePlaceModal.css';

const DURATION_OPTIONS = [
  { label: '1 hour', value: 1 },
  { label: '2 hours', value: 2 },
  { label: '4 hours', value: 4 },
  { label: 'Tonight', value: 'tonight' },
  { label: 'Custom', value: 'custom' }
];

const CreatePlaceModal = ({ latlng, userId, onClose, onPlaceCreated }) => {
  const [name, setName] = useState('');
  const [bio, setBio] = useState('');
  const [imageFile, setImageFile] = useState(null);
  const [imagePreview, setImagePreview] = useState(null);
  const [isTemporary, setIsTemporary] = useState(false);
  const [duration, setDuration] = useState(null);
  const [customEndTime, setCustomEndTime] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  const fileInputRef = useRef(null);

  const handleImageSelect = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith('image/')) {
      setError('Please select an image file');
      return;
    }

    if (file.size > 5 * 1024 * 1024) {
      setError('Image must be under 5MB');
      return;
    }

    setImageFile(file);
    setError('');

    const reader = new FileReader();
    reader.onload = (ev) => setImagePreview(ev.target.result);
    reader.readAsDataURL(file);
  };

  const removeImage = () => {
    setImageFile(null);
    setImagePreview(null);
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const calculateExpiresAt = () => {
    if (!isTemporary || !duration) return null;

    if (duration === 'tonight') {
      const tonight = new Date();
      tonight.setHours(23, 59, 59, 0);
      return tonight.toISOString();
    }

    if (duration === 'custom') {
      if (!customEndTime) return null;
      return new Date(customEndTime).toISOString();
    }

    const expires = new Date();
    expires.setHours(expires.getHours() + duration);
    return expires.toISOString();
  };

  const handleSubmit = async (e) => {
    e.preventDefault();

    if (!name.trim()) {
      setError('Please enter a place name');
      return;
    }

    if (!imageFile) {
      setError('Please upload an image for the place');
      return;
    }

    if (isTemporary && !duration) {
      setError('Please select how long the place should last');
      return;
    }

    if (isTemporary && duration === 'custom' && !customEndTime) {
      setError('Please set an end time');
      return;
    }

    setSubmitting(true);
    setError('');

    try {
      // Upload image to Supabase Storage
      const ext = imageFile.name.split('.').pop();
      const filePath = `place-images/${userId}/${Date.now()}.${ext}`;

      const { error: uploadError } = await supabase.storage
        .from('avatars')
        .upload(filePath, imageFile);

      if (uploadError) {
        setError('Image upload failed: ' + uploadError.message);
        setSubmitting(false);
        return;
      }

      const { data: urlData } = supabase.storage
        .from('avatars')
        .getPublicUrl(filePath);

      const imageUrl = urlData.publicUrl;

      const expiresAt = calculateExpiresAt();

      // Insert place into database
      const { data, error: insertError } = await supabase
        .from('places')
        .insert({
          name: name.trim(),
          type: 'custom',
          latitude: latlng.lat,
          longitude: latlng.lng,
          description: bio.trim() || null,
          bio: bio.trim() || null,
          image_url: imageUrl,
          created_by: userId,
          is_temporary: isTemporary,
          expires_at: expiresAt
        })
        .select()
        .single();

      if (insertError) {
        setError('Failed to create place: ' + insertError.message);
        setSubmitting(false);
        return;
      }

      onPlaceCreated(data);
    } catch (err) {
      setError('Something went wrong. Please try again.');
      setSubmitting(false);
    }
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="create-place-modal" onClick={(e) => e.stopPropagation()}>
        <button className="close-btn" onClick={onClose}>{'\u2715'}</button>

        <div className="create-place-header">
          <h2>Create a Place</h2>
          <p className="create-place-coords">
            {latlng.lat.toFixed(4)}, {latlng.lng.toFixed(4)}
          </p>
        </div>

        <form onSubmit={handleSubmit} className="create-place-form">
          {/* Image upload */}
          <div className="create-field">
            <label>Place Image *</label>
            {imagePreview ? (
              <div className="image-preview-container">
                <img src={imagePreview} alt="Preview" className="image-preview" />
                <button type="button" className="remove-image-btn" onClick={removeImage}>
                  {'\u2715'}
                </button>
              </div>
            ) : (
              <div
                className="image-upload-area"
                onClick={() => fileInputRef.current?.click()}
              >
                <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="#94a3b8" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <rect x="3" y="3" width="18" height="18" rx="2" ry="2"/>
                  <circle cx="8.5" cy="8.5" r="1.5"/>
                  <polyline points="21 15 16 10 5 21"/>
                </svg>
                <span>Click to upload an image</span>
              </div>
            )}
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              style={{ display: 'none' }}
              onChange={handleImageSelect}
            />
          </div>

          {/* Place name */}
          <div className="create-field">
            <label>Place Name *</label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Give your place a name..."
              maxLength={100}
            />
          </div>

          {/* Bio/Description */}
          <div className="create-field">
            <label>Description (optional)</label>
            <textarea
              value={bio}
              onChange={(e) => setBio(e.target.value)}
              placeholder="What is this place about?"
              rows={3}
              maxLength={300}
            />
          </div>

          {/* Temporary toggle */}
          <div className="create-field">
            <div className="temp-toggle-row">
              <label>Place Type</label>
              <div className="toggle-buttons">
                <button
                  type="button"
                  className={`toggle-btn ${!isTemporary ? 'active' : ''}`}
                  onClick={() => { setIsTemporary(false); setDuration(null); }}
                >
                  Permanent
                </button>
                <button
                  type="button"
                  className={`toggle-btn ${isTemporary ? 'active' : ''}`}
                  onClick={() => setIsTemporary(true)}
                >
                  Temporary
                </button>
              </div>
            </div>
          </div>

          {/* Duration selection */}
          {isTemporary && (
            <div className="create-field duration-field">
              <label>How long should it last?</label>
              <div className="duration-options">
                {DURATION_OPTIONS.map(opt => (
                  <button
                    key={opt.value}
                    type="button"
                    className={`duration-btn ${duration === opt.value ? 'active' : ''}`}
                    onClick={() => setDuration(opt.value)}
                  >
                    {opt.label}
                  </button>
                ))}
              </div>
              {duration === 'custom' && (
                <input
                  type="datetime-local"
                  className="custom-time-input"
                  value={customEndTime}
                  onChange={(e) => setCustomEndTime(e.target.value)}
                  min={new Date().toISOString().slice(0, 16)}
                />
              )}
            </div>
          )}

          {error && <div className="create-error">{error}</div>}

          <button
            type="submit"
            className="create-submit-btn"
            disabled={submitting}
          >
            {submitting ? 'Creating...' : 'Create Place'}
          </button>
        </form>
      </div>
    </div>
  );
};

export default CreatePlaceModal;
