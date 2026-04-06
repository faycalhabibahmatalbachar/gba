/** Extrait bucket + chemin objet depuis une URL publique Supabase Storage. */
export function storageRefFromPublicUrl(url: string): { bucket: string; path: string } | null {
  try {
    const u = new URL(url);
    const m = u.pathname.match(/\/storage\/v1\/object\/public\/([^/]+)\/(.+)$/);
    if (!m) return null;
    return { bucket: m[1], path: decodeURIComponent(m[2]) };
  } catch {
    return null;
  }
}

export function collectUrlsFromChatAttachments(raw: unknown, imageUrl: string | null | undefined): string[] {
  const urls: string[] = [];
  if (imageUrl && typeof imageUrl === 'string' && imageUrl.startsWith('http')) urls.push(imageUrl);
  if (raw == null) return urls;
  try {
    const arr = Array.isArray(raw) ? raw : typeof raw === 'string' ? JSON.parse(raw) : null;
    if (!Array.isArray(arr)) return urls;
    for (const item of arr) {
      if (item && typeof item === 'object' && 'url' in item && typeof (item as { url: unknown }).url === 'string') {
        const u = (item as { url: string }).url;
        if (u.startsWith('http')) urls.push(u);
      }
    }
  } catch {
    /* ignore */
  }
  return urls;
}
