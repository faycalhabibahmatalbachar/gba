import 'package:flutter/material.dart';
import 'package:provider/provider.dart';
import '../localization/app_localizations.dart';
import '../providers/language_provider.dart';

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
    _selectedLanguage = 'fr';
  }

  void _changeLanguage(String? languageCode) {
    if (languageCode == null) return;
    setState(() {
      _selectedLanguage = languageCode;
    });

    final provider = Provider.of<LanguageProvider>(context, listen: false);
    provider.setLocale(Locale(languageCode, ''));
  }

  @override
  Widget build(BuildContext context) {
    final localizations = AppLocalizations.of(context);
    final current = Provider.of<LanguageProvider>(context).locale.languageCode;
    if (current != _selectedLanguage) {
      _selectedLanguage = current;
    }
    
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
