import 'package:flutter/material.dart';
import 'package:go_router/go_router.dart';
import '../../localization/app_localizations.dart';

class PrivacyPolicyScreen extends StatelessWidget {
  const PrivacyPolicyScreen({super.key});

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    final localizations = AppLocalizations.of(context);

    return PopScope(
      canPop: true,
      onPopInvokedWithResult: (didPop, result) {
        if (didPop) return;
        if (!context.mounted) return;
        if (GoRouter.of(context).canPop()) {
          GoRouter.of(context).pop();
        } else {
          context.go('/home');
        }
      },
      child: Scaffold(
      appBar: AppBar(
        title: Text(localizations.translate('privacy_policy')),
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
                            localizations.translate('privacy_policy_section1_title'),
                            style: theme.textTheme.titleMedium?.copyWith(fontWeight: FontWeight.bold),
                          ),
                          const SizedBox(height: 8),
                          Text(localizations.translate('privacy_policy_section1_body')),
                          const SizedBox(height: 16),
                          Text(
                            localizations.translate('privacy_policy_section2_title'),
                            style: theme.textTheme.titleMedium?.copyWith(fontWeight: FontWeight.bold),
                          ),
                          const SizedBox(height: 8),
                          Text(localizations.translate('privacy_policy_section2_body')),
                          const SizedBox(height: 8),
                          Text(localizations.translate('privacy_policy_section2_body_location')),
                          const SizedBox(height: 16),
                          Text(
                            localizations.translate('privacy_policy_section3_title'),
                            style: theme.textTheme.titleMedium?.copyWith(fontWeight: FontWeight.bold),
                          ),
                          const SizedBox(height: 8),
                          Text(localizations.translate('privacy_policy_section3_body')),
                          const SizedBox(height: 16),
                          Text(
                            localizations.translate('privacy_policy_section4_title'),
                            style: theme.textTheme.titleMedium?.copyWith(fontWeight: FontWeight.bold),
                          ),
                          const SizedBox(height: 8),
                          Text(localizations.translate('privacy_policy_section4_body')),
                          const SizedBox(height: 16),
                          Text(
                            localizations.translate('privacy_policy_section5_title'),
                            style: theme.textTheme.titleMedium?.copyWith(fontWeight: FontWeight.bold),
                          ),
                          const SizedBox(height: 8),
                          Text(localizations.translate('privacy_policy_section5_body')),
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
      ),
    );
  }
}
