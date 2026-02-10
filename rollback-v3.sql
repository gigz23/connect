-- Rollback Migration V3 - Restores original state
-- Run this in your Supabase SQL Editor

-- Step 1: Remove all the universities that were added
DELETE FROM places WHERE name IN (
  'Georgian Technical University',
  'Ilia State University',
  'Free University of Tbilisi',
  'Caucasus University',
  'Business and Technology University',
  'Georgian American University',
  'University of Georgia',
  'Tbilisi State Medical University',
  'Agricultural University of Georgia',
  'European University',
  'GIPA',
  'SEU University',
  'International Black Sea University',
  'Caucasus International University',
  'San Diego State University Georgia'
);

-- Step 2: Revert Freedom Square coordinates back to original
UPDATE places
SET latitude = 41.6922, longitude = 44.8007
WHERE name = 'Freedom Square';

-- Step 3: Re-insert the deleted places
INSERT INTO places (name, type, latitude, longitude, address, description, image_url) VALUES
  ('Central Library', 'library', 41.7151, 44.8271, 'Rustaveli Ave', 'Public library and study space', 'https://images.unsplash.com/photo-150784272343-583f20270319?w=500&h=300&fit=crop'),
  ('Fabrika', 'cafe', 41.6934, 44.8015, '8 Egnate Ninoshvili St', 'Co-working cafe and hostel', 'https://images.unsplash.com/photo-1495521821757-a1efb6729352?w=500&h=300&fit=crop'),
  ('Impact Hub Tbilisi', 'coworking', 41.6933, 44.8013, '5 Egnate Ninoshvili St', 'Co-working space', 'https://images.unsplash.com/photo-1552664730-d307ca884978?w=500&h=300&fit=crop'),
  ('Mziuri Park', 'park', 41.7150, 44.7550, 'Saburtalo District', 'Large park with sports facilities', 'https://images.unsplash.com/photo-1511632765486-a01980e01a18?w=500&h=300&fit=crop'),
  ('Terminal', 'cafe', 41.6945, 44.8010, '12 Atoneli St', 'Popular cafe for students', 'https://images.unsplash.com/photo-1442512595331-e89e6e0acbe0?w=500&h=300&fit=crop');
