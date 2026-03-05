/**
 * validate_product_images.mjs
 * Valide toutes les images produits :
 *   - HTTP 200
 *   - Content-Type: image/*
 *   - Content-Length > 10 KB (10 240 bytes)
 * Nullifie main_image des produits dont l'image est invalide.
 *
 * Usage :
 *   node validate_product_images.mjs              # mode réel
 *   node validate_product_images.mjs --dry-run    # simulation sans modification
 */

import { createClient } from '@supabase/supabase-js';
import { readFileSync } from 'fs';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));

// ─── Config ──────────────────────────────────────────────────────────────────
const DRY_RUN    = process.argv.includes('--dry-run');
const CONCURRENCY = 5;
const TIMEOUT_MS  = 8_000;
const MIN_BYTES   = 10_240;

// Charger variables depuis ../.env si présent
let envUrl, envKey;
try {
  const envPath = resolve(__dirname, '../.env');
  const lines = readFileSync(envPath, 'utf8').split('\n');
  for (const line of lines) {
    const [k, ...v] = line.split('=');
    if (k?.trim() === 'SUPABASE_URL' || k?.trim() === 'VITE_SUPABASE_URL')
      envUrl = v.join('=').trim().replace(/^"|"$/g, '');
    if (k?.trim() === 'SUPABASE_SERVICE_ROLE_KEY')
      envKey = v.join('=').trim().replace(/^"|"$/g, '');
  }
} catch { /* .env optionnel */ }

const SUPABASE_URL = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL || envUrl;
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || envKey;

if (!SUPABASE_URL || !SUPABASE_KEY) {
  console.error('[!] SUPABASE_URL et SUPABASE_SERVICE_ROLE_KEY requis');
  console.error('    Définir dans .env ou en variables d\'environnement');
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

// ─── Validation d'une URL ─────────────────────────────────────────────────────
async function validateImageUrl(url) {
  if (!url || typeof url !== 'string' || !url.startsWith('http')) {
    return { valid: false, reason: 'URL invalide ou vide' };
  }
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
  try {
    const res = await fetch(url, {
      method: 'HEAD',
      signal: controller.signal,
      redirect: 'follow',
    });
    clearTimeout(timer);

    if (res.status !== 200) {
      return { valid: false, reason: `HTTP ${res.status}` };
    }

    const ct = (res.headers.get('content-type') || '').toLowerCase();
    if (!ct.startsWith('image/')) {
      // Retenter avec GET pour les CDN qui ne renvoient pas de headers sur HEAD
      const resGet = await fetch(url, {
        method: 'GET',
        signal: AbortSignal.timeout(TIMEOUT_MS),
        redirect: 'follow',
        headers: { Range: 'bytes=0-16383' },
      });
      clearTimeout(timer);
      const ctGet = (resGet.headers.get('content-type') || '').toLowerCase();
      if (!ctGet.startsWith('image/')) {
        return { valid: false, reason: `Content-Type invalide: ${ctGet || 'absent'}` };
      }
      const cl = parseInt(resGet.headers.get('content-length') || '0', 10);
      if (cl > 0 && cl < MIN_BYTES) {
        return { valid: false, reason: `Trop petite: ${cl} bytes < ${MIN_BYTES}` };
      }
      return { valid: true };
    }

    const cl = parseInt(res.headers.get('content-length') || '0', 10);
    if (cl > 0 && cl < MIN_BYTES) {
      return { valid: false, reason: `Trop petite: ${cl} bytes < ${MIN_BYTES}` };
    }
    return { valid: true };
  } catch (err) {
    clearTimeout(timer);
    if (err.name === 'AbortError') return { valid: false, reason: 'Timeout' };
    return { valid: false, reason: `Erreur réseau: ${err.message}` };
  }
}

// ─── Traitement par batch ─────────────────────────────────────────────────────
async function processInBatches(items, fn, concurrency) {
  const results = [];
  for (let i = 0; i < items.length; i += concurrency) {
    const batch = items.slice(i, i + concurrency);
    const batchResults = await Promise.all(batch.map(fn));
    results.push(...batchResults);
    process.stdout.write(`\r  Progression: ${Math.min(i + concurrency, items.length)}/${items.length}   `);
  }
  process.stdout.write('\n');
  return results;
}

// ─── Main ─────────────────────────────────────────────────────────────────────
async function main() {
  console.log(`\n═══════════════════════════════════════════════`);
  console.log(`  Validation images produits GBA`);
  console.log(`  Mode: ${DRY_RUN ? '🔵 DRY-RUN (aucune modification)' : '🔴 RÉEL (modifications appliquées)'}`);
  console.log(`═══════════════════════════════════════════════\n`);

  // 1. Récupérer tous les produits avec main_image non-null
  console.log('📦 Chargement des produits...');
  const { data: products, error } = await supabase
    .from('products')
    .select('id, name, main_image')
    .not('main_image', 'is', null)
    .order('created_at', { ascending: false });

  if (error) {
    console.error('[!] Erreur chargement produits:', error.message);
    process.exit(1);
  }

  console.log(`    → ${products.length} produits avec main_image\n`);

  if (products.length === 0) {
    console.log('✅ Aucun produit à valider.');
    return;
  }

  // 2. Valider chaque image
  console.log('🔍 Validation des URLs...');
  const results = await processInBatches(
    products,
    async (product) => {
      const { valid, reason } = await validateImageUrl(product.main_image);
      return { ...product, valid, reason };
    },
    CONCURRENCY
  );

  // 3. Rapport
  const valid   = results.filter(r => r.valid);
  const invalid = results.filter(r => !r.valid);

  console.log(`\n📊 Résultats :`);
  console.log(`   ✅ Valides   : ${valid.length}`);
  console.log(`   ❌ Invalides : ${invalid.length}`);

  if (invalid.length > 0) {
    console.log('\n   Détail des images invalides :');
    invalid.forEach(r => {
      console.log(`   - [${r.id.slice(0, 8)}] "${r.name?.slice(0, 40) || 'sans nom'}" → ${r.reason}`);
    });
  }

  // 4. Appliquer les corrections
  if (!DRY_RUN && invalid.length > 0) {
    console.log(`\n🔧 Nullification de ${invalid.length} images invalides...`);
    const ids = invalid.map(r => r.id);
    const { error: updateError } = await supabase
      .from('products')
      .update({ main_image: null, updated_at: new Date().toISOString() })
      .in('id', ids);

    if (updateError) {
      console.error('[!] Erreur mise à jour:', updateError.message);
    } else {
      console.log(`✅ ${invalid.length} images nullifiées avec succès.`);
    }
  } else if (DRY_RUN && invalid.length > 0) {
    console.log(`\n🔵 DRY-RUN : ${invalid.length} images auraient été nullifiées.`);
    console.log('   Relancer sans --dry-run pour appliquer.');
  }

  console.log(`\n═══════════════════════════════════════════════\n`);
}

main().catch(err => {
  console.error('[!] Erreur fatale:', err);
  process.exit(1);
});
