import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import '../utils/animation_manager.dart';

// Widget pour les réactions animées selon le contexte
class AnimatedReaction extends StatelessWidget {
  final ReactionType type;
  final Widget child;
  final VoidCallback? onComplete;
  
  const AnimatedReaction({
    Key? key,
    required this.type,
    required this.child,
    this.onComplete,
  }) : super(key: key);
  
  @override
  Widget build(BuildContext context) {
    switch (type) {
      case ReactionType.success:
        return _SuccessReaction(child: child, onComplete: onComplete);
      case ReactionType.error:
        return _ErrorReaction(child: child);
      case ReactionType.loading:
        return _LoadingReaction(child: child);
      case ReactionType.blocked:
        return _BlockedReaction(child: child);
      case ReactionType.addToCart:
        return _AddToCartReaction(child: child, onComplete: onComplete);
      case ReactionType.favorite:
        return _FavoriteReaction(child: child, onComplete: onComplete);
      case ReactionType.purchase:
        return _PurchaseReaction(child: child, onComplete: onComplete);
      default:
        return child;
    }
  }
}

enum ReactionType {
  success,
  error,
  loading,
  blocked,
  addToCart,
  favorite,
  purchase,
}

// Animation de succès avec particules
class _SuccessReaction extends StatefulWidget {
  final Widget child;
  final VoidCallback? onComplete;
  
  const _SuccessReaction({required this.child, this.onComplete});
  
  @override
  State<_SuccessReaction> createState() => _SuccessReactionState();
}

class _SuccessReactionState extends State<_SuccessReaction>
    with TickerProviderStateMixin {
  late AnimationController _controller;
  late AnimationController _particleController;
  late Animation<double> _scaleAnimation;
  late Animation<double> _checkAnimation;
  
  @override
  void initState() {
    super.initState();
    
    _controller = AnimationController(
      duration: const Duration(milliseconds: 1500),
      vsync: this,
    );
    
    _particleController = AnimationController(
      duration: const Duration(seconds: 2),
      vsync: this,
    );
    
    _scaleAnimation = TweenSequence<double>([
      TweenSequenceItem(
        tween: Tween(begin: 1.0, end: 1.2)
            .chain(CurveTween(curve: Curves.easeOut)),
        weight: 30,
      ),
      TweenSequenceItem(
        tween: Tween(begin: 1.2, end: 0.95)
            .chain(CurveTween(curve: Curves.elasticOut)),
        weight: 70,
      ),
    ]).animate(_controller);
    
    _checkAnimation = CurvedAnimation(
      parent: _controller,
      curve: const Interval(0.5, 1.0, curve: Curves.elasticOut),
    );
    
    _controller.forward();
    _particleController.forward();
    
    HapticFeedback.mediumImpact();
    
    if (widget.onComplete != null) {
      Future.delayed(const Duration(milliseconds: 1500), widget.onComplete!);
    }
  }
  
  @override
  void dispose() {
    _controller.dispose();
    _particleController.dispose();
    super.dispose();
  }
  
  @override
  Widget build(BuildContext context) {
    return Stack(
      alignment: Alignment.center,
      children: [
        // Particules d'explosion
        AnimatedBuilder(
          animation: _particleController,
          builder: (context, _) {
            return CustomPaint(
              size: const Size(300, 300),
              painter: ParticlePainter(
                progress: _particleController.value,
                color: Colors.green,
              ),
            );
          },
        ),
        // Widget principal avec animation
        AnimatedBuilder(
          animation: _scaleAnimation,
          builder: (context, child) => Transform.scale(
            scale: _scaleAnimation.value,
            child: widget.child,
          ),
        ),
        // Check mark overlay
        AnimatedBuilder(
          animation: _checkAnimation,
          builder: (context, _) {
            return Opacity(
              opacity: _checkAnimation.value,
              child: Transform.scale(
                scale: _checkAnimation.value,
                child: Container(
                  width: 60,
                  height: 60,
                  decoration: BoxDecoration(
                    shape: BoxShape.circle,
                    color: Colors.green.withOpacity(0.9),
                  ),
                  child: const Icon(
                    Icons.check,
                    color: Colors.white,
                    size: 35,
                  ),
                ),
              ),
            );
          },
        ),
      ],
    );
  }
}

// Animation d'erreur avec secousse
class _ErrorReaction extends StatefulWidget {
  final Widget child;
  
  const _ErrorReaction({required this.child});
  
  @override
  State<_ErrorReaction> createState() => _ErrorReactionState();
}

class _ErrorReactionState extends State<_ErrorReaction>
    with SingleTickerProviderStateMixin {
  late AnimationController _controller;
  late Animation<double> _shakeAnimation;
  late Animation<Color?> _colorAnimation;
  
  @override
  void initState() {
    super.initState();
    
    _controller = AnimationController(
      duration: const Duration(milliseconds: 800),
      vsync: this,
    );
    
    _shakeAnimation = TweenSequence<double>([
      TweenSequenceItem(tween: Tween(begin: 0, end: -15), weight: 10),
      TweenSequenceItem(tween: Tween(begin: -15, end: 15), weight: 10),
      TweenSequenceItem(tween: Tween(begin: 15, end: -15), weight: 10),
      TweenSequenceItem(tween: Tween(begin: -15, end: 10), weight: 10),
      TweenSequenceItem(tween: Tween(begin: 10, end: -10), weight: 10),
      TweenSequenceItem(tween: Tween(begin: -10, end: 5), weight: 10),
      TweenSequenceItem(tween: Tween(begin: 5, end: -5), weight: 10),
      TweenSequenceItem(tween: Tween(begin: -5, end: 0), weight: 30),
    ]).animate(_controller);
    
    _colorAnimation = ColorTween(
      begin: Colors.transparent,
      end: Colors.red.withOpacity(0.3),
    ).animate(CurvedAnimation(
      parent: _controller,
      curve: Curves.easeInOut,
    ));
    
    _controller.forward();
    HapticFeedback.heavyImpact();
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
        return Container(
          decoration: BoxDecoration(
            color: _colorAnimation.value,
            borderRadius: BorderRadius.circular(12),
          ),
          child: Transform.translate(
            offset: Offset(_shakeAnimation.value, 0),
            child: widget.child,
          ),
        );
      },
    );
  }
}

// Animation de chargement premium
class _LoadingReaction extends StatefulWidget {
  final Widget child;
  
  const _LoadingReaction({required this.child});
  
  @override
  State<_LoadingReaction> createState() => _LoadingReactionState();
}

class _LoadingReactionState extends State<_LoadingReaction>
    with SingleTickerProviderStateMixin {
  late AnimationController _controller;
  
  @override
  void initState() {
    super.initState();
    _controller = AnimationController(
      duration: const Duration(seconds: 2),
      vsync: this,
    )..repeat();
  }
  
  @override
  void dispose() {
    _controller.dispose();
    super.dispose();
  }
  
  @override
  Widget build(BuildContext context) {
    return Stack(
      alignment: Alignment.center,
      children: [
        AnimatedBuilder(
          animation: _controller,
          builder: (context, _) {
            return Transform.rotate(
              angle: _controller.value * 2 * 3.14159,
              child: Container(
                width: 100,
                height: 100,
                decoration: BoxDecoration(
                  shape: BoxShape.circle,
                  gradient: SweepGradient(
                    colors: [
                      Theme.of(context).primaryColor.withOpacity(0),
                      Theme.of(context).primaryColor,
                      Theme.of(context).primaryColor.withOpacity(0),
                    ],
                    stops: const [0.0, 0.5, 1.0],
                  ),
                ),
              ),
            );
          },
        ),
        widget.child,
      ],
    );
  }
}

// Animation de blocage avec effet dramatique
class _BlockedReaction extends StatefulWidget {
  final Widget child;
  
  const _BlockedReaction({required this.child});
  
  @override
  State<_BlockedReaction> createState() => _BlockedReactionState();
}

class _BlockedReactionState extends State<_BlockedReaction>
    with TickerProviderStateMixin {
  late AnimationController _controller;
  late AnimationController _pulseController;
  late Animation<double> _scaleAnimation;
  late Animation<double> _rotationAnimation;
  
  @override
  void initState() {
    super.initState();
    
    _controller = AnimationController(
      duration: const Duration(milliseconds: 1200),
      vsync: this,
    );
    
    _pulseController = AnimationController(
      duration: const Duration(seconds: 2),
      vsync: this,
    )..repeat(reverse: true);
    
    _scaleAnimation = TweenSequence<double>([
      TweenSequenceItem(
        tween: Tween(begin: 1.0, end: 0.8)
            .chain(CurveTween(curve: Curves.easeOut)),
        weight: 50,
      ),
      TweenSequenceItem(
        tween: Tween(begin: 0.8, end: 0.9)
            .chain(CurveTween(curve: Curves.elasticOut)),
        weight: 50,
      ),
    ]).animate(_controller);
    
    _rotationAnimation = Tween<double>(
      begin: 0,
      end: 0.1,
    ).animate(CurvedAnimation(
      parent: _controller,
      curve: Curves.elasticOut,
    ));
    
    _controller.forward();
    HapticFeedback.heavyImpact();
  }
  
  @override
  void dispose() {
    _controller.dispose();
    _pulseController.dispose();
    super.dispose();
  }
  
  @override
  Widget build(BuildContext context) {
    return AnimatedBuilder(
      animation: Listenable.merge([_controller, _pulseController]),
      builder: (context, child) {
        return Transform(
          alignment: Alignment.center,
          transform: Matrix4.identity()
            ..rotateZ(_rotationAnimation.value * (1 - _controller.value))
            ..scale(_scaleAnimation.value),
          child: Container(
            decoration: BoxDecoration(
              borderRadius: BorderRadius.circular(20),
              boxShadow: [
                BoxShadow(
                  color: Colors.red.withOpacity(0.3 + 0.2 * _pulseController.value),
                  blurRadius: 20 + 10 * _pulseController.value,
                  spreadRadius: 5,
                ),
              ],
            ),
            child: ColorFiltered(
              colorFilter: ColorFilter.mode(
                Colors.red.withOpacity(0.1),
                BlendMode.multiply,
              ),
              child: widget.child,
            ),
          ),
        );
      },
    );
  }
}

// Animation d'ajout au panier
class _AddToCartReaction extends StatefulWidget {
  final Widget child;
  final VoidCallback? onComplete;
  
  const _AddToCartReaction({required this.child, this.onComplete});
  
  @override
  State<_AddToCartReaction> createState() => _AddToCartReactionState();
}

class _AddToCartReactionState extends State<_AddToCartReaction>
    with SingleTickerProviderStateMixin {
  late AnimationController _controller;
  late Animation<double> _jumpAnimation;
  late Animation<double> _scaleAnimation;
  
  @override
  void initState() {
    super.initState();
    
    _controller = AnimationController(
      duration: const Duration(milliseconds: 800),
      vsync: this,
    );
    
    _jumpAnimation = TweenSequence<double>([
      TweenSequenceItem(
        tween: Tween(begin: 0.0, end: -30.0)
            .chain(CurveTween(curve: Curves.easeOut)),
        weight: 40,
      ),
      TweenSequenceItem(
        tween: Tween(begin: -30.0, end: 0.0)
            .chain(CurveTween(curve: Curves.bounceOut)),
        weight: 60,
      ),
    ]).animate(_controller);
    
    _scaleAnimation = TweenSequence<double>([
      TweenSequenceItem(
        tween: Tween(begin: 1.0, end: 1.3),
        weight: 30,
      ),
      TweenSequenceItem(
        tween: Tween(begin: 1.3, end: 1.0),
        weight: 70,
      ),
    ]).animate(_controller);
    
    _controller.forward().then((_) {
      widget.onComplete?.call();
    });
    
    HapticFeedback.lightImpact();
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
        return Transform.translate(
          offset: Offset(0, _jumpAnimation.value),
          child: Transform.scale(
            scale: _scaleAnimation.value,
            child: widget.child,
          ),
        );
      },
    );
  }
}

// Animation de favori avec cœur
class _FavoriteReaction extends StatefulWidget {
  final Widget child;
  final VoidCallback? onComplete;
  
  const _FavoriteReaction({required this.child, this.onComplete});
  
  @override
  State<_FavoriteReaction> createState() => _FavoriteReactionState();
}

class _FavoriteReactionState extends State<_FavoriteReaction>
    with TickerProviderStateMixin {
  late AnimationController _controller;
  late AnimationController _heartController;
  late List<Animation<Offset>> _heartAnimations;
  late List<Animation<double>> _opacityAnimations;
  
  @override
  void initState() {
    super.initState();
    
    _controller = AnimationController(
      duration: const Duration(milliseconds: 600),
      vsync: this,
    );
    
    _heartController = AnimationController(
      duration: const Duration(seconds: 2),
      vsync: this,
    );
    
    // Créer plusieurs cœurs flottants
    _heartAnimations = List.generate(5, (index) {
      final startAngle = (index * 72) * 3.14159 / 180;
      return Tween<Offset>(
        begin: Offset.zero,
        end: Offset(
          50 * (index % 2 == 0 ? 1 : -1),
          -100.0,
        ),
      ).animate(CurvedAnimation(
        parent: _heartController,
        curve: Curves.easeOut,
      ));
    });
    
    _opacityAnimations = List.generate(5, (index) {
      return Tween<double>(
        begin: 1.0,
        end: 0.0,
      ).animate(CurvedAnimation(
        parent: _heartController,
        curve: const Interval(0.5, 1.0),
      ));
    });
    
    _controller.forward();
    _heartController.forward();
    
    HapticFeedback.lightImpact();
    
    widget.onComplete?.call();
  }
  
  @override
  void dispose() {
    _controller.dispose();
    _heartController.dispose();
    super.dispose();
  }
  
  @override
  Widget build(BuildContext context) {
    return Stack(
      clipBehavior: Clip.none,
      alignment: Alignment.center,
      children: [
        // Cœurs flottants
        ...List.generate(5, (index) {
          return AnimatedBuilder(
            animation: _heartController,
            builder: (context, _) {
              return Transform.translate(
                offset: _heartAnimations[index].value,
                child: Opacity(
                  opacity: _opacityAnimations[index].value,
                  child: Icon(
                    Icons.favorite,
                    color: Colors.red.withOpacity(0.7),
                    size: 20 + (index * 3),
                  ),
                ),
              );
            },
          );
        }),
        // Widget principal
        AnimatedBuilder(
          animation: _controller,
          builder: (context, child) {
            return Transform.scale(
              scale: 1.0 + (_controller.value * 0.2),
              child: widget.child,
            );
          },
        ),
      ],
    );
  }
}

// Animation d'achat réussi
class _PurchaseReaction extends StatefulWidget {
  final Widget child;
  final VoidCallback? onComplete;
  
  const _PurchaseReaction({required this.child, this.onComplete});
  
  @override
  State<_PurchaseReaction> createState() => _PurchaseReactionState();
}

class _PurchaseReactionState extends State<_PurchaseReaction>
    with TickerProviderStateMixin {
  late AnimationController _controller;
  late Animation<double> _coinAnimation;
  late Animation<double> _glowAnimation;
  
  @override
  void initState() {
    super.initState();
    
    _controller = AnimationController(
      duration: const Duration(milliseconds: 1500),
      vsync: this,
    );
    
    _coinAnimation = CurvedAnimation(
      parent: _controller,
      curve: Curves.elasticOut,
    );
    
    _glowAnimation = TweenSequence<double>([
      TweenSequenceItem(
        tween: Tween(begin: 0.0, end: 1.0),
        weight: 50,
      ),
      TweenSequenceItem(
        tween: Tween(begin: 1.0, end: 0.0),
        weight: 50,
      ),
    ]).animate(_controller);
    
    _controller.forward().then((_) {
      widget.onComplete?.call();
    });
    
    HapticFeedback.mediumImpact();
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
        return Container(
          decoration: BoxDecoration(
            borderRadius: BorderRadius.circular(20),
            boxShadow: [
              BoxShadow(
                color: Colors.green.withOpacity(0.5 * _glowAnimation.value),
                blurRadius: 30 * _glowAnimation.value,
                spreadRadius: 10 * _glowAnimation.value,
              ),
            ],
          ),
          child: Transform.scale(
            scale: 0.8 + (0.2 * _coinAnimation.value),
            child: widget.child,
          ),
        );
      },
    );
  }
}

// Painter pour les particules
class ParticlePainter extends CustomPainter {
  final double progress;
  final Color color;
  
  ParticlePainter({required this.progress, required this.color});
  
  @override
  void paint(Canvas canvas, Size size) {
    final paint = Paint()
      ..color = color.withOpacity(1 - progress)
      ..style = PaintingStyle.fill;
    
    final center = Offset(size.width / 2, size.height / 2);
    final random = [0.3, 0.5, 0.7, 0.9, 1.1];
    
    for (int i = 0; i < 10; i++) {
      final angle = (i * 36) * 3.14159 / 180;
      final distance = 100 * progress * random[i % 5];
      final offset = Offset(
        center.dx + distance * (i % 2 == 0 ? 1 : -1),
        center.dy - distance,
      );
      
      canvas.drawCircle(
        offset,
        5 * (1 - progress),
        paint,
      );
    }
  }
  
  @override
  bool shouldRepaint(ParticlePainter oldDelegate) {
    return oldDelegate.progress != progress;
  }
}
