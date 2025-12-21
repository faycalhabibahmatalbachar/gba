import 'package:flutter/material.dart';
import 'package:go_router/go_router.dart';
import '../widgets/animated_route.dart';
import 'package:supabase_flutter/supabase_flutter.dart';
import '../screens/auth/login_screen.dart';
import '../screens/register_screen.dart';
import '../screens/home_screen_premium.dart';
import '../screens/product/product_detail_screen.dart';
// import '../screens/product/product_search_screen.dart'; // Fichier n'existe pas encore
import '../screens/checkout/ultra_checkout_screen.dart';
import '../screens/orders/my_orders_screen.dart';
import '../screens/favorites_screen_premium.dart';
import '../screens/categories_screen_premium.dart';
import '../screens/cart_screen_premium.dart';
import '../screens/profile_screen_ultra.dart';
import '../screens/settings_screen_premium.dart';
import '../screens/chat/chat_screen.dart';
import '../screens/chat/conversations_list_screen.dart';
import '../screens/chat/admin_chat_screen.dart';
import '../screens/bloc_screen.dart';

class AppRoutes {
  static final router = GoRouter(
    initialLocation: '/',
    errorBuilder: (context, state) {
      return Scaffold(
        body: Container(
          decoration: const BoxDecoration(
            gradient: LinearGradient(
              begin: Alignment.topLeft,
              end: Alignment.bottomRight,
              colors: [
                Color(0xFF667eea),
                Color(0xFF764ba2),
              ],
            ),
          ),
          child: SafeArea(
            child: Center(
              child: Padding(
                padding: const EdgeInsets.all(24),
                child: Column(
                  mainAxisAlignment: MainAxisAlignment.center,
                  children: [
                    const Icon(Icons.travel_explore, size: 72, color: Colors.white),
                    const SizedBox(height: 16),
                    const Text(
                      'Page introuvable',
                      textAlign: TextAlign.center,
                      style: TextStyle(
                        color: Colors.white,
                        fontSize: 26,
                        fontWeight: FontWeight.bold,
                      ),
                    ),
                    const SizedBox(height: 10),
                    Text(
                      'Aucune route pour: ${state.uri}',
                      textAlign: TextAlign.center,
                      style: TextStyle(
                        color: Colors.white.withOpacity(0.9),
                        fontSize: 14,
                      ),
                    ),
                    const SizedBox(height: 22),
                    ElevatedButton.icon(
                      onPressed: () => context.go('/home'),
                      style: ElevatedButton.styleFrom(
                        backgroundColor: Colors.white,
                        foregroundColor: const Color(0xFF667eea),
                        padding: const EdgeInsets.symmetric(horizontal: 18, vertical: 12),
                        shape: RoundedRectangleBorder(
                          borderRadius: BorderRadius.circular(14),
                        ),
                      ),
                      icon: const Icon(Icons.home),
                      label: const Text(
                        'Retour à l\'accueil',
                        style: TextStyle(fontWeight: FontWeight.w700),
                      ),
                    ),
                  ],
                ),
              ),
            ),
          ),
        ),
      );
    },
    redirect: (context, state) async {
      final supabase = Supabase.instance.client;
      final session = supabase.auth.currentSession;
      final isLoggedIn = session != null;
      final isAuthRoute = state.matchedLocation == '/login' || 
                         state.matchedLocation == '/register';
      final isBlockedRoute = state.matchedLocation == '/blocked';
      
      // Si connecté, vérifier si l'utilisateur est bloqué
      if (isLoggedIn && !isBlockedRoute) {
        try {
          final userId = supabase.auth.currentUser?.id;
          if (userId != null) {
            final response = await supabase
                .from('profiles')
                .select('is_blocked')
                .eq('id', userId)
                .single();
            
            if (response['is_blocked'] == true) {
              return '/blocked';
            }
          }
        } catch (e) {
          print('Erreur vérification blocage: $e');
        }
      }
      
      // If not logged in and trying to access protected routes
      if (!isLoggedIn && !isAuthRoute && !isBlockedRoute) {
        return '/login';
      }
      
      // If logged in and trying to access auth routes
      if (isLoggedIn && isAuthRoute) {
        return '/home';
      }
      
      return null;
    },
    routes: [
      GoRoute(
        path: '/',
        redirect: (context, state) => '/home',
      ),
      GoRoute(
        path: '/login',
        builder: (context, state) => const LoginScreen(),
      ),
      GoRoute(
        path: '/register',
        builder: (context, state) => const RegisterScreen(),
      ),
      GoRoute(
        path: '/home',
        pageBuilder: (context, state) => CustomTransitionPage(
          child: const HomeScreenPremium(),
          transitionsBuilder: (context, animation, secondaryAnimation, child) {
            return FadeTransition(
              opacity: CurvedAnimation(
                parent: animation,
                curve: Curves.easeInOutCubic,
              ),
              child: ScaleTransition(
                scale: Tween<double>(
                  begin: 0.95,
                  end: 1.0,
                ).animate(CurvedAnimation(
                  parent: animation,
                  curve: Curves.easeOutBack,
                )),
                child: child,
              ),
            );
          },
        ),
      ),
      GoRoute(
        path: '/checkout',
        builder: (context, state) => const UltraCheckoutScreen(),
      ),
      GoRoute(
        path: '/orders',
        builder: (context, state) => const MyOrdersScreen(),
      ),
      GoRoute(
        path: '/categories',
        pageBuilder: (context, state) => CustomTransitionPage(
          child: const CategoriesScreenPremium(),
          transitionDuration: const Duration(milliseconds: 600),
          transitionsBuilder: (context, animation, secondaryAnimation, child) {
            return SlideTransition(
              position: Tween<Offset>(
                begin: const Offset(1.0, 0.0),
                end: Offset.zero,
              ).animate(CurvedAnimation(
                parent: animation,
                curve: Curves.easeOutQuart,
              )),
              child: FadeTransition(
                opacity: CurvedAnimation(
                  parent: animation,
                  curve: const Interval(0.0, 0.5),
                ),
                child: child,
              ),
            );
          },
        ),
      ),
      GoRoute(
        path: '/cart',
        pageBuilder: (context, state) => CustomTransitionPage(
          child: const CartScreenPremium(),
          transitionDuration: const Duration(milliseconds: 500),
          transitionsBuilder: (context, animation, secondaryAnimation, child) {
            return SlideTransition(
              position: Tween<Offset>(
                begin: const Offset(0.0, 1.0),
                end: Offset.zero,
              ).animate(CurvedAnimation(
                parent: animation,
                curve: Curves.easeOutCubic,
              )),
              child: FadeTransition(
                opacity: CurvedAnimation(
                  parent: animation,
                  curve: Curves.easeIn,
                ),
                child: child,
              ),
            );
          },
        ),
      ),
      GoRoute(
        path: '/profile',
        pageBuilder: (context, state) => CustomTransitionPage(
          child: const ProfileScreenUltra(),
          transitionDuration: const Duration(milliseconds: 900),
          transitionsBuilder: (context, animation, secondaryAnimation, child) {
            // Animation Parallax + Zoom spectaculaire
            final curvedAnimation = CurvedAnimation(
              parent: animation,
              curve: Curves.easeOutExpo,
            );
            
            // Effet de zoom explosif
            final zoomAnimation = Tween<double>(
              begin: 0.0,
              end: 1.0,
            ).animate(CurvedAnimation(
              parent: animation,
              curve: const Interval(0.0, 0.7, curve: Curves.elasticOut),
            ));
            
            // Effet parallax sur la page précédente
            return Stack(
              children: [
                // Page précédente avec effet parallax
                if (secondaryAnimation.status != AnimationStatus.dismissed)
                  AnimatedBuilder(
                    animation: secondaryAnimation,
                    builder: (context, _) {
                      return Transform(
                        transform: Matrix4.identity()
                          ..setEntry(3, 2, 0.002)
                          ..translate(
                            -MediaQuery.of(context).size.width * 0.3 * secondaryAnimation.value,
                            0.0,
                            -100 * secondaryAnimation.value,
                          )
                          ..scale(1.0 - (0.2 * secondaryAnimation.value)),
                        child: Container(
                          color: Colors.black.withOpacity(0.5 * secondaryAnimation.value),
                        ),
                      );
                    },
                  ),
                // Nouvelle page avec effet zoom explosif
                Transform(
                  alignment: Alignment.center,
                  transform: Matrix4.identity()
                    ..setEntry(3, 2, 0.002)
                    ..scale(zoomAnimation.value)
                    ..rotateZ(0.05 * (1 - animation.value)),
                  child: FadeTransition(
                    opacity: CurvedAnimation(
                      parent: animation,
                      curve: const Interval(0.3, 1.0),
                    ),
                    child: Container(
                      decoration: BoxDecoration(
                        boxShadow: [
                          BoxShadow(
                            color: Colors.black.withOpacity(0.3 * animation.value),
                            blurRadius: 30 * animation.value,
                            spreadRadius: 10 * animation.value,
                          ),
                        ],
                      ),
                      child: child,
                    ),
                  ),
                ),
              ],
            );
          },
        ),
      ),
      GoRoute(
        path: '/settings',
        builder: (context, state) => const SettingsScreenPremium(),
      ),
      GoRoute(
        path: '/product/:id',
        pageBuilder: (context, state) {
          final productId = state.pathParameters['id']!;
          return CustomTransitionPage(
            child: ProductDetailScreen(productId: productId),
            transitionDuration: const Duration(milliseconds: 600),
            transitionsBuilder: (context, animation, secondaryAnimation, child) {
              const begin = Offset(1.0, 0.0);
              const end = Offset.zero;
              const curve = Curves.easeOutQuart;
              
              var tween = Tween(begin: begin, end: end).chain(
                CurveTween(curve: curve),
              );
              
              return SlideTransition(
                position: animation.drive(tween),
                child: FadeTransition(
                  opacity: CurvedAnimation(
                    parent: animation,
                    curve: const Interval(0.2, 1.0),
                  ),
                  child: child,
                ),
              );
            },
          );
        },
      ),
      GoRoute(
        path: '/favorites',
        pageBuilder: (context, state) => CustomTransitionPage(
          child: const FavoritesScreenPremium(),
          transitionDuration: const Duration(milliseconds: 500),
          transitionsBuilder: (context, animation, secondaryAnimation, child) {
            return SlideTransition(
              position: Tween<Offset>(
                begin: const Offset(-1.0, 0.0),
                end: Offset.zero,
              ).animate(CurvedAnimation(
                parent: animation,
                curve: Curves.easeOutCubic,
              )),
              child: FadeTransition(
                opacity: CurvedAnimation(
                  parent: animation,
                  curve: Curves.easeIn,
                ),
                child: child,
              ),
            );
          },
        ),
      ),
      GoRoute(
        path: '/messages',
        pageBuilder: (context, state) => CustomTransitionPage(
          child: const ConversationsListScreen(),
          transitionDuration: const Duration(milliseconds: 600),
          transitionsBuilder: (context, animation, secondaryAnimation, child) {
            return SlideTransition(
              position: Tween<Offset>(
                begin: const Offset(0.0, -1.0),
                end: Offset.zero,
              ).animate(CurvedAnimation(
                parent: animation,
                curve: Curves.easeOutQuart,
              )),
              child: FadeTransition(
                opacity: CurvedAnimation(
                  parent: animation,
                  curve: const Interval(0.3, 1.0),
                ),
                child: child,
              ),
            );
          },
        ),
      ),
      GoRoute(
        path: '/chat/:conversationId',
        pageBuilder: (context, state) {
          final conversationId = state.pathParameters['conversationId'];
          return CustomTransitionPage(
            child: ChatScreen(conversationId: conversationId),
            transitionDuration: const Duration(milliseconds: 500),
            transitionsBuilder: (context, animation, secondaryAnimation, child) {
              return SlideTransition(
                position: Tween<Offset>(
                  begin: const Offset(1.0, 0.0),
                  end: Offset.zero,
                ).animate(CurvedAnimation(
                  parent: animation,
                  curve: Curves.easeOutCubic,
                )),
                child: FadeTransition(
                  opacity: animation,
                  child: child,
                ),
              );
            },
          );
        },
      ),
      GoRoute(
        path: '/chat',
        pageBuilder: (context, state) => CustomTransitionPage(
          child: const ChatScreen(),
          transitionDuration: const Duration(milliseconds: 500),
          transitionsBuilder: (context, animation, secondaryAnimation, child) {
            return SlideTransition(
              position: Tween<Offset>(
                begin: const Offset(1.0, 0.0),
                end: Offset.zero,
              ).animate(CurvedAnimation(
                parent: animation,
                curve: Curves.easeOutCubic,
              )),
              child: FadeTransition(
                opacity: animation,
                child: child,
              ),
            );
          },
        ),
      ),
      GoRoute(
        path: '/admin-chat',
        pageBuilder: (context, state) => CustomTransitionPage(
          child: const AdminChatScreen(),
          transitionDuration: const Duration(milliseconds: 800),
          transitionsBuilder: (context, animation, secondaryAnimation, child) {
            return Transform(
              transform: Matrix4.identity()
                ..setEntry(3, 2, 0.002)
                ..rotateX(-animation.value * 0.2),
              alignment: Alignment.topCenter,
              child: FadeTransition(
                opacity: CurvedAnimation(
                  parent: animation,
                  curve: Curves.easeInOut,
                ),
                child: ScaleTransition(
                  scale: Tween<double>(
                    begin: 0.9,
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
        ),
      ),
      GoRoute(
        path: '/blocked',
        pageBuilder: (context, state) => CustomTransitionPage(
          child: const BlocScreen(),
          transitionDuration: const Duration(milliseconds: 1200),
          transitionsBuilder: (context, animation, secondaryAnimation, child) {
            return FadeTransition(
              opacity: CurvedAnimation(
                parent: animation,
                curve: Curves.easeIn,
              ),
              child: ScaleTransition(
                scale: Tween<double>(
                  begin: 1.5,
                  end: 1.0,
                ).animate(CurvedAnimation(
                  parent: animation,
                  curve: Curves.easeOutCubic,
                )),
                child: child,
              ),
            );
          },
        ),
      ),
    ],
  );
}
