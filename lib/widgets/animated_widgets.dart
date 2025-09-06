import 'package:flutter/material.dart';

// Widget animé pour les boutons avec effet de pulsation
class AnimatedButton extends StatefulWidget {
  final Widget child;
  final VoidCallback onPressed;
  final Color? backgroundColor;
  final Duration duration;
  
  const AnimatedButton({
    Key? key,
    required this.child,
    required this.onPressed,
    this.backgroundColor,
    this.duration = const Duration(milliseconds: 200),
  }) : super(key: key);

  @override
  State<AnimatedButton> createState() => _AnimatedButtonState();
}

class _AnimatedButtonState extends State<AnimatedButton>
    with SingleTickerProviderStateMixin {
  late AnimationController _controller;
  late Animation<double> _scaleAnimation;
  
  @override
  void initState() {
    super.initState();
    _controller = AnimationController(
      duration: widget.duration,
      vsync: this,
    );
    _scaleAnimation = Tween<double>(
      begin: 1.0,
      end: 0.95,
    ).animate(CurvedAnimation(
      parent: _controller,
      curve: Curves.easeInOut,
    ));
  }
  
  @override
  void dispose() {
    _controller.dispose();
    super.dispose();
  }
  
  @override
  Widget build(BuildContext context) {
    return GestureDetector(
      onTapDown: (_) => _controller.forward(),
      onTapUp: (_) {
        _controller.reverse();
        widget.onPressed();
      },
      onTapCancel: () => _controller.reverse(),
      child: AnimatedBuilder(
        animation: _scaleAnimation,
        builder: (context, child) => Transform.scale(
          scale: _scaleAnimation.value,
          child: Container(
            decoration: BoxDecoration(
              color: widget.backgroundColor ?? Theme.of(context).primaryColor,
              borderRadius: BorderRadius.circular(12),
              boxShadow: [
                BoxShadow(
                  color: Colors.black.withOpacity(0.2),
                  blurRadius: 8,
                  offset: Offset(0, 4 * (1 - _scaleAnimation.value)),
                ),
              ],
            ),
            padding: const EdgeInsets.symmetric(horizontal: 24, vertical: 12),
            child: widget.child,
          ),
        ),
      ),
    );
  }
}

// Widget animé pour les cartes avec effet de survol
class AnimatedCard extends StatefulWidget {
  final Widget child;
  final VoidCallback? onTap;
  final Duration duration;
  
  const AnimatedCard({
    Key? key,
    required this.child,
    this.onTap,
    this.duration = const Duration(milliseconds: 300),
  }) : super(key: key);

  @override
  State<AnimatedCard> createState() => _AnimatedCardState();
}

class _AnimatedCardState extends State<AnimatedCard>
    with SingleTickerProviderStateMixin {
  late AnimationController _controller;
  late Animation<double> _scaleAnimation;
  late Animation<double> _rotationAnimation;
  
  @override
  void initState() {
    super.initState();
    _controller = AnimationController(
      duration: widget.duration,
      vsync: this,
    );
    _scaleAnimation = Tween<double>(
      begin: 1.0,
      end: 1.05,
    ).animate(CurvedAnimation(
      parent: _controller,
      curve: Curves.easeInOut,
    ));
    _rotationAnimation = Tween<double>(
      begin: 0,
      end: 0.02,
    ).animate(CurvedAnimation(
      parent: _controller,
      curve: Curves.easeInOut,
    ));
  }
  
  @override
  void dispose() {
    _controller.dispose();
    super.dispose();
  }
  
  @override
  Widget build(BuildContext context) {
    return MouseRegion(
      onEnter: (_) => _controller.forward(),
      onExit: (_) => _controller.reverse(),
      child: GestureDetector(
        onTap: widget.onTap,
        child: AnimatedBuilder(
          animation: _controller,
          builder: (context, child) => Transform(
            alignment: Alignment.center,
            transform: Matrix4.identity()
              ..setEntry(3, 2, 0.001)
              ..rotateY(_rotationAnimation.value)
              ..scale(_scaleAnimation.value),
            child: widget.child,
          ),
        ),
      ),
    );
  }
}

// Animation de chargement premium
class PremiumLoadingIndicator extends StatefulWidget {
  final double size;
  final Color? color;
  
  const PremiumLoadingIndicator({
    Key? key,
    this.size = 50,
    this.color,
  }) : super(key: key);

  @override
  State<PremiumLoadingIndicator> createState() => _PremiumLoadingIndicatorState();
}

class _PremiumLoadingIndicatorState extends State<PremiumLoadingIndicator>
    with TickerProviderStateMixin {
  late AnimationController _controller1;
  late AnimationController _controller2;
  late Animation<double> _animation1;
  late Animation<double> _animation2;
  
  @override
  void initState() {
    super.initState();
    _controller1 = AnimationController(
      duration: const Duration(seconds: 2),
      vsync: this,
    )..repeat();
    _controller2 = AnimationController(
      duration: const Duration(seconds: 3),
      vsync: this,
    )..repeat();
    
    _animation1 = CurvedAnimation(
      parent: _controller1,
      curve: Curves.easeInOut,
    );
    _animation2 = CurvedAnimation(
      parent: _controller2,
      curve: Curves.linear,
    );
  }
  
  @override
  void dispose() {
    _controller1.dispose();
    _controller2.dispose();
    super.dispose();
  }
  
  @override
  Widget build(BuildContext context) {
    final color = widget.color ?? Theme.of(context).primaryColor;
    
    return SizedBox(
      width: widget.size,
      height: widget.size,
      child: Stack(
        alignment: Alignment.center,
        children: [
          AnimatedBuilder(
            animation: _animation1,
            builder: (context, child) => Transform.scale(
              scale: _animation1.value,
              child: Container(
                width: widget.size,
                height: widget.size,
                decoration: BoxDecoration(
                  shape: BoxShape.circle,
                  border: Border.all(
                    color: color.withOpacity(0.3),
                    width: 3,
                  ),
                ),
              ),
            ),
          ),
          AnimatedBuilder(
            animation: _animation2,
            builder: (context, child) => Transform.rotate(
              angle: _animation2.value * 6.28,
              child: Container(
                width: widget.size * 0.7,
                height: widget.size * 0.7,
                decoration: BoxDecoration(
                  shape: BoxShape.circle,
                  gradient: LinearGradient(
                    colors: [
                      color,
                      color.withOpacity(0.5),
                      Colors.transparent,
                    ],
                    stops: const [0, 0.5, 1],
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

// Animation de succès
class SuccessAnimation extends StatefulWidget {
  final VoidCallback? onComplete;
  
  const SuccessAnimation({Key? key, this.onComplete}) : super(key: key);

  @override
  State<SuccessAnimation> createState() => _SuccessAnimationState();
}

class _SuccessAnimationState extends State<SuccessAnimation>
    with SingleTickerProviderStateMixin {
  late AnimationController _controller;
  late Animation<double> _scaleAnimation;
  late Animation<double> _opacityAnimation;
  
  @override
  void initState() {
    super.initState();
    _controller = AnimationController(
      duration: const Duration(seconds: 1),
      vsync: this,
    );
    
    _scaleAnimation = TweenSequence<double>([
      TweenSequenceItem(
        tween: Tween<double>(begin: 0, end: 1.2)
            .chain(CurveTween(curve: Curves.elasticOut)),
        weight: 70,
      ),
      TweenSequenceItem(
        tween: Tween<double>(begin: 1.2, end: 1)
            .chain(CurveTween(curve: Curves.easeInOut)),
        weight: 30,
      ),
    ]).animate(_controller);
    
    _opacityAnimation = Tween<double>(
      begin: 0,
      end: 1,
    ).animate(CurvedAnimation(
      parent: _controller,
      curve: const Interval(0, 0.5, curve: Curves.easeIn),
    ));
    
    _controller.forward().then((_) {
      Future.delayed(const Duration(milliseconds: 500), () {
        if (widget.onComplete != null) {
          widget.onComplete!();
        }
      });
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
      builder: (context, child) => Opacity(
        opacity: _opacityAnimation.value,
        child: Transform.scale(
          scale: _scaleAnimation.value,
          child: Container(
            width: 100,
            height: 100,
            decoration: BoxDecoration(
              shape: BoxShape.circle,
              color: Colors.green,
              boxShadow: [
                BoxShadow(
                  color: Colors.green.withOpacity(0.5),
                  blurRadius: 20,
                  spreadRadius: 5,
                ),
              ],
            ),
            child: const Icon(
              Icons.check,
              color: Colors.white,
              size: 60,
            ),
          ),
        ),
      ),
    );
  }
}

// Animation d'erreur avec shake
class ErrorShakeAnimation extends StatefulWidget {
  final Widget child;
  final bool isError;
  final Duration duration;
  
  const ErrorShakeAnimation({
    Key? key,
    required this.child,
    this.isError = false,
    this.duration = const Duration(milliseconds: 500),
  }) : super(key: key);

  @override
  State<ErrorShakeAnimation> createState() => _ErrorShakeAnimationState();
}

class _ErrorShakeAnimationState extends State<ErrorShakeAnimation>
    with SingleTickerProviderStateMixin {
  late AnimationController _controller;
  late Animation<double> _animation;
  
  @override
  void initState() {
    super.initState();
    _controller = AnimationController(
      duration: widget.duration,
      vsync: this,
    );
    
    _animation = TweenSequence<double>([
      TweenSequenceItem(tween: Tween(begin: 0.0, end: -10.0), weight: 1),
      TweenSequenceItem(tween: Tween(begin: -10.0, end: 10.0), weight: 1),
      TweenSequenceItem(tween: Tween(begin: 10.0, end: -10.0), weight: 1),
      TweenSequenceItem(tween: Tween(begin: -10.0, end: 10.0), weight: 1),
      TweenSequenceItem(tween: Tween(begin: 10.0, end: -5.0), weight: 1),
      TweenSequenceItem(tween: Tween(begin: -5.0, end: 5.0), weight: 1),
      TweenSequenceItem(tween: Tween(begin: 5.0, end: 0.0), weight: 1),
    ]).animate(CurvedAnimation(
      parent: _controller,
      curve: Curves.easeInOut,
    ));
  }
  
  @override
  void didUpdateWidget(ErrorShakeAnimation oldWidget) {
    super.didUpdateWidget(oldWidget);
    if (widget.isError && !oldWidget.isError) {
      _controller.forward(from: 0);
    }
  }
  
  @override
  void dispose() {
    _controller.dispose();
    super.dispose();
  }
  
  @override
  Widget build(BuildContext context) {
    return AnimatedBuilder(
      animation: _animation,
      builder: (context, child) => Transform.translate(
        offset: Offset(_animation.value, 0),
        child: widget.child,
      ),
    );
  }
}
