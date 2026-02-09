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

-- RLS Policies
CREATE POLICY "Public read reactions" ON message_reactions
  FOR SELECT USING (true);

CREATE POLICY "Auth insert reactions" ON message_reactions
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Auth delete own reactions" ON message_reactions
  FOR DELETE USING (auth.uid() = user_id);

-- Enable Realtime
ALTER PUBLICATION supabase_realtime ADD TABLE message_reactions;

-- Allow updating messages (needed for unsend feature)
-- Check if policy already exists, if not create it
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE policyname = 'Users can update own messages' AND tablename = 'messages'
  ) THEN
    EXECUTE 'CREATE POLICY "Users can update own messages" ON messages FOR UPDATE USING (auth.uid() = user_id)';
  END IF;
END
$$;

-- Enable email confirmation in Supabase:
-- Go to Supabase Dashboard > Authentication > Settings
-- Option 1: Disable "Confirm email" to auto-confirm users (for development)
-- Option 2: Configure SMTP settings under "Email" section for proper email delivery
-- Option 3: Use a custom SMTP provider (Resend, SendGrid, etc.) for production
