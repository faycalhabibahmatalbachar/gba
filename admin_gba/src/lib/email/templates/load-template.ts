import fs from 'fs';
import path from 'path';
import type { EmailTemplateId } from './registry';
import { templateFileName } from './registry';

const dir = path.join(process.cwd(), 'src', 'lib', 'email', 'templates', 'html');

/** Charge le HTML brut d’un template (serveur uniquement). */
export function loadEmailTemplateHtml(id: EmailTemplateId): string {
  const file = path.join(dir, templateFileName(id));
  return fs.readFileSync(file, 'utf8');
}

/** Remplace {{clé}} par les valeurs fournies (simple). */
export function interpolateTemplate(html: string, vars: Record<string, string>): string {
  let out = html;
  for (const [k, v] of Object.entries(vars)) {
    out = out.split(`{{${k}}}`).join(v);
  }
  return out;
}
