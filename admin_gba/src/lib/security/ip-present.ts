/** Étiquettes IP pour l’UI admin (pas d’IP nue sans contexte). */
export function labelIpKind(ip: string | null | undefined): {
  kind: 'localhost' | 'lan' | 'public' | 'empty';
  label: string;
} {
  const s = (ip || '').trim();
  if (!s) return { kind: 'empty', label: 'IP inconnue' };
  if (s === '127.0.0.1' || s === '::1' || s === 'localhost') {
    return { kind: 'localhost', label: 'Localhost (développement)' };
  }
  if (s.startsWith('::ffff:')) {
    const inner = s.slice(7);
    if (/^192\.168\./.test(inner) || /^10\./.test(inner) || /^172\.(1[6-9]|2\d|3[01])\./.test(inner)) {
      return { kind: 'lan', label: 'Réseau local' };
    }
  }
  if (/^192\.168\./.test(s) || /^10\./.test(s) || /^172\.(1[6-9]|2\d|3[01])\./.test(s)) {
    return { kind: 'lan', label: 'Réseau local' };
  }
  return { kind: 'public', label: s };
}
