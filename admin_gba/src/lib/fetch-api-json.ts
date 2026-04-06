/**
 * Parse une réponse `fetch` attendue JSON. Évite l'erreur
 * "Unexpected token '<' ... is not valid JSON" quand le serveur renvoie une page HTML (login, 404, erreur Next).
 */
export async function parseApiJson<T = unknown>(r: Response): Promise<T> {
  const text = await r.text();
  const ct = (r.headers.get('content-type') || '').toLowerCase();

  if (!text) {
    if (!r.ok) throw new Error(`HTTP ${r.status}`);
    return {} as T;
  }

  const trim = text.trimStart();
  if (trim.startsWith('<!') || trim.startsWith('<html') || trim.toLowerCase().startsWith('<!doctype')) {
    if (r.status === 401 || r.status === 403) {
      throw new Error('Session expirée ou accès refusé. Reconnectez-vous.');
    }
    throw new Error(
      `Réponse HTML au lieu de JSON (HTTP ${r.status}). Vérifiez l’URL de l’API ou les logs serveur.`,
    );
  }

  if (ct.includes('application/json') || trim.startsWith('{') || trim.startsWith('[')) {
    try {
      return JSON.parse(text) as T;
    } catch {
      throw new Error('Réponse JSON invalide du serveur.');
    }
  }

  try {
    return JSON.parse(text) as T;
  } catch {
    throw new Error(text.slice(0, 240) || `HTTP ${r.status}`);
  }
}
