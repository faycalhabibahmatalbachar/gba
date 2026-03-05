-- Create chat-images storage bucket (public)
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'chat-images',
  'chat-images',
  true,
  10485760,  -- 10 MB max
  ARRAY['image/jpeg','image/jpg','image/png','image/gif','image/webp']
)
ON CONFLICT (id) DO NOTHING;

-- Allow authenticated users to upload to chat-images
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE schemaname = 'storage' AND tablename = 'objects'
    AND policyname = 'chat-images: authenticated upload'
  ) THEN
    EXECUTE $policy$
      CREATE POLICY "chat-images: authenticated upload"
      ON storage.objects FOR INSERT
      TO authenticated
      WITH CHECK (bucket_id = 'chat-images')
    $policy$;
  END IF;
END $$;

-- Allow public read on chat-images
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE schemaname = 'storage' AND tablename = 'objects'
    AND policyname = 'chat-images: public read'
  ) THEN
    EXECUTE $policy$
      CREATE POLICY "chat-images: public read"
      ON storage.objects FOR SELECT
      TO public
      USING (bucket_id = 'chat-images')
    $policy$;
  END IF;
END $$;
