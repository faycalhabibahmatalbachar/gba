import 'package:flutter/material.dart';
import 'package:go_router/go_router.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:supabase_flutter/supabase_flutter.dart';
import '../screens/auth/login_screen.dart';
import '../screens/home_screen_premium.dart';
import '../screens/product/product_detail_screen.dart';

class AppRoutes {
  static final router = GoRouter(
    initialLocation: '/',
    redirect: (context, state) {
      final session = Supabase.instance.client.auth.currentSession;
      final isLoggedIn = session != null;
      final isAuthRoute = state.matchedLocation == '/login' || 
                         state.matchedLocation == '/register';
      
      // If not logged in and trying to access protected routes
      if (!isLoggedIn && !isAuthRoute) {
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
        builder: (context, state) => Scaffold(
          body: Center(
            child: Text('Register Screen - À implémenter'),
          ),
        ),
      ),
      GoRoute(
        path: '/home',
        builder: (context, state) => const HomeScreenPremium(),
      ),
      GoRoute(
        path: '/categories',
        builder: (context, state) => Scaffold(
          body: Center(
            child: Text('Categories Screen - À implémenter'),
          ),
        ),
      ),
      GoRoute(
        path: '/cart',
        builder: (context, state) => Scaffold(
          body: Center(
            child: Text('Cart Screen - À implémenter'),
          ),
        ),
      ),
      GoRoute(
        path: '/profile',
        builder: (context, state) => Scaffold(
          body: Center(
            child: Text('Profile Screen - À implémenter'),
          ),
        ),
      ),
      GoRoute(
        path: '/product/:id',
        builder: (context, state) {
          final productId = state.pathParameters['id']!;
          return ProductDetailScreen(productId: productId);
        },
      ),
      GoRoute(
        path: '/favorites',
        builder: (context, state) => Scaffold(
          body: Center(
            child: Text('Favorites Screen - À implémenter'),
          ),
        ),
      ),
    ],
  );
}
