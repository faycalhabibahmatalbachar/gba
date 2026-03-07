# Supabase Email Templates - Configuration

## 📧 Templates personnalisés pour GBA

### Configuration
**Supabase Dashboard → Authentication → Email Templates**

---

## 1. Invite User Template

**Subject:** `Bienvenue sur GBA !`

**Body (HTML):**
```html
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <style>
    body {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Arial, sans-serif;
      background-color: #f5f5f5;
      margin: 0;
      padding: 20px;
    }
    .container {
      max-width: 600px;
      margin: 0 auto;
      background: white;
      border-radius: 16px;
      overflow: hidden;
      box-shadow: 0 10px 40px rgba(0,0,0,0.1);
    }
    .header {
      background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
      padding: 40px 20px;
      text-align: center;
    }
    .header h1 {
      color: white;
      margin: 0;
      font-size: 28px;
      font-weight: 900;
    }
    .content {
      padding: 40px 30px;
      line-height: 1.6;
    }
    .button {
      display: inline-block;
      background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
      color: white;
      padding: 14px 32px;
      text-decoration: none;
      border-radius: 10px;
      font-weight: bold;
      box-shadow: 0 4px 15px rgba(102, 126, 234, 0.4);
    }
    .footer {
      padding: 20px;
      text-align: center;
      color: #666;
      font-size: 12px;
    }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <h1>Bienvenue sur GBA !</h1>
    </div>
    <div class="content">
      <p>Bonjour,</p>
      <p>Vous avez été invité à rejoindre notre plateforme e-commerce GBA.</p>
      <p>Cliquez sur le bouton ci-dessous pour accepter l'invitation et créer votre compte :</p>
      <p style="text-align: center; margin: 30px 0;">
        <a href="{{ .ConfirmationURL }}" class="button">Accepter l'invitation</a>
      </p>
      <p>Si vous n'avez pas demandé cette invitation, vous pouvez ignorer cet email.</p>
    </div>
    <div class="footer">
      <p>&copy; 2026 GBA - Global Business Amdaradir. Tous droits réservés.</p>
    </div>
  </div>
</body>
</html>
```

---

## 2. Reset Password Template

**Subject:** `Réinitialisation de votre mot de passe GBA`

**Body (HTML):**
```html
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <style>
    body {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Arial, sans-serif;
      background-color: #f5f5f5;
      margin: 0;
      padding: 20px;
    }
    .container {
      max-width: 600px;
      margin: 0 auto;
      background: white;
      border-radius: 16px;
      overflow: hidden;
      box-shadow: 0 10px 40px rgba(0,0,0,0.1);
    }
    .header {
      background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
      padding: 40px 20px;
      text-align: center;
    }
    .header h1 {
      color: white;
      margin: 0;
      font-size: 28px;
      font-weight: 900;
    }
    .content {
      padding: 40px 30px;
      line-height: 1.6;
    }
    .button {
      display: inline-block;
      background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
      color: white;
      padding: 14px 32px;
      text-decoration: none;
      border-radius: 10px;
      font-weight: bold;
      box-shadow: 0 4px 15px rgba(102, 126, 234, 0.4);
    }
    .warning {
      background: #fff3cd;
      border-left: 4px solid #ffc107;
      padding: 12px;
      margin: 20px 0;
      border-radius: 4px;
    }
    .footer {
      padding: 20px;
      text-align: center;
      color: #666;
      font-size: 12px;
    }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <h1>Réinitialisation mot de passe</h1>
    </div>
    <div class="content">
      <p>Bonjour,</p>
      <p>Vous avez demandé la réinitialisation de votre mot de passe GBA.</p>
      <p>Cliquez sur le bouton ci-dessous pour définir un nouveau mot de passe :</p>
      <p style="text-align: center; margin: 30px 0;">
        <a href="{{ .ConfirmationURL }}" class="button">Réinitialiser le mot de passe</a>
      </p>
      <div class="warning">
        <strong>⚠️ Sécurité :</strong> Si vous n'avez pas demandé cette réinitialisation, ignorez cet email et votre mot de passe restera inchangé.
      </div>
      <p style="color: #666; font-size: 13px;">Ce lien expire dans 1 heure pour votre sécurité.</p>
    </div>
    <div class="footer">
      <p>&copy; 2026 GBA - Global Business Amdaradir. Tous droits réservés.</p>
    </div>
  </div>
</body>
</html>
```

---

## 3. Email Confirmation Template

**Subject:** `Confirmez votre adresse email GBA`

**Body (HTML):**
```html
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <style>
    body {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Arial, sans-serif;
      background-color: #f5f5f5;
      margin: 0;
      padding: 20px;
    }
    .container {
      max-width: 600px;
      margin: 0 auto;
      background: white;
      border-radius: 16px;
      overflow: hidden;
      box-shadow: 0 10px 40px rgba(0,0,0,0.1);
    }
    .header {
      background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
      padding: 40px 20px;
      text-align: center;
    }
    .header h1 {
      color: white;
      margin: 0;
      font-size: 28px;
      font-weight: 900;
    }
    .content {
      padding: 40px 30px;
      line-height: 1.6;
    }
    .button {
      display: inline-block;
      background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
      color: white;
      padding: 14px 32px;
      text-decoration: none;
      border-radius: 10px;
      font-weight: bold;
      box-shadow: 0 4px 15px rgba(102, 126, 234, 0.4);
    }
    .footer {
      padding: 20px;
      text-align: center;
      color: #666;
      font-size: 12px;
    }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <h1>Confirmez votre email</h1>
    </div>
    <div class="content">
      <p>Bonjour,</p>
      <p>Merci de vous être inscrit sur GBA !</p>
      <p>Pour activer votre compte, veuillez confirmer votre adresse email en cliquant sur le bouton ci-dessous :</p>
      <p style="text-align: center; margin: 30px 0;">
        <a href="{{ .ConfirmationURL }}" class="button">Confirmer mon email</a>
      </p>
      <p style="color: #666; font-size: 13px;">Ce lien expire dans 24 heures.</p>
    </div>
    <div class="footer">
      <p>&copy; 2026 GBA - Global Business Amdaradir. Tous droits réservés.</p>
    </div>
  </div>
</body>
</html>
```

---

## 📝 Instructions d'application

1. Aller dans **Supabase Dashboard**
2. **Authentication** → **Email Templates**
3. Sélectionner chaque template (Invite, Reset Password, Confirm Email)
4. Copier/coller le HTML correspondant
5. Tester avec "Send test email"
6. Sauvegarder

---

## 🎨 Personnalisation

### Couleurs GBA:
- Primary: `#667eea`
- Secondary: `#764ba2`
- Gradient: `linear-gradient(135deg, #667eea 0%, #764ba2 100%)`

### Logo (optionnel):
Ajouter dans header:
```html
<img src="URL_LOGO_GBA" alt="GBA" style="width: 120px; margin-bottom: 20px;">
```

---

**Dernière mise à jour:** 7 Mars 2026
