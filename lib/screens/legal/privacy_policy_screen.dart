import 'package:flutter/material.dart';

class PrivacyPolicyScreen extends StatelessWidget {
  const PrivacyPolicyScreen({super.key});

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);

    return Scaffold(
      appBar: AppBar(
        title: const Text('Politique de confidentialité'),
      ),
      body: SafeArea(
        child: SingleChildScrollView(
          padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 24),
          child: Center(
            child: ConstrainedBox(
              constraints: const BoxConstraints(maxWidth: 900),
              child: Card(
                child: Padding(
                  padding: const EdgeInsets.all(24),
                  child: SelectionArea(
                    child: DefaultTextStyle(
                      style: theme.textTheme.bodyMedium ?? const TextStyle(),
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          Text(
                            '1. Données collectées',
                            style: theme.textTheme.titleMedium?.copyWith(fontWeight: FontWeight.bold),
                          ),
                          const SizedBox(height: 8),
                          const Text(
                            "Nous collectons les informations nécessaires pour créer votre compte, traiter vos commandes et améliorer l'expérience (ex: email, nom, téléphone, adresses).",
                          ),
                          const SizedBox(height: 16),
                          Text(
                            '2. Utilisation des données',
                            style: theme.textTheme.titleMedium?.copyWith(fontWeight: FontWeight.bold),
                          ),
                          const SizedBox(height: 8),
                          const Text(
                            'Les données sont utilisées pour: authentification, livraison, support client, statistiques, prévention de fraude.',
                          ),
                          const SizedBox(height: 8),
                          const Text(
                            "Si vous utilisez la fonctionnalité de géolocalisation pour la livraison, nous pouvons traiter votre position uniquement pour faciliter la livraison. La localisation n'est demandée qu'après une action explicite (ex: bouton \"Utiliser ma position\") lors du passage d'une commande ou d'une commande spéciale, et n'est pas collectée en arrière-plan.",
                          ),
                          const SizedBox(height: 16),
                          Text(
                            '3. Notifications',
                            style: theme.textTheme.titleMedium?.copyWith(fontWeight: FontWeight.bold),
                          ),
                          const SizedBox(height: 8),
                          const Text(
                            "Si vous activez les notifications, l'application peut utiliser un identifiant de notification (token) afin de vous envoyer des messages (statut commande, promotions).",
                          ),
                          const SizedBox(height: 16),
                          Text(
                            '4. Partage',
                            style: theme.textTheme.titleMedium?.copyWith(fontWeight: FontWeight.bold),
                          ),
                          const SizedBox(height: 8),
                          const Text(
                            "Nous ne vendons pas vos données. Certains services techniques (ex: authentification, base de données) peuvent traiter des données pour fournir le service.",
                          ),
                          const SizedBox(height: 16),
                          Text(
                            '5. Vos droits',
                            style: theme.textTheme.titleMedium?.copyWith(fontWeight: FontWeight.bold),
                          ),
                          const SizedBox(height: 8),
                          const Text(
                            "Vous pouvez demander l'accès, la correction ou la suppression de vos données selon la réglementation applicable.",
                          ),
                        ],
                      ),
                    ),
                  ),
                ),
              ),
            ),
          ),
        ),
      ),
    );
  }
}
