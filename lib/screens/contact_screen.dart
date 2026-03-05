import 'dart:ui';

import 'package:flutter/material.dart';
import 'package:font_awesome_flutter/font_awesome_flutter.dart';
import 'package:go_router/go_router.dart';
import 'package:google_fonts/google_fonts.dart';
import 'package:url_launcher/url_launcher.dart';

import '../localization/app_localizations.dart';

const _g1 = Color(0xFF667eea);
const _g2 = Color(0xFF764ba2);

class ContactScreen extends StatelessWidget {
  const ContactScreen({super.key});

  static const String _phoneNumber = '+23566720010';
  static final Uri _phoneUri = Uri(scheme: 'tel', path: _phoneNumber);
  static final Uri _facebookUri = Uri.parse('https://www.facebook.com/share/1DC8wBiShc/');
  static final Uri _tiktokUri = Uri.parse('https://www.tiktok.com/@g.business.amdaradir?_r=1&_t=ZT-94HGcxhKbkb');

  Future<void> _open(BuildContext context, Uri uri) async {
    try {
      final ok = await launchUrl(uri, mode: LaunchMode.externalApplication);
      if (!ok && context.mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(content: Text(AppLocalizations.of(context).translate('contact_open_failed'))),
        );
      }
    } catch (_) {
      if (context.mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(content: Text(AppLocalizations.of(context).translate('contact_open_failed'))),
        );
      }
    }
  }

  @override
  Widget build(BuildContext context) {
    final loc = AppLocalizations.of(context);
    final isDark = Theme.of(context).brightness == Brightness.dark;

    return PopScope(
      canPop: true, // allow natural back when pushed on stack; PopScope handles edge cases
      onPopInvokedWithResult: (bool didPop, dynamic result) {
        if (didPop) return;
        if (!context.mounted) return;
        // Fallback: if nothing to pop in GoRouter, navigate to home
        if (GoRouter.of(context).canPop()) {
          GoRouter.of(context).pop();
        } else {
          context.go('/home');
        }
      },
      child: Scaffold(
        body: Stack(
        children: [
          Container(
            decoration: BoxDecoration(
              gradient: LinearGradient(
                begin: Alignment.topLeft,
                end: Alignment.bottomRight,
                colors: isDark
                    ? [const Color(0xFF1a1a2e), const Color(0xFF16213e)]
                    : [_g1.withOpacity(0.12), _g2.withOpacity(0.08)],
              ),
            ),
          ),
          SafeArea(
            child: Column(
              children: [
                Padding(
                  padding: const EdgeInsets.fromLTRB(8, 8, 16, 8),
                  child: Row(
                    children: [
                      Material(
                        color: (isDark ? Colors.white : _g1).withOpacity(0.2),
                        borderRadius: BorderRadius.circular(14),
                        child: InkWell(
                          borderRadius: BorderRadius.circular(14),
                          onTap: () {
                            if (context.canPop()) {
                              context.pop();
                            } else {
                              context.go('/home');
                            }
                          },
                          child: Padding(
                            padding: const EdgeInsets.all(10),
                            child: Icon(
                              Icons.arrow_back_rounded,
                              color: isDark ? Colors.white : _g2,
                              size: 22,
                            ),
                          ),
                        ),
                      ),
                      const SizedBox(width: 16),
                      Text(
                        loc.translate('contact_title'),
                        style: GoogleFonts.poppins(
                          fontSize: 22,
                          fontWeight: FontWeight.w800,
                          color: isDark ? Colors.white : _g2,
                        ),
                      ),
                    ],
                  ),
                ),
                Expanded(
                  child: ClipRRect(
                    borderRadius: const BorderRadius.only(topLeft: Radius.circular(28), topRight: Radius.circular(28)),
                    child: BackdropFilter(
                      filter: ImageFilter.blur(sigmaX: 10, sigmaY: 10),
                      child: Container(
                        decoration: BoxDecoration(
                          color: (isDark ? const Color(0xFF1a1a2e) : Colors.white).withOpacity(0.95),
                          borderRadius: const BorderRadius.only(topLeft: Radius.circular(28), topRight: Radius.circular(28)),
                        ),
                        child: ListView(
                          padding: const EdgeInsets.fromLTRB(20, 24, 20, 32),
                          children: [
                            _ContactTile(
                              icon: Icons.phone_rounded,
                              gradient: const [Color(0xFF00C853), Color(0xFF69F0AE)],
                              title: loc.translate('contact_phone_title'),
                              subtitle: _phoneNumber,
                              onTap: () => _open(context, _phoneUri),
                              isDark: isDark,
                            ),
                            const SizedBox(height: 16),
                            _ContactTile(
                              iconWidget: const FaIcon(FontAwesomeIcons.facebook, color: Colors.white, size: 22),
                              gradient: const [Color(0xFF1877F2), Color(0xFF0D65D9)],
                              title: loc.translate('contact_facebook_title'),
                              subtitle: loc.translate('contact_facebook_subtitle'),
                              onTap: () => _open(context, _facebookUri),
                              isDark: isDark,
                            ),
                            const SizedBox(height: 16),
                            _ContactTile(
                              iconWidget: const FaIcon(FontAwesomeIcons.tiktok, color: Colors.white, size: 22),
                              gradient: [Colors.black, Colors.grey.shade800],
                              title: loc.translate('contact_tiktok_title'),
                              subtitle: loc.translate('contact_tiktok_subtitle'),
                              onTap: () => _open(context, _tiktokUri),
                              isDark: isDark,
                            ),
                          ],
                        ),
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
    );
  }
}

class _ContactTile extends StatelessWidget {
  const _ContactTile({
    required this.title,
    required this.subtitle,
    required this.onTap,
    required this.gradient,
    required this.isDark,
    this.icon,
    this.iconWidget,
  });

  final String title;
  final String subtitle;
  final VoidCallback onTap;
  final List<Color> gradient;
  final bool isDark;
  final IconData? icon;
  final Widget? iconWidget;

  @override
  Widget build(BuildContext context) {
    return Material(
      color: Colors.transparent,
      child: InkWell(
        onTap: onTap,
        borderRadius: BorderRadius.circular(20),
        child: Container(
          padding: const EdgeInsets.all(18),
          decoration: BoxDecoration(
            borderRadius: BorderRadius.circular(20),
            border: Border.all(
              color: (isDark ? Colors.white : _g1).withOpacity(0.12),
            ),
            boxShadow: [
              BoxShadow(
                color: (isDark ? Colors.black : _g1).withOpacity(0.08),
                blurRadius: 16,
                offset: const Offset(0, 6),
              ),
            ],
          ),
          child: Row(
            children: [
              Container(
                width: 52,
                height: 52,
                decoration: BoxDecoration(
                  gradient: LinearGradient(colors: gradient),
                  borderRadius: BorderRadius.circular(16),
                  boxShadow: [
                    BoxShadow(
                      color: gradient.first.withOpacity(0.4),
                      blurRadius: 12,
                      offset: const Offset(0, 4),
                    ),
                  ],
                ),
                child: Center(
                  child: iconWidget ?? Icon(icon, color: Colors.white, size: 24),
                ),
              ),
              const SizedBox(width: 16),
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(
                      title,
                      style: GoogleFonts.poppins(
                        fontWeight: FontWeight.w800,
                        fontSize: 16,
                        color: isDark ? Colors.white : const Color(0xFF2D3436),
                      ),
                    ),
                    const SizedBox(height: 4),
                    Text(
                      subtitle,
                      style: TextStyle(
                        color: (isDark ? Colors.white70 : Colors.grey.shade600),
                        fontSize: 13,
                      ),
                      maxLines: 2,
                      overflow: TextOverflow.ellipsis,
                    ),
                  ],
                ),
              ),
              Icon(
                Icons.arrow_forward_ios_rounded,
                size: 14,
                color: isDark ? Colors.white54 : Colors.grey.shade500,
              ),
            ],
          ),
        ),
      ),
    );
  }
}
