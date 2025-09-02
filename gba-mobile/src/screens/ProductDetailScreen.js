import React, { useEffect, useState } from 'react';
import { useLanguage } from '../contexts/LanguageContext';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  Image,
  TouchableOpacity,
  Dimensions,
  SafeAreaView,
  ActivityIndicator,
} from 'react-native';
import Icon from 'react-native-vector-icons/MaterialIcons';
import { useProduct } from '../hooks/useProducts';
import LinearGradient from 'react-native-linear-gradient';
import { useCart } from '../contexts/CartContext';

const { width, height } = Dimensions.get('window');

export default function ProductDetailScreen({ route, navigation }) {
  const { t } = useLanguage();
  const { productId } = route.params;
  const { product, loading, error } = useProduct(productId);
  const [selectedImage, setSelectedImage] = useState(0);
  const [quantity, setQuantity] = useState(1);
  const [selectedVariant, setSelectedVariant] = useState(null);
  const { addToCart } = useCart();

  const images = product?.images?.length > 0 
    ? product.images 
    : [product?.main_image || 'https://via.placeholder.com/400'];

  useEffect(() => {
    if (product?.variants?.length > 0) {
      setSelectedVariant(product.variants[0]);
    }
  }, [product]);

  const handleAddToCart = () => {
    if (product) {
      addToCart({
        ...product,
        quantity,
        variant: selectedVariant,
        price: selectedVariant?.price || product.price
      });
      navigation.goBack();
    }
  };

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#667eea" />
      </View>
    );
  }

  if (error || !product) {
    return (
      <View style={styles.errorContainer}>
        <Icon name="error-outline" size={60} color="#999" />
        <Text style={styles.errorText}>Produit non trouvé</Text>
        <TouchableOpacity onPress={() => navigation.goBack()}>
          <Text style={styles.backButton}>Retour</Text>
        </TouchableOpacity>
      </View>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView showsVerticalScrollIndicator={false}>
        {/* Image Gallery */}
        <View style={styles.imageContainer}>
          <Image source={{ uri: images[selectedImage] }} style={styles.mainImage} />
          <ScrollView 
            horizontal 
            showsHorizontalScrollIndicator={false}
            style={styles.thumbnailContainer}
          >
            {images.map((img, index) => (
              <TouchableOpacity
                key={index}
                onPress={() => setSelectedImage(index)}
                style={[
                  styles.thumbnail,
                  selectedImage === index && styles.thumbnailActive
                ]}
              >
                <Image source={{ uri: img }} style={styles.thumbnailImage} />
              </TouchableOpacity>
            ))}
          </ScrollView>
        </View>

        {/* Product Info */}
        <View style={styles.infoContainer}>
          <View style={styles.categoryBadge}>
            <Text style={styles.category}>{product.category?.name || 'Sans catégorie'}</Text>
          </View>
          
          <Text style={styles.productName}>{product.name}</Text>
          
          <View style={styles.ratingContainer}>
            <View style={styles.stars}>
              {[1, 2, 3, 4, 5].map((star) => (
                <Icon
                  key={star}
                  name="star"
                  size={20}
                  color={star <= product.rating ? '#FFD700' : '#e0e0e0'}
                />
              ))}
            </View>
            <Text style={styles.ratingText}>{product.rating} (124 avis)</Text>
          </View>

          <Text style={styles.price}>
            {(selectedVariant?.price || product.price).toLocaleString()} FCFA
          </Text>
          {product.compare_at_price && (
            <Text style={styles.comparePrice}>
              {product.compare_at_price.toLocaleString()} FCFA
            </Text>
          )}

          {/* Variantes */}
          {product.variants && product.variants.length > 0 && (
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>Options</Text>
              <ScrollView horizontal showsHorizontalScrollIndicator={false}>
                {product.variants.map(variant => (
                  <TouchableOpacity
                    key={variant.id}
                    style={[
                      styles.variantButton,
                      selectedVariant?.id === variant.id && styles.variantButtonActive
                    ]}
                    onPress={() => setSelectedVariant(variant)}
                  >
                    <Text style={[
                      styles.variantText,
                      selectedVariant?.id === variant.id && styles.variantTextActive
                    ]}>
                      {variant.name}
                    </Text>
                  </TouchableOpacity>
                ))}
              </ScrollView>
            </View>
          )}

          {/* Description */}
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>{t('description')}</Text>
            <Text style={styles.description}>
              {product.description || 'Aucune description disponible'}
            </Text>
          </View>

          {/* Specifications */}
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Caractéristiques</Text>
            {product.brand && (
              <View style={styles.specItem}>
                <Text style={styles.specLabel}>Marque</Text>
                <Text style={styles.specValue}>{product.brand}</Text>
              </View>
            )}
            {product.model && (
              <View style={styles.specItem}>
                <Text style={styles.specLabel}>Modèle</Text>
                <Text style={styles.specValue}>{product.model}</Text>
              </View>
            )}
            {product.sku && (
              <View style={styles.specItem}>
                <Text style={styles.specLabel}>SKU</Text>
                <Text style={styles.specValue}>{product.sku}</Text>
              </View>
            )}
            {product.specifications && Object.entries(product.specifications).map(([key, value]) => (
              <View key={key} style={styles.specItem}>
                <Text style={styles.specLabel}>{key}</Text>
                <Text style={styles.specValue}>{value}</Text>
              </View>
            ))}
            <View style={styles.specItem}>
              <Text style={styles.stockStatus}>{t('inStock')}</Text>
              <Text style={[styles.specValue, { color: product.quantity > 0 ? '#4CAF50' : '#F44336' }]}>
                {product.quantity > 0 ? `${product.quantity} unités` : 'Rupture de stock'}
              </Text>
            </View>
          </View>

          {/* Quantity Selector */}
          <View style={styles.quantitySection}>
            <Text style={styles.sectionTitle}>Quantité</Text>
            <View style={styles.quantitySelector}>
              <TouchableOpacity
                onPress={() => quantity > 1 && setQuantity(quantity - 1)}
                style={styles.quantityButton}
              >
                <Icon name="remove" size={24} color="#667eea" />
              </TouchableOpacity>
              <Text style={styles.quantityLabel}>{t('quantity')}</Text>
              <Text style={styles.quantityText}>{quantity}</Text>
              <TouchableOpacity
                onPress={() => setQuantity(quantity + 1)}
                style={styles.quantityButton}
              >
                <Icon name="add" size={24} color="#667eea" />
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </ScrollView>

      {/* Bottom Actions */}
      <View style={styles.bottomActions}>
        <TouchableOpacity style={styles.favoriteButton}>
          <Icon name="favorite-border" size={24} color="#667eea" />
        </TouchableOpacity>
        <TouchableOpacity onPress={handleAddToCart} style={styles.addToCartButtonLarge}>
          <LinearGradient
            colors={['#667eea', '#764ba2']}
            style={styles.gradient}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 0 }}
          >
            <Icon name="shopping-cart" size={20} color="#fff" />
            <Text style={styles.addToCartText}>{t('addToCart')}</Text>
          </LinearGradient>
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f5f5f5',
  },
  imageContainer: {
    backgroundColor: '#fff',
    paddingBottom: 10,
  },
  mainImage: {
    width: width,
    height: width,
    resizeMode: 'cover',
  },
  thumbnailContainer: {
    paddingHorizontal: 10,
    marginTop: 10,
  },
  thumbnail: {
    width: 70,
    height: 70,
    marginRight: 10,
    borderRadius: 10,
    borderWidth: 2,
    borderColor: 'transparent',
  },
  thumbnailActive: {
    borderColor: '#667eea',
  },
  thumbnailImage: {
    width: '100%',
    height: '100%',
    borderRadius: 8,
  },
  infoContainer: {
    backgroundColor: '#fff',
    marginTop: 10,
    padding: 20,
    borderTopLeftRadius: 30,
    borderTopRightRadius: 30,
  },
  categoryBadge: {
    alignSelf: 'flex-start',
    backgroundColor: '#f0f0f0',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 15,
    marginBottom: 10,
  },
  categoryText: {
    color: '#667eea',
    fontSize: 12,
    fontWeight: '600',
  },
  productName: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 10,
  },
  ratingContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 15,
  },
  stars: {
    flexDirection: 'row',
    marginRight: 10,
  },
  ratingText: {
    color: '#666',
    fontSize: 14,
  },
  price: {
    fontSize: 28,
    fontWeight: 'bold',
    color: '#667eea',
    marginBottom: 20,
  },
  descriptionSection: {
    marginBottom: 20,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 10,
  },
  description: {
    color: '#666',
    fontSize: 14,
    lineHeight: 22,
  },
  featuresSection: {
    marginBottom: 20,
  },
  feature: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
  },
  featureText: {
    marginLeft: 10,
    color: '#666',
    fontSize: 14,
  },
  quantitySection: {
    marginBottom: 20,
  },
  quantitySelector: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#f5f5f5',
    borderRadius: 25,
    padding: 5,
    alignSelf: 'flex-start',
  },
  quantityButton: {
    width: 40,
    height: 40,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#fff',
    borderRadius: 20,
  },
  quantityText: {
    marginHorizontal: 20,
    fontSize: 18,
    fontWeight: '600',
    color: '#333',
  },
  bottomActions: {
    flexDirection: 'row',
    paddingHorizontal: 20,
    paddingVertical: 15,
    backgroundColor: '#fff',
    borderTopWidth: 1,
    borderTopColor: '#f0f0f0',
  },
  favoriteButton: {
    width: 50,
    height: 50,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#f5f5f5',
    borderRadius: 25,
    marginRight: 15,
  },
  addToCartButtonLarge: {
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
  addToCartText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: 'bold',
    marginLeft: 10,
  },
});
