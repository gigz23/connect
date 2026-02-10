-- PlaceConnect Migration V4
-- Adds universities, gyms, and bars
-- Run this in your Supabase SQL Editor

INSERT INTO places (name, type, latitude, longitude, address, description) VALUES
  -- Universities
  ('Ilia State University', 'university', 41.7088, 44.7730, '32 Ilia Chavchavadze Ave', 'Leading research university in Georgia'),
  ('Business and Technology University', 'university', 41.7168, 44.7715, '82 Ilia Chavchavadze Ave', 'BTU - technology-focused university'),
  ('Caucasus University', 'university', 41.7188, 44.7820, '1 Paata Saakadze St', 'Private university with business and law programs'),

  -- Popular Gyms
  ('Fitness Palace Vake', 'gym', 41.7100, 44.7680, '22 Ilia Chavchavadze Ave', 'One of the most popular gym chains in Tbilisi'),
  ('Gym Nation', 'gym', 41.7250, 44.7700, '71 Vazha-Pshavela Ave', 'Popular fitness center in Saburtalo'),
  ('CrossFit Tbilisi', 'gym', 41.7060, 44.7900, '14 Aleksandre Kazbegi Ave', 'Top CrossFit box in Tbilisi'),

  -- Popular Bars / Drinking Places
  ('Bassiani', 'bar', 41.7300, 44.7698, '2 Akaki Tsereteli Ave (under Dinamo Arena)', 'World-famous techno club under the football stadium'),
  ('Khidi', 'bar', 41.6955, 44.8070, 'Left Bank of Mtkvari River', 'Iconic underground club on the riverbank'),
  ('Dive Bar', 'bar', 41.7055, 44.8000, '34 Marjanishvili St', 'Popular American-style bar with cocktails');
