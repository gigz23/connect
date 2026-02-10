-- PlaceConnect Database Schema
-- Run this in your Supabase SQL Editor

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Places table
CREATE TABLE places (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name VARCHAR(255) NOT NULL,
  type VARCHAR(50) NOT NULL, -- school, university, cafe, basketball_court, etc.
  latitude DECIMAL(10, 8) NOT NULL,
  longitude DECIMAL(11, 8) NOT NULL,
  address TEXT,
  description TEXT,
  image_url TEXT, -- URL to building image
  activity_level INTEGER DEFAULT 0, -- 0-20 scale based on recent messages
  last_activity TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Messages table
CREATE TABLE messages (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  place_id UUID NOT NULL REFERENCES places(id) ON DELETE CASCADE,
  user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  username VARCHAR(50) NOT NULL,
  content TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Profiles table (linked to Supabase Auth users)
CREATE TABLE profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  full_name TEXT,
  avatar_url TEXT,
  email TEXT,
  updated_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Indexes for performance
CREATE INDEX idx_messages_place_id ON messages(place_id);
CREATE INDEX idx_messages_created_at ON messages(created_at DESC);
CREATE INDEX idx_messages_user_id ON messages(user_id);
CREATE INDEX idx_places_activity ON places(activity_level DESC);
CREATE INDEX idx_places_location ON places(latitude, longitude);

-- Enable Row Level Security
ALTER TABLE places ENABLE ROW LEVEL SECURITY;
ALTER TABLE messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;

-- RLS Policies - Allow all operations for now (adjust based on your needs)
CREATE POLICY "Public read access on places" 
  ON places FOR SELECT 
  USING (true);

CREATE POLICY "Public insert access on places" 
  ON places FOR INSERT 
  WITH CHECK (true);

CREATE POLICY "Public update access on places" 
  ON places FOR UPDATE 
  USING (true);

CREATE POLICY "Public read access on messages" 
  ON messages FOR SELECT 
  USING (true);

CREATE POLICY "Public insert access on messages" 
  ON messages FOR INSERT 
  WITH CHECK (true);

-- Profiles policies
CREATE POLICY "Authenticated users can view all profiles"
  ON profiles FOR SELECT TO authenticated
  USING (true);

CREATE POLICY "Users can insert their profile"
  ON profiles FOR INSERT
  WITH CHECK (auth.uid() = id);

CREATE POLICY "Users can update their profile"
  ON profiles FOR UPDATE
  USING (auth.uid() = id);

-- Function to clean old messages (optional - keeps database lean)
CREATE OR REPLACE FUNCTION cleanup_old_messages()
RETURNS void AS $$
BEGIN
  DELETE FROM messages 
  WHERE created_at < NOW() - INTERVAL '7 days';
END;
$$ LANGUAGE plpgsql;

-- Function to update activity level based on recent messages
CREATE OR REPLACE FUNCTION update_place_activity()
RETURNS TRIGGER AS $$
BEGIN
  UPDATE places 
  SET 
    activity_level = (
      SELECT COUNT(*) 
      FROM messages 
      WHERE place_id = NEW.place_id 
      AND created_at > NOW() - INTERVAL '1 hour'
    ),
    last_activity = NOW()
  WHERE id = NEW.place_id;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger to automatically update activity on new messages
CREATE TRIGGER update_activity_on_message
  AFTER INSERT ON messages
  FOR EACH ROW
  EXECUTE FUNCTION update_place_activity();

-- Insert sample places (Tbilisi examples - adjust to your location)
INSERT INTO places (name, type, latitude, longitude, address, description, image_url) VALUES
  ('Tbilisi State University', 'university', 41.7095, 44.7739, '1 Ilia Chavchavadze Ave', 'Main campus of TSU', 'https://images.unsplash.com/photo-1541339907198-e7900dcf2cb4?w=500&h=300&fit=crop'),
  ('Central Library', 'library', 41.7151, 44.8271, 'Rustaveli Ave', 'Public library and study space', 'https://images.unsplash.com/photo-150784272343-583f20270319?w=500&h=300&fit=crop'),
  ('Vake Park Basketball Court', 'basketball_court', 41.7020, 44.7700, 'Vake Park', 'Outdoor basketball court', 'https://images.unsplash.com/photo-1546519638-68711109d298?w=500&h=300&fit=crop'),
  ('Fabrika', 'cafe', 41.6934, 44.8015, '8 Egnate Ninoshvili St', 'Co-working cafe and hostel', 'https://images.unsplash.com/photo-1495521821757-a1efb6729352?w=500&h=300&fit=crop'),
  ('Impact Hub Tbilisi', 'coworking', 41.6933, 44.8013, '5 Egnate Ninoshvili St', 'Co-working space', 'https://images.unsplash.com/photo-1552664730-d307ca884978?w=500&h=300&fit=crop'),
  ('Freedom Square', 'park', 41.6922, 44.8007, 'Freedom Square', 'Central city square', 'https://images.unsplash.com/photo-1448375240586-882707db888b?w=500&h=300&fit=crop'),
  ('Mziuri Park', 'park', 41.7150, 44.7550, 'Saburtalo District', 'Large park with sports facilities', 'https://images.unsplash.com/photo-1511632765486-a01980e01a18?w=500&h=300&fit=crop'),
  ('Terminal', 'cafe', 41.6945, 44.8010, '12 Atoneli St', 'Popular cafe for students', 'https://images.unsplash.com/photo-1442512595331-e89e6e0acbe0?w=500&h=300&fit=crop');

-- FK from messages to profiles (for Supabase joins)
ALTER TABLE messages ADD CONSTRAINT messages_profile_fkey
  FOREIGN KEY (user_id) REFERENCES profiles(id) ON DELETE SET NULL;

-- Friendships table
CREATE TABLE friendships (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  requester_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  addressee_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  status VARCHAR(20) NOT NULL DEFAULT 'pending',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  CONSTRAINT unique_friendship UNIQUE (requester_id, addressee_id),
  CONSTRAINT no_self_friend CHECK (requester_id != addressee_id)
);

ALTER TABLE friendships ENABLE ROW LEVEL SECURITY;

-- Friendships RLS policies
CREATE POLICY "View own friendships" ON friendships FOR SELECT
  USING (auth.uid() = requester_id OR auth.uid() = addressee_id OR status = 'accepted');

CREATE POLICY "Send friend requests" ON friendships FOR INSERT
  WITH CHECK (auth.uid() = requester_id);

CREATE POLICY "Update own friendships" ON friendships FOR UPDATE
  USING (auth.uid() = addressee_id OR auth.uid() = requester_id);

CREATE POLICY "Delete own friendships" ON friendships FOR DELETE
  USING (auth.uid() = requester_id OR auth.uid() = addressee_id);

-- Enable Realtime for all tables
ALTER PUBLICATION supabase_realtime ADD TABLE places;
ALTER PUBLICATION supabase_realtime ADD TABLE messages;
ALTER PUBLICATION supabase_realtime ADD TABLE friendships;
