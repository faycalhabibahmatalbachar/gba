import 'package:flutter/material.dart';
import 'package:flutter/foundation.dart';
import 'package:flutter/services.dart';
import 'package:provider/provider.dart';
import 'package:font_awesome_flutter/font_awesome_flutter.dart';
import 'package:shared_preferences/shared_preferences.dart';
import '../providers/theme_provider.dart';
import '../providers/language_provider.dart';
import '../providers/notification_preferences_provider.dart';
import 'dart:ui';
import 'dart:math' as math;
import '../localization/app_localizations.dart';
import '../services/supabase_service.dart';
import 'package:go_router/go_router.dart';

class SettingsScreenPremium extends StatefulWidget {
  const SettingsScreenPremium({Key? key}) : super(key: key);

  @override
  State<SettingsScreenPremium> createState() => _SettingsScreenPremiumState();
}

class _SettingsScreenPremiumState extends State<SettingsScreenPremium>
    with TickerProviderStateMixin {
  late AnimationController _fadeController;
  late AnimationController _slideController;
  late Animation<double> _fadeAnimation;
  late Animation<Offset> _slideAnimation;

  bool _notificationsEnabled = true;
  bool _darkModeEnabled = false;
  bool _soundEnabled = true;
  bool _vibrationEnabled = true;

  @override
  void initState() {
    super.initState();
    _initAnimations();
    _loadSettings();
  }

  void _initAnimations() {
    _fadeController = AnimationController(
      duration: const Duration(milliseconds: 1200),
      vsync: this,
    );
    _slideController = AnimationController(
      duration: const Duration(milliseconds: 800),
      vsync: this,
    );

    _fadeAnimation = CurvedAnimation(
      parent: _fadeController,
      curve: Curves.easeInOut,
    );
    _slideAnimation = Tween<Offset>(
      begin: const Offset(0, 0.3),
      end: Offset.zero,
    ).animate(CurvedAnimation(
      parent: _slideController,
      curve: Curves.easeOutCubic,
    ));

    _fadeController.forward();
    _slideController.forward();
  }

  Future<void> _loadSettings() async {
    final prefs = await SharedPreferences.getInstance();
    setState(() {
      _notificationsEnabled = prefs.getBool('notifications') ?? true;
      _darkModeEnabled = prefs.getBool('darkMode') ?? false;
      _soundEnabled = prefs.getBool('sound') ?? true;
      _vibrationEnabled = prefs.getBool('vibration') ?? true;
    });
  }

  Future<void> _saveSetting(String key, dynamic value) async {
    final prefs = await SharedPreferences.getInstance();
    if (value is bool) {
      await prefs.setBool(key, value);
    } else if (value is String) {
      await prefs.setString(key, value);
    }
  }

  @override
  void dispose() {
    _fadeController.dispose();
    _slideController.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    final localizations = AppLocalizations.of(context);

    return Scaffold(
      extendBodyBehindAppBar: true,
      appBar: _buildAppBar(context, localizations),
      body: Stack(
        children: [
          Container(
            decoration: BoxDecoration(
              gradient: LinearGradient(
                begin: Alignment.topLeft,
                end: Alignment.bottomRight,
                colors: [
                  Colors.blue.shade50,
                  Colors.purple.shade50,
                  Colors.pink.shade50,
                ],
              ),
            ),
          ),
          _buildSettingsContent(theme, localizations),
        ],
      ),
    );
  }

  PreferredSizeWidget _buildAppBar(BuildContext context, AppLocalizations localizations) {
    return AppBar(
      backgroundColor: Colors.transparent,
      elevation: 0,
      leading: IconButton(
        icon: Container(
          padding: const EdgeInsets.all(8),
          decoration: BoxDecoration(
            color: Colors.white.withOpacity(0.9),
            borderRadius: BorderRadius.circular(12),
          ),
          child: const Icon(
            FontAwesomeIcons.arrowLeft,
            color: Colors.black87,
            size: 16,
          ),
        ),
        onPressed: () => Navigator.pop(context),
      ),
      title: Row(
        children: [
          const Icon(FontAwesomeIcons.gear, size: 20, color: Colors.black87),
          const SizedBox(width: 12),
          Text(
            localizations.translate('settings'),
            style: const TextStyle(
              fontWeight: FontWeight.bold,
              color: Colors.black87,
            ),
          ),
        ],
      ),
    );
  }

  Widget _buildSettingsContent(ThemeData theme, AppLocalizations localizations) {
    return SafeArea(
      child: SlideTransition(
        position: _slideAnimation,
        child: FadeTransition(
          opacity: _fadeAnimation,
          child: ListView(
            padding: const EdgeInsets.all(16),
            children: [
              _buildSectionTitle(localizations.translate('notifications'), FontAwesomeIcons.bell),
              _buildNotificationSettings(),
              const SizedBox(height: 24),
              
              _buildSectionTitle(localizations.translate('appearance'), FontAwesomeIcons.palette),
              _buildAppearanceSettings(),
              const SizedBox(height: 24),
              
              _buildSectionTitle(localizations.translate('language'), FontAwesomeIcons.globe),
              _buildLanguageSettings(),
              const SizedBox(height: 24),
              
              _buildSectionTitle(localizations.translate('privacy'), FontAwesomeIcons.lock),
              _buildPrivacySettings(),
              const SizedBox(height: 24),
              
              _buildDangerZone(),
            ],
          ),
        ),
      ),
    );
  }

  Widget _buildSectionTitle(String title, IconData icon) {
    return Container(
      margin: const EdgeInsets.only(bottom: 12),
      child: Row(
        children: [
          Container(
            padding: const EdgeInsets.all(10),
            decoration: BoxDecoration(
              gradient: LinearGradient(
                colors: [Colors.purple.shade400, Colors.blue.shade400],
              ),
              borderRadius: BorderRadius.circular(12),
            ),
            child: Icon(icon, color: Colors.white, size: 16),
          ),
          const SizedBox(width: 12),
          Text(
            title,
            style: const TextStyle(
              fontSize: 18,
              fontWeight: FontWeight.bold,
              color: Colors.black87,
            ),
          ),
        ],
      ),
    );
  }

  Widget _buildNotificationSettings() {
    final localizations = AppLocalizations.of(context);

    return Container(
      decoration: BoxDecoration(
        color: Colors.white,
        borderRadius: BorderRadius.circular(20),
        boxShadow: [
          BoxShadow(
            color: Colors.grey.withOpacity(0.1),
            blurRadius: 15,
            offset: const Offset(0, 5),
          ),
        ],
      ),
      child: Column(
        children: [
          _buildSwitchTile(
            icon: FontAwesomeIcons.bell,
            title: localizations.translate('push_notifications'),
            subtitle: localizations.translate('receive_notifications'),
            value: _notificationsEnabled,
            onChanged: (value) {
              setState(() => _notificationsEnabled = value);
              _saveSetting('notifications', value);
              HapticFeedback.selectionClick();
              Provider.of<NotificationPreferencesProvider>(context, listen: false)
                  .setPushEnabled(value);
            },
          ),
          const Divider(height: 1),
          _buildListTile(
            icon: FontAwesomeIcons.sliders,
            title: localizations.translate('notification_preferences'),
            subtitle: localizations.translate('choose_categories'),
            onTap: () {
              HapticFeedback.selectionClick();
              context.push('/settings/notifications');
            },
          ),
          const Divider(height: 1),
          _buildSwitchTile(
            icon: FontAwesomeIcons.volumeHigh,
            title: localizations.translate('sounds'),
            subtitle: localizations.translate('enable_sound_effects'),
            value: _soundEnabled,
            onChanged: (value) {
              setState(() => _soundEnabled = value);
              _saveSetting('sound', value);
              HapticFeedback.selectionClick();
            },
          ),
          const Divider(height: 1),
          _buildSwitchTile(
            icon: FontAwesomeIcons.mobileScreen,
            title: localizations.translate('vibrations'),
            subtitle: localizations.translate('haptic_feedback'),
            value: _vibrationEnabled,
            onChanged: (value) {
              setState(() => _vibrationEnabled = value);
              _saveSetting('vibration', value);
              if (value) HapticFeedback.mediumImpact();
            },
          ),
        ],
      ),
    );
  }

  Widget _buildAppearanceSettings() {
    final localizations = AppLocalizations.of(context);

    return Container(
      decoration: BoxDecoration(
        color: Colors.white,
        borderRadius: BorderRadius.circular(20),
        boxShadow: [
          BoxShadow(
            color: Colors.grey.withOpacity(0.1),
            blurRadius: 15,
            offset: const Offset(0, 5),
          ),
        ],
      ),
      child: _buildSwitchTile(
        icon: FontAwesomeIcons.moon,
        title: localizations.translate('dark_mode'),
        subtitle: localizations.translate('enable_dark_theme'),
        value: Provider.of<ThemeProvider>(context).isDarkMode,
        onChanged: (value) {
          Provider.of<ThemeProvider>(context, listen: false).toggleTheme();
          setState(() => _darkModeEnabled = value);
          _saveSetting('darkMode', value);
          HapticFeedback.selectionClick();
        },
      ),
    );
  }

  Widget _buildLanguageSettings() {
    final localizations = AppLocalizations.of(context);
    final languageProvider = Provider.of<LanguageProvider>(context);

    return Container(
      decoration: BoxDecoration(
        color: Colors.white,
        borderRadius: BorderRadius.circular(20),
        boxShadow: [
          BoxShadow(
            color: Colors.grey.withOpacity(0.1),
            blurRadius: 15,
            offset: const Offset(0, 5),
          ),
        ],
      ),
      padding: const EdgeInsets.all(16),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            children: [
              Icon(FontAwesomeIcons.language, size: 16, color: Colors.grey.shade600),
              const SizedBox(width: 12),
              Text(
                localizations.translate('app_language'),
                style: const TextStyle(fontSize: 16, fontWeight: FontWeight.w500),
              ),
            ],
          ),
          const SizedBox(height: 16),
          Container(
            padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 4),
            decoration: BoxDecoration(
              border: Border.all(color: Colors.grey.shade300),
              borderRadius: BorderRadius.circular(12),
            ),
            child: DropdownButton<String>(
              value: languageProvider.locale.languageCode,
              isExpanded: true,
              underline: const SizedBox(),
              icon: const Icon(FontAwesomeIcons.chevronDown, size: 12),
              items: [
                DropdownMenuItem(
                  value: 'fr',
                  child: Text("🇫🇷 ${localizations.translate('language_french')}"),
                ),
                DropdownMenuItem(
                  value: 'en',
                  child: Text("🇬🇧 ${localizations.translate('language_english')}"),
                ),
                DropdownMenuItem(
                  value: 'ar',
                  child: Text("🇸🇦 ${localizations.translate('language_arabic')}"),
                ),
              ],
              onChanged: (value) {
                if (value != null) {
                  Provider.of<LanguageProvider>(context, listen: false)
                      .setLocale(Locale(value, ''));
                  HapticFeedback.selectionClick();
                }
              },
            ),
          ),
        ],
      ),
    );
  }

  Widget _buildPrivacySettings() {
    final localizations = AppLocalizations.of(context);

    return Container(
      decoration: BoxDecoration(
        color: Colors.white,
        borderRadius: BorderRadius.circular(20),
        boxShadow: [
          BoxShadow(
            color: Colors.grey.withOpacity(0.1),
            blurRadius: 15,
            offset: const Offset(0, 5),
          ),
        ],
      ),
      child: Column(
        children: [
          _buildListTile(
            icon: FontAwesomeIcons.key,
            title: localizations.translate('change_password'),
            subtitle: localizations.translate('change_password_subtitle'),
            onTap: () {
              HapticFeedback.selectionClick();
              context.push('/settings/change-password');
            },
          ),
          const Divider(height: 1),
          _buildListTile(
            icon: FontAwesomeIcons.shield,
            title: localizations.translate('privacy_policy'),
            subtitle: localizations.translate('privacy_policy_subtitle'),
            onTap: () {
              HapticFeedback.selectionClick();
              context.push('/legal/privacy');
            },
          ),
          const Divider(height: 1),
          _buildListTile(
            icon: FontAwesomeIcons.fileContract,
            title: localizations.translate('terms_of_service'),
            subtitle: localizations.translate('terms_of_service_subtitle'),
            onTap: () {
              HapticFeedback.selectionClick();
              context.push('/legal/terms');
            },
          ),
        ],
      ),
    );
  }

  Widget _buildDangerZone() {
    final localizations = AppLocalizations.of(context);

    return Container(
      decoration: BoxDecoration(
        gradient: LinearGradient(
          colors: [Colors.red.shade50, Colors.orange.shade50],
        ),
        borderRadius: BorderRadius.circular(20),
        border: Border.all(color: Colors.red.shade200),
      ),
      padding: const EdgeInsets.all(16),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            children: [
              Icon(FontAwesomeIcons.triangleExclamation, color: Colors.red.shade600, size: 20),
              const SizedBox(width: 12),
              Text(
                localizations.translate('danger_zone'),
                style: TextStyle(
                  fontSize: 18,
                  fontWeight: FontWeight.bold,
                  color: Colors.red.shade700,
                ),
              ),
            ],
          ),
          const SizedBox(height: 16),
          _buildDangerButton(
            icon: FontAwesomeIcons.rightFromBracket,
            title: localizations.translate('logout'),
            onTap: () {
              HapticFeedback.heavyImpact();
              _showLogoutDialog();
            },
          ),
          const SizedBox(height: 12),
          _buildDangerButton(
            icon: FontAwesomeIcons.trash,
            title: localizations.translate('clear_cache'),
            onTap: () {
              HapticFeedback.heavyImpact();
              ScaffoldMessenger.of(context).showSnackBar(
                SnackBar(
                  content: Row(
                    children: [
                      const Icon(FontAwesomeIcons.check, color: Colors.white, size: 16),
                      const SizedBox(width: 12),
                      Text(localizations.translate('cache_cleared_success')),
                    ],
                  ),
                  backgroundColor: Colors.green.shade600,
                  behavior: kIsWeb ? SnackBarBehavior.fixed : SnackBarBehavior.floating,
                  shape: RoundedRectangleBorder(
                    borderRadius: BorderRadius.circular(12),
                  ),
                ),
              );
            },
          ),
        ],
      ),
    );
  }

  Widget _buildSwitchTile({
    required IconData icon,
    required String title,
    required String subtitle,
    required bool value,
    required ValueChanged<bool> onChanged,
  }) {
    return ListTile(
      leading: Container(
        padding: const EdgeInsets.all(8),
        decoration: BoxDecoration(
          color: Colors.purple.shade50,
          borderRadius: BorderRadius.circular(10),
        ),
        child: Icon(icon, size: 16, color: Colors.purple.shade400),
      ),
      title: Text(title, style: const TextStyle(fontWeight: FontWeight.w500)),
      subtitle: Text(subtitle, style: TextStyle(fontSize: 12, color: Colors.grey.shade600)),
      trailing: Switch(
        value: value,
        onChanged: onChanged,
        activeColor: Colors.purple.shade400,
      ),
    );
  }

  Widget _buildListTile({
    required IconData icon,
    required String title,
    required String subtitle,
    required VoidCallback onTap,
  }) {
    return ListTile(
      leading: Container(
        padding: const EdgeInsets.all(8),
        decoration: BoxDecoration(
          color: Colors.blue.shade50,
          borderRadius: BorderRadius.circular(10),
        ),
        child: Icon(icon, size: 16, color: Colors.blue.shade400),
      ),
      title: Text(title, style: const TextStyle(fontWeight: FontWeight.w500)),
      subtitle: Text(subtitle, style: TextStyle(fontSize: 12, color: Colors.grey.shade600)),
      trailing: Icon(FontAwesomeIcons.chevronRight, size: 12, color: Colors.grey.shade400),
      onTap: onTap,
    );
  }

  Widget _buildDangerButton({
    required IconData icon,
    required String title,
    required VoidCallback onTap,
  }) {
    return InkWell(
      onTap: onTap,
      borderRadius: BorderRadius.circular(12),
      child: Container(
        padding: const EdgeInsets.all(12),
        decoration: BoxDecoration(
          color: Colors.white,
          borderRadius: BorderRadius.circular(12),
          border: Border.all(color: Colors.red.shade200),
        ),
        child: Row(
          children: [
            Icon(icon, color: Colors.red.shade600, size: 16),
            const SizedBox(width: 12),
            Text(
              title,
              style: TextStyle(
                color: Colors.red.shade700,
                fontWeight: FontWeight.w500,
              ),
            ),
            const Spacer(),
            Icon(FontAwesomeIcons.chevronRight, size: 12, color: Colors.red.shade400),
          ],
        ),
      ),
    );
  }

  void _showLogoutDialog() {
    final localizations = AppLocalizations.of(context);

    showDialog(
      context: context,
      builder: (context) => AlertDialog(
        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(20)),
        title: Row(
          children: [
            const Icon(FontAwesomeIcons.rightFromBracket, color: Colors.orange, size: 20),
            const SizedBox(width: 12),
            Text(localizations.translate('logout')),
          ],
        ),
        content: Text(localizations.translate('logout_confirm_message')),
        actions: [
          TextButton(
            onPressed: () => Navigator.pop(context),
            child: Text(localizations.translate('cancel')),
          ),
          ElevatedButton(
            onPressed: () async {
              await SupabaseService.client.auth.signOut();
              if (mounted) {
                Navigator.pushNamedAndRemoveUntil(context, '/login', (route) => false);
              }
            },
            style: ElevatedButton.styleFrom(
              backgroundColor: Colors.orange,
              shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
            ),
            child: Text(localizations.translate('logout')),
          ),
        ],
      ),
    );
  }
}

class _MeshGradientPainter extends CustomPainter {
  final double animation;

  _MeshGradientPainter(this.animation);

  @override
  void paint(Canvas canvas, Size size) {
    final paint = Paint()
      ..style = PaintingStyle.fill
      ..strokeWidth = 2;

    final path = Path();
    final waveHeight = 50.0;
    final waveCount = 3;
    
    for (int i = 0; i < waveCount; i++) {
      paint.color = [
        Colors.blue.withOpacity(0.1),
        Colors.purple.withOpacity(0.1),
        Colors.pink.withOpacity(0.1),
      ][i % 3];

      path.reset();
      path.moveTo(0, size.height * (0.5 + i * 0.2));
      
      for (double x = 0; x <= size.width; x += 10) {
        final y = size.height * (0.5 + i * 0.2) +
            math.sin((x / size.width * math.pi * 2) + (animation * math.pi * 2) + (i * math.pi / 3)) *
                waveHeight;
        path.lineTo(x, y);
      }
      
      path.lineTo(size.width, size.height);
      path.lineTo(0, size.height);
      path.close();
      
      canvas.drawPath(path, paint);
    }
  }

  @override
  bool shouldRepaint(covariant CustomPainter oldDelegate) => true;
}
