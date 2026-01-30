import 'package:flutter/material.dart';
import 'package:flutter_animate/flutter_animate.dart';
import 'package:go_router/go_router.dart';
import '../../localization/app_localizations.dart';

class AuthMethodSelectionScreen extends StatelessWidget {
  const AuthMethodSelectionScreen({super.key, required this.mode});

  final String mode;

  bool get _isLogin => mode == 'login';

  @override
  Widget build(BuildContext context) {
    final localizations = AppLocalizations.of(context);

    return Scaffold(
      appBar: AppBar(
        title: Text(_isLogin ? localizations.translate('login') : localizations.translate('register')),
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
          child: SingleChildScrollView(
            padding: const EdgeInsets.all(24),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.stretch,
              children: [
                const SizedBox(height: 10),
                Text(
                  _isLogin ? 'Se connecter avec' : 'Créer un compte avec',
                  textAlign: TextAlign.center,
                  style: Theme.of(context).textTheme.headlineSmall?.copyWith(
                        fontWeight: FontWeight.w900,
                        color: Colors.white,
                      ),
                ).animate().fadeIn(duration: 500.ms).slideY(begin: -0.10, end: 0),
                const SizedBox(height: 20),
                _MethodCard(
                  title: localizations.translate('email'),
                  subtitle: _isLogin ? 'Email + mot de passe' : 'Email + mot de passe',
                  icon: Icons.email_rounded,
                  onTap: () {
                    if (_isLogin) {
                      context.go('/login');
                    } else {
                      context.go('/register');
                    }
                  },
                ).animate().fadeIn(delay: 150.ms).slideX(begin: -0.10, end: 0),
                const SizedBox(height: 14),
                _MethodCard(
                  title: localizations.translate('phone'),
                  subtitle: 'SMS + code OTP',
                  icon: Icons.phone_rounded,
                  onTap: () => context.go('/phone-auth?mode=$mode'),
                ).animate().fadeIn(delay: 250.ms).slideX(begin: 0.10, end: 0),
                const SizedBox(height: 18),
                TextButton(
                  onPressed: () => context.go('/welcome'),
                  child: const Text('Retour'),
                  style: TextButton.styleFrom(foregroundColor: Colors.white),
                ).animate().fadeIn(delay: 350.ms),
              ],
            ),
          ),
        ),
      ),
    );
  }
}

class _MethodCard extends StatelessWidget {
  const _MethodCard({
    required this.title,
    required this.subtitle,
    required this.icon,
    required this.onTap,
  });

  final String title;
  final String subtitle;
  final IconData icon;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    return InkWell(
      onTap: onTap,
      borderRadius: BorderRadius.circular(18),
      child: Container(
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
        child: Row(
          children: [
            Container(
              width: 54,
              height: 54,
              decoration: BoxDecoration(
                color: const Color(0xFF2196F3).withOpacity(0.12),
                shape: BoxShape.circle,
              ),
              child: Icon(icon, color: const Color(0xFF1976D2)),
            ),
            const SizedBox(width: 14),
            Expanded(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(
                    title,
                    style: Theme.of(context).textTheme.titleMedium?.copyWith(
                          fontWeight: FontWeight.w900,
                        ),
                  ),
                  const SizedBox(height: 4),
                  Text(
                    subtitle,
                    style: Theme.of(context).textTheme.bodyMedium?.copyWith(
                          color: Colors.black54,
                        ),
                  ),
                ],
              ),
            ),
            const Icon(Icons.chevron_right_rounded, color: Colors.black38),
          ],
        ),
      ),
    );
  }
}
