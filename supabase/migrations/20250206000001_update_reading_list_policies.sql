-- Add UPDATE policy for reading_list to support upsert conflicts
-- Ensures users can update their own entries when upserting

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'reading_list' AND policyname = 'update_own_reading_list'
  ) THEN
    CREATE POLICY update_own_reading_list ON public.reading_list
      FOR UPDATE TO authenticated
      USING (user_id = auth.uid())
      WITH CHECK (user_id = auth.uid());
  END IF;
END $$;