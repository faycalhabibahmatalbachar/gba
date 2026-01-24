import 'package:flutter/material.dart';
import 'package:provider/provider.dart';

import '../../providers/notification_preferences_provider.dart';

class NotificationPreferencesScreen extends StatelessWidget {
  const NotificationPreferencesScreen({super.key});

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);

    return Consumer<NotificationPreferencesProvider>(
      builder: (context, prefs, _) {
        return Scaffold(
          appBar: AppBar(
            title: const Text('Préférences notifications'),
          ),
          body: SafeArea(
            child: LayoutBuilder(
              builder: (context, constraints) {
                final maxWidth = constraints.maxWidth < 720 ? constraints.maxWidth : 680.0;

                return SingleChildScrollView(
                  padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 24),
                  child: Center(
                    child: ConstrainedBox(
                      constraints: BoxConstraints(maxWidth: maxWidth),
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.stretch,
                        children: [
                          Card(
                            child: SwitchListTile(
                              title: const Text('Notifications push'),
                              subtitle: const Text('Activer/Désactiver toutes les notifications'),
                              value: prefs.pushEnabled,
                              onChanged: prefs.setPushEnabled,
                            ),
                          ),
                          const SizedBox(height: 16),
                          Card(
                            child: Column(
                              crossAxisAlignment: CrossAxisAlignment.start,
                              children: [
                                Padding(
                                  padding: const EdgeInsets.fromLTRB(16, 16, 16, 8),
                                  child: Text(
                                    'Catégories',
                                    style: theme.textTheme.titleMedium?.copyWith(fontWeight: FontWeight.bold),
                                  ),
                                ),
                                const Divider(height: 1),
                                SwitchListTile(
                                  title: const Text('Commandes'),
                                  subtitle: const Text('Statut de commande, livraison, annulation'),
                                  value: prefs.ordersEnabled,
                                  onChanged: prefs.pushEnabled ? prefs.setOrdersEnabled : null,
                                ),
                                const Divider(height: 1),
                                SwitchListTile(
                                  title: const Text('Promotions'),
                                  subtitle: const Text('Offres, réductions, nouveautés'),
                                  value: prefs.promotionsEnabled,
                                  onChanged: prefs.pushEnabled ? prefs.setPromotionsEnabled : null,
                                ),
                                const Divider(height: 1),
                                SwitchListTile(
                                  title: const Text('Messages'),
                                  subtitle: const Text('Nouveaux messages support / chat'),
                                  value: prefs.chatEnabled,
                                  onChanged: prefs.pushEnabled ? prefs.setChatEnabled : null,
                                ),
                              ],
                            ),
                          ),
                        ],
                      ),
                    ),
                  ),
                );
              },
            ),
          ),
        );
      },
    );
  }
}
