import 'package:country_picker/country_picker.dart';
import 'package:flutter/material.dart';
import 'package:flutter_animate/flutter_animate.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import '../../animations/app_animations.dart';
import '../../localization/app_localizations.dart';
import '../../providers/auth_provider.dart';
import '../../widgets/app_animation.dart';

class PhoneAuthScreen extends ConsumerStatefulWidget {
  const PhoneAuthScreen({super.key, required this.mode});

  final String mode;

  @override
  ConsumerState<PhoneAuthScreen> createState() => _PhoneAuthScreenState();
}

class _PhoneAuthScreenState extends ConsumerState<PhoneAuthScreen> {
  final _formKey = GlobalKey<FormState>();
  final _phoneController = TextEditingController();
  final _nameController = TextEditingController();

  Country _country = CountryParser.parseCountryCode('GN');

  bool get _isLogin => widget.mode == 'login';

  @override
  void dispose() {
    _phoneController.dispose();
    _nameController.dispose();
    super.dispose();
  }

  void _pickCountry() {
    showCountryPicker(
      context: context,
      showPhoneCode: true,
      onSelect: (country) {
        setState(() => _country = country);
      },
    );
  }

  String _buildE164() {
    final digits = _phoneController.text.replaceAll(RegExp(r'[^0-9]'), '');
    final fullDigits = '${_country.phoneCode}$digits';
    return fullDigits.isEmpty ? '' : '+$fullDigits';
  }

  Future<void> _submit() async {
    if (!_formKey.currentState!.validate()) return;

    final phone = _buildE164();
    final locale = Localizations.localeOf(context).languageCode;

    await ref.read(authProvider.notifier).requestPhoneOtp(
          phone: phone,
          fullName: _isLogin ? null : _nameController.text.trim(),
          locale: locale,
          shouldCreateUser: !_isLogin,
        );

    if (!mounted) return;

    final authState = ref.read(authProvider);
    if (authState.error == null) {
      context.go('/otp?phone=${Uri.encodeComponent(phone)}&mode=${widget.mode}');
    }
  }

  @override
  Widget build(BuildContext context) {
    final localizations = AppLocalizations.of(context);
    final authState = ref.watch(authProvider);

    return Scaffold(
      appBar: AppBar(
        title: Text(_isLogin ? 'Téléphone' : 'Inscription par téléphone'),
        backgroundColor: const Color(0xFF1976D2),
        foregroundColor: Colors.white,
      ),
      body: Container(
        decoration: const BoxDecoration(
          gradient: LinearGradient(
            begin: Alignment.topLeft,
            end: Alignment.bottomRight,
            colors: [
              Color(0xFF1976D2),
              Color(0xFF2196F3),
              Color(0xFF42A5F5),
            ],
          ),
        ),
        child: SafeArea(
          child: Center(
            child: SingleChildScrollView(
              padding: const EdgeInsets.all(24),
              child: ConstrainedBox(
                constraints: const BoxConstraints(maxWidth: 560),
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.stretch,
                  children: [
                    Container(
                      padding: const EdgeInsets.all(16),
                      decoration: BoxDecoration(
                        color: Colors.white.withOpacity(0.14),
                        borderRadius: BorderRadius.circular(16),
                        border: Border.all(color: Colors.white.withOpacity(0.18)),
                      ),
                      child: Row(
                        children: [
                          const AppAnimation(
                            id: AppAnimations.loadingSpinner,
                            width: 42,
                            height: 42,
                          ),
                          const SizedBox(width: 12),
                          Expanded(
                            child: Text(
                              'On t\'enverra un code par SMS',
                              style: Theme.of(context).textTheme.bodyMedium?.copyWith(
                                    color: Colors.white,
                                    fontWeight: FontWeight.w600,
                                  ),
                            ),
                          ),
                        ],
                      ),
                    ).animate().fadeIn(duration: 500.ms),
                    const SizedBox(height: 16),
                    if (authState.error != null)
                      Container(
                        padding: const EdgeInsets.all(14),
                        decoration: BoxDecoration(
                          color: Colors.red.withOpacity(0.08),
                          borderRadius: BorderRadius.circular(14),
                          border: Border.all(color: Colors.red.withOpacity(0.25)),
                        ),
                        child: Row(
                          children: [
                            const Icon(Icons.error_outline, color: Colors.red),
                            const SizedBox(width: 10),
                            Expanded(
                              child: Text(
                                authState.error!,
                                style: const TextStyle(color: Colors.red),
                              ),
                            ),
                            IconButton(
                              onPressed: () => ref.read(authProvider.notifier).clearError(),
                              icon: const Icon(Icons.close, color: Colors.red),
                            ),
                          ],
                        ),
                      ).animate().fadeIn(delay: 80.ms),
                    if (authState.error != null) const SizedBox(height: 12),
                    Container(
                      padding: const EdgeInsets.all(18),
                      decoration: BoxDecoration(
                        color: Colors.white,
                        borderRadius: BorderRadius.circular(18),
                        boxShadow: [
                          BoxShadow(
                            color: Colors.black.withOpacity(0.10),
                            blurRadius: 18,
                            offset: const Offset(0, 10),
                          ),
                        ],
                      ),
                      child: Form(
                        key: _formKey,
                        child: Column(
                          crossAxisAlignment: CrossAxisAlignment.stretch,
                          children: [
                            if (!_isLogin) ...[
                              TextFormField(
                                controller: _nameController,
                                textInputAction: TextInputAction.next,
                                decoration: InputDecoration(
                                  labelText: localizations.translate('full_name'),
                                  prefixIcon: const Icon(Icons.person_outline, color: Color(0xFF2196F3)),
                                  border: OutlineInputBorder(
                                    borderRadius: BorderRadius.circular(16),
                                    borderSide: BorderSide.none,
                                  ),
                                  filled: true,
                                  fillColor: Colors.white,
                                ),
                                validator: (value) {
                                  if (value == null || value.trim().isEmpty) {
                                    return localizations.translate('enter_your_name');
                                  }
                                  return null;
                                },
                              ),
                              const SizedBox(height: 14),
                            ],
                            InkWell(
                              onTap: _pickCountry,
                              borderRadius: BorderRadius.circular(16),
                              child: Container(
                                padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 12),
                                decoration: BoxDecoration(
                                  color: const Color(0xFFF4F7FF),
                                  borderRadius: BorderRadius.circular(16),
                                  border: Border.all(color: const Color(0xFF2196F3).withOpacity(0.20)),
                                ),
                                child: Row(
                                  children: [
                                    Text(
                                      _country.flagEmoji,
                                      style: const TextStyle(fontSize: 22),
                                    ),
                                    const SizedBox(width: 10),
                                    Expanded(
                                      child: Text(
                                        '${_country.name} (+${_country.phoneCode})',
                                        style: const TextStyle(fontWeight: FontWeight.w700),
                                      ),
                                    ),
                                    const Icon(Icons.keyboard_arrow_down_rounded),
                                  ],
                                ),
                              ),
                            ),
                            const SizedBox(height: 14),
                            TextFormField(
                              controller: _phoneController,
                              keyboardType: TextInputType.phone,
                              textInputAction: TextInputAction.done,
                              decoration: InputDecoration(
                                labelText: localizations.translate('phone'),
                                prefixIcon: const Icon(Icons.phone_rounded, color: Color(0xFF2196F3)),
                                border: OutlineInputBorder(
                                  borderRadius: BorderRadius.circular(16),
                                  borderSide: BorderSide.none,
                                ),
                                filled: true,
                                fillColor: Colors.white,
                              ),
                              validator: (value) {
                                final digits = (value ?? '').replaceAll(RegExp(r'[^0-9]'), '');
                                if (digits.isEmpty) {
                                  return localizations.translate('invalid_phone_number');
                                }
                                if (digits.length < 6) {
                                  return localizations.translate('invalid_phone_number');
                                }
                                return null;
                              },
                            ),
                            const SizedBox(height: 16),
                            ElevatedButton(
                              onPressed: authState.isLoading ? null : _submit,
                              style: ElevatedButton.styleFrom(
                                backgroundColor: const Color(0xFF2196F3),
                                foregroundColor: Colors.white,
                                padding: const EdgeInsets.symmetric(vertical: 14),
                                shape: RoundedRectangleBorder(
                                  borderRadius: BorderRadius.circular(14),
                                ),
                              ),
                              child: authState.isLoading
                                  ? const SizedBox(
                                      width: 22,
                                      height: 22,
                                      child: CircularProgressIndicator(strokeWidth: 2, color: Colors.white),
                                    )
                                  : const Text('Envoyer le code'),
                            ),
                            const SizedBox(height: 10),
                            TextButton(
                              onPressed: () => context.go('/auth-method?mode=${widget.mode}'),
                              child: const Text('Changer de méthode'),
                            ),
                          ],
                        ),
                      ),
                    ).animate().fadeIn(delay: 150.ms).slideY(begin: 0.08, end: 0),
                  ],
                ),
              ),
            ),
          ),
        ),
      ),
    );
  }
}
