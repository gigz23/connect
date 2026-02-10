-- Migration V6: Fix friend count visibility
-- Run this in your Supabase SQL Editor
--
-- Problem: The "View own friendships" policy only lets users see
-- friendships they're involved in. So when user3 views user1's profile,
-- user3 can't see user1's accepted friendships, resulting in 0 friends.
--
-- Fix: Allow all authenticated users to see accepted friendships.
-- Pending requests remain private (only visible to sender/receiver).

DROP POLICY IF EXISTS "View own friendships" ON friendships;

CREATE POLICY "View own friendships" ON friendships FOR SELECT
  USING (
    auth.uid() = requester_id
    OR auth.uid() = addressee_id
    OR status = 'accepted'
  );
