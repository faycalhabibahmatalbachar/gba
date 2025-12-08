// ========================================
// GUIDE D'INTÉGRATION DU TRACKING
// ========================================

// 1. DANS main.dart - Initialiser le tracking
/*
import 'services/activity_tracking_service.dart';

void main() async {
  WidgetsFlutterBinding.ensureInitialized();
  await Supabase.initialize(...);
  
  // Initialiser le tracking
  await ActivityTrackingService().initSession();
  
  runApp(MyApp());
}

// Dans AppLifecycleState
@override
void didChangeAppLifecycleState(AppLifecycleState state) {
  if (state == AppLifecycleState.paused) {
    ActivityTrackingService().endSession();
  } else if (state == AppLifecycleState.resumed) {
    ActivityTrackingService().initSession();
  }
}
*/

// 2. DANS home_screen_premium.dart - Tracking produits
/*
import '../services/activity_tracking_service.dart';

// Dans _buildProductCard
onTap: () {
  // Tracker la vue du produit
  ActivityTrackingService().trackProductView(
    product.id,
    product.name,
  );
  
  context.push('/product/${product.id}');
},
*/

// 3. DANS cart_provider.dart - Tracking panier
/*
import '../services/activity_tracking_service.dart';

// Dans addItem
Future<void> addItem(Product product, int quantity) async {
  // ... code existant ...
  
  // Tracker l'ajout au panier
  await ActivityTrackingService().trackCartAdd(
    product.id,
    product.name,
    quantity,
  );
}

// Dans removeItem
Future<void> removeItem(String productId) async {
  final item = state.firstWhere((item) => item.product?.id == productId);
  
  // Tracker la suppression
  await ActivityTrackingService().trackCartRemove(
    productId,
    item.product?.name ?? '',
  );
  
  // ... code existant ...
}
*/

// 4. DANS favorites_provider.dart - Tracking favoris
/*
import '../services/activity_tracking_service.dart';

// Dans toggleFavorite
Future<void> toggleFavorite(Product product) async {
  if (isFavorite(product.id)) {
    // Tracker suppression favori
    await ActivityTrackingService().trackFavoriteRemove(
      product.id,
      product.name,
    );
    // ... code existant ...
  } else {
    // Tracker ajout favori
    await ActivityTrackingService().trackFavoriteAdd(
      product.id,
      product.name,
    );
    // ... code existant ...
  }
}
*/

// 5. DANS auth_provider.dart - Tracking connexion
/*
import '../services/activity_tracking_service.dart';

// Dans signIn
Future<void> signIn(String email, String password) async {
  // ... code existant ...
  
  // Tracker la connexion
  await ActivityTrackingService().trackLogin();
}

// Dans signOut
Future<void> signOut() async {
  // Tracker la déconnexion
  await ActivityTrackingService().trackLogout();
  
  // ... code existant ...
}
*/

// 6. DANS profile_screen_premium.dart - Tracking profil
/*
import '../services/activity_tracking_service.dart';

// Dans _updateProfile
Future<void> _updateProfile() async {
  // ... code existant ...
  
  // Tracker la mise à jour
  await ActivityTrackingService().trackProfileUpdate();
}
*/

// 7. DANS ultra_checkout_screen.dart - Tracking commande
/*
import '../../services/activity_tracking_service.dart';

// Dans _submitOrder
Future<void> _submitOrder() async {
  // Tracker le début du checkout
  await ActivityTrackingService().trackCheckoutStarted();
  
  try {
    // ... code existant ...
    
    if (result['success']) {
      // Tracker la commande passée
      await ActivityTrackingService().trackOrderPlaced(
        result['order_id'],
        result['order_number'],
        total + 1000.0,
      );
      
      // Tracker le paiement
      await ActivityTrackingService().trackPaymentCompleted(
        result['order_id'],
        total + 1000.0,
      );
    }
  } catch (e) {
    // Tracker l'abandon du checkout
    await ActivityTrackingService().trackCheckoutAbandoned();
  }
}
*/

// 8. DANS chat_screen.dart - Tracking messages
/*
import '../../services/activity_tracking_service.dart';

// Dans _sendMessage
Future<void> _sendMessage() async {
  // ... code existant ...
  
  // Tracker l'envoi du message
  await ActivityTrackingService().trackMessageSent(
    recipientId,
    recipientName,
  );
}
*/

// 9. DANS categories_screen_premium.dart - Tracking catégories
/*
import '../services/activity_tracking_service.dart';

// Dans _buildCategoryCard
onTap: () {
  // Tracker la vue de catégorie
  ActivityTrackingService().trackCategoryView(
    category.id,
    category.name,
  );
  
  // ... navigation ...
},
*/

// 10. EXEMPLE D'UTILISATION GÉNÉRIQUE
/*
// Pour toute action personnalisée
ActivityTrackingService().trackActivity(
  'custom_action',
  actionDetails: {
    'key': 'value',
    'timestamp': DateTime.now().toIso8601String(),
  },
  entityType: 'custom',
  entityId: 'id',
  entityName: 'name',
  pageName: 'current_page',
);
*/
