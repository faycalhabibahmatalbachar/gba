import React, { useEffect, useState } from 'react';
import { useLanguage } from '../contexts/LanguageContext';
import { supabase } from '../services/supabaseService';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  Image,
  SafeAreaView,
  Button
} from 'react-native';
import Icon from 'react-native-vector-icons/MaterialIcons';
import LinearGradient from 'react-native-linear-gradient';
import { useCart } from '../contexts/CartContext';

export default function CartScreen({ navigation }) {
  const { t } = useLanguage();
  const { cart, removeFromCart, updateQuantity, clearCart, getCartTotal } = useCart();
  const [products, setProducts] = useState([]);
  const [loading, setLoading] = useState(false);

  // Synchroniser les prix et stock avec Supabase
  useEffect(() => {
    syncCartWithSupabase();
  }, [cart]);

  const syncCartWithSupabase = async () => {
    if (cart.length === 0) {
      setProducts([]);
      return;
    }

    setLoading(true);
    try {
      const productIds = cart.map(item => item.id);
      const { data: products, error } = await supabase
        .from('products')
        .select('id, name, price, quantity, main_image, images')
        .in('id', productIds);

      if (error) throw error;

      const syncedItems = cart.map(cartItem => {
        const product = products.find(p => p.id === cartItem.id);
        if (product) {
          return {
            ...cartItem,
            name: product.name,
            price: product.price,
            availableStock: product.quantity,
            image: product.main_image || product.images?.[0] || cartItem.image,
            outOfStock: product.quantity === 0,
            lowStock: product.quantity < cartItem.quantity
          };
        }
        return cartItem;
      });

      setProducts(syncedItems);
    } catch (error) {
      console.error('Error syncing cart:', error);
      setProducts(cart);
    } finally {
      setLoading(false);
    }
  };

  const displayItems = products.length > 0 ? products : cart;

  const renderCartItem = ({ item }) => (
    <View style={[styles.cartItem, item.outOfStock && styles.outOfStockItem]}>
      <Image source={{ uri: item.image || 'https://via.placeholder.com/100' }} style={styles.itemImage} />
      <View style={styles.itemInfo}>
        <Text style={styles.itemName} numberOfLines={2}>{item.name}</Text>
        <View style={styles.priceContainer}>
          <Text style={styles.itemPrice}>{item.price.toLocaleString()} FCFA</Text>
          {item.outOfStock && (
            <Text style={styles.stockWarning}>{t('outOfStock')}!</Text>
          )}
          {item.lowStock && (
            <Text style={styles.stockInfo}>{t('limitedStock')}: {item.quantity}</Text>
          )}
        </View>
        <View style={styles.quantityContainer}>
          <TouchableOpacity
            onPress={() => updateQuantity(item.id, item.quantity - 1)}
            style={styles.quantityButton}
          >
            <Icon name="remove" size={20} color="#667eea" />
          </TouchableOpacity>
          <Text style={styles.quantity}>{item.quantity}</Text>
          <TouchableOpacity
            onPress={() => updateQuantity(item.id, item.quantity + 1)}
            style={styles.quantityButton}
          >
            <Icon name="add" size={20} color="#667eea" />
          </TouchableOpacity>
        </View>
      </View>
      <TouchableOpacity
        onPress={() => removeFromCart(item.id)}
        style={styles.deleteButton}
      >
        <Icon name="delete" size={20} color="#ff4444" />
      </TouchableOpacity>
    </View>
  );

  const EmptyCart = () => (
    <View style={styles.emptyContainer}>
      <Icon name="shopping-cart" size={80} color="#e0e0e0" />
      <Text style={styles.emptyText}>{t('cartEmpty')}</Text>
      <Text style={styles.emptySubtitle}>Ajoutez des produits pour commencer</Text>
      <TouchableOpacity 
        style={styles.browseButton}
        onPress={() => navigation.navigate('Home')}
      >
        <Text style={styles.emptyButtonText}>{t('continueShopping')}</Text>
      </TouchableOpacity>
    </View>
  );

  const handleCheckout = () => {
    navigation.navigate('Checkout');
  };

  return (
    <SafeAreaView style={styles.container}>
      {displayItems.length === 0 ? (
        <EmptyCart />
      ) : (
        <>
          <FlatList
            data={displayItems}
            renderItem={renderCartItem}
            keyExtractor={item => item.id.toString()}
            contentContainerStyle={styles.listContent}
            showsVerticalScrollIndicator={false}
          />
          
          <View style={styles.summaryContainer}>
            <View style={styles.summaryRow}>
              <Text style={styles.summaryLabel}>Sous-total</Text>
              <Text style={styles.summaryValue}>{getTotalPrice(displayItems).toLocaleString()} FCFA</Text>
            </View>
            <View style={styles.summaryRow}>
              <Text style={styles.summaryLabel}>Livraison</Text>
              <Text style={styles.summaryValue}>Gratuite</Text>
            </View>
            <View style={[styles.summaryRow, styles.totalRow]}>
              <Text style={styles.totalLabel}>{t('total')}</Text>
              <Text style={styles.totalValue}>{getTotalPrice(displayItems).toLocaleString()} FCFA</Text>
            </View>
          </View>

          <View style={styles.bottomActions}>
            <TouchableOpacity 
              style={styles.clearButton}
              onPress={clearCart}
            >
              <Icon name="delete-sweep" size={20} color="#ff4444" />
              <Text style={styles.clearButtonText}>{t('clearCart')}</Text>
            </TouchableOpacity>
            <TouchableOpacity 
              onPress={handleCheckout}
              disabled={displayItems.some(item => item.outOfStock)}
            >
              <LinearGradient
                colors={displayItems.some(item => item.outOfStock) ? ['#999', '#777'] : ['#667eea', '#764ba2']}
                style={styles.checkoutButton}
              >
                <Icon name="payment" size={20} color="#fff" />
                <Text style={styles.checkoutButtonText}>{t('checkout')}</Text>
              </LinearGradient>
            </TouchableOpacity>
            {displayItems.some(item => item.outOfStock) && (
              <Text style={styles.checkoutWarning}>
                Certains articles sont en rupture de stock
              </Text>
            )}
          </View>
        </>
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f5f5f5',
  },
  listContent: {
    padding: 15,
  },
  cartItem: {
    flexDirection: 'row',
    backgroundColor: '#fff',
    borderRadius: 15,
    padding: 15,
    marginBottom: 15,
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
  },
  itemImage: {
    width: 80,
    height: 80,
    borderRadius: 10,
    backgroundColor: '#f0f0f0',
  },
  itemInfo: {
    flex: 1,
    marginLeft: 15,
    justifyContent: 'space-between',
  },
  itemName: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333',
    marginBottom: 5,
  },
  itemPrice: {
    fontSize: 14,
    color: '#667eea',
    fontWeight: 'bold',
    marginBottom: 10,
  },
  quantityContainer: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  quantityButton: {
    width: 30,
    height: 30,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#f0f0f0',
    borderRadius: 15,
  },
  quantity: {
    marginHorizontal: 15,
    fontSize: 16,
    fontWeight: '600',
    color: '#333',
  },
  deleteButton: {
    justifyContent: 'center',
    paddingLeft: 10,
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  emptyTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#333',
    marginTop: 20,
    marginBottom: 10,
  },
  emptySubtitle: {
    fontSize: 14,
    color: '#666',
    marginBottom: 30,
  },
  browseButton: {
    backgroundColor: '#667eea',
    paddingHorizontal: 30,
    paddingVertical: 15,
    borderRadius: 25,
  },
  browseButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: 'bold',
  },
  summaryContainer: {
    backgroundColor: '#fff',
    padding: 20,
    marginHorizontal: 15,
    marginBottom: 10,
    borderRadius: 15,
  },
  summaryRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 10,
  },
  summaryLabel: {
    fontSize: 14,
    color: '#666',
  },
  summaryValue: {
    fontSize: 14,
    color: '#333',
    fontWeight: '500',
  },
  totalRow: {
    borderTopWidth: 1,
    borderTopColor: '#e0e0e0',
    paddingTop: 10,
    marginTop: 5,
    marginBottom: 0,
  },
  totalLabel: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#333',
  },
  totalValue: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#667eea',
  },
  bottomActions: {
    flexDirection: 'row',
    paddingHorizontal: 15,
    paddingVertical: 15,
    backgroundColor: '#fff',
    borderTopWidth: 1,
    borderTopColor: '#f0f0f0',
  },
  clearButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderRadius: 25,
    borderWidth: 1,
    borderColor: '#ff4444',
    marginRight: 10,
  },
  clearButtonText: {
    color: '#ff4444',
    fontSize: 14,
    fontWeight: '600',
    marginLeft: 5,
  },
  checkoutButton: {
    flex: 1,
    borderRadius: 25,
    overflow: 'hidden',
  },
  gradient: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: 15,
  },
  checkoutButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: 'bold',
    marginLeft: 10,
  },
});
