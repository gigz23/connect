-- PlaceConnect Migration V2
-- Run this in your Supabase SQL Editor to enable reactions and other new features

-- Message reactions table
CREATE TABLE IF NOT EXISTS message_reactions (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  message_id UUID NOT NULL REFERENCES messages(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  emoji VARCHAR(10) NOT NULL,
  username VARCHAR(50),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  CONSTRAINT unique_user_emoji_reaction UNIQUE (message_id, user_id, emoji)
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_reactions_message_id ON message_reactions(message_id);
CREATE INDEX IF NOT EXISTS idx_reactions_user_id ON message_reactions(user_id);

-- Enable RLS
ALTER TABLE message_reactions ENABLE ROW LEVEL SECURITY;

-- RLS Policies (safe for re-runs)
DO '
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = ''Public read reactions'' AND tablename = ''message_reactions'') THEN
    CREATE POLICY "Public read reactions" ON message_reactions FOR SELECT USING (true);
  END IF;
END;
';

DO '
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = ''Auth insert reactions'' AND tablename = ''message_reactions'') THEN
    CREATE POLICY "Auth insert reactions" ON message_reactions FOR INSERT WITH CHECK (auth.uid() = user_id);
  END IF;
END;
';

DO '
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = ''Auth delete own reactions'' AND tablename = ''message_reactions'') THEN
    CREATE POLICY "Auth delete own reactions" ON message_reactions FOR DELETE USING (auth.uid() = user_id);
  END IF;
END;
';

-- Enable Realtime
ALTER PUBLICATION supabase_realtime ADD TABLE message_reactions;

-- Allow updating messages (needed for unsend feature)
DO '
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = ''Users can update own messages'' AND tablename = ''messages'') THEN
    CREATE POLICY "Users can update own messages" ON messages FOR UPDATE USING (auth.uid() = user_id);
  END IF;
END;
';
