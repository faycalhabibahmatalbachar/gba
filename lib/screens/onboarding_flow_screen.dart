import 'package:flutter/material.dart';
import 'package:go_router/go_router.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:provider/provider.dart' as provider;

import '../providers/auth_provider.dart';
import '../providers/language_provider.dart';
import '../providers/notification_preferences_provider.dart';
import '../services/onboarding_service.dart';
import '../services/supabase_service.dart';

class OnboardingFlowScreen extends ConsumerStatefulWidget {
  const OnboardingFlowScreen({super.key});

  @override
  ConsumerState<OnboardingFlowScreen> createState() => _OnboardingFlowScreenState();
}

class _OnboardingFlowScreenState extends ConsumerState<OnboardingFlowScreen> {
  final _pageController = PageController();
  int _step = 0;
  bool _saving = false;

  final _firstNameController = TextEditingController();
  final _lastNameController = TextEditingController();
  final _phoneController = TextEditingController();
  final _addressController = TextEditingController();
  final _cityController = TextEditingController();

  String _language = 'fr';

  @override
  void initState() {
    super.initState();
    _language = provider.Provider.of<LanguageProvider>(context, listen: false).locale.languageCode;
    final auth = ref.read(authProvider);
    final profile = auth.profile;
    _firstNameController.text = profile?.firstName ?? '';
    _lastNameController.text = profile?.lastName ?? '';
    _phoneController.text = profile?.phone ?? '';
    _addressController.text = profile?.address ?? '';
    _cityController.text = profile?.city ?? '';
  }

  @override
  void dispose() {
    _pageController.dispose();
    _firstNameController.dispose();
    _lastNameController.dispose();
    _phoneController.dispose();
    _addressController.dispose();
    _cityController.dispose();
    super.dispose();
  }

  Future<void> _skip() async {
    final userId = ref.read(authProvider).user?.id;
    if (userId == null) {
      if (mounted) context.go('/login');
      return;
    }
    await OnboardingService().setCompleted(userId: userId, value: true);
    if (mounted) context.go('/home');
  }

  Future<void> _next() async {
    final nextStep = _step + 1;
    if (nextStep >= 3) {
      await _finish();
      return;
    }

    setState(() => _step = nextStep);
    await _pageController.animateToPage(
      nextStep,
      duration: const Duration(milliseconds: 350),
      curve: Curves.easeOutCubic,
    );
  }

  Future<void> _finish() async {
    if (_saving) return;

    final userId = ref.read(authProvider).user?.id;
    if (userId == null) {
      if (mounted) context.go('/login');
      return;
    }

    setState(() => _saving = true);

    try {
      final updates = <String, dynamic>{
        if (_firstNameController.text.trim().isNotEmpty) 'first_name': _firstNameController.text.trim(),
        if (_lastNameController.text.trim().isNotEmpty) 'last_name': _lastNameController.text.trim(),
        if (_phoneController.text.trim().isNotEmpty) 'phone': _phoneController.text.trim(),
        if (_addressController.text.trim().isNotEmpty) 'address': _addressController.text.trim(),
        if (_cityController.text.trim().isNotEmpty) 'city': _cityController.text.trim(),
      };

      if (updates.isNotEmpty) {
        try {
          await SupabaseService.updateUserProfile(updates);
        } catch (_) {}
      }

      try {
        await SupabaseService.updateUserProfile({'language_preference': _language});
      } catch (_) {}

      final prefs = provider.Provider.of<NotificationPreferencesProvider>(context, listen: false);
      try {
        await SupabaseService.updateUserProfile({
          'notification_preferences': {
            'push_enabled': prefs.pushEnabled,
            'orders': prefs.ordersEnabled,
            'promotions': prefs.promotionsEnabled,
            'chat': prefs.chatEnabled,
          },
        });
      } catch (_) {}

      final languageProvider = provider.Provider.of<LanguageProvider>(context, listen: false);
      languageProvider.setLocale(Locale(_language, ''));

      await OnboardingService().setCompleted(userId: userId, value: true);
      if (!mounted) return;
      context.go('/home');
    } finally {
      if (mounted) setState(() => _saving = false);
    }
  }

  double _completionRatio() {
    const total = 5;
    var filled = 0;
    if (_firstNameController.text.trim().isNotEmpty) filled++;
    if (_lastNameController.text.trim().isNotEmpty) filled++;
    if (_phoneController.text.trim().isNotEmpty) filled++;
    if (_addressController.text.trim().isNotEmpty) filled++;
    if (_cityController.text.trim().isNotEmpty) filled++;
    return filled / total;
  }

  @override
  Widget build(BuildContext context) {
    final ratio = _completionRatio();
    final percent = (ratio * 100).round();

    return Scaffold(
      body: SafeArea(
        child: Column(
          children: [
            Padding(
              padding: const EdgeInsets.fromLTRB(20, 20, 20, 8),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.stretch,
                children: [
                  Row(
                    children: [
                      Expanded(
                        child: Text(
                          'Bienvenue',
                          style: Theme.of(context).textTheme.headlineSmall?.copyWith(
                                fontWeight: FontWeight.w800,
                              ),
                        ),
                      ),
                      TextButton(
                        onPressed: _saving ? null : _skip,
                        child: const Text('Passer'),
                      ),
                    ],
                  ),
                  const SizedBox(height: 8),
                  ClipRRect(
                    borderRadius: BorderRadius.circular(10),
                    child: LinearProgressIndicator(
                      value: ratio,
                      minHeight: 10,
                    ),
                  ),
                  const SizedBox(height: 8),
                  Text(
                    '$percent% complété',
                    textAlign: TextAlign.right,
                    style: TextStyle(color: Colors.grey.shade700),
                  ),
                ],
              ),
            ),
            const Divider(height: 1),
            Expanded(
              child: PageView(
                controller: _pageController,
                physics: const NeverScrollableScrollPhysics(),
                children: [
                  _stepProfile(),
                  _stepLanguage(),
                  _stepNotifications(),
                ],
              ),
            ),
            Padding(
              padding: const EdgeInsets.fromLTRB(20, 12, 20, 20),
              child: Row(
                children: [
                  if (_step > 0)
                    Expanded(
                      child: OutlinedButton(
                        onPressed: _saving
                            ? null
                            : () async {
                                final prev = _step - 1;
                                setState(() => _step = prev);
                                await _pageController.animateToPage(
                                  prev,
                                  duration: const Duration(milliseconds: 350),
                                  curve: Curves.easeOutCubic,
                                );
                              },
                        child: const Text('Retour'),
                      ),
                    ),
                  if (_step > 0) const SizedBox(width: 12),
                  Expanded(
                    child: ElevatedButton(
                      onPressed: _saving ? null : (_step == 2 ? _finish : _next),
                      child: _saving
                          ? const SizedBox(
                              width: 18,
                              height: 18,
                              child: CircularProgressIndicator(strokeWidth: 2),
                            )
                          : Text(_step == 2 ? 'Terminer' : 'Suivant'),
                    ),
                  ),
                ],
              ),
            ),
          ],
        ),
      ),
    );
  }

  Widget _stepProfile() {
    return SingleChildScrollView(
      padding: const EdgeInsets.all(20),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          Text(
            'Complète ton profil',
            style: Theme.of(context).textTheme.titleLarge?.copyWith(
                  fontWeight: FontWeight.w800,
                ),
          ),
          const SizedBox(height: 8),
          Text(
            'Ces informations accélèrent le checkout et la livraison.',
            style: TextStyle(color: Colors.grey.shade700),
          ),
          const SizedBox(height: 18),
          TextField(
            controller: _firstNameController,
            textInputAction: TextInputAction.next,
            decoration: const InputDecoration(
              labelText: 'Prénom',
              border: OutlineInputBorder(),
            ),
            onChanged: (_) => setState(() {}),
          ),
          const SizedBox(height: 12),
          TextField(
            controller: _lastNameController,
            textInputAction: TextInputAction.next,
            decoration: const InputDecoration(
              labelText: 'Nom',
              border: OutlineInputBorder(),
            ),
            onChanged: (_) => setState(() {}),
          ),
          const SizedBox(height: 12),
          TextField(
            controller: _phoneController,
            textInputAction: TextInputAction.next,
            keyboardType: TextInputType.phone,
            decoration: const InputDecoration(
              labelText: 'Téléphone',
              border: OutlineInputBorder(),
            ),
            onChanged: (_) => setState(() {}),
          ),
          const SizedBox(height: 12),
          TextField(
            controller: _addressController,
            textInputAction: TextInputAction.next,
            decoration: const InputDecoration(
              labelText: 'Adresse',
              border: OutlineInputBorder(),
            ),
            onChanged: (_) => setState(() {}),
          ),
          const SizedBox(height: 12),
          TextField(
            controller: _cityController,
            textInputAction: TextInputAction.done,
            decoration: const InputDecoration(
              labelText: 'Ville',
              border: OutlineInputBorder(),
            ),
            onChanged: (_) => setState(() {}),
          ),
        ],
      ),
    );
  }

  Widget _stepLanguage() {
    return Padding(
      padding: const EdgeInsets.all(20),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          Text(
            'Langue',
            style: Theme.of(context).textTheme.titleLarge?.copyWith(
                  fontWeight: FontWeight.w800,
                ),
          ),
          const SizedBox(height: 8),
          Text(
            'Choisis la langue de l\'application.',
            style: TextStyle(color: Colors.grey.shade700),
          ),
          const SizedBox(height: 18),
          RadioListTile<String>(
            value: 'fr',
            groupValue: _language,
            onChanged: (v) => setState(() => _language = v ?? 'fr'),
            title: const Text('Français'),
          ),
          RadioListTile<String>(
            value: 'en',
            groupValue: _language,
            onChanged: (v) => setState(() => _language = v ?? 'en'),
            title: const Text('English'),
          ),
          RadioListTile<String>(
            value: 'ar',
            groupValue: _language,
            onChanged: (v) => setState(() => _language = v ?? 'ar'),
            title: const Text('العربية'),
          ),
        ],
      ),
    );
  }

  Widget _stepNotifications() {
    final prefs = provider.Provider.of<NotificationPreferencesProvider>(context);

    return Padding(
      padding: const EdgeInsets.all(20),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          Text(
            'Notifications',
            style: Theme.of(context).textTheme.titleLarge?.copyWith(
                  fontWeight: FontWeight.w800,
                ),
          ),
          const SizedBox(height: 8),
          Text(
            'Choisis ce que tu veux recevoir.',
            style: TextStyle(color: Colors.grey.shade700),
          ),
          const SizedBox(height: 18),
          SwitchListTile(
            value: prefs.pushEnabled,
            onChanged: _saving ? null : prefs.setPushEnabled,
            title: const Text('Activer les notifications'),
          ),
          const SizedBox(height: 10),
          Opacity(
            opacity: prefs.pushEnabled ? 1.0 : 0.5,
            child: Column(
              children: [
                SwitchListTile(
                  value: prefs.ordersEnabled,
                  onChanged: _saving || !prefs.pushEnabled ? null : prefs.setOrdersEnabled,
                  title: const Text('Commandes'),
                ),
                SwitchListTile(
                  value: prefs.promotionsEnabled,
                  onChanged: _saving || !prefs.pushEnabled ? null : prefs.setPromotionsEnabled,
                  title: const Text('Promotions'),
                ),
                SwitchListTile(
                  value: prefs.chatEnabled,
                  onChanged: _saving || !prefs.pushEnabled ? null : prefs.setChatEnabled,
                  title: const Text('Messages'),
                ),
              ],
            ),
          ),
        ],
      ),
    );
  }
}
