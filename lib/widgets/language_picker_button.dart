import 'package:flutter/material.dart';
import 'package:provider/provider.dart';
import '../providers/language_provider.dart';

/// Globe button that opens a bottom sheet language selector (FR / EN / AR).
/// Compatible with both light and dark backgrounds — defaults to white icon.
class LanguagePickerButton extends StatelessWidget {
  const LanguagePickerButton({super.key, this.iconColor = Colors.white});

  final Color iconColor;

  static const _languages = [
    _LangOption(code: 'fr', label: 'Français', flag: '🇫🇷'),
    _LangOption(code: 'en', label: 'English', flag: '🇬🇧'),
    _LangOption(code: 'ar', label: 'العربية', flag: '🇸🇦'),
  ];

  @override
  Widget build(BuildContext context) {
    final provider = Provider.of<LanguageProvider>(context, listen: true);
    final current = provider.locale.languageCode.toUpperCase();

    return GestureDetector(
      onTap: () => _showPicker(context, provider),
      child: Container(
        padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 6),
        decoration: BoxDecoration(
          color: Colors.white.withValues(alpha: 0.15),
          borderRadius: BorderRadius.circular(20),
          border: Border.all(color: Colors.white.withValues(alpha: 0.3)),
        ),
        child: Row(
          mainAxisSize: MainAxisSize.min,
          children: [
            Icon(Icons.language_rounded, color: iconColor, size: 18),
            const SizedBox(width: 4),
            Text(
              current,
              style: TextStyle(
                color: iconColor,
                fontSize: 12,
                fontWeight: FontWeight.w700,
                letterSpacing: 0.5,
              ),
            ),
          ],
        ),
      ),
    );
  }

  void _showPicker(BuildContext context, LanguageProvider provider) {
    final current = provider.locale.languageCode;
    showModalBottomSheet<void>(
      context: context,
      backgroundColor: Colors.transparent,
      builder: (ctx) {
        return Container(
          decoration: BoxDecoration(
            color: Theme.of(ctx).colorScheme.surface,
            borderRadius: const BorderRadius.vertical(top: Radius.circular(24)),
          ),
          padding: const EdgeInsets.fromLTRB(24, 12, 24, 32),
          child: Column(
            mainAxisSize: MainAxisSize.min,
            children: [
              // Handle bar
              Container(
                width: 40,
                height: 4,
                margin: const EdgeInsets.only(bottom: 20),
                decoration: BoxDecoration(
                  color: Theme.of(ctx).colorScheme.onSurfaceVariant.withValues(alpha: 0.3),
                  borderRadius: BorderRadius.circular(2),
                ),
              ),
              Text(
                'Choisir la langue',
                style: TextStyle(
                  fontSize: 18,
                  fontWeight: FontWeight.w800,
                  color: Theme.of(ctx).colorScheme.onSurface,
                ),
              ),
              const SizedBox(height: 20),
              ..._languages.map((lang) {
                final isSelected = lang.code == current;
                return ListTile(
                  leading: Text(lang.flag, style: const TextStyle(fontSize: 26)),
                  title: Text(
                    lang.label,
                    style: TextStyle(
                      fontWeight: isSelected ? FontWeight.w700 : FontWeight.w500,
                      color: isSelected
                          ? const Color(0xFF667eea)
                          : Theme.of(ctx).colorScheme.onSurface,
                    ),
                  ),
                  trailing: isSelected
                      ? const Icon(Icons.check_circle_rounded, color: Color(0xFF667eea))
                      : null,
                  shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(14)),
                  tileColor: isSelected
                      ? const Color(0xFF667eea).withValues(alpha: 0.08)
                      : Colors.transparent,
                  onTap: () {
                    provider.setLocale(Locale(lang.code));
                    Navigator.of(ctx).pop();
                  },
                );
              }),
            ],
          ),
        );
      },
    );
  }
}

class _LangOption {
  final String code;
  final String label;
  final String flag;
  const _LangOption({required this.code, required this.label, required this.flag});
}
