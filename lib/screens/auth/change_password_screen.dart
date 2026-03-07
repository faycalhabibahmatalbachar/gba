import 'package:flutter/material.dart';
import 'package:flutter/foundation.dart';
import 'package:go_router/go_router.dart';
import 'package:font_awesome_flutter/font_awesome_flutter.dart';
import 'package:supabase_flutter/supabase_flutter.dart';
import '../../localization/app_localizations.dart';

class ChangePasswordScreen extends StatefulWidget {
  const ChangePasswordScreen({super.key});

  @override
  State<ChangePasswordScreen> createState() => _ChangePasswordScreenState();
}

class _ChangePasswordScreenState extends State<ChangePasswordScreen>
    with SingleTickerProviderStateMixin {
  final _currentController = TextEditingController();
  final _newController = TextEditingController();
  final _confirmController = TextEditingController();
  bool _loading = false;
  bool _obscureCurrent = true;
  bool _obscureNew = true;
  bool _obscureConfirm = true;
  late AnimationController _animController;
  late Animation<double> _fadeAnimation;

  @override
  void initState() {
    super.initState();
    _animController = AnimationController(
      duration: const Duration(milliseconds: 800),
      vsync: this,
    );
    _fadeAnimation = CurvedAnimation(
      parent: _animController,
      curve: Curves.easeOutCubic,
    );
    _animController.forward();
  }

  @override
  void dispose() {
    _animController.dispose();
    _currentController.dispose();
    _newController.dispose();
    _confirmController.dispose();
    super.dispose();
  }

  Future<void> _submit() async {
    final localizations = AppLocalizations.of(context);

    final currentPassword = _currentController.text;
    final newPassword = _newController.text;
    final confirm = _confirmController.text;

    final user = Supabase.instance.client.auth.currentUser;
    final email = user?.email;
    if (email == null || email.isEmpty) {
      _showSnackBar(localizations.translate('error_user_email_not_found'), isError: true);
      return;
    }

    if (newPassword.length < 6) {
      _showSnackBar(localizations.translate('password_min_length'), isError: true);
      return;
    }

    if (newPassword != confirm) {
      _showSnackBar(localizations.translate('passwords_do_not_match'), isError: true);
      return;
    }

    setState(() => _loading = true);
    try {
      await Supabase.instance.client.auth.signInWithPassword(
        email: email,
        password: currentPassword,
      );

      await Supabase.instance.client.auth.updateUser(
        UserAttributes(password: newPassword),
      );

      if (!mounted) return;
      _showSnackBar(localizations.translate('password_changed_success'), isError: false);
      context.pop();
    } catch (e) {
      if (!mounted) return;
      _showSnackBar(
        localizations.translateParams('error_with_details', {'error': e.toString()}),
        isError: true,
      );
    } finally {
      if (mounted) setState(() => _loading = false);
    }
  }

  void _showSnackBar(String message, {required bool isError}) {
    ScaffoldMessenger.of(context).showSnackBar(
      SnackBar(
        content: Row(
          children: [
            Icon(
              isError ? FontAwesomeIcons.circleExclamation : FontAwesomeIcons.circleCheck,
              color: Colors.white,
              size: 18,
            ),
            const SizedBox(width: 12),
            Expanded(child: Text(message)),
          ],
        ),
        backgroundColor: isError ? Colors.red : Colors.green,
        behavior: kIsWeb ? SnackBarBehavior.fixed : SnackBarBehavior.floating,
        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
      ),
    );
  }

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    final isDark = theme.brightness == Brightness.dark;
    final localizations = AppLocalizations.of(context);

    return Scaffold(
      extendBodyBehindAppBar: true,
      appBar: AppBar(
        backgroundColor: Colors.transparent,
        elevation: 0,
        leading: IconButton(
          icon: Container(
            padding: const EdgeInsets.all(8),
            decoration: BoxDecoration(
              color: theme.colorScheme.surface.withOpacity(0.9),
              borderRadius: BorderRadius.circular(12),
            ),
            child: Icon(
              FontAwesomeIcons.arrowLeft,
              color: theme.colorScheme.onSurface,
              size: 16,
            ),
          ),
          onPressed: () => Navigator.pop(context),
        ),
        title: Row(
          children: [
            Icon(FontAwesomeIcons.key, size: 18, color: theme.colorScheme.onSurface),
            const SizedBox(width: 12),
            Text(
              localizations.translate('change_password'),
              style: TextStyle(
                fontWeight: FontWeight.bold,
                color: theme.colorScheme.onSurface,
              ),
            ),
          ],
        ),
      ),
      body: Stack(
        children: [
          Container(
            decoration: BoxDecoration(
              gradient: LinearGradient(
                begin: Alignment.topLeft,
                end: Alignment.bottomRight,
                colors: isDark
                    ? [
                        Colors.deepPurple.shade900.withOpacity(0.3),
                        Colors.purple.shade900.withOpacity(0.3),
                      ]
                    : [
                        Colors.blue.shade50,
                        Colors.purple.shade50,
                        Colors.pink.shade50,
                      ],
              ),
            ),
          ),
          SafeArea(
            child: FadeTransition(
              opacity: _fadeAnimation,
              child: LayoutBuilder(
                builder: (context, constraints) {
                  final maxWidth = constraints.maxWidth < 600 ? constraints.maxWidth : 520.0;

                  return SingleChildScrollView(
                    padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 24),
                    child: Center(
                      child: ConstrainedBox(
                        constraints: BoxConstraints(maxWidth: maxWidth),
                        child: Column(
                          children: [
                            Container(
                              padding: const EdgeInsets.all(20),
                              decoration: BoxDecoration(
                                color: theme.colorScheme.surface,
                                borderRadius: BorderRadius.circular(20),
                                boxShadow: [
                                  BoxShadow(
                                    color: Colors.black.withOpacity(0.05),
                                    blurRadius: 15,
                                    offset: const Offset(0, 5),
                                  ),
                                ],
                              ),
                              child: Column(
                                crossAxisAlignment: CrossAxisAlignment.stretch,
                                children: [
                                  Row(
                                    children: [
                                      Container(
                                        padding: const EdgeInsets.all(10),
                                        decoration: BoxDecoration(
                                          gradient: LinearGradient(
                                            colors: [Colors.purple.shade400, Colors.blue.shade400],
                                          ),
                                          borderRadius: BorderRadius.circular(12),
                                        ),
                                        child: const Icon(FontAwesomeIcons.shieldHalved, color: Colors.white, size: 18),
                                      ),
                                      const SizedBox(width: 14),
                                      Expanded(
                                        child: Text(
                                          localizations.translate('change_password_security_hint'),
                                          style: TextStyle(
                                            fontSize: 14,
                                            color: theme.colorScheme.onSurfaceVariant,
                                          ),
                                        ),
                                      ),
                                    ],
                                  ),
                                  const SizedBox(height: 24),
                                  _buildPasswordField(
                                    controller: _currentController,
                                    label: localizations.translate('current_password'),
                                    icon: FontAwesomeIcons.lock,
                                    obscure: _obscureCurrent,
                                    onToggle: () => setState(() => _obscureCurrent = !_obscureCurrent),
                                  ),
                                  const SizedBox(height: 16),
                                  _buildPasswordField(
                                    controller: _newController,
                                    label: localizations.translate('new_password'),
                                    icon: FontAwesomeIcons.lockOpen,
                                    obscure: _obscureNew,
                                    onToggle: () => setState(() => _obscureNew = !_obscureNew),
                                  ),
                                  const SizedBox(height: 16),
                                  _buildPasswordField(
                                    controller: _confirmController,
                                    label: localizations.translate('confirm_password'),
                                    icon: FontAwesomeIcons.circleCheck,
                                    obscure: _obscureConfirm,
                                    onToggle: () => setState(() => _obscureConfirm = !_obscureConfirm),
                                  ),
                                  const SizedBox(height: 24),
                                  SizedBox(
                                    height: 52,
                                    child: ElevatedButton(
                                      onPressed: _loading ? null : _submit,
                                      style: ElevatedButton.styleFrom(
                                        backgroundColor: const Color(0xFF667eea),
                                        foregroundColor: Colors.white,
                                        shape: RoundedRectangleBorder(
                                          borderRadius: BorderRadius.circular(14),
                                        ),
                                        elevation: 0,
                                      ),
                                      child: _loading
                                          ? const SizedBox(
                                              width: 20,
                                              height: 20,
                                              child: CircularProgressIndicator(
                                                strokeWidth: 2,
                                                color: Colors.white,
                                              ),
                                            )
                                          : Text(
                                              localizations.translate('save'),
                                              style: const TextStyle(
                                                fontSize: 16,
                                                fontWeight: FontWeight.w600,
                                              ),
                                            ),
                                    ),
                                  ),
                                ],
                              ),
                            ),
                          ],
                        ),
                      ),
                    ),
                  );
                },
              ),
            ),
          ),
        ],
      ),
    );
  }

  Widget _buildPasswordField({
    required TextEditingController controller,
    required String label,
    required IconData icon,
    required bool obscure,
    required VoidCallback onToggle,
  }) {
    final theme = Theme.of(context);
    final isDark = theme.brightness == Brightness.dark;
    return TextField(
      controller: controller,
      obscureText: obscure,
      decoration: InputDecoration(
        labelText: label,
        prefixIcon: Icon(icon, size: 16),
        suffixIcon: IconButton(
          icon: Icon(
            obscure ? FontAwesomeIcons.eye : FontAwesomeIcons.eyeSlash,
            size: 16,
            color: theme.colorScheme.onSurfaceVariant,
          ),
          onPressed: onToggle,
        ),
        border: OutlineInputBorder(
          borderRadius: BorderRadius.circular(12),
          borderSide: BorderSide(color: theme.dividerColor),
        ),
        focusedBorder: OutlineInputBorder(
          borderRadius: BorderRadius.circular(12),
          borderSide: const BorderSide(color: Color(0xFF667eea), width: 2),
        ),
        filled: true,
        fillColor: isDark ? theme.colorScheme.surface : Colors.grey[50],
      ),
    );
  }
}
