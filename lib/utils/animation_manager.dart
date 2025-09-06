import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import '../widgets/animated_widgets.dart';

class AnimationManager {
  // Afficher une animation de succès
  static void showSuccess(BuildContext context, {String? message, VoidCallback? onComplete}) {
    HapticFeedback.lightImpact();
    showDialog(
      context: context,
      barrierDismissible: false,
      barrierColor: Colors.black54,
      builder: (context) => Dialog(
        backgroundColor: Colors.transparent,
        elevation: 0,
        child: Column(
          mainAxisSize: MainAxisSize.min,
          mainAxisAlignment: MainAxisAlignment.center,
          children: [
            SuccessAnimation(
              onComplete: () {
                Navigator.of(context).pop();
                onComplete?.call();
              },
            ),
            if (message != null) ...[
              const SizedBox(height: 20),
              Container(
                padding: const EdgeInsets.symmetric(horizontal: 30, vertical: 15),
                decoration: BoxDecoration(
                  color: Colors.white,
                  borderRadius: BorderRadius.circular(30),
                  boxShadow: [
                    BoxShadow(
                      color: Colors.green.withOpacity(0.3),
                      blurRadius: 20,
                      spreadRadius: 5,
                    ),
                  ],
                ),
                child: Text(
                  message,
                  style: const TextStyle(
                    fontSize: 16,
                    fontWeight: FontWeight.w600,
                    color: Colors.green,
                  ),
                ),
              ),
            ],
          ],
        ),
      ),
    );
  }

  // Afficher une animation d'erreur
  static void showError(BuildContext context, {required String message}) {
    HapticFeedback.heavyImpact();
    showDialog(
      context: context,
      barrierColor: Colors.black54,
      builder: (context) => Dialog(
        shape: RoundedRectangleBorder(
          borderRadius: BorderRadius.circular(20),
        ),
        child: Container(
          padding: const EdgeInsets.all(25),
          child: Column(
            mainAxisSize: MainAxisSize.min,
            children: [
              TweenAnimationBuilder<double>(
                duration: const Duration(milliseconds: 600),
                tween: Tween(begin: 0, end: 1),
                builder: (context, value, child) {
                  return Transform.scale(
                    scale: value,
                    child: Container(
                      width: 80,
                      height: 80,
                      decoration: BoxDecoration(
                        shape: BoxShape.circle,
                        color: Colors.red.withOpacity(0.1),
                      ),
                      child: Icon(
                        Icons.error_outline,
                        size: 50 * value,
                        color: Colors.red,
                      ),
                    ),
                  );
                },
              ),
              const SizedBox(height: 20),
              Text(
                'Erreur',
                style: TextStyle(
                  fontSize: 22,
                  fontWeight: FontWeight.bold,
                  color: Colors.red[700],
                ),
              ),
              const SizedBox(height: 10),
              Text(
                message,
                textAlign: TextAlign.center,
                style: const TextStyle(
                  fontSize: 16,
                  color: Colors.black87,
                ),
              ),
              const SizedBox(height: 25),
              AnimatedButton(
                onPressed: () => Navigator.of(context).pop(),
                backgroundColor: Colors.red,
                child: const Text(
                  'Fermer',
                  style: TextStyle(
                    color: Colors.white,
                    fontWeight: FontWeight.w600,
                  ),
                ),
              ),
            ],
          ),
        ),
      ),
    );
  }

  // Afficher un loader premium
  static void showLoading(BuildContext context, {String? message}) {
    showDialog(
      context: context,
      barrierDismissible: false,
      barrierColor: Colors.black54,
      builder: (context) => Dialog(
        backgroundColor: Colors.transparent,
        elevation: 0,
        child: Container(
          padding: const EdgeInsets.all(30),
          decoration: BoxDecoration(
            color: Colors.white,
            borderRadius: BorderRadius.circular(20),
            boxShadow: [
              BoxShadow(
                color: Theme.of(context).primaryColor.withOpacity(0.3),
                blurRadius: 30,
                spreadRadius: 5,
              ),
            ],
          ),
          child: Column(
            mainAxisSize: MainAxisSize.min,
            children: [
              PremiumLoadingIndicator(
                size: 60,
                color: Theme.of(context).primaryColor,
              ),
              if (message != null) ...[
                const SizedBox(height: 20),
                Text(
                  message,
                  style: const TextStyle(
                    fontSize: 16,
                    fontWeight: FontWeight.w500,
                    color: Colors.black87,
                  ),
                ),
              ],
            ],
          ),
        ),
      ),
    );
  }

  // Fermer le loader
  static void hideLoading(BuildContext context) {
    Navigator.of(context).pop();
  }

  // Animation d'ajout au panier
  static void showAddToCart(BuildContext context, {required GlobalKey widgetKey}) {
    HapticFeedback.selectionClick();
    
    final RenderBox renderBox = widgetKey.currentContext?.findRenderObject() as RenderBox;
    final position = renderBox.localToGlobal(Offset.zero);
    final size = renderBox.size;

    OverlayEntry? overlayEntry;
    overlayEntry = OverlayEntry(
      builder: (context) => AnimatedCartIcon(
        startPosition: position + Offset(size.width / 2, size.height / 2),
        endPosition: const Offset(300, 100), // Position du panier dans la nav
        onComplete: () {
          overlayEntry?.remove();
        },
      ),
    );

    Overlay.of(context).insert(overlayEntry);
  }

  // Animation de favori
  static void showFavoriteAnimation(BuildContext context) {
    HapticFeedback.lightImpact();
    
    final overlay = Overlay.of(context);
    final overlayEntry = OverlayEntry(
      builder: (context) => Center(
        child: TweenAnimationBuilder<double>(
          duration: const Duration(milliseconds: 800),
          tween: Tween(begin: 0, end: 1),
          builder: (context, value, child) {
            if (value > 0.5) {
              final fadeOut = 1 - ((value - 0.5) * 2);
              return Opacity(
                opacity: fadeOut,
                child: Transform.scale(
                  scale: 1 + (value * 0.5),
                  child: child,
                ),
              );
            }
            return Transform.scale(
              scale: value * 2,
              child: Opacity(
                opacity: value,
                child: child,
              ),
            );
          },
          child: const Icon(
            Icons.favorite,
            color: Colors.red,
            size: 100,
          ),
          onEnd: () {
            Future.delayed(const Duration(milliseconds: 100), () {
              // Remove overlay after animation
            });
          },
        ),
      ),
    );
    
    overlay.insert(overlayEntry);
    Future.delayed(const Duration(milliseconds: 900), () {
      overlayEntry.remove();
    });
  }

  // Animation de notification
  static void showNotification(BuildContext context, {
    required String message,
    IconData? icon,
    Color? backgroundColor,
    Duration duration = const Duration(seconds: 3),
  }) {
    final overlay = Overlay.of(context);
    late OverlayEntry overlayEntry;
    
    overlayEntry = OverlayEntry(
      builder: (context) => Positioned(
        top: MediaQuery.of(context).padding.top + 20,
        left: 20,
        right: 20,
        child: Material(
          color: Colors.transparent,
          child: TweenAnimationBuilder<double>(
            duration: const Duration(milliseconds: 500),
            tween: Tween(begin: 0, end: 1),
            builder: (context, value, child) {
              return Transform.translate(
                offset: Offset(0, -50 * (1 - value)),
                child: Opacity(
                  opacity: value,
                  child: Container(
                    padding: const EdgeInsets.symmetric(horizontal: 20, vertical: 15),
                    decoration: BoxDecoration(
                      color: backgroundColor ?? Theme.of(context).primaryColor,
                      borderRadius: BorderRadius.circular(15),
                      boxShadow: [
                        BoxShadow(
                          color: Colors.black.withOpacity(0.2),
                          blurRadius: 15,
                          offset: const Offset(0, 5),
                        ),
                      ],
                    ),
                    child: Row(
                      children: [
                        if (icon != null) ...[
                          Icon(icon, color: Colors.white),
                          const SizedBox(width: 15),
                        ],
                        Expanded(
                          child: Text(
                            message,
                            style: const TextStyle(
                              color: Colors.white,
                              fontSize: 16,
                              fontWeight: FontWeight.w500,
                            ),
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
    );
    
    overlay.insert(overlayEntry);
    
    Future.delayed(duration, () {
      overlayEntry.remove();
    });
  }
}

// Widget d'icône panier animée
class AnimatedCartIcon extends StatefulWidget {
  final Offset startPosition;
  final Offset endPosition;
  final VoidCallback onComplete;
  
  const AnimatedCartIcon({
    Key? key,
    required this.startPosition,
    required this.endPosition,
    required this.onComplete,
  }) : super(key: key);

  @override
  State<AnimatedCartIcon> createState() => _AnimatedCartIconState();
}

class _AnimatedCartIconState extends State<AnimatedCartIcon>
    with SingleTickerProviderStateMixin {
  late AnimationController _controller;
  late Animation<Offset> _positionAnimation;
  late Animation<double> _scaleAnimation;
  late Animation<double> _rotationAnimation;
  
  @override
  void initState() {
    super.initState();
    _controller = AnimationController(
      duration: const Duration(milliseconds: 800),
      vsync: this,
    );
    
    _positionAnimation = Tween<Offset>(
      begin: widget.startPosition,
      end: widget.endPosition,
    ).animate(CurvedAnimation(
      parent: _controller,
      curve: Curves.easeInOut,
    ));
    
    _scaleAnimation = TweenSequence<double>([
      TweenSequenceItem(tween: Tween(begin: 0, end: 1.5), weight: 30),
      TweenSequenceItem(tween: Tween(begin: 1.5, end: 0.3), weight: 70),
    ]).animate(_controller);
    
    _rotationAnimation = Tween<double>(
      begin: 0,
      end: 2,
    ).animate(_controller);
    
    _controller.forward().then((_) {
      widget.onComplete();
    });
  }
  
  @override
  void dispose() {
    _controller.dispose();
    super.dispose();
  }
  
  @override
  Widget build(BuildContext context) {
    return AnimatedBuilder(
      animation: _controller,
      builder: (context, child) {
        return Positioned(
          left: _positionAnimation.value.dx - 25,
          top: _positionAnimation.value.dy - 25,
          child: Transform.rotate(
            angle: _rotationAnimation.value * 3.14159,
            child: Transform.scale(
              scale: _scaleAnimation.value,
              child: Container(
                width: 50,
                height: 50,
                decoration: BoxDecoration(
                  shape: BoxShape.circle,
                  color: Theme.of(context).primaryColor,
                  boxShadow: [
                    BoxShadow(
                      color: Theme.of(context).primaryColor.withOpacity(0.5),
                      blurRadius: 20,
                      spreadRadius: 5,
                    ),
                  ],
                ),
                child: const Icon(
                  Icons.shopping_cart,
                  color: Colors.white,
                  size: 25,
                ),
              ),
            ),
          ),
        );
      },
    );
  }
}
