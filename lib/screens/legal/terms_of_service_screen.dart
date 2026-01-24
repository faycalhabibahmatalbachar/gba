import 'package:flutter/material.dart';

class TermsOfServiceScreen extends StatelessWidget {
  const TermsOfServiceScreen({super.key});

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);

    return Scaffold(
      appBar: AppBar(
        title: const Text("Conditions d'utilisation"),
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
                            '1. Objet',
                            style: theme.textTheme.titleMedium?.copyWith(fontWeight: FontWeight.bold),
                          ),
                          const SizedBox(height: 8),
                          const Text(
                            "Les présentes conditions définissent les règles d'utilisation de l'application et des services associés.",
                          ),
                          const SizedBox(height: 16),
                          Text(
                            '2. Compte utilisateur',
                            style: theme.textTheme.titleMedium?.copyWith(fontWeight: FontWeight.bold),
                          ),
                          const SizedBox(height: 8),
                          const Text(
                            "Vous êtes responsable de la confidentialité de vos identifiants et de l'utilisation de votre compte.",
                          ),
                          const SizedBox(height: 16),
                          Text(
                            '3. Commandes et paiement',
                            style: theme.textTheme.titleMedium?.copyWith(fontWeight: FontWeight.bold),
                          ),
                          const SizedBox(height: 8),
                          const Text(
                            "Les commandes sont soumises à disponibilité. Les prix et frais peuvent changer. Le paiement peut être traité par un prestataire.",
                          ),
                          const SizedBox(height: 16),
                          Text(
                            '4. Livraison',
                            style: theme.textTheme.titleMedium?.copyWith(fontWeight: FontWeight.bold),
                          ),
                          const SizedBox(height: 8),
                          const Text(
                            "Les délais de livraison sont indicatifs. Assurez-vous de fournir une adresse correcte.",
                          ),
                          const SizedBox(height: 8),
                          const Text(
                            "Si vous choisissez d'utiliser la fonctionnalité de géolocalisation, votre position peut être utilisée uniquement pour faciliter la livraison. La localisation n'est demandée qu'après une action explicite (ex: bouton \"Utiliser ma position\") lors du passage d'une commande ou d'une commande spéciale, et n'est pas collectée en arrière-plan.",
                          ),
                          const SizedBox(height: 16),
                          Text(
                            '5. Support',
                            style: theme.textTheme.titleMedium?.copyWith(fontWeight: FontWeight.bold),
                          ),
                          const SizedBox(height: 8),
                          const Text(
                            "Pour toute question, contactez le support via les canaux disponibles dans l'application.",
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
