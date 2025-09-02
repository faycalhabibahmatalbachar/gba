import React, { useEffect, useState } from 'react';
import { useLanguage } from '../contexts/LanguageContext';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  FlatList,
  Image,
  TouchableOpacity,
  TextInput,
  ActivityIndicator,
  RefreshControl,
  Dimensions,
} from 'react-native';
import Icon from 'react-native-vector-icons/MaterialIcons';
import LinearGradient from 'react-native-linear-gradient';
import { useCart } from '../contexts/CartContext';
import { useFeaturedProducts, useNewProducts, useCategories, useProductSearch } from '../hooks/useProducts';

const { width } = Dimensions.get('window');

export default function HomeScreen({ navigation }) {
  const { t } = useLanguage();
  const [searchQuery, setSearchQuery] = useState('');
  const { addToCart } = useCart();
  
  // Hooks pour les données Supabase
  const { categories, loading: categoriesLoading } = useCategories();
  const { products: featuredProducts, loading: featuredLoading, refreshing, refresh } = useFeaturedProducts();
  const { products: newProducts, loading: newLoading } = useNewProducts(8);
  const { results: searchResults, searching } = useProductSearch(searchQuery);
  
  const loading = categoriesLoading || featuredLoading || newLoading;

  const onRefresh = () => {
    refresh();
  };

  const renderCategory = ({ item }) => {
    const categoryColors = {
      'Bureautique': '#667eea',
      'Informatique': '#FF6B6B',
      'Papeterie': '#4ECDC4',
      'Impression': '#95E77E',
      'Mobilier': '#FFD93D',
      'Électronique': '#FF8CC3',
    };
    const categoryIcons = {
      'Bureautique': 'folder',
      'Informatique': 'computer',
      'Papeterie': 'edit',
      'Impression': 'print',
      'Mobilier': 'weekend',
      'Électronique': 'devices',
    };
    
    return (
      <TouchableOpacity
        style={styles.categoryCard}
        onPress={() => navigation.navigate('Categories', { categoryId: item.id })}
      >
        <View style={[styles.categoryIcon, { backgroundColor: categoryColors[item.name] || '#9B59B6' }]}>
          <Icon name={categoryIcons[item.name] || item.icon || 'category'} size={30} color="white" />
        </View>
        <Text style={styles.categoryName}>{item.name}</Text>
      </TouchableOpacity>
    );
  };

  const renderProduct = ({ item }) => (
    <TouchableOpacity
      style={styles.productCard}
      onPress={() => navigation.navigate('ProductDetail', { productId: item.id })}
    >
      <Image source={{ uri: item.main_image || item.images?.[0] || 'https://via.placeholder.com/200' }} style={styles.productImage} />
      <View style={styles.productInfo}>
        <Text style={styles.productCategory}>{item.category?.name || 'Sans catégorie'}</Text>
        <Text style={styles.productName} numberOfLines={2}>{item.name}</Text>
        <View style={styles.ratingContainer}>
          <Icon name="star" size={16} color="#FFD700" />
          <Text style={styles.rating}>{item.rating}</Text>
          <Text style={styles.oldPrice}>{item.compare_at_price} CFA</Text>
        </View>
        <Text style={styles.productPrice}>{item.price.toLocaleString()} FCFA</Text>
        <TouchableOpacity 
          style={styles.addToCartButton}
          onPress={() => addToCart(item)}
        >
          <Icon name="add-shopping-cart" size={18} color="#fff" />
        </TouchableOpacity>
      </View>
    </TouchableOpacity>
  );

  return (
    <View style={styles.container}>
      <LinearGradient colors={['#667eea', '#764ba2']} style={styles.header}>
        <View style={styles.headerContent}>
          <Text style={styles.welcomeText}>Bienvenue!</Text>
          <Text style={styles.headerTitle}>Découvrez nos produits</Text>
          {searching ? (
            <ActivityIndicator size="small" color="white" />
          ) : (
            <Icon name="search" size={24} color="white" />
          )}
        </View>
        <View style={styles.searchContainer}>
          <Icon name="search" size={20} color="#999" style={styles.searchIcon} />
          <TextInput
            style={styles.searchInput}
            placeholder="Rechercher un produit..."
            placeholderTextColor="#999"
            value={searchQuery}
            onChangeText={setSearchQuery}
          />
        </View>
      </LinearGradient>

      <ScrollView
        style={styles.content}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} colors={['#667eea']} />
        }
      >
        {/* Promo Banner */}
        <View style={styles.promoBanner}>
          <LinearGradient
            colors={['#FF6B6B', '#FF8787']}
            style={styles.promoGradient}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 0 }}
          >
            <Text style={styles.promoText}>🔥 Offre Spéciale!</Text>
            <Text style={styles.promoSubtext}>Jusqu'à -50% sur tous les produits</Text>
          </LinearGradient>
        </View>

        {/* Categories */}
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>{t('categories')}</Text>
            <TouchableOpacity onPress={() => navigation.navigate('Categories')}>
              <Text style={styles.seeAll}>Voir tout</Text>
            </TouchableOpacity>
          </View>
          <FlatList
            horizontal
            data={categories}
            renderItem={renderCategory}
            keyExtractor={item => item.id.toString()}
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.categoriesList}
          />
        </View>

        {/* Featured Products */}
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>{t('featuredProducts') || 'Produits vedettes'}</Text>
            <TouchableOpacity>
              <Text style={styles.seeAll}>Voir tout</Text>
            </TouchableOpacity>
          </View>
          <FlatList
            horizontal
            data={searchQuery.length > 1 ? searchResults : featuredProducts}
            renderItem={renderProduct}
            keyExtractor={item => item.id.toString()}
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.productsList}
          />
        </View>

        {/* New Products */}
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>Nouveautés</Text>
            <TouchableOpacity>
              <Text style={styles.seeAll}>Voir tout</Text>
            </TouchableOpacity>
          </View>
          <FlatList
            horizontal
            data={newProducts}
            renderItem={renderProduct}
            keyExtractor={item => item.id.toString()}
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.productsList}
          />
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f5f5f5',
  },
  header: {
    paddingTop: 20,
    paddingBottom: 20,
    paddingHorizontal: 20,
    borderBottomLeftRadius: 30,
    borderBottomRightRadius: 30,
  },
  headerContent: {
    marginBottom: 20,
  },
  welcomeText: {
    color: 'rgba(255, 255, 255, 0.8)',
    fontSize: 14,
  },
  headerTitle: {
    color: '#fff',
    fontSize: 24,
    fontWeight: 'bold',
    marginTop: 5,
  },
  searchContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#fff',
    borderRadius: 25,
    paddingHorizontal: 15,
    paddingVertical: 10,
  },
  searchIcon: {
    marginRight: 10,
  },
  searchInput: {
    flex: 1,
    fontSize: 16,
    color: '#333',
  },
  content: {
    flex: 1,
  },
  promoBanner: {
    marginHorizontal: 20,
    marginTop: 20,
  },
  promoGradient: {
    borderRadius: 15,
    padding: 20,
  },
  promoText: {
    color: '#fff',
    fontSize: 18,
    fontWeight: 'bold',
  },
  promoSubtext: {
    color: 'rgba(255, 255, 255, 0.9)',
    fontSize: 14,
    marginTop: 5,
  },
  section: {
    marginTop: 25,
  },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginHorizontal: 20,
    marginBottom: 15,
  },
  sectionTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#333',
  },
  seeAll: {
    color: '#667eea',
    fontSize: 14,
    fontWeight: '600',
  },
  categoriesList: {
    paddingHorizontal: 20,
  },
  categoryCard: {
    alignItems: 'center',
    marginRight: 15,
  },
  categoryGradient: {
    width: 70,
    height: 70,
    borderRadius: 35,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 8,
  },
  categoryName: {
    fontSize: 12,
    color: '#666',
    textAlign: 'center',
  },
  productsList: {
    paddingHorizontal: 20,
  },
  productCard: {
    backgroundColor: '#fff',
    borderRadius: 15,
    marginRight: 15,
    width: width * 0.45,
    elevation: 3,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 3.84,
  },
  productImage: {
    width: '100%',
    height: 150,
    borderTopLeftRadius: 15,
    borderTopRightRadius: 15,
    backgroundColor: '#f0f0f0',
  },
  productInfo: {
    padding: 12,
  },
  productCategory: {
    color: '#999',
    fontSize: 12,
    marginBottom: 4,
  },
  productName: {
    fontSize: 14,
    fontWeight: '600',
    color: '#333',
    marginBottom: 8,
  },
  ratingContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
  },
  rating: {
    marginLeft: 4,
    fontSize: 12,
    color: '#666',
  },
  productPrice: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#667eea',
    marginBottom: 8,
  },
  addToCartButton: {
    position: 'absolute',
    right: 10,
    bottom: 10,
    backgroundColor: '#667eea',
    borderRadius: 20,
    width: 36,
    height: 36,
    justifyContent: 'center',
    alignItems: 'center',
  },
});
