-- Migration V5: User-created places + Temporary places
-- Run this in your Supabase SQL Editor

-- Add created_by column to track who created a place
ALTER TABLE places ADD COLUMN IF NOT EXISTS created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL;

-- Add temporary place fields
ALTER TABLE places ADD COLUMN IF NOT EXISTS is_temporary BOOLEAN DEFAULT false;
ALTER TABLE places ADD COLUMN IF NOT EXISTS expires_at TIMESTAMP WITH TIME ZONE;

-- Add bio field for user-created places
ALTER TABLE places ADD COLUMN IF NOT EXISTS bio TEXT;

-- Index for finding expired temporary places
CREATE INDEX IF NOT EXISTS idx_places_expires_at ON places(expires_at) WHERE is_temporary = true;

-- Index for user-created places
CREATE INDEX IF NOT EXISTS idx_places_created_by ON places(created_by);

-- Policy for deleting places (only creator can delete their own)
DO '
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename = ''places'' AND policyname = ''Creators can delete their places''
  ) THEN
    CREATE POLICY "Creators can delete their places" ON places FOR DELETE
      USING (auth.uid() = created_by);
  END IF;
END;
';

-- Function to auto-cleanup expired temporary places
CREATE OR REPLACE FUNCTION cleanup_expired_places()
RETURNS void AS '
BEGIN
  DELETE FROM places
  WHERE is_temporary = true
  AND expires_at IS NOT NULL
  AND expires_at < NOW();
END;
' LANGUAGE plpgsql;
