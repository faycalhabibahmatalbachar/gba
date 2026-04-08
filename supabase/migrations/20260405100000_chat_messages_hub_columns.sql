Tu es un Fullstack Senior Developer 10 ans d'expérience.
Projet : C:\Users\faycalhabibahmat\Music\gba\admin_gba
Stack : Next.js 14 App Router · Supabase · Tailwind · shadcn/ui · Recharts ·
        Framer Motion · Lucide React · TanStack Table v8 · FCM · Mapbox GL

CONTEXTE EXACT DE CE QUI EST DÉJÀ FAIT :
✅ Étapes 1–8  : Dashboard, Users, Products, Orders, Payments, Inventory, Reviews,
                 Coupons, Categories, Deliveries, Security, Analytics — tous implémentés
✅ Étape 9     : /messages — Hub 3 colonnes complet (MessagesContext + BFF complet)
                 APIs : conversations, messages, upload, broadcast, templates, export
                 Migrations : audit_logs guards + chat_messages_hub_columns
✅ Build       : npm run build VERT — 0 erreur TypeScript

RESTE À FAIRE dans cette session — étapes 10 → 15 :
Tu dois implémenter CHAQUE ÉTAPE COMPLÈTEMENT, en ordre.
Build vert obligatoire après chaque étape.
ZÉRO TOLÉRANCE pour le code incomplet, les TODO, les placeholders.

══════════════════════════════════════════════════════════
AVANT DE COMMENCER — RAPPEL DES COMPOSANTS PARTAGÉS
══════════════════════════════════════════════════════════

Vérifier que ces composants existent dans src/components/ui/.
Les créer s'ils sont absents, les réutiliser s'ils existent :

- DataTable (TanStack Table v8)
- KPICard (label + valeur + delta + sparkline)
- StatusBadge (map statut → couleur)
- PageHeader (titre + sous-titre + actions)
- Drawer (Radix Sheet, 520px desktop)
- ConfirmModal (confirmation critique)
- ChartWrapper (skeleton + error + Recharts)
- JsonDiffViewer (avant/après coloré)
- AvatarWithInitials (fallback initiales)

Police DM Sans importée dans layout.tsx ?
Tokens CSS dans src/styles/tokens.css ?
Sonner Toaster dans le layout admin ?
Si non → créer d'abord, puis continuer.

══════════════════════════════════════════════════════════
ÉTAPE 10 — /notifications (PRIORITÉ MAXIMALE)
══════════════════════════════════════════════════════════

Page complète avec 5 onglets. Utiliser Radix Tabs.

### MIGRATIONS SQL (appliquer si tables absentes)
```sql
-- Push logs
CREATE TABLE IF NOT EXISTS push_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  campaign_name text,
  target_type text CHECK (target_type IN ('all','segment','single')),
  target_filters jsonb DEFAULT '{}',
  total_targeted int DEFAULT 0,
  total_sent int DEFAULT 0,
  delivered int DEFAULT 0,
  failed int DEFAULT 0,
  invalid_tokens_removed int DEFAULT 0,
  sent_at timestamptz DEFAULT now(),
  scheduled_at timestamptz,
  sent_by uuid REFERENCES auth.users(id),
  status text DEFAULT 'pending'
    CHECK (status IN ('pending','running','done','failed','scheduled')),
  error_detail text,
  batch_results jsonb DEFAULT '[]'
);

-- Push media
CREATE TABLE IF NOT EXISTS push_media (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  url text NOT NULL,
  filename text,
  size_bytes int,
  mime_type text,
  used_in_campaigns int DEFAULT 0,
  uploaded_by uuid REFERENCES auth.users(id),
  created_at timestamptz DEFAULT now()
);

-- Push templates
CREATE TABLE IF NOT EXISTS push_templates (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  category text CHECK (category IN
    ('promotional','transactional','alert','system')),
  title_template text NOT NULL,
  body_template text NOT NULL,
  image_url text,
  data_json jsonb DEFAULT '{}',
  variables text[] DEFAULT '{}',
  created_by uuid REFERENCES auth.users(id),
  created_at timestamptz DEFAULT now()
);

-- Notification segments
CREATE TABLE IF NOT EXISTS notification_segments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  description text,
  filters jsonb NOT NULL DEFAULT '{}',
  estimated_devices int DEFAULT 0,
  last_estimated_at timestamptz,
  created_by uuid REFERENCES auth.users(id),
  created_at timestamptz DEFAULT now()
);

ALTER TABLE push_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE push_media ENABLE ROW LEVEL SECURITY;
ALTER TABLE push_templates ENABLE ROW LEVEL SECURITY;
ALTER TABLE notification_segments ENABLE ROW LEVEL SECURITY;
```

### APIS BFF NÉCESSAIRES -- Colonnes optionnelles hub admin messages (reply, metadata JSON)
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'public' AND table_name = 'chat_messages'
  ) THEN
    ALTER TABLE public.chat_messages
      ADD COLUMN IF NOT EXISTS reply_to_id uuid REFERENCES public.chat_messages(id) ON DELETE SET NULL,
      ADD COLUMN IF NOT EXISTS metadata jsonb DEFAULT '{}'::jsonb;
  END IF;
END $$;
