Owner: AI_CASCADE
Status: completed
Scope: flutter
Files (prévu):
- lib/services/notification_service.dart
- lib/localization/app_localizations.dart

Branch (si Git): feature/mobile-push-templates-i18n

Definition of Done:
- Les templates `order_status`, `cart_abandoned`, `promotion` affichent titre+body en fonction de la langue (fr/en/ar)
- Aucun texte de template push n'est hardcodé uniquement en FR
- Fallback propre si locale inconnue
- Commandes: `flutter analyze` passe
