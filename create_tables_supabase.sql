-- ========================================
-- TABLES ESSENTIELLES POUR GBA STORE
-- ========================================

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ========================================
-- CATEGORIES TABLE
-- ========================================
DROP TABLE IF EXISTS public.categories CASCADE;
CREATE TABLE public.categories (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  name TEXT NOT NULL,
  slug TEXT UNIQUE NOT NULL,
  description TEXT,
  image_url TEXT,
  icon TEXT,
  parent_id UUID REFERENCES public.categories(id),
  display_order INTEGER DEFAULT 0,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ========================================
-- PRODUCTS TABLE
-- ========================================
DROP TABLE IF EXISTS public.products CASCADE;
CREATE TABLE public.products (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  sku TEXT UNIQUE,
  name TEXT NOT NULL,
  slug TEXT UNIQUE,
  description TEXT,
  short_description TEXT,
  price DECIMAL(10, 2) NOT NULL,
  compare_at_price DECIMAL(10, 2),
  cost_price DECIMAL(10, 2),
  quantity INTEGER DEFAULT 0,
  low_stock_threshold INTEGER DEFAULT 10,
  unit TEXT DEFAULT 'pièce',
  barcode TEXT,
  weight DECIMAL(10, 3),
  dimensions JSONB DEFAULT '{}',
  category_id UUID REFERENCES public.categories(id),
  brand TEXT,
  model TEXT,
  main_image TEXT,
  images TEXT[],
  specifications JSONB DEFAULT '{}',
  tags TEXT[],
  rating DECIMAL(3, 2) DEFAULT 0,
  reviews_count INTEGER DEFAULT 0,
  is_featured BOOLEAN DEFAULT false,
  is_active BOOLEAN DEFAULT true,
  status TEXT DEFAULT 'available',
  meta_title TEXT,
  meta_description TEXT,
  meta_keywords TEXT[],
  created_by UUID,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ========================================
-- PRODUCT_VARIANTS TABLE
-- ========================================
DROP TABLE IF EXISTS public.product_variants CASCADE;
CREATE TABLE public.product_variants (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  product_id UUID REFERENCES public.products(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  sku TEXT UNIQUE,
  price DECIMAL(10, 2),
  quantity INTEGER DEFAULT 0,
  attributes JSONB DEFAULT '{}',
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ========================================
-- Enable Row Level Security (RLS)
-- ========================================
ALTER TABLE public.categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.products ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.product_variants ENABLE ROW LEVEL SECURITY;

-- ========================================
-- Policies pour accès public en lecture
-- ========================================
CREATE POLICY "Enable read access for all users" ON public.categories
  FOR SELECT USING (true);

CREATE POLICY "Enable read access for all users" ON public.products
  FOR SELECT USING (true);

CREATE POLICY "Enable read access for all users" ON public.product_variants
  FOR SELECT USING (true);

-- ========================================
-- Policies pour permettre toutes les opérations (temporaire pour dev)
-- ========================================
CREATE POLICY "Enable all operations for authenticated users" ON public.categories
  FOR ALL USING (true);

CREATE POLICY "Enable all operations for authenticated users" ON public.products
  FOR ALL USING (true);

CREATE POLICY "Enable all operations for authenticated users" ON public.product_variants
  FOR ALL USING (true);

-- ========================================
-- Insérer quelques catégories de base
-- ========================================
INSERT INTO public.categories (name, slug, description, icon, display_order, is_active) VALUES
  ('Électronique', 'electronique', 'Appareils électroniques et gadgets', '📱', 1, true),
  ('Vêtements', 'vetements', 'Mode et habillement', '👕', 2, true),
  ('Alimentation', 'alimentation', 'Produits alimentaires et boissons', '🍔', 3, true),
  ('Maison', 'maison', 'Articles pour la maison et décoration', '🏠', 4, true),
  ('Sports', 'sports', 'Équipements sportifs et fitness', '⚽', 5, true),
  ('Beauté', 'beaute', 'Cosmétiques et soins personnels', '💄', 6, true),
  ('Livres', 'livres', 'Livres et magazines', '📚', 7, true),
  ('Jouets', 'jouets', 'Jouets et jeux', '🎮', 8, true);

-- ========================================
-- Créer des index pour les performances
-- ========================================
CREATE INDEX idx_products_slug ON public.products(slug);
CREATE INDEX idx_products_category ON public.products(category_id);
CREATE INDEX idx_products_sku ON public.products(sku);
CREATE INDEX idx_products_featured ON public.products(is_featured) WHERE is_featured = true;
CREATE INDEX idx_categories_slug ON public.categories(slug);
CREATE INDEX idx_product_variants_product ON public.product_variants(product_id);
