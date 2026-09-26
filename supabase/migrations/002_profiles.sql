-- ============================================================
-- Migration 002: Profiles + Auth Trigger
-- ============================================================
-- Creates profiles table mirroring auth.users.
-- handle_new_user() trigger auto-creates a profile on signup.
-- ============================================================

CREATE TABLE profiles (
  id          uuid        PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  display_name text       NOT NULL,
  email       text        NOT NULL UNIQUE,
  role        user_role   NOT NULL DEFAULT 'staff',
  created_at  timestamptz NOT NULL DEFAULT now(),
  updated_at  timestamptz NOT NULL DEFAULT now()
);

-- Trigger function: create profile when a new user signs up
CREATE OR REPLACE FUNCTION handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.profiles (id, display_name, email, role)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data->>'display_name', split_part(NEW.email, '@', 1)),
    NEW.email,
    'staff'
  );
  RETURN NEW;
END;
$$;

-- Attach trigger to auth.users
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION handle_new_user();
