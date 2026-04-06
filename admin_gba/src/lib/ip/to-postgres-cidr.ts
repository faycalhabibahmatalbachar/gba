import ipaddr from 'ipaddr.js';

function normalizeInput(input: string): string {
  return input.replace(/\uFEFF/g, '').replace(/\r/g, '').trim();
}

/**
 * Normalise une IP seule ou un CIDR pour colonne PostgreSQL `cidr`.
 * Gère espaces, fin de ligne Windows, IPv4/IPv6, préfixes invalides.
 */
export function toPostgresCidr(input: string): string {
  const raw = normalizeInput(input);
  if (!raw) throw new Error('IP vide');

  const lower = raw.toLowerCase();

  if (lower.includes('/')) {
    try {
      if (ipaddr.isValidCIDR(raw)) {
        const ref = ipaddr.parseCIDR(raw);
        const network = ref[0];
        const prefix = ref[1];
        return `${network.toString()}/${prefix}`;
      }
    } catch {
      /* fall through */
    }
    throw new Error('CIDR invalide');
  }

  try {
    const a = ipaddr.parse(raw);
    if (a.kind() === 'ipv4') return `${a.toString()}/32`;
    return `${a.toString()}/128`;
  } catch {
    throw new Error('Adresse IP invalide');
  }
}
