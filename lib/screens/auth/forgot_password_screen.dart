import 'dart:math' as math;
import 'dart:ui';

import 'package:flutter/foundation.dart' show kIsWeb;
import 'package:flutter/material.dart';
import 'package:flutter_animate/flutter_animate.dart';
import 'package:go_router/go_router.dart';
import 'package:google_fonts/google_fonts.dart';
import 'package:supabase_flutter/supabase_flutter.dart';

import '../../config/app_config.dart';
import '../../localization/app_localizations.dart';

const _g1 = Color(0xFF667eea);
const _g2 = Color(0xFF764ba2);
const _g3 = Color(0xFFf093fb);

class ForgotPasswordScreen extends StatefulWidget {
  const ForgotPasswordScreen({super.key});

  @override
  State<ForgotPasswordScreen> createState() => _ForgotPasswordScreenState();
}

class _ForgotPasswordScreenState extends State<ForgotPasswordScreen>
    with SingleTickerProviderStateMixin {
  final _formKey = GlobalKey<FormState>();
  final _emailController = TextEditingController();
  late final AnimationController _bgController;
  bool _loading = false;
  bool _sent = false;
  String? _error;

  @override
  void initState() {
    super.initState();
    _bgController = AnimationController(duration: const Duration(seconds: 20), vsync: this)..repeat();
  }

  @override
  void dispose() {
    _bgController.dispose();
    _emailController.dispose();
    super.dispose();
  }

  Future<void> _submit() async {
    if (!_formKey.currentState!.validate()) return;
    setState(() { _loading = true; _error = null; });
    try {
      final email = _emailController.text.trim();
      final baseUrl = AppConfig.siteUrl.trim();
      final normalizedBaseUrl = baseUrl.endsWith('/') ? baseUrl.substring(0, baseUrl.length - 1) : baseUrl;
      final redirectTo = kIsWeb
          ? '$normalizedBaseUrl/#/reset-password'
          : 'com.gba.ecommerce_client://login-callback';
      await Supabase.instance.client.auth.resetPasswordForEmail(email, redirectTo: redirectTo);
      if (!mounted) return;
      setState(() { _sent = true; _loading = false; });
    } catch (e) {
      if (!mounted) return;
      setState(() { _error = e.toString(); _loading = false; });
    }
  }

  @override
  Widget build(BuildContext context) {
    final l10n = AppLocalizations.of(context);
    return Scaffold(
      body: Stack(
        children: [
          _AuthBg(animation: _bgController),
          SafeArea(
            child: SingleChildScrollView(
              padding: const EdgeInsets.symmetric(horizontal: 24, vertical: 16),
              child: Center(
                child: ConstrainedBox(
                  constraints: const BoxConstraints(maxWidth: 500),
                  child: Column(
                    children: [
                      const SizedBox(height: 24),
                      Align(
                        alignment: Alignment.centerLeft,
                        child: GestureDetector(
                          onTap: () => context.canPop() ? context.pop() : context.go('/login'),
                          child: Container(
                            padding: const EdgeInsets.all(10),
                            decoration: BoxDecoration(
                              color: Colors.white.withOpacity(0.18),
                              shape: BoxShape.circle,
                              border: Border.all(color: Colors.white.withOpacity(0.25)),
                            ),
                            child: const Icon(Icons.arrow_back_rounded, color: Colors.white, size: 20),
                          ),
                        ),
                      ).animate().fadeIn(duration: 400.ms),
                      const SizedBox(height: 28),
                      if (_sent) _SuccessView(
                        email: _emailController.text.trim(),
                        bgController: _bgController,
                        localizations: l10n,
                      )
                      else _FormView(
                        formKey: _formKey,
                        emailController: _emailController,
                        loading: _loading,
                        error: _error,
                        onSubmit: _submit,
                        onClearError: () => setState(() => _error = null),
                        localizations: l10n,
                      ),
                    ],
                  ),
                ),
              ),
            ),
          ),
        ],
      ),
    );
  }
}

class _FormView extends StatelessWidget {
  const _FormView({
    required this.formKey,
    required this.emailController,
    required this.loading,
    required this.error,
    required this.onSubmit,
    required this.onClearError,
    required this.localizations,
  });
  final GlobalKey<FormState> formKey;
  final TextEditingController emailController;
  final bool loading;
  final String? error;
  final VoidCallback onSubmit;
  final VoidCallback onClearError;
  final AppLocalizations localizations;

  @override
  Widget build(BuildContext context) {
    return Column(
      children: [
        Image.asset(
          'assets/images/GBA_sans_arriere.png',
          width: 130,
          height: 130,
          fit: BoxFit.contain,
          filterQuality: FilterQuality.high,
        ).animate().fadeIn(duration: 500.ms).scale(begin: const Offset(0.88, 0.88), end: const Offset(1, 1), duration: 600.ms, curve: Curves.easeOutCubic),
        const SizedBox(height: 18),
        Text(
          localizations.translate('forgot_password_title'),
          style: GoogleFonts.poppins(fontSize: 26, fontWeight: FontWeight.w800, color: Colors.white),
        ).animate().fadeIn(delay: 200.ms).slideY(begin: -0.1, end: 0),
        const SizedBox(height: 6),
        Text(
          localizations.translate('auth_forgot_password_instruction_short'),
          textAlign: TextAlign.center,
          style: GoogleFonts.poppins(fontSize: 13, color: Colors.white.withOpacity(0.75)),
        ).animate().fadeIn(delay: 280.ms),
        const SizedBox(height: 22),
        if (error != null) ...[
          _ErrorBanner(
            message: error!.contains('Exception') || error!.contains('500')
                ? localizations.translate('auth_error_generic')
                : error!,
            onClose: onClearError,
          ).animate().fadeIn(duration: 300.ms),
          const SizedBox(height: 12),
        ],
        _GlassCard(
          child: Form(
            key: formKey,
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.stretch,
              children: [
                _PremiumField(
                  controller: emailController,
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
                const SizedBox(height: 20),
                _PremiumButton(
                  label: localizations.translate('auth_send_link'),
                  isLoading: loading,
                  onPressed: onSubmit,
                  animDelay: 420.ms,
                ),
              ],
            ),
          ),
        ).animate().fadeIn(delay: 320.ms).slideY(begin: 0.06, end: 0),
      ],
    );
  }
}

class _SuccessView extends StatelessWidget {
  const _SuccessView({
    required this.email,
    required this.bgController,
    required this.localizations,
  });
  final String email;
  final AnimationController bgController;
  final AppLocalizations localizations;

  @override
  Widget build(BuildContext context) {
    return _GlassCard(
      child: Column(
        mainAxisSize: MainAxisSize.min,
        children: [
          Container(
            width: 72,
            height: 72,
            decoration: const BoxDecoration(
              gradient: LinearGradient(colors: [Color(0xFF00C853), Color(0xFF69F0AE)]),
              shape: BoxShape.circle,
            ),
            child: const Icon(Icons.mark_email_read_outlined, color: Colors.white, size: 36),
          ).animate().fadeIn(duration: 400.ms).scale(begin: const Offset(0.6, 0.6), end: const Offset(1, 1)),
          const SizedBox(height: 20),
          Text(
            localizations.translate('auth_email_sent'),
            style: GoogleFonts.poppins(fontSize: 22, fontWeight: FontWeight.w800, color: const Color(0xFF2D3436)),
          ).animate().fadeIn(delay: 200.ms),
          const SizedBox(height: 10),
          Text(
            localizations.translateParams('auth_reset_link_sent_to', {'email': email}),
            textAlign: TextAlign.center,
            style: TextStyle(fontSize: 14, color: Colors.grey.shade600, height: 1.5),
          ).animate().fadeIn(delay: 300.ms),
          const SizedBox(height: 6),
          Text(
            localizations.translate('auth_check_spam'),
            style: TextStyle(fontSize: 12, color: Colors.grey.shade400),
          ).animate().fadeIn(delay: 380.ms),
          const SizedBox(height: 24),
          _PremiumButton(
            label: localizations.translate('auth_back_to_login'),
            isLoading: false,
            onPressed: () => context.go('/login'),
            animDelay: 450.ms,
          ),
        ],
      ),
    ).animate().fadeIn(duration: 400.ms).scale(begin: const Offset(0.96, 0.96), end: const Offset(1, 1));
  }
}

// ─── Shared ────────────────────────────────────────────────────────────────────

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
    required this.controller, required this.label, required this.icon,
    this.keyboardType = TextInputType.text, this.obscure = false,
    this.toggleObscure, this.validator, this.animDelay = Duration.zero,
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
      controller: controller, keyboardType: keyboardType, obscureText: obscure,
      decoration: InputDecoration(
        labelText: label,
        prefixIcon: Icon(icon, color: _g1, size: 20),
        suffixIcon: toggleObscure != null
            ? IconButton(icon: Icon(obscure ? Icons.visibility_rounded : Icons.visibility_off_rounded, color: Colors.grey.shade500, size: 20), onPressed: toggleObscure)
            : null,
        filled: true, fillColor: Colors.grey.shade50,
        border: OutlineInputBorder(borderRadius: BorderRadius.circular(14), borderSide: BorderSide(color: Colors.grey.shade200)),
        enabledBorder: OutlineInputBorder(borderRadius: BorderRadius.circular(14), borderSide: BorderSide(color: Colors.grey.shade200)),
        focusedBorder: OutlineInputBorder(borderRadius: BorderRadius.circular(14), borderSide: const BorderSide(color: _g1, width: 1.8)),
        errorBorder: OutlineInputBorder(borderRadius: BorderRadius.circular(14), borderSide: const BorderSide(color: Colors.red, width: 1.2)),
        focusedErrorBorder: OutlineInputBorder(borderRadius: BorderRadius.circular(14), borderSide: const BorderSide(color: Colors.red, width: 1.8)),
        labelStyle: TextStyle(color: Colors.grey.shade600, fontSize: 14),
        contentPadding: const EdgeInsets.symmetric(horizontal: 16, vertical: 14),
      ),
      validator: validator,
    ).animate().fadeIn(delay: animDelay, duration: 350.ms);
  }
}

class _PremiumButton extends StatelessWidget {
  const _PremiumButton({required this.label, required this.isLoading, required this.onPressed, this.animDelay = Duration.zero});
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
          gradient: isLoading ? const LinearGradient(colors: [Colors.grey, Colors.grey]) : const LinearGradient(colors: [_g1, _g2]),
          borderRadius: BorderRadius.circular(16),
          boxShadow: [BoxShadow(color: _g1.withOpacity(0.35), blurRadius: 18, offset: const Offset(0, 8))],
        ),
        child: ElevatedButton(
          onPressed: isLoading ? null : onPressed,
          style: ElevatedButton.styleFrom(backgroundColor: Colors.transparent, shadowColor: Colors.transparent, shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(16))),
          child: isLoading
              ? const SizedBox(width: 22, height: 22, child: CircularProgressIndicator(strokeWidth: 2.5, color: Colors.white))
              : Text(label, style: GoogleFonts.poppins(fontSize: 16, fontWeight: FontWeight.w700, color: Colors.white)),
        ),
      ),
    ).animate().fadeIn(delay: animDelay, duration: 350.ms);
  }
}

class _ErrorBanner extends StatelessWidget {
  const _ErrorBanner({required this.message, required this.onClose});
  final String message;
  final VoidCallback onClose;
  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 10),
      decoration: BoxDecoration(color: Colors.red.withOpacity(0.12), borderRadius: BorderRadius.circular(12), border: Border.all(color: Colors.red.withOpacity(0.3))),
      child: Row(children: [
        const Icon(Icons.error_outline_rounded, color: Colors.red, size: 18),
        const SizedBox(width: 8),
        Expanded(child: Text(message, style: const TextStyle(color: Colors.red, fontSize: 13))),
        GestureDetector(onTap: onClose, child: const Icon(Icons.close_rounded, color: Colors.red, size: 18)),
      ]),
    );
  }
}

class _AuthBg extends StatelessWidget {
  const _AuthBg({required this.animation});
  final Animation<double> animation;
  @override
  Widget build(BuildContext context) {
    return AnimatedBuilder(
      animation: animation,
      builder: (_, __) => Container(
        decoration: BoxDecoration(
          gradient: LinearGradient(
            begin: Alignment.topLeft, end: Alignment.bottomRight,
            colors: const [_g1, _g2, _g3], stops: const [0.0, 0.52, 1.0],
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
    void c(Paint p, double x, double y, double r) => canvas.drawCircle(Offset(size.width * x, size.height * y), size.width * r, p);
    c(Paint()..color = Colors.white.withOpacity(0.12)..maskFilter = MaskFilter.blur(BlurStyle.normal, size.shortestSide * 0.09), 0.18 + 0.06 * math.sin(a * 0.9), 0.24 + 0.06 * math.cos(a), 0.42);
    c(Paint()..color = const Color(0xFFFFD54F).withOpacity(0.12)..maskFilter = MaskFilter.blur(BlurStyle.normal, size.shortestSide * 0.11), 0.88 + 0.05 * math.cos(a), 0.22 + 0.06 * math.sin(a), 0.32);
    c(Paint()..color = const Color(0xFF69F0AE).withOpacity(0.09)..maskFilter = MaskFilter.blur(BlurStyle.normal, size.shortestSide * 0.13), 0.62 + 0.06 * math.sin(a), 0.84 + 0.05 * math.cos(a), 0.44);
  }
  @override
  bool shouldRepaint(_MeshPainter old) => old.t != t;
}
