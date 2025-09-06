import 'package:flutter/material.dart';
import 'package:supabase_flutter/supabase_flutter.dart';
import 'package:go_router/go_router.dart';
import 'dart:async';
import 'dart:math' as math;

class BlocScreen extends StatefulWidget {
  const BlocScreen({super.key});
  
  @override
  State<BlocScreen> createState() => _BlocScreenState();
}

class _BlocScreenState extends State<BlocScreen> with TickerProviderStateMixin {
  final supabase = Supabase.instance.client;
  StreamSubscription? _profileSubscription;
  late AnimationController _pulseController;
  late Animation<double> _pulseAnimation;
  late AnimationController _slideController;
  late Animation<Offset> _slideAnimation;
  late AnimationController _fadeController;
  late Animation<double> _fadeAnimation;
  late AnimationController _bellController;
  late Animation<double> _bellAnimation;
  bool _isChecking = false;
  
  @override
  void initState() {
    super.initState();
    _setupRealtimeListener();
    _setupAnimations();
  }
  
  void _setupAnimations() {
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
    
    _slideController = AnimationController(
      duration: const Duration(milliseconds: 800),
      vsync: this,
    )..forward();
    
    _slideAnimation = Tween<Offset>(
      begin: const Offset(0, 0.3),
      end: Offset.zero,
    ).animate(CurvedAnimation(
      parent: _slideController,
      curve: Curves.easeOutCubic,
    ));
    
    _fadeController = AnimationController(
      duration: const Duration(milliseconds: 1000),
      vsync: this,
    )..forward();
    
    _fadeAnimation = Tween<double>(
      begin: 0.0,
      end: 1.0,
    ).animate(CurvedAnimation(
      parent: _fadeController,
      curve: Curves.easeIn,
    ));
    
    _bellController = AnimationController(
      duration: const Duration(seconds: 1),
      vsync: this,
    )..repeat(reverse: true);
    
    _bellAnimation = Tween<double>(
      begin: -0.1,
      end: 0.1,
    ).animate(CurvedAnimation(
      parent: _bellController,
      curve: Curves.easeInOut,
    ));
  }
  
  void _setupRealtimeListener() {
    final userId = supabase.auth.currentUser?.id;
    if (userId != null) {
      // Écouter les changements du profil en temps réel
      _profileSubscription = supabase
          .from('profiles')
          .stream(primaryKey: ['id'])
          .eq('id', userId)
          .listen((List<Map<String, dynamic>> data) {
        if (data.isNotEmpty) {
          final profile = data.first;
          final isBlocked = profile['is_blocked'] ?? false;
          
          // Si l'utilisateur n'est plus bloqué, rediriger vers home
          if (!isBlocked && mounted) {
            print('✅ Utilisateur débloqué - redirection vers home');
            context.go('/home');
          }
        }
      });
    }
  }
  
  @override
  void dispose() {
    _profileSubscription?.cancel();
    _pulseController.dispose();
    _slideController.dispose();
    _fadeController.dispose();
    _bellController.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    // Empêcher le retour arrière
    return WillPopScope(
      onWillPop: () async => false,
      child: Scaffold(
        body: Container(
          decoration: BoxDecoration(
            gradient: LinearGradient(
              begin: Alignment.topLeft,
              end: Alignment.bottomRight,
              colors: [
                Colors.red.shade900,
                Colors.red.shade600,
                Colors.orange.shade600,
              ],
            ),
          ),
          child: SafeArea(
            child: FadeTransition(
              opacity: _fadeAnimation,
              child: Center(
                child: SingleChildScrollView(
                  padding: const EdgeInsets.all(24),
                  child: Column(
                    mainAxisAlignment: MainAxisAlignment.center,
                    children: [
                      // Cloche animée avec effet de balancement
                      AnimatedBuilder(
                        animation: _bellAnimation,
                        builder: (context, child) {
                          return Transform.rotate(
                            angle: _bellAnimation.value,
                            child: ScaleTransition(
                              scale: _pulseAnimation,
                              child: Container(
                                width: 120,
                                height: 120,
                                decoration: BoxDecoration(
                                  shape: BoxShape.circle,
                                  color: Colors.white.withOpacity(0.2),
                                  boxShadow: [
                                    BoxShadow(
                                      color: Colors.black.withOpacity(0.3),
                                      blurRadius: 20,
                                      spreadRadius: 5,
                                    ),
                                  ],
                                ),
                                child: Stack(
                                  alignment: Alignment.center,
                                  children: [
                                    // Cercles concentriques animés
                                    ...List.generate(3, (index) {
                                      return AnimatedBuilder(
                                        animation: _pulseController,
                                        builder: (context, child) {
                                          return Container(
                                            width: 80 + (index * 20) *
                                                _pulseAnimation.value,
                                            height: 80 + (index * 20) *
                                                _pulseAnimation.value,
                                            decoration: BoxDecoration(
                                              shape: BoxShape.circle,
                                              border: Border.all(
                                                color: Colors.white.withOpacity(
                                                    0.3 - (index * 0.1)),
                                                width: 2,
                                              ),
                                            ),
                                          );
                                        },
                                      );
                                    }),
                                    const Icon(
                                      Icons.block,
                                      size: 60,
                                      color: Colors.white,
                                    ),
                                  ],
                                ),
                              ),
                            ),
                          );
                        },
                      ),
                      
                      const SizedBox(height: 40),
                      
                      // Titre animé
                      SlideTransition(
                        position: _slideAnimation,
                        child: const Text(
                          'Accès Bloqué',
                          style: TextStyle(
                            fontSize: 32,
                            fontWeight: FontWeight.bold,
                            color: Colors.white,
                            letterSpacing: 1.2,
                            shadows: [
                              Shadow(
                                blurRadius: 10,
                                color: Colors.black45,
                                offset: Offset(2, 2),
                              ),
                            ],
                          ),
                        ),
                      ),
                      
                      const SizedBox(height: 20),
                      
                      // Message principal
                      SlideTransition(
                        position: _slideAnimation,
                        child: Container(
                          padding: const EdgeInsets.all(20),
                          decoration: BoxDecoration(
                            color: Colors.white.withOpacity(0.1),
                            borderRadius: BorderRadius.circular(15),
                            border: Border.all(
                              color: Colors.white.withOpacity(0.3),
                              width: 1,
                            ),
                          ),
                          child: Column(
                            children: [
                              const Icon(
                                Icons.warning_amber_rounded,
                                size: 50,
                                color: Colors.yellow,
                              ),
                              const SizedBox(height: 15),
                              const Text(
                                'Votre compte a été temporairement suspendu',
                                textAlign: TextAlign.center,
                                style: TextStyle(
                                  fontSize: 18,
                                  color: Colors.white,
                                  fontWeight: FontWeight.w500,
                                ),
                              ),
                              const SizedBox(height: 10),
                              Text(
                                'Cette mesure a été prise suite à une violation de nos conditions d\'utilisation.',
                                textAlign: TextAlign.center,
                                style: TextStyle(
                                  fontSize: 14,
                                  color: Colors.white.withOpacity(0.9),
                                ),
                              ),
                            ],
                          ),
                        ),
                      ),
                      
                      const SizedBox(height: 30),
                      
                      // Informations de contact
                      Container(
                        padding: const EdgeInsets.all(16),
                        decoration: BoxDecoration(
                          color: Colors.black.withOpacity(0.3),
                          borderRadius: BorderRadius.circular(12),
                        ),
                        child: Column(
                          children: [
                            Row(
                              mainAxisAlignment: MainAxisAlignment.center,
                              children: [
                                Icon(
                                  Icons.info_outline,
                                  color: Colors.white.withOpacity(0.8),
                                  size: 20,
                                ),
                                const SizedBox(width: 8),
                                Text(
                                  'Que faire maintenant?',
                                  style: TextStyle(
                                    fontSize: 16,
                                    fontWeight: FontWeight.bold,
                                    color: Colors.white.withOpacity(0.9),
                                  ),
                                ),
                              ],
                            ),
                            const SizedBox(height: 12),
                            Text(
                              'Si vous pensez qu\'il s\'agit d\'une erreur, veuillez contacter notre équipe de support.',
                              textAlign: TextAlign.center,
                              style: TextStyle(
                                fontSize: 13,
                                color: Colors.white.withOpacity(0.8),
                              ),
                            ),
                            const SizedBox(height: 16),
                            Container(
                              padding: const EdgeInsets.symmetric(
                                horizontal: 16,
                                vertical: 8,
                              ),
                              decoration: BoxDecoration(
                                color: Colors.white.withOpacity(0.2),
                                borderRadius: BorderRadius.circular(8),
                              ),
                              child: Row(
                                mainAxisSize: MainAxisSize.min,
                                children: [
                                  const Icon(
                                    Icons.email,
                                    color: Colors.white,
                                    size: 18,
                                  ),
                                  const SizedBox(width: 8),
                                  Text(
                                    'support@gba-app.com',
                                    style: TextStyle(
                                      color: Colors.white.withOpacity(0.9),
                                      fontWeight: FontWeight.w500,
                                    ),
                                  ),
                                ],
                              ),
                            ),
                          ],
                        ),
                      ),
                      
                      const SizedBox(height: 30),
                      
                      // Bouton de déconnexion
                      ElevatedButton.icon(
                        onPressed: () async {
                          await supabase.auth.signOut();
                          // Utiliser go_router pour la navigation
                          if (context.mounted) {
                            context.go('/login');
                          }
                        },
                        icon: const Icon(Icons.logout),
                        label: const Text('Se déconnecter'),
                        style: ElevatedButton.styleFrom(
                          backgroundColor: Colors.white.withOpacity(0.2),
                          foregroundColor: Colors.white,
                          padding: const EdgeInsets.symmetric(
                            horizontal: 24,
                            vertical: 12,
                          ),
                          shape: RoundedRectangleBorder(
                            borderRadius: BorderRadius.circular(25),
                            side: BorderSide(
                              color: Colors.white.withOpacity(0.5),
                            ),
                          ),
                        ),
                      ),
                      
                      if (_isChecking)
                        const Padding(
                          padding: EdgeInsets.only(top: 20),
                          child: CircularProgressIndicator(
                            color: Colors.white,
                          ),
                        ),
                    ],
                  ),
                ),
              ),
            ),
          ),
        ),
      ),
    );
  }
}
