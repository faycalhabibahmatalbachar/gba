# Page /email-logs — Journal des emails GBA

## Vue d'ensemble
Centre de gestion et traçabilité des emails envoyés par la plateforme GBA.
Tous les emails (transactionnels, sécurité, notifications, invitations) sont
tracés dans la table email_logs avec leur statut d'envoi.

## Fonctionnalités implémentées

### 1. Tableau de bord statut configuration
- Détection automatique du provider actif (Resend / SMTP / Non configuré)
- Bandeau d'état coloré (vert=ok, rouge=manquant)
- Bouton "Tester la configuration" → envoi email test à l'admin connecté
- Instructions de configuration inline si provider manquant

### 2. Journal des emails (DataTable)
Colonnes :
- Type d'email (badge coloré) : security_alert / invitation / notification /
  password_reset / order_confirmation / transactionnel / système
- Destinataire(s) : email(s) avec avatar si utilisateur connu
- Sujet : objet de l'email
- Date/heure d'envoi
- Statut : sent (vert) / failed (rouge) / pending (amber) / bounced (orange)
- Provider utilisé : Resend / SMTP / Mock
- Latence : temps d'envoi en ms
- Actions : Voir détail / Renvoyer / Voir template

### 3. Filtres avancés
- Type d'email (multi-select)
- Statut (multi-select)
- Destinataire (recherche)
- Plage de dates
- Provider
- Succès / Échec uniquement

### 4. Détail d'un email (Drawer)
- En-tête : type + statut + timestamp
- Destinataires complets
- Sujet
- Corps HTML de l'email (preview iframe sandboxed)
- Headers techniques (Message-ID, provider response)
- Erreur complète si failed
- Bouton "Renvoyer cet email"

### 5. Upload pièce jointe email (NOUVEAU)
- Zone upload fichier (image JPG/PNG/PDF)
- Upload vers Supabase Storage bucket "email-attachments"
- Sélection dans le composer d'email pour joindre aux envois manuels

### 6. Composer email manuel
- Destinataire (recherche utilisateur ou saisie libre)
- Sujet
- Corps (éditeur rich-text basique)
- Pièces jointes (depuis galerie Storage ou upload direct)
- Prévisualisation avant envoi
- Envoi via POST /api/admin/send-email

### 7. Templates d'emails
- Liste des templates existants (sécurité, invitation, commande...)
- Prévisualisation HTML de chaque template
- Test d'envoi d'un template spécifique

### 8. Statistiques
- Total emails ce mois
- Taux de succès %
- Emails échoués (avec alerte si > 0)
- Répartition par type (donut chart)
- Volume par jour (line chart 30j)

### 9. Configuration email
- Formulaire SMTP (host/port/user/pass) avec test de connexion
- Champ RESEND_API_KEY (masqué, bouton révéler)
- Bouton "Sauvegarder dans .env" (écrit dans settings table)
- Indicateur de santé en temps réel

## Routes BFF associées
- GET /api/email-logs — liste paginée avec filtres
- GET /api/email-logs/[id] — détail complet
- POST /api/email-logs/[id]/resend — renvoyer
- POST /api/admin/send-email — envoi manuel
- POST /api/admin/test-email — test configuration
- GET /api/email-logs/stats — métriques agrégées
- POST /api/email-logs/upload-attachment — upload Storage

## Tables Supabase utilisées
- email_logs (id, type, recipients, subject, body_html, status,
  provider, latency_ms, error_message, metadata, created_at,
  created_by, attachments)
- settings (key='email_config' pour SMTP stocké chiffré)
