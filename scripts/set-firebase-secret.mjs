#!/usr/bin/env node
/**
 * Configure FIREBASE_SERVICE_ACCOUNT (JSON brut ou base64).
 * Usage: node scripts/set-firebase-secret.mjs
 *
 * Méthode 1: écrit un script PowerShell temporaire pour éviter la troncature de la ligne de commande.
 * Méthode 2 (fallback): copie le JSON dans le presse-papiers pour collage dans le Dashboard.
 *
 * Prérequis: supabase CLI installé et lié au projet (npx supabase link)
 */

import { existsSync, readFileSync, writeFileSync, unlinkSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import { spawnSync } from 'child_process';
import { tmpdir } from 'os';

const __dirname = dirname(fileURLToPath(import.meta.url));
const projectRoot = join(__dirname, '..');
const keyPath = join(projectRoot, 'android', 'app', 'globalbusinessamdaradir-fba45-firebase-adminsdk-fbsvc-0b9bbafd71.json');

if (!existsSync(keyPath)) {
  console.error('Fichier clé introuvable:', keyPath);
  process.exit(1);
}

const jsonRaw = readFileSync(keyPath, 'utf8').trim();
const base64url = Buffer.from(jsonRaw, 'utf8').toString('base64')
  .replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');

if (process.platform === 'win32') {
  const psScript = join(tmpdir(), `supabase-firebase-secret-${Date.now()}.ps1`);
  const escaped = base64url.replace(/'/g, "''");
  writeFileSync(psScript, `$env:FIREBASE_SECRET = '${escaped}'\nnpx supabase secrets set FIREBASE_SERVICE_ACCOUNT=$env:FIREBASE_SECRET\n`, 'utf8');
  const result = spawnSync('powershell', ['-NoProfile', '-ExecutionPolicy', 'Bypass', '-File', psScript], {
    stdio: 'inherit',
    cwd: projectRoot,
  });
  try { unlinkSync(psScript); } catch {}
  if (result.status !== 0) {
    console.error('\nSi le secret reste invalide, utilisez le Dashboard :');
    console.error('  1. Ouvrez android/app/globalbusinessamdaradir-fba45-firebase-adminsdk-fbsvc-0b9bbafd71.json');
    console.error('  2. Copiez tout le contenu (Ctrl+A, Ctrl+C)');
    console.error('  3. Supabase Dashboard > Project Settings > Edge Functions > Secrets > FIREBASE_SERVICE_ACCOUNT');
    console.error('  4. Collez et enregistrez.');
    process.exit(1);
  }
} else {
  const result = spawnSync(`npx supabase secrets set FIREBASE_SERVICE_ACCOUNT=${base64url}`, [], {
    stdio: 'inherit',
    shell: true,
    cwd: projectRoot,
  });
  if (result.status !== 0) process.exit(1);
}

console.log('Secret défini. Redéployez la fonction :');
console.log('  npx supabase functions deploy send-push-notification');
