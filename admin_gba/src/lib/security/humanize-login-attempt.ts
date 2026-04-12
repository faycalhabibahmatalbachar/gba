/** Libellés humains pour tentatives de connexion (jamais "OK" / "Échec" seuls). */
export function humanizeLoginResult(success: boolean, userAgent?: string | null): string {
  if (success) return 'Connexion réussie';
  const ua = (userAgent || '').toLowerCase();
  if (/blocked|block|blacklist|denied/i.test(ua)) return 'Échec — accès refusé (IP ou politique)';
  return 'Échec — identifiants incorrects ou compte indisponible';
}
