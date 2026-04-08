-- Bucket stockage pièces jointes messagerie admin (évite "Bucket not found" sur POST /api/messages/upload)
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'chat-attachments',
  'chat-attachments',
  true,
  52428800,
  ARRAY[
    'image/jpeg', 'image/png', 'image/webp', 'image/gif',
    'audio/webm', 'audio/ogg', 'audio/mpeg',
    'video/webm', 'application/pdf', 'application/octet-stream'
  ]
)
ON CONFLICT (id) DO UPDATE SET
  public = EXCLUDED.public,
  file_size_limit = COALESCE(EXCLUDED.file_size_limit, storage.buckets.file_size_limit);
