import 'package:flutter/material.dart';
import 'package:provider/provider.dart';

import '../../localization/app_localizations.dart';
import '../../providers/notification_preferences_provider.dart';

class NotificationPreferencesScreen extends StatelessWidget {
  const NotificationPreferencesScreen({super.key});

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    final localizations = AppLocalizations.of(context);

    return Consumer<NotificationPreferencesProvider>(
      builder: (context, prefs, _) {
        return Scaffold(
          appBar: AppBar(
            title: Text(localizations.translate('notification_preferences')),
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
                              title: Text(localizations.translate('push_notifications')),
                              subtitle: Text(localizations.translate('enable_disable_all_notifications')),
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
                                    localizations.translate('categories'),
                                    style: theme.textTheme.titleMedium?.copyWith(fontWeight: FontWeight.bold),
                                  ),
                                ),
                                const Divider(height: 1),
                                SwitchListTile(
                                  title: Text(localizations.translate('orders')),
                                  subtitle: Text(localizations.translate('notification_category_orders_subtitle')),
                                  value: prefs.ordersEnabled,
                                  onChanged: prefs.pushEnabled ? prefs.setOrdersEnabled : null,
                                ),
                                const Divider(height: 1),
                                SwitchListTile(
                                  title: Text(localizations.translate('promotions')),
                                  subtitle: Text(localizations.translate('notification_category_promotions_subtitle')),
                                  value: prefs.promotionsEnabled,
                                  onChanged: prefs.pushEnabled ? prefs.setPromotionsEnabled : null,
                                ),
                                const Divider(height: 1),
                                SwitchListTile(
                                  title: Text(localizations.translate('messages')),
                                  subtitle: Text(localizations.translate('notification_category_messages_subtitle')),
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
