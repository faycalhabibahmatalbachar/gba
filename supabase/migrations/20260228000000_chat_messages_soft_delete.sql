-- Soft delete pour chat_messages (audit + restauration possible)
ALTER TABLE public.chat_messages
  ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS deleted_by UUID REFERENCES auth.users(id);

CREATE INDEX IF NOT EXISTS idx_chat_messages_deleted_at
  ON public.chat_messages(conversation_id, deleted_at)
  WHERE deleted_at IS NULL;

COMMENT ON COLUMN public.chat_messages.deleted_at IS 'Soft delete: date de suppression';
COMMENT ON COLUMN public.chat_messages.deleted_by IS 'Admin/utilisateur ayant supprimé';
