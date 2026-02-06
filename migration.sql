-- 1. Add user_id to messages
ALTER TABLE messages ADD COLUMN IF NOT EXISTS user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL;

-- 2. Index on messages.user_id
CREATE INDEX IF NOT EXISTS idx_messages_user_id ON messages(user_id);

-- 3. FK from messages.user_id to profiles
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints
    WHERE constraint_name = 'messages_profile_fkey'
  ) THEN
    ALTER TABLE messages ADD CONSTRAINT messages_profile_fkey
      FOREIGN KEY (user_id) REFERENCES profiles(id) ON DELETE SET NULL;
  END IF;
END $$;

-- 4. Create friendships table
CREATE TABLE IF NOT EXISTS friendships (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  requester_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  addressee_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  status VARCHAR(20) NOT NULL DEFAULT 'pending',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  CONSTRAINT unique_friendship UNIQUE (requester_id, addressee_id),
  CONSTRAINT no_self_friend CHECK (requester_id != addressee_id)
);

-- 5. Enable RLS on friendships
ALTER TABLE friendships ENABLE ROW LEVEL SECURITY;

-- 6-9. Friendships RLS policies
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'View own friendships' AND tablename = 'friendships') THEN
    CREATE POLICY "View own friendships" ON friendships FOR SELECT
      USING (auth.uid() = requester_id OR auth.uid() = addressee_id);
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Send friend requests' AND tablename = 'friendships') THEN
    CREATE POLICY "Send friend requests" ON friendships FOR INSERT
      WITH CHECK (auth.uid() = requester_id);
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Update own friendships' AND tablename = 'friendships') THEN
    CREATE POLICY "Update own friendships" ON friendships FOR UPDATE
      USING (auth.uid() = addressee_id OR auth.uid() = requester_id);
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Delete own friendships' AND tablename = 'friendships') THEN
    CREATE POLICY "Delete own friendships" ON friendships FOR DELETE
      USING (auth.uid() = requester_id OR auth.uid() = addressee_id);
  END IF;
END $$;

-- 10. Update profiles SELECT policy
DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Users can view their profile' AND tablename = 'profiles') THEN
    DROP POLICY "Users can view their profile" ON profiles;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Authenticated users can view all profiles' AND tablename = 'profiles') THEN
    CREATE POLICY "Authenticated users can view all profiles" ON profiles FOR SELECT TO authenticated USING (true);
  END IF;
END $$;

-- 11. Enable realtime on friendships
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime' AND tablename = 'friendships'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE friendships;
  END IF;
END $$;
