import 'package:flutter/material.dart';

// Transition Fade In Scale
class FadeScaleTransition extends PageRouteBuilder {
  final Widget page;
  
  FadeScaleTransition({required this.page})
      : super(
          pageBuilder: (context, animation, secondaryAnimation) => page,
          transitionDuration: const Duration(milliseconds: 600),
          reverseTransitionDuration: const Duration(milliseconds: 400),
          transitionsBuilder: (context, animation, secondaryAnimation, child) {
            const begin = 0.0;
            const end = 1.0;
            const curve = Curves.easeOutQuart;
            
            var tween = Tween(begin: begin, end: end);
            var curvedAnimation = CurvedAnimation(
              parent: animation,
              curve: curve,
            );
            
            return FadeTransition(
              opacity: tween.animate(curvedAnimation),
              child: ScaleTransition(
                scale: Tween<double>(
                  begin: 0.85,
                  end: 1.0,
                ).animate(CurvedAnimation(
                  parent: animation,
                  curve: curve,
                )),
                child: child,
              ),
            );
          },
        );
}

// Transition Slide Fade
class SlideFadeTransition extends PageRouteBuilder {
  final Widget page;
  final AxisDirection direction;
  
  SlideFadeTransition({
    required this.page, 
    this.direction = AxisDirection.left
  }) : super(
          pageBuilder: (context, animation, secondaryAnimation) => page,
          transitionDuration: const Duration(milliseconds: 500),
          reverseTransitionDuration: const Duration(milliseconds: 350),
          transitionsBuilder: (context, animation, secondaryAnimation, child) {
            Offset begin;
            switch (direction) {
              case AxisDirection.right:
                begin = const Offset(-1.0, 0.0);
                break;
              case AxisDirection.left:
                begin = const Offset(1.0, 0.0);
                break;
              case AxisDirection.up:
                begin = const Offset(0.0, 1.0);
                break;
              case AxisDirection.down:
                begin = const Offset(0.0, -1.0);
                break;
            }
            
            const end = Offset.zero;
            const curve = Curves.easeInOutCubic;
            
            var tween = Tween(begin: begin, end: end).chain(
              CurveTween(curve: curve),
            );
            
            var offsetAnimation = animation.drive(tween);
            
            return SlideTransition(
              position: offsetAnimation,
              child: FadeTransition(
                opacity: Tween<double>(
                  begin: 0.0,
                  end: 1.0,
                ).animate(CurvedAnimation(
                  parent: animation,
                  curve: const Interval(0.0, 0.5, curve: Curves.easeOut),
                )),
                child: child,
              ),
            );
          },
        );
}

// Transition 3D Flip
class FlipTransition extends PageRouteBuilder {
  final Widget page;
  
  FlipTransition({required this.page})
      : super(
          pageBuilder: (context, animation, secondaryAnimation) => page,
          transitionDuration: const Duration(milliseconds: 800),
          reverseTransitionDuration: const Duration(milliseconds: 600),
          transitionsBuilder: (context, animation, secondaryAnimation, child) {
            final rotateAnimation = Tween<double>(
              begin: 0.0,
              end: 1.0,
            ).animate(CurvedAnimation(
              parent: animation,
              curve: Curves.easeInOutBack,
            ));
            
            return AnimatedBuilder(
              animation: rotateAnimation,
              child: child,
              builder: (context, child) {
                final isUnder = (ValueKey(child?.key) != ValueKey(page.key));
                final value = isUnder ? 1.0 - rotateAnimation.value : rotateAnimation.value;
                final angle = value * 3.14159 / 2;
                
                if (value >= 0.5) {
                  return Transform(
                    alignment: Alignment.center,
                    transform: Matrix4.identity()
                      ..setEntry(3, 2, 0.001)
                      ..rotateY(3.14159),
                    child: child,
                  );
                } else {
                  return Transform(
                    alignment: Alignment.center,
                    transform: Matrix4.identity()
                      ..setEntry(3, 2, 0.001)
                      ..rotateY(angle),
                    child: child,
                  );
                }
              },
            );
          },
        );
}

// Transition Parallax
class ParallaxTransition extends PageRouteBuilder {
  final Widget page;
  
  ParallaxTransition({required this.page})
      : super(
          pageBuilder: (context, animation, secondaryAnimation) => page,
          transitionDuration: const Duration(milliseconds: 700),
          transitionsBuilder: (context, animation, secondaryAnimation, child) {
            return Stack(
              children: [
                SlideTransition(
                  position: Tween<Offset>(
                    begin: Offset.zero,
                    end: const Offset(-0.3, 0.0),
                  ).animate(CurvedAnimation(
                    parent: secondaryAnimation,
                    curve: Curves.easeInOutCubic,
                  )),
                  child: Container(
                    color: Colors.black.withOpacity(
                      secondaryAnimation.value * 0.5,
                    ),
                  ),
                ),
                SlideTransition(
                  position: Tween<Offset>(
                    begin: const Offset(1.0, 0.0),
                    end: Offset.zero,
                  ).animate(CurvedAnimation(
                    parent: animation,
                    curve: Curves.easeOutCubic,
                  )),
                  child: FadeTransition(
                    opacity: Tween<double>(
                      begin: 0.0,
                      end: 1.0,
                    ).animate(CurvedAnimation(
                      parent: animation,
                      curve: const Interval(0.2, 1.0, curve: Curves.easeOut),
                    )),
                    child: child,
                  ),
                ),
              ],
            );
          },
        );
}

// Hero Diagonal Transition
class HeroDiagonalTransition extends PageRouteBuilder {
  final Widget page;
  
  HeroDiagonalTransition({required this.page})
      : super(
          pageBuilder: (context, animation, secondaryAnimation) => page,
          transitionDuration: const Duration(milliseconds: 600),
          transitionsBuilder: (context, animation, secondaryAnimation, child) {
            const begin = Offset(1.0, 1.0);
            const end = Offset.zero;
            const curve = Curves.fastOutSlowIn;
            
            var tween = Tween(begin: begin, end: end).chain(
              CurveTween(curve: curve),
            );
            
            return SlideTransition(
              position: animation.drive(tween),
              child: FadeTransition(
                opacity: Tween<double>(
                  begin: 0.0,
                  end: 1.0,
                ).animate(CurvedAnimation(
                  parent: animation,
                  curve: const Interval(0.0, 0.5, curve: Curves.easeOut),
                )),
                child: ScaleTransition(
                  scale: Tween<double>(
                    begin: 0.7,
                    end: 1.0,
                  ).animate(CurvedAnimation(
                    parent: animation,
                    curve: Curves.easeOutBack,
                  )),
                  child: child,
                ),
              ),
            );
          },
        );
}

// Elastic Transition
class ElasticTransition extends PageRouteBuilder {
  final Widget page;
  
  ElasticTransition({required this.page})
      : super(
          pageBuilder: (context, animation, secondaryAnimation) => page,
          transitionDuration: const Duration(milliseconds: 900),
          transitionsBuilder: (context, animation, secondaryAnimation, child) {
            return ScaleTransition(
              scale: Tween<double>(
                begin: 0.0,
                end: 1.0,
              ).animate(CurvedAnimation(
                parent: animation,
                curve: Curves.elasticOut,
              )),
              child: RotationTransition(
                turns: Tween<double>(
                  begin: 0.5,
                  end: 1.0,
                ).animate(CurvedAnimation(
                  parent: animation,
                  curve: Curves.easeOutCubic,
                )),
                child: FadeTransition(
                  opacity: Tween<double>(
                    begin: 0.0,
                    end: 1.0,
                  ).animate(CurvedAnimation(
                    parent: animation,
                    curve: const Interval(0.0, 0.3, curve: Curves.easeIn),
                  )),
                  child: child,
                ),
              ),
            );
          },
        );
}
