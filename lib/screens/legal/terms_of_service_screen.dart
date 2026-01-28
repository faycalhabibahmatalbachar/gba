import 'package:flutter/material.dart';
import '../../localization/app_localizations.dart';

class TermsOfServiceScreen extends StatelessWidget {
  const TermsOfServiceScreen({super.key});

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    final localizations = AppLocalizations.of(context);

    return Scaffold(
      appBar: AppBar(
        title: Text(localizations.translate('terms_of_service')),
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
                            localizations.translate('terms_of_service_section1_title'),
                            style: theme.textTheme.titleMedium?.copyWith(fontWeight: FontWeight.bold),
                          ),
                          const SizedBox(height: 8),
                          Text(localizations.translate('terms_of_service_section1_body')),
                          const SizedBox(height: 16),
                          Text(
                            localizations.translate('terms_of_service_section2_title'),
                            style: theme.textTheme.titleMedium?.copyWith(fontWeight: FontWeight.bold),
                          ),
                          const SizedBox(height: 8),
                          Text(localizations.translate('terms_of_service_section2_body')),
                          const SizedBox(height: 16),
                          Text(
                            localizations.translate('terms_of_service_section3_title'),
                            style: theme.textTheme.titleMedium?.copyWith(fontWeight: FontWeight.bold),
                          ),
                          const SizedBox(height: 8),
                          Text(localizations.translate('terms_of_service_section3_body')),
                          const SizedBox(height: 16),
                          Text(
                            localizations.translate('terms_of_service_section4_title'),
                            style: theme.textTheme.titleMedium?.copyWith(fontWeight: FontWeight.bold),
                          ),
                          const SizedBox(height: 8),
                          Text(localizations.translate('terms_of_service_section4_body')),
                          const SizedBox(height: 8),
                          Text(localizations.translate('terms_of_service_section4_body_location')),
                          const SizedBox(height: 16),
                          Text(
                            localizations.translate('terms_of_service_section5_title'),
                            style: theme.textTheme.titleMedium?.copyWith(fontWeight: FontWeight.bold),
                          ),
                          const SizedBox(height: 8),
                          Text(localizations.translate('terms_of_service_section5_body')),
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
