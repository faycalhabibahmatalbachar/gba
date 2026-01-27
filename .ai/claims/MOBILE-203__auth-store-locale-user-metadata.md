Owner: AI_CASCADE
Status: completed
Scope: flutter
Files (prévu):
- lib/providers/auth_provider.dart
- lib/screens/register_screen.dart
- lib/providers/language_provider.dart

Branch (si Git): feature/auth-store-locale

Definition of Done:
- Lors du `signUp`, le `locale` courant est stocké dans `auth.users.user_metadata` (clé: `locale`)
- Les templates email Supabase peuvent utiliser `{{ .Data.locale }}` pour choisir la langue
- Commandes: `flutter analyze` passe
