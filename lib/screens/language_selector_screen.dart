import 'package:flutter/material.dart';
import '../localization/app_localizations.dart';

class LanguageSelectorScreen extends StatefulWidget {
  const LanguageSelectorScreen({super.key});

  @override
  State<LanguageSelectorScreen> createState() => _LanguageSelectorScreenState();
}

class _LanguageSelectorScreenState extends State<LanguageSelectorScreen> {
  late String _selectedLanguage;

  @override
  void initState() {
    super.initState();
    _selectedLanguage = Localizations.localeOf(context).languageCode;
  }

  void _changeLanguage(String? languageCode) {
    if (languageCode == null) return;
    setState(() {
      _selectedLanguage = languageCode;
    });
    
    // TODO: Implement language change functionality
    // This would typically involve updating the app's locale
  }

  @override
  Widget build(BuildContext context) {
    final localizations = AppLocalizations.of(context);
    
    return Scaffold(
      appBar: AppBar(
        title: Text(localizations.translate('language')),
      ),
      body: Padding(
        padding: const EdgeInsets.all(16.0),
        child: Column(
          children: [
            ListTile(
              title: const Text('English'),
              trailing: Radio<String>(
                value: 'en',
                groupValue: _selectedLanguage,
                onChanged: (String? value) => _changeLanguage(value),
              ),
              onTap: () => _changeLanguage('en'),
            ),
            ListTile(
              title: const Text('Français'),
              trailing: Radio<String>(
                value: 'fr',
                groupValue: _selectedLanguage,
                onChanged: (String? value) => _changeLanguage(value),
              ),
              onTap: () => _changeLanguage('fr'),
            ),
            ListTile(
              title: const Text('العربية'),
              trailing: Radio<String>(
                value: 'ar',
                groupValue: _selectedLanguage,
                onChanged: (String? value) => _changeLanguage(value),
              ),
              onTap: () => _changeLanguage('ar'),
            ),
          ],
        ),
      ),
    );
  }
}
