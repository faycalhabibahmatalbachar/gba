/**
 * GBA — Script upload images produits vers Supabase Storage
 *
 * Pour chaque produit :
 *  1. Recherche image HD via Unsplash API (fallback Pexels)
 *  2. Vérification HTTP 200
 *  3. Download en mémoire
 *  4. Upload → bucket "product-images/<sku>.jpg"
 *  5. UPDATE products SET main_image = publicUrl
 *
 * Usage :
 *   node scripts/upload_product_images.mjs
 *
 * Variables d'environnement requises (.env à la racine du projet) :
 *   SUPABASE_URL=https://uvlrgwdbjegoavjfdrzb.supabase.co
 *   SUPABASE_SERVICE_ROLE_KEY=<service_role_key>
 *   UNSPLASH_ACCESS_KEY=<unsplash_api_key>
 *   PEXELS_API_KEY=<pexels_api_key>          (fallback)
 */

import { createClient } from '@supabase/supabase-js';
import { readFileSync, existsSync } from 'fs';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));

// ── Env loader (no dotenv dependency) ────────────────────────────────────────
function loadEnv() {
  const envPath = resolve(__dirname, '../.env');
  if (!existsSync(envPath)) {
    console.warn('[ENV] No .env file found at project root — using process.env');
    return;
  }
  for (const line of readFileSync(envPath, 'utf8').split('\n')) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    const idx = trimmed.indexOf('=');
    if (idx < 0) continue;
    const key = trimmed.slice(0, idx).trim();
    const val = trimmed.slice(idx + 1).trim().replace(/^["']|["']$/g, '');
    if (!process.env[key]) process.env[key] = val;
  }
}
loadEnv();

const SUPABASE_URL            = process.env.SUPABASE_URL;
const SUPABASE_SERVICE_ROLE   = process.env.SUPABASE_SERVICE_ROLE_KEY;
const UNSPLASH_KEY            = process.env.UNSPLASH_ACCESS_KEY;
const PEXELS_KEY              = process.env.PEXELS_API_KEY;
const BUCKET                  = 'product-images';

if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE) {
  console.error('[FATAL] SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are required.');
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE, {
  auth: { persistSession: false },
});

// ── Image search via Unsplash ─────────────────────────────────────────────────
async function searchUnsplash(query) {
  if (!UNSPLASH_KEY) return null;
  try {
    const url = `https://api.unsplash.com/photos/random?query=${encodeURIComponent(query)}&orientation=squarish&w=800`;
    const res = await fetch(url, {
      headers: { Authorization: `Client-ID ${UNSPLASH_KEY}` },
    });
    if (!res.ok) return null;
    const json = await res.json();
    const imageUrl = json?.urls?.regular;
    if (!imageUrl) return null;
    // Validate URL is accessible
    const check = await fetch(imageUrl, { method: 'HEAD' });
    return check.ok ? imageUrl : null;
  } catch {
    return null;
  }
}

// ── Image search via Pexels (fallback) ───────────────────────────────────────
async function searchPexels(query) {
  if (!PEXELS_KEY) return null;
  try {
    const url = `https://api.pexels.com/v1/search?query=${encodeURIComponent(query)}&per_page=1&size=medium`;
    const res = await fetch(url, {
      headers: { Authorization: PEXELS_KEY },
    });
    if (!res.ok) return null;
    const json = await res.json();
    const imageUrl = json?.photos?.[0]?.src?.large;
    if (!imageUrl) return null;
    const check = await fetch(imageUrl, { method: 'HEAD' });
    return check.ok ? imageUrl : null;
  } catch {
    return null;
  }
}

// ── Download image buffer ─────────────────────────────────────────────────────
async function downloadImage(imageUrl) {
  const res = await fetch(imageUrl);
  if (!res.ok) throw new Error(`HTTP ${res.status} for ${imageUrl}`);
  const arrayBuf = await res.arrayBuffer();
  return Buffer.from(arrayBuf);
}

// ── Process one product ───────────────────────────────────────────────────────
async function processProduct(product) {
  const { id, sku, name, main_image: currentImage } = product;
  const label = `[${sku}] ${name}`;

  // Build a focused search query from product name
  const searchQuery = name
    .replace(/\b(cm|mm|kg|w|v|hz|go|mo|tb|gb|mp|mah|ghz|le|la|les|des|du|de|et|en|avec)\b/gi, '')
    .replace(/\d+/g, '')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, 60);

  // Try Unsplash first, then Pexels
  let sourceUrl = await searchUnsplash(searchQuery);
  let source = 'Unsplash';
  if (!sourceUrl) {
    sourceUrl = await searchPexels(searchQuery);
    source = 'Pexels';
  }

  if (!sourceUrl) {
    console.warn(`  ⚠️  ${label} — no image found, keeping existing`);
    return { sku, status: 'no_image_found' };
  }

  // Download
  let buffer;
  try {
    buffer = await downloadImage(sourceUrl);
  } catch (e) {
    console.warn(`  ⚠️  ${label} — download failed: ${e.message}`);
    return { sku, status: 'download_failed' };
  }

  // Upload to Storage
  const storagePath = `${sku}.jpg`;
  const { error: uploadError } = await supabase.storage
    .from(BUCKET)
    .upload(storagePath, buffer, {
      contentType: 'image/jpeg',
      upsert: true,
    });

  if (uploadError) {
    console.warn(`  ⚠️  ${label} — upload failed: ${uploadError.message}`);
    return { sku, status: 'upload_failed' };
  }

  // Get public URL
  const { data: urlData } = supabase.storage.from(BUCKET).getPublicUrl(storagePath);
  const publicUrl = urlData?.publicUrl;

  if (!publicUrl) {
    console.warn(`  ⚠️  ${label} — publicUrl is null`);
    return { sku, status: 'url_null' };
  }

  // Update product main_image
  const { error: updateError } = await supabase
    .from('products')
    .update({ main_image: publicUrl })
    .eq('id', id);

  if (updateError) {
    console.warn(`  ⚠️  ${label} — DB update failed: ${updateError.message}`);
    return { sku, status: 'db_update_failed' };
  }

  console.log(`  ✅  ${label} — ${source} → ${storagePath}`);
  return { sku, status: 'success', publicUrl };
}

// ── Main ──────────────────────────────────────────────────────────────────────
async function main() {
  console.log('\n🚀 GBA — Product Image Upload Pipeline');
  console.log('==========================================');

  if (!UNSPLASH_KEY && !PEXELS_KEY) {
    console.error('[FATAL] At least one of UNSPLASH_ACCESS_KEY or PEXELS_API_KEY is required.');
    process.exit(1);
  }

  // Fetch all products
  const { data: products, error } = await supabase
    .from('products')
    .select('id, sku, name, main_image')
    .order('sku');

  if (error) {
    console.error('[FATAL] Could not fetch products:', error.message);
    process.exit(1);
  }

  console.log(`\n📦 ${products.length} produits à traiter\n`);

  const results = { success: 0, no_image_found: 0, failed: 0 };

  for (const product of products) {
    const result = await processProduct(product);
    if (result.status === 'success') results.success++;
    else if (result.status === 'no_image_found') results.no_image_found++;
    else results.failed++;

    // Small delay to respect API rate limits
    await new Promise(r => setTimeout(r, 300));
  }

  console.log('\n==========================================');
  console.log(`✅  Succès        : ${results.success}`);
  console.log(`⚠️   Sans image   : ${results.no_image_found}`);
  console.log(`❌  Échecs        : ${results.failed}`);

  // Validation query
  const { data: missing } = await supabase
    .from('products')
    .select('sku, name')
    .is('main_image', null);

  if (missing?.length) {
    console.log(`\n⚠️  Produits sans image après traitement :`);
    missing.forEach(p => console.log(`   - [${p.sku}] ${p.name}`));
  } else {
    console.log('\n🎉 Tous les produits ont une image valide.');
  }
}

main().catch(e => {
  console.error('[FATAL]', e);
  process.exit(1);
});
