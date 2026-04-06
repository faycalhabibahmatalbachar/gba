# Reprise après verrouillage d’urgence (lockdown)

Si l’admin affiche « Verrouillage d’urgence actif » ou si les IPs sont bloquées après un **full lockdown**, vous pouvez rétablir l’accès depuis **Supabase SQL** (projet concerné).

## 1. Désactiver le drapeau lockdown

```sql
UPDATE public.settings
SET value = jsonb_build_object('active', false, 'cleared_at', now()::text)
WHERE key = 'security_emergency_lockdown';
```

Ou supprimer / remettre une valeur inactive selon votre convention.

## 2. Relâcher la liste blanche IP d’urgence

Le middleware fusionne `ip_whitelist` (CIDR) et `emergency_allowlist_ips` (JSON dans `security_access`) lorsque `enforce_ip_allowlist` est actif.

```sql
UPDATE public.settings
SET value = value || jsonb_build_object(
  'enforce_ip_allowlist', false,
  'emergency_allowlist_ips', '[]'::jsonb
)
WHERE key = 'security_access';
```

Ajustez si votre ligne `security_access` n’existe pas encore (INSERT minimal avec les clés attendues par l’app).

## 3. Comptes suspendus par full lockdown

Le **full lockdown** suspend uniquement les profils `role = 'admin'`. Les **superadmin** ne sont pas suspendus par cette requête.

Pour réactiver un admin :

```sql
UPDATE public.profiles
SET is_suspended = false, suspended_at = null, suspended_by = null, suspension_reason = null
WHERE role = 'admin' AND is_suspended = true;
```

## 4. Superadmin qui ne passe pas la gate

- Vérifier `profiles.role` = `superadmin` pour l’utilisateur.
- Après bootstrap ou changement de rôle, **se déconnecter / se reconnecter** pour rafraîchir le JWT.
- Les routes API mettent à jour `app_metadata.role` lorsque le service role est disponible (`bootstrap-superadmin`, PATCH utilisateur avec changement de rôle).

## 5. Emails d’alerte

Sans `RESEND_API_KEY`, les alertes sont journalisées en échec dans `email_logs`. Configurez la clé sur l’hébergeur (ex. Vercel) et redéployez.
