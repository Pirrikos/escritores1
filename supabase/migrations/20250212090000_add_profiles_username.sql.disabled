-- Add a unique, URL-friendly username to profiles
DO $$ BEGIN
  -- Add column if not exists
  IF NOT EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'profiles' AND column_name = 'username'
  ) THEN
    ALTER TABLE public.profiles ADD COLUMN username text;
  END IF;
END $$;

-- Valid characters check for username (slug-style)
ALTER TABLE public.profiles
  ADD CONSTRAINT IF NOT EXISTS profiles_username_valid
  CHECK (username IS NULL OR username ~ '^[a-z0-9]+(?:-[a-z0-9]+)*$');

-- Unique index for non-null usernames
CREATE UNIQUE INDEX IF NOT EXISTS uq_profiles_username ON public.profiles(username) WHERE username IS NOT NULL;

-- Helper: slugify a text to url-friendly username
CREATE OR REPLACE FUNCTION public.slugify_username(input text)
RETURNS text AS $$
DECLARE
  base text;
BEGIN
  IF input IS NULL THEN
    RETURN NULL;
  END IF;
  base := lower(trim(input));
  -- Replace non-alphanumerics with dashes, collapse dashes
  base := regexp_replace(base, '[^a-z0-9]+', '-', 'g');
  base := regexp_replace(base, '-{2,}', '-', 'g');
  base := trim(both '-' FROM base);
  IF base = '' THEN
    RETURN NULL;
  END IF;
  RETURN base;
END;
$$ LANGUAGE plpgsql IMMUTABLE;

-- Helper: ensure uniqueness by adding short hex suffix if needed
CREATE OR REPLACE FUNCTION public.ensure_unique_username(base text)
RETURNS text AS $$
DECLARE
  candidate text := base;
  exists_row record;
  tries int := 0;
BEGIN
  IF base IS NULL THEN
    RETURN NULL;
  END IF;
  LOOP
    SELECT 1 INTO exists_row FROM public.profiles WHERE username = candidate LIMIT 1;
    IF NOT FOUND THEN
      RETURN candidate;
    END IF;
    tries := tries + 1;
    -- Add short random suffix to avoid collisions
    candidate := base || '-' || encode(gen_random_bytes(3), 'hex');
    IF tries > 10 THEN
      -- Fallback with full uuid slice
      candidate := base || '-' || substr(gen_random_uuid()::text, 1, 8);
    END IF;
  END LOOP;
END;
$$ LANGUAGE plpgsql;

-- Trigger: set username on INSERT if NULL; allow manual updates
CREATE OR REPLACE FUNCTION public.profiles_set_username()
RETURNS TRIGGER AS $$
DECLARE
  base text;
BEGIN
  IF TG_OP = 'INSERT' THEN
    IF NEW.username IS NULL THEN
      base := public.slugify_username(NEW.display_name);
      NEW.username := public.ensure_unique_username(base);
    ELSE
      NEW.username := public.slugify_username(NEW.username);
    END IF;
    RETURN NEW;
  ELSIF TG_OP = 'UPDATE' THEN
    -- Only adjust when explicitly changing username; keep stable across display_name changes
    IF NEW.username IS DISTINCT FROM OLD.username THEN
      base := public.slugify_username(NEW.username);
      NEW.username := public.ensure_unique_username(base);
    END IF;
    RETURN NEW;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS profiles_set_username_trigger ON public.profiles;
CREATE TRIGGER profiles_set_username_trigger
  BEFORE INSERT OR UPDATE ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION public.profiles_set_username();

-- Backfill usernames for existing rows
UPDATE public.profiles p
SET username = public.ensure_unique_username(public.slugify_username(p.display_name))
WHERE p.username IS NULL;

COMMENT ON COLUMN public.profiles.username IS 'URL-friendly unique username for profile pages';