-- ============================================
-- Afegir columnes per sincronitzar amb Supabase
-- (favorites, dies programats, soft-delete)
-- ============================================

-- Afegir is_favorite a routines
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'routines' AND column_name = 'is_favorite' AND table_schema = 'public'
  ) THEN
    ALTER TABLE public.routines ADD COLUMN is_favorite BOOLEAN NOT NULL DEFAULT false;
  END IF;
END $$;

-- Afegir scheduled_days (dies de la setmana: 0=diumenge, 1=dilluns, ..., 6=dissabte)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'routines' AND column_name = 'scheduled_days' AND table_schema = 'public'
  ) THEN
    ALTER TABLE public.routines ADD COLUMN scheduled_days INTEGER[] NOT NULL DEFAULT '{}';
  END IF;
END $$;

-- Afegir deleted_at per a soft-delete (null = activa, timestamp = eliminada)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'routines' AND column_name = 'deleted_at' AND table_schema = 'public'
  ) THEN
    ALTER TABLE public.routines ADD COLUMN deleted_at TIMESTAMP WITH TIME ZONE NULL;
  END IF;
END $$;

-- ============================================
-- Storage bucket per a avatars
-- ============================================

INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'avatars',
  'avatars',
  true,
  5242880,
  ARRAY['image/jpeg', 'image/png', 'image/webp', 'image/gif']
)
ON CONFLICT (id) DO UPDATE SET public = true;

-- Política: qualsevol usuari autenticat pot pujar el seu avatar
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE policyname = 'Usuaris poden pujar el seu avatar' AND tablename = 'objects'
  ) THEN
    CREATE POLICY "Usuaris poden pujar el seu avatar"
    ON storage.objects FOR INSERT
    TO authenticated
    WITH CHECK (
      bucket_id = 'avatars'
      AND (storage.foldername(name))[1] = auth.uid()::text
    );
  END IF;
END $$;

-- Política: qualsevol usuari autenticat pot actualitzar el seu avatar
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE policyname = 'Usuaris poden actualitzar el seu avatar' AND tablename = 'objects'
  ) THEN
    CREATE POLICY "Usuaris poden actualitzar el seu avatar"
    ON storage.objects FOR UPDATE
    TO authenticated
    USING (
      bucket_id = 'avatars'
      AND (storage.foldername(name))[1] = auth.uid()::text
    );
  END IF;
END $$;

-- Política: avatars visibles públicament
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE policyname = 'Avatars visibles públicament' AND tablename = 'objects'
  ) THEN
    CREATE POLICY "Avatars visibles públicament"
    ON storage.objects FOR SELECT
    TO public
    USING (bucket_id = 'avatars');
  END IF;
END $$;
