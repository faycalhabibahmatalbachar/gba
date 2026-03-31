import 'package:flutter/material.dart';
import 'package:go_router/go_router.dart';
import '../widgets/animated_route.dart';
import 'package:supabase_flutter/supabase_flutter.dart';
import '../screens/auth/login_screen.dart';
import '../screens/auth/forgot_password_screen.dart';
import '../screens/auth/reset_password_screen.dart';
import '../screens/auth/change_password_screen.dart';
import '../screens/splash_screen.dart';
import '../screens/register_screen.dart';
import '../screens/main_navigation_screen.dart';
import '../screens/home_screen_premium.dart';
import '../screens/product/product_detail_screen.dart';
import '../screens/product/product_search_screen.dart';
import '../screens/products_by_category_screen.dart';
import '../screens/checkout/ultra_checkout_screen.dart';
import '../screens/orders/my_orders_screen.dart';
import '../screens/favorites_screen_premium.dart';
import '../screens/categories_screen_premium.dart';
import '../screens/cart_screen_premium.dart';
import '../screens/profile_screen_ultra.dart';
import '../screens/settings_screen_premium.dart';
import '../screens/promotions_screen_premium.dart';
import '../screens/chat/chat_screen.dart';
import '../screens/contact_screen.dart';
import '../screens/chat/admin_chat_screen.dart';
import '../screens/checkout/checkout_cancel_screen.dart';
import '../screens/checkout/checkout_success_screen.dart';
import '../screens/checkout/flutterwave_return_screen.dart';
import '../screens/bloc_screen.dart';
import '../screens/special_order_screen.dart';
import '../screens/special_orders/my_special_orders_screen.dart';
import '../screens/special_orders/special_order_details_screen.dart';
import '../screens/legal/terms_of_service_screen.dart';
import '../screens/legal/privacy_policy_screen.dart';
import '../screens/settings/notification_preferences_screen.dart';
import '../screens/onboarding_flow_screen.dart';
import '../services/onboarding_service.dart';
import '../localization/app_localizations.dart';
import 'navigation_keys.dart';

class AppRoutes {
  static final GlobalKey<NavigatorState> rootNavigatorKey = NavigationKeys.rootNavigatorKey;
  static final GlobalKey<ScaffoldMessengerState> scaffoldMessengerKey =
      NavigationKeys.scaffoldMessengerKey;

  static final router = GoRouter(
    navigatorKey: NavigationKeys.rootNavigatorKey,
    initialLocation: '/splash',
    errorBuilder: (context, state) {
      final localizations = AppLocalizations.of(context);
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
                    Text(
                      localizations.translate('page_not_found_title'),
                      textAlign: TextAlign.center,
                      style: TextStyle(
                        color: Colors.white,
                        fontSize: 26,
                        fontWeight: FontWeight.bold,
                      ),
                    ),
                    const SizedBox(height: 10),
                    Text(
                      localizations.translateParams(
                        'no_route_for',
                        {'route': state.uri.toString()},
                      ),
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
                      label: Text(
                        localizations.translate('back_to_home'),
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
      final loc = state.matchedLocation;
      final isSplashRoute = loc == '/splash';
      final isResetPasswordRoute = loc == '/reset-password';
      final isAuthRoute = loc == '/login' ||
          loc == '/splash' ||
          loc == '/register' ||
          loc == '/forgot-password' ||
          loc == '/reset-password' ||
          loc == '/otp-verification' ||
          loc == '/legal/terms' ||
          loc == '/legal/privacy';
      final isOnboardingRoute = loc == '/onboarding';
      final isBlockedRoute = loc == '/blocked';

      // Routes accessible without authentication (guest browsing)
      final isPublicRoute = isAuthRoute ||
          loc == '/home' ||
          loc == '/categories' ||
          loc == '/promotions' ||
          loc == '/contact' ||
          loc.startsWith('/product/') ||
          loc.startsWith('/category/') ||
          loc == '/search' ||
          loc.startsWith('/legal/') ||
          isSplashRoute ||
          isBlockedRoute;

      if (isSplashRoute) {
        return null;
      }
      
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
      
      // If not logged in and trying to access protected routes → redirect to home
      if (!isLoggedIn && !isPublicRoute) {
        return '/home';
      }

      // If logged in but onboarding not completed, force onboarding
      if (isLoggedIn && !isBlockedRoute && !isAuthRoute && !isOnboardingRoute) {
        try {
          final userId = supabase.auth.currentUser?.id;
          if (userId != null) {
            final completed = await OnboardingService().isCompleted(userId: userId);
            if (!completed) {
              return '/onboarding';
            }
          }
        } catch (_) {}
      }
      
      // If logged in and trying to access auth routes
      // Note: /legal/* is treated as public and must remain accessible even when logged in.
      if (isLoggedIn && isAuthRoute && !loc.startsWith('/legal/')) {
        if (isResetPasswordRoute) {
          return null;
        }
        try {
          final userId = supabase.auth.currentUser?.id;
          if (userId != null) {
            final completed = await OnboardingService().isCompleted(userId: userId);
            if (!completed) return '/onboarding';
          }
        } catch (_) {}
        return '/home';
      }
      
      return null;
    },
    routes: [
      GoRoute(
        path: '/splash',
        builder: (context, state) => const SplashScreen(),
      ),
      GoRoute(
        path: '/',
        redirect: (context, state) => '/home',
      ),
      GoRoute(
        path: '/login',
        builder: (context, state) => const LoginScreen(),
      ),
      GoRoute(
        path: '/forgot-password',
        builder: (context, state) => const ForgotPasswordScreen(),
      ),
      GoRoute(
        path: '/reset-password',
        builder: (context, state) => const ResetPasswordScreen(),
      ),
      GoRoute(
        path: '/register',
        builder: (context, state) => const RegisterScreen(),
      ),
      GoRoute(
        path: '/onboarding',
        builder: (context, state) => const OnboardingFlowScreen(),
      ),
      GoRoute(
        path: '/home',
        pageBuilder: (context, state) => CustomTransitionPage(
          child: const MainNavigationScreen(initialIndex: 0),
          transitionDuration: const Duration(milliseconds: 300),
          transitionsBuilder: (context, animation, secondaryAnimation, child) {
            return FadeTransition(
              opacity: CurvedAnimation(
                parent: animation,
                curve: Curves.easeInOut,
              ),
              child: child,
            );
          },
        ),
      ),
      GoRoute(
        path: '/checkout',
        builder: (context, state) => const UltraCheckoutScreen(),
      ),
      GoRoute(
        path: '/checkout/success',
        builder: (context, state) {
          final orderId = state.uri.queryParameters['order_id'];
          return CheckoutSuccessScreen(orderId: orderId);
        },
      ),
      GoRoute(
        path: '/checkout/cancel',
        builder: (context, state) {
          final orderId = state.uri.queryParameters['order_id'];
          return CheckoutCancelScreen(orderId: orderId);
        },
      ),
      GoRoute(
        path: '/checkout/flutterwave-return',
        builder: (context, state) => const FlutterwaveReturnScreen(),
      ),
      GoRoute(
        path: '/orders',
        pageBuilder: (context, state) => CustomTransitionPage(
          key: state.pageKey,
          child: const MyOrdersScreen(),
          transitionsBuilder: (context, animation, secondaryAnimation, child) {
            return SlideTransition(
              position: Tween<Offset>(begin: const Offset(1, 0), end: Offset.zero)
                  .animate(CurvedAnimation(parent: animation, curve: Curves.easeOutCubic)),
              child: child,
            );
          },
        ),
      ),
      GoRoute(
        path: '/special-order',
        pageBuilder: (context, state) => CustomTransitionPage(
          key: state.pageKey,
          child: const SpecialOrderScreen(),
          transitionsBuilder: (context, animation, secondaryAnimation, child) {
            return SlideTransition(
              position: Tween<Offset>(begin: const Offset(0, 0.15), end: Offset.zero)
                  .animate(CurvedAnimation(parent: animation, curve: Curves.easeOutCubic)),
              child: FadeTransition(opacity: animation, child: child),
            );
          },
        ),
      ),
      GoRoute(
        path: '/special-orders',
        pageBuilder: (context, state) => CustomTransitionPage(
          key: state.pageKey,
          child: const MySpecialOrdersScreen(),
          transitionsBuilder: (context, animation, secondaryAnimation, child) {
            return SlideTransition(
              position: Tween<Offset>(begin: const Offset(1, 0), end: Offset.zero)
                  .animate(CurvedAnimation(parent: animation, curve: Curves.easeOutCubic)),
              child: child,
            );
          },
        ),
      ),
      GoRoute(
        path: '/special-order/:id',
        pageBuilder: (context, state) {
          final id = state.pathParameters['id'] ?? '';
          return CustomTransitionPage(
            key: state.pageKey,
            child: SpecialOrderDetailsScreen(specialOrderId: id),
            transitionsBuilder: (context, animation, secondaryAnimation, child) {
              return SlideTransition(
                position: Tween<Offset>(begin: const Offset(1, 0), end: Offset.zero)
                    .animate(CurvedAnimation(parent: animation, curve: Curves.easeOutCubic)),
                child: child,
              );
            },
          );
        },
      ),
      GoRoute(
        path: '/search',
        pageBuilder: (context, state) {
          final q = state.uri.queryParameters['q'];
          return CustomTransitionPage(
            child: ProductSearchScreen(initialQuery: q),
            transitionDuration: const Duration(milliseconds: 400),
            transitionsBuilder: (context, animation, secondaryAnimation, child) {
              return FadeTransition(
                opacity: CurvedAnimation(parent: animation, curve: Curves.easeInOut),
                child: SlideTransition(
                  position: Tween<Offset>(
                    begin: const Offset(0, 0.05),
                    end: Offset.zero,
                  ).animate(CurvedAnimation(parent: animation, curve: Curves.easeOutCubic)),
                  child: child,
                ),
              );
            },
          );
        },
      ),
      GoRoute(
        path: '/category/:id',
        pageBuilder: (context, state) {
          final categoryId = state.pathParameters['id'] ?? '';
          final categoryName = state.uri.queryParameters['name'] ?? '';
          return CustomTransitionPage(
            child: ProductsByCategoryScreen(
              categoryId: categoryId,
              categoryName: Uri.decodeComponent(categoryName),
            ),
            transitionDuration: const Duration(milliseconds: 500),
            transitionsBuilder: (context, animation, secondaryAnimation, child) {
              return SlideTransition(
                position: Tween<Offset>(
                  begin: const Offset(1.0, 0.0),
                  end: Offset.zero,
                ).animate(CurvedAnimation(parent: animation, curve: Curves.easeOutCubic)),
                child: FadeTransition(opacity: animation, child: child),
              );
            },
          );
        },
      ),
      GoRoute(
        path: '/promotions',
        pageBuilder: (context, state) => CustomTransitionPage(
          child: const PromotionsScreenPremium(),
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
                opacity: CurvedAnimation(
                  parent: animation,
                  curve: const Interval(0.2, 1.0),
                ),
                child: child,
              ),
            );
          },
        ),
      ),
      GoRoute(
        path: '/categories',
        pageBuilder: (context, state) => CustomTransitionPage(
          child: const MainNavigationScreen(initialIndex: 1),
          transitionDuration: const Duration(milliseconds: 300),
          transitionsBuilder: (context, animation, secondaryAnimation, child) {
            return FadeTransition(
              opacity: CurvedAnimation(
                parent: animation,
                curve: Curves.easeInOut,
              ),
              child: child,
            );
          },
        ),
      ),
      GoRoute(
        path: '/cart',
        pageBuilder: (context, state) => CustomTransitionPage(
          child: const MainNavigationScreen(initialIndex: 2),
          transitionDuration: const Duration(milliseconds: 300),
          transitionsBuilder: (context, animation, secondaryAnimation, child) {
            return FadeTransition(
              opacity: CurvedAnimation(
                parent: animation,
                curve: Curves.easeInOut,
              ),
              child: child,
            );
          },
        ),
      ),
      GoRoute(
        path: '/profile',
        pageBuilder: (context, state) => CustomTransitionPage(
          child: const MainNavigationScreen(initialIndex: 4),
          transitionDuration: const Duration(milliseconds: 300),
          transitionsBuilder: (context, animation, secondaryAnimation, child) {
            return FadeTransition(
              opacity: CurvedAnimation(
                parent: animation,
                curve: Curves.easeInOut,
              ),
              child: child,
            );
          },
        ),
      ),
      GoRoute(
        path: '/settings',
        builder: (context, state) => const SettingsScreenPremium(),
      ),
      GoRoute(
        path: '/settings/notifications',
        builder: (context, state) => const NotificationPreferencesScreen(),
      ),
      GoRoute(
        path: '/settings/change-password',
        builder: (context, state) => const ChangePasswordScreen(),
      ),
      GoRoute(
        path: '/legal/terms',
        builder: (context, state) => const TermsOfServiceScreen(),
      ),
      GoRoute(
        path: '/legal/privacy',
        builder: (context, state) => const PrivacyPolicyScreen(),
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
          child: const MainNavigationScreen(initialIndex: 3),
          transitionDuration: const Duration(milliseconds: 300),
          transitionsBuilder: (context, animation, secondaryAnimation, child) {
            return FadeTransition(
              opacity: CurvedAnimation(
                parent: animation,
                curve: Curves.easeInOut,
              ),
              child: child,
            );
          },
        ),
      ),
      GoRoute(
        path: '/favorites-standalone',
        pageBuilder: (context, state) => CustomTransitionPage(
          child: const FavoritesScreenPremium(),
          transitionDuration: const Duration(milliseconds: 300),
          transitionsBuilder: (context, animation, secondaryAnimation, child) {
            return SlideTransition(
              position: Tween<Offset>(
                begin: const Offset(1.0, 0.0),
                end: Offset.zero,
              ).animate(CurvedAnimation(
                parent: animation,
                curve: Curves.easeOutCubic,
              )),
              child: FadeTransition(opacity: animation, child: child),
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
        path: '/contact',
        builder: (context, state) => const ContactScreen(),
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
