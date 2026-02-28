import 'dart:math' as math;
import 'dart:ui';

import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:flutter_animate/flutter_animate.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import 'package:google_fonts/google_fonts.dart';

import '../../providers/auth_provider.dart';
import '../../localization/app_localizations.dart';
import '../../widgets/language_picker_button.dart';

const _g1 = Color(0xFF667eea);
const _g2 = Color(0xFF764ba2);
const _g3 = Color(0xFFf093fb);

class LoginScreen extends ConsumerStatefulWidget {
  const LoginScreen({super.key});

  @override
  ConsumerState<LoginScreen> createState() => _LoginScreenState();
}

class _LoginScreenState extends ConsumerState<LoginScreen>
    with SingleTickerProviderStateMixin {
  final _formKey = GlobalKey<FormState>();
  final _emailController = TextEditingController();
  final _passwordController = TextEditingController();
  late final AnimationController _bgController;
  bool _obscurePassword = true;
  bool _isSubmitting = false;

  @override
  void initState() {
    super.initState();
    _bgController = AnimationController(
      duration: const Duration(seconds: 20),
      vsync: this,
    )..repeat();
  }

  @override
  void dispose() {
    _bgController.dispose();
    _emailController.dispose();
    _passwordController.dispose();
    super.dispose();
  }

  String _authErrorMessage(AppLocalizations l10n, String raw, String? code) {
    if (code == 'invalid_credentials') return l10n.translate('auth_error_invalid_credentials');
    if (code == 'email_address_invalid') return l10n.translate('auth_error_email_invalid');
    if (code == 'unexpected_failure') return l10n.translate('auth_error_server_db');
    if (raw.contains('Database error') || raw.contains('500')) return l10n.translate('auth_error_server_db');
    return raw;
  }

  Future<void> _handleLogin() async {
    if (_isSubmitting) return;
    if (!_formKey.currentState!.validate()) return;
    setState(() => _isSubmitting = true);
    try {
      final email = _emailController.text.trim();
      final password = _passwordController.text.trim();
      debugPrint('[Login] submit: email=$email');
      await ref.read(authProvider.notifier).signIn(email, password);
      if (!mounted) return;
      final authState = ref.read(authProvider);
      if (authState.user != null) {
        context.go('/home');
      } else if (authState.error != null) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(content: Text(authState.error!)),
        );
      }
    } finally {
      if (mounted) setState(() => _isSubmitting = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    final authState = ref.watch(authProvider);
    final localizations = AppLocalizations.of(context);

    return Scaffold(
      body: Stack(
        children: [
          _AuthBackground(animation: _bgController),
          SafeArea(
            child: SingleChildScrollView(
              padding: const EdgeInsets.symmetric(horizontal: 24, vertical: 16),
              child: Center(
                child: ConstrainedBox(
                  constraints: const BoxConstraints(maxWidth: 540),
                  child: Column(
                    children: [
                      const SizedBox(height: 20),
                      // Logo
                      Image.asset(
                        'assets/images/GBA_sans_arriere.png',
                        width: 130,
                        height: 130,
                        fit: BoxFit.contain,
                        filterQuality: FilterQuality.high,
                      )
                          .animate()
                          .fadeIn(duration: 500.ms)
                          .scale(begin: const Offset(0.88, 0.88), end: const Offset(1, 1), duration: 600.ms, curve: Curves.easeOutCubic),
                      const SizedBox(height: 18),
                      Text(
                        localizations.translate('auth_login_title'),
                        style: GoogleFonts.poppins(fontSize: 28, fontWeight: FontWeight.w800, color: Colors.white),
                      ).animate().fadeIn(delay: 200.ms).slideY(begin: -0.1, end: 0),
                      const SizedBox(height: 4),
                      Text(
                        localizations.translate('auth_login_subtitle'),
                        textAlign: TextAlign.center,
                        style: GoogleFonts.poppins(fontSize: 13, color: Colors.white.withOpacity(0.72)),
                      ).animate().fadeIn(delay: 280.ms),
                      const SizedBox(height: 24),
                      if (authState.error != null) ...[
                        _ErrorBanner(
                          message: _authErrorMessage(localizations, authState.error!, authState.errorCode),
                          onClose: () => ref.read(authProvider.notifier).clearError(),
                          extra: authState.errorCode == 'invalid_credentials'
                              ? TextButton(
                                  onPressed: () async {
                                    final email = _emailController.text.trim();
                                    if (email.isEmpty) return;
                                    try {
                                      await ref.read(authProvider.notifier).resendEmailConfirmation(email);
                                      if (!mounted) return;
                                      ScaffoldMessenger.of(context).showSnackBar(SnackBar(
                                          content: Text(localizations.translate('auth_resend_confirmation_sent'))));
                                    } catch (_) {}
                                  },
                                  child: Text(localizations.translate('auth_resend_confirmation'),
                                      style: TextStyle(color: Colors.red.shade700, fontSize: 12)),
                                )
                              : null,
                        ).animate().fadeIn(duration: 300.ms),
                        const SizedBox(height: 12),
                      ],
                      _GlassCard(
                        child: Form(
                          key: _formKey,
                          child: Column(
                            crossAxisAlignment: CrossAxisAlignment.stretch,
                            children: [
                              _PremiumField(
                                controller: _emailController,
                                label: localizations.translate('auth_label_email'),
                                icon: Icons.email_outlined,
                                keyboardType: TextInputType.emailAddress,
                                validator: (v) {
                                  if (v == null || v.trim().isEmpty) return localizations.translate('auth_enter_email');
                                  if (!v.trim().contains('@')) return localizations.translate('auth_invalid_email_format');
                                  return null;
                                },
                                animDelay: 350.ms,
                              ),
                              const SizedBox(height: 14),
                              _PremiumField(
                                controller: _passwordController,
                                label: localizations.translate('auth_label_password'),
                                icon: Icons.lock_outline_rounded,
                                obscure: _obscurePassword,
                                toggleObscure: () => setState(() => _obscurePassword = !_obscurePassword),
                                validator: (v) {
                                  if (v == null || v.isEmpty) return localizations.translate('auth_enter_password');
                                  if (v.length < 6) return localizations.translate('auth_min_6_chars');
                                  return null;
                                },
                                animDelay: 420.ms,
                              ),
                              Align(
                                alignment: Alignment.centerRight,
                                child: TextButton(
                                  onPressed: () => context.push('/forgot-password'),
                                  style: TextButton.styleFrom(
                                      padding: const EdgeInsets.symmetric(vertical: 4),
                                      tapTargetSize: MaterialTapTargetSize.shrinkWrap),
                                  child: Text(localizations.translate('auth_forgot_password_link'),
                                      style: TextStyle(color: _g1, fontSize: 13, fontWeight: FontWeight.w600)),
                                ),
                              ).animate().fadeIn(delay: 490.ms),
                              const SizedBox(height: 8),
                              _PremiumButton(
                                label: localizations.translate('auth_login_button'),
                                isLoading: authState.isLoading,
                                onPressed: _handleLogin,
                                animDelay: 560.ms,
                              ),
                            ],
                          ),
                        ),
                      ).animate().fadeIn(delay: 320.ms).slideY(begin: 0.06, end: 0),
                      const SizedBox(height: 18),
                      Row(
                        mainAxisAlignment: MainAxisAlignment.center,
                        mainAxisSize: MainAxisSize.min,
                        children: [
                          Flexible(
                            child: Text(
                              localizations.translate('auth_no_account_yet'),
                              style: TextStyle(color: Colors.white.withOpacity(0.8)),
                              overflow: TextOverflow.ellipsis,
                            ),
                          ),
                          GestureDetector(
                            onTap: () => context.go('/register'),
                            child: Text(
                              localizations.translate('auth_sign_up_link'),
                              style: GoogleFonts.poppins(
                                  color: Colors.white,
                                  fontWeight: FontWeight.w800,
                                  decoration: TextDecoration.underline,
                                  decorationColor: Colors.white),
                            ),
                          ),
                        ],
                      ).animate().fadeIn(delay: 750.ms),
                      const SizedBox(height: 24),
                    ],
                  ),
                ),
              ),
            ),
          ),
          // Language picker — top-right (keep last so it stays clickable over scroll)
          Positioned(
            top: 0,
            right: 16,
            child: SafeArea(
              child: Padding(
                padding: EdgeInsets.only(top: 8),
                child: LanguagePickerButton(),
              ),
            ),
          ),
        ],
      ),
    );
  }
}

// ─── Shared premium components ─────────────────────────────────────────────────

class _GlassCard extends StatelessWidget {
  const _GlassCard({required this.child});
  final Widget child;
  @override
  Widget build(BuildContext context) {
    return ClipRRect(
      borderRadius: BorderRadius.circular(24),
      child: BackdropFilter(
        filter: ImageFilter.blur(sigmaX: 20, sigmaY: 20),
        child: Container(
          padding: const EdgeInsets.all(22),
          decoration: BoxDecoration(
            color: Colors.white.withOpacity(0.93),
            borderRadius: BorderRadius.circular(24),
            border: Border.all(color: Colors.white.withOpacity(0.6)),
            boxShadow: [BoxShadow(color: _g2.withOpacity(0.12), blurRadius: 30, offset: const Offset(0, 12))],
          ),
          child: child,
        ),
      ),
    );
  }
}

class _PremiumField extends StatelessWidget {
  const _PremiumField({
    required this.controller,
    required this.label,
    required this.icon,
    this.keyboardType = TextInputType.text,
    this.obscure = false,
    this.toggleObscure,
    this.validator,
    this.animDelay = Duration.zero,
  });
  final TextEditingController controller;
  final String label;
  final IconData icon;
  final TextInputType keyboardType;
  final bool obscure;
  final VoidCallback? toggleObscure;
  final String? Function(String?)? validator;
  final Duration animDelay;

  @override
  Widget build(BuildContext context) {
    return TextFormField(
      controller: controller,
      keyboardType: keyboardType,
      obscureText: obscure,
      decoration: InputDecoration(
        labelText: label,
        prefixIcon: Icon(icon, color: _g1, size: 20),
        suffixIcon: toggleObscure != null
            ? IconButton(
                icon: Icon(obscure ? Icons.visibility_rounded : Icons.visibility_off_rounded,
                    color: Colors.grey.shade500, size: 20),
                onPressed: toggleObscure)
            : null,
        filled: true,
        fillColor: Colors.grey.shade50,
        border: OutlineInputBorder(borderRadius: BorderRadius.circular(14), borderSide: BorderSide(color: Colors.grey.shade200)),
        enabledBorder: OutlineInputBorder(borderRadius: BorderRadius.circular(14), borderSide: BorderSide(color: Colors.grey.shade200)),
        focusedBorder: OutlineInputBorder(borderRadius: BorderRadius.circular(14), borderSide: const BorderSide(color: _g1, width: 1.8)),
        errorBorder: OutlineInputBorder(borderRadius: BorderRadius.circular(14), borderSide: const BorderSide(color: Colors.red, width: 1.2)),
        focusedErrorBorder: OutlineInputBorder(borderRadius: BorderRadius.circular(14), borderSide: const BorderSide(color: Colors.red, width: 1.8)),
        labelStyle: TextStyle(color: Colors.grey.shade600, fontSize: 14),
        contentPadding: const EdgeInsets.symmetric(horizontal: 16, vertical: 14),
      ),
      validator: validator,
    ).animate().fadeIn(delay: animDelay, duration: 350.ms).slideX(begin: -0.05, end: 0);
  }
}

class _PremiumButton extends StatelessWidget {
  const _PremiumButton({
    required this.label,
    required this.isLoading,
    required this.onPressed,
    this.animDelay = Duration.zero,
  });
  final String label;
  final bool isLoading;
  final VoidCallback onPressed;
  final Duration animDelay;

  @override
  Widget build(BuildContext context) {
    return SizedBox(
      height: 54,
      child: DecoratedBox(
        decoration: BoxDecoration(
          gradient: isLoading
              ? const LinearGradient(colors: [Colors.grey, Colors.grey])
              : const LinearGradient(colors: [_g1, _g2]),
          borderRadius: BorderRadius.circular(16),
          boxShadow: [BoxShadow(color: _g1.withOpacity(0.35), blurRadius: 18, offset: const Offset(0, 8))],
        ),
        child: ElevatedButton(
          onPressed: isLoading ? null : onPressed,
          style: ElevatedButton.styleFrom(
              backgroundColor: Colors.transparent,
              shadowColor: Colors.transparent,
              shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(16))),
          child: isLoading
              ? const SizedBox(width: 22, height: 22, child: CircularProgressIndicator(strokeWidth: 2.5, color: Colors.white))
              : Text(label, style: GoogleFonts.poppins(fontSize: 16, fontWeight: FontWeight.w700, color: Colors.white)),
        ),
      ),
    ).animate().fadeIn(delay: animDelay, duration: 350.ms);
  }
}

class _ErrorBanner extends StatelessWidget {
  const _ErrorBanner({required this.message, required this.onClose, this.extra});
  final String message;
  final VoidCallback onClose;
  final Widget? extra;

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 10),
      decoration: BoxDecoration(
          color: Colors.red.withOpacity(0.12),
          borderRadius: BorderRadius.circular(12),
          border: Border.all(color: Colors.red.withOpacity(0.3))),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        mainAxisSize: MainAxisSize.min,
        children: [
          Row(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              const Icon(Icons.error_outline_rounded, color: Colors.red, size: 18),
              const SizedBox(width: 8),
              Expanded(
                child: Text(
                  message,
                  style: const TextStyle(color: Colors.red, fontSize: 13),
                  maxLines: 4,
                  overflow: TextOverflow.ellipsis,
                ),
              ),
              GestureDetector(onTap: onClose, child: const Icon(Icons.close_rounded, color: Colors.red, size: 18)),
            ],
          ),
          if (extra != null) extra!,
        ],
      ),
    );
  }
}

class _AuthBackground extends StatelessWidget {
  const _AuthBackground({required this.animation});
  final Animation<double> animation;

  @override
  Widget build(BuildContext context) {
    return AnimatedBuilder(
      animation: animation,
      builder: (context, _) => Container(
        decoration: BoxDecoration(
          gradient: LinearGradient(
            begin: Alignment.topLeft,
            end: Alignment.bottomRight,
            colors: const [_g1, _g2, _g3],
            stops: const [0.0, 0.52, 1.0],
            transform: GradientRotation(animation.value * 2 * math.pi),
          ),
        ),
        child: CustomPaint(painter: _MeshPainter(animation.value), child: const SizedBox.expand()),
      ),
    );
  }
}

class _MeshPainter extends CustomPainter {
  const _MeshPainter(this.t);
  final double t;
  @override
  void paint(Canvas canvas, Size size) {
    final a = t * 2 * math.pi;
    void circle(Paint p, double x, double y, double r) =>
        canvas.drawCircle(Offset(size.width * x, size.height * y), size.width * r, p);
    circle(Paint()..color = Colors.white.withOpacity(0.12)..maskFilter = MaskFilter.blur(BlurStyle.normal, size.shortestSide * 0.09),
        0.18 + 0.06 * math.sin(a * 0.9), 0.24 + 0.06 * math.cos(a * 1.1), 0.44 + 0.03 * math.sin(a * 1.2));
    circle(Paint()..color = const Color(0xFFFFD54F).withOpacity(0.12)..maskFilter = MaskFilter.blur(BlurStyle.normal, size.shortestSide * 0.11),
        0.88 + 0.05 * math.cos(a * 0.8), 0.22 + 0.06 * math.sin(a * 0.7), 0.34 + 0.03 * math.cos(a * 1.3));
    circle(Paint()..color = const Color(0xFF69F0AE).withOpacity(0.09)..maskFilter = MaskFilter.blur(BlurStyle.normal, size.shortestSide * 0.13),
        0.62 + 0.06 * math.sin(a * 0.8), 0.84 + 0.05 * math.cos(a * 1.0), 0.46 + 0.03 * math.sin(a * 1.1));
  }
  @override
  bool shouldRepaint(_MeshPainter old) => old.t != t;
}
