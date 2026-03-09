import 'package:flutter/material.dart';
import 'package:lottie/lottie.dart';
import 'package:provider/provider.dart';
import '../services/connectivity_service.dart';
import '../localization/app_localizations.dart';

/// Overlay widget that displays when internet connection is lost
class NoInternetOverlay extends StatelessWidget {
  final Widget child;

  const NoInternetOverlay({
    super.key,
    required this.child,
  });

  @override
  Widget build(BuildContext context) {
    return Consumer<ConnectivityService>(
      builder: (context, connectivity, _) {
        return Stack(
          children: [
            child,
            if (!connectivity.isOnline)
              Positioned.fill(
                child: _NoInternetScreen(),
              ),
          ],
        );
      },
    );
  }
}

class _NoInternetScreen extends StatefulWidget {
  @override
  State<_NoInternetScreen> createState() => _NoInternetScreenState();
}

class _NoInternetScreenState extends State<_NoInternetScreen>
    with SingleTickerProviderStateMixin {
  late AnimationController _pulseController;
  late Animation<double> _pulseAnimation;

  @override
  void initState() {
    super.initState();
    _pulseController = AnimationController(
      duration: const Duration(seconds: 2),
      vsync: this,
    )..repeat(reverse: true);

    _pulseAnimation = Tween<double>(
      begin: 0.95,
      end: 1.05,
    ).animate(CurvedAnimation(
      parent: _pulseController,
      curve: Curves.easeInOut,
    ));
  }

  @override
  void dispose() {
    _pulseController.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final localizations = AppLocalizations.of(context);
    final theme = Theme.of(context);
    final isDark = theme.brightness == Brightness.dark;

    return Material(
      color: isDark ? const Color(0xFF1A1D21) : Colors.white,
      child: Container(
        decoration: BoxDecoration(
          gradient: LinearGradient(
            begin: Alignment.topCenter,
            end: Alignment.bottomCenter,
            colors: isDark
                ? [
                    const Color(0xFF1A1D21),
                    const Color(0xFF2C3036),
                  ]
                : [
                    Colors.blue.shade50,
                    Colors.white,
                  ],
          ),
        ),
        child: SafeArea(
          child: Center(
            child: Padding(
              padding: const EdgeInsets.all(32.0),
              child: Column(
                mainAxisAlignment: MainAxisAlignment.center,
                children: [
                  // Lottie animation
                  ScaleTransition(
                    scale: _pulseAnimation,
                    child: SizedBox(
                      width: 280,
                      height: 280,
                      child: Lottie.asset(
                        'assets/animations/lottie/no_internet.json',
                        fit: BoxFit.contain,
                        repeat: true,
                        errorBuilder: (context, error, stackTrace) {
                          // Fallback icon if animation not found
                          return Icon(
                            Icons.wifi_off_rounded,
                            size: 120,
                            color: isDark 
                                ? Colors.grey.shade600 
                                : Colors.grey.shade400,
                          );
                        },
                      ),
                    ),
                  ),
                  const SizedBox(height: 32),
                  
                  // Title
                  Text(
                    localizations.translate('no_internet_connection'),
                    style: theme.textTheme.headlineSmall?.copyWith(
                      fontWeight: FontWeight.w900,
                      color: isDark ? Colors.white : Colors.black87,
                    ),
                    textAlign: TextAlign.center,
                  ),
                  const SizedBox(height: 16),
                  
                  // Description
                  Text(
                    localizations.translate('check_connection_and_retry'),
                    style: theme.textTheme.bodyLarge?.copyWith(
                      color: isDark 
                          ? Colors.grey.shade400 
                          : Colors.grey.shade700,
                    ),
                    textAlign: TextAlign.center,
                  ),
                  const SizedBox(height: 48),
                  
                  // Animated loading indicator
                  Container(
                    padding: const EdgeInsets.all(16),
                    decoration: BoxDecoration(
                      color: theme.primaryColor.withOpacity(0.1),
                      borderRadius: BorderRadius.circular(16),
                    ),
                    child: Row(
                      mainAxisSize: MainAxisSize.min,
                      children: [
                        SizedBox(
                          width: 20,
                          height: 20,
                          child: CircularProgressIndicator(
                            strokeWidth: 2.5,
                            valueColor: AlwaysStoppedAnimation<Color>(
                              theme.primaryColor,
                            ),
                          ),
                        ),
                        const SizedBox(width: 16),
                        Text(
                          _getWaitingMessage(localizations),
                          style: TextStyle(
                            color: theme.primaryColor,
                            fontWeight: FontWeight.w600,
                          ),
                        ),
                      ],
                    ),
                  ),
                ],
              ),
            ),
          ),
        ),
      ),
    );
  }

  String _getWaitingMessage(AppLocalizations localizations) {
    final locale = localizations.locale.languageCode;
    switch (locale) {
      case 'ar':
        return 'في انتظار الاتصال...';
      case 'en':
        return 'Waiting for connection...';
      case 'fr':
      default:
        return 'En attente de connexion...';
    }
  }
}
