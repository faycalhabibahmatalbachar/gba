# Supabase Auth — Production (prod uniquement)

Toutes les redirections auth utilisent l’URL de prod : **https://globalbusinessamdaradir.vercel.app** (aucun localhost).

## 1. Redirect URLs (Supabase Dashboard → Authentication → URL Configuration)

À ajouter dans **Redirect URLs** :

```
https://globalbusinessamdaradir.vercel.app/#/reset-password
https://globalbusinessamdaradir.vercel.app/#/otp
https://globalbusinessamdaradir.vercel.app/**
```

**Site URL** : `https://globalbusinessamdaradir.vercel.app`

## 2. Email Templates

### Confirm sign up
- **Lien uniquement** : garder `{{ .ConfirmationURL }}` — l’utilisateur clique et est confirmé.
- **OTP en plus** : afficher le code à 6 chiffres pour saisie sur `/otp?email=...&mode=register` :
```html
<h2>Confirm your signup</h2>
<p>Your code: <strong>{{ .Token }}</strong></p>
<p>Or follow this link:</p>
<p><a href="{{ .ConfirmationURL }}">Confirm your mail</a></p>
```

### Magic link
Lien de connexion sans mot de passe. Redirection gérée par `detectSessionInUri`.

### Reset password
Lien de réinitialisation. Redirection vers `/#/reset-password` ; l’app échange le code et affiche le formulaire nouveau mot de passe.

### Change email address
Après changement d’email, l’utilisateur reçoit un lien. Redirection vers l’app ; session mise à jour par Supabase.

### Invite user
L’invité reçoit un lien ; en cliquant il accepte l’invite et est redirigé vers l’app.

### Reauthentication
Template avec code : `Enter the code: {{ .Token }}`.  
Pour une action sensible, rediriger l’utilisateur vers `/otp?email=...&type=email` (ou le type approprié) pour saisir le code.

## 3. Routes app utilisées

| Flux              | Route / paramètres                    |
|-------------------|---------------------------------------|
| OTP email signup  | `/otp?email=...&mode=register`        |
| OTP email recovery| `/otp?email=...&type=recovery`        |
| OTP email change  | `/otp?email=...&type=email_change`    |
| OTP invite        | `/otp?email=...&type=invite`          |
| OTP magic link    | `/otp?email=...&type=magiclink`       |
| Reset password    | `/#/reset-password` (avec `?code=...` si PKCE) |

## 4. Config app (prod)

- `AppConfig.authRedirectBaseUrl` = `https://globalbusinessamdaradir.vercel.app` (utilisé pour reset password et tout redirect auth).
- Aucune URL de dev (localhost) n’est utilisée pour les redirections auth.
