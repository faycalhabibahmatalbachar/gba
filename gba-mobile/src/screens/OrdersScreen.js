import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  SafeAreaView,
  Image,
} from 'react-native';
import Icon from 'react-native-vector-icons/MaterialIcons';
import LinearGradient from 'react-native-linear-gradient';

export default function OrdersScreen({ navigation }) {
  const [selectedTab, setSelectedTab] = useState('all');

  const tabs = [
    { id: 'all', label: 'Tous' },
    { id: 'pending', label: 'En cours' },
    { id: 'delivered', label: 'Livrées' },
    { id: 'cancelled', label: 'Annulées' },
  ];

  const orders = [
    {
      id: '1',
      orderNumber: 'CMD-2024-001',
      date: '15 Jan 2024',
      status: 'delivered',
      statusLabel: 'Livrée',
      statusColor: '#4CAF50',
      total: 125000,
      itemsCount: 3,
      items: [
        { name: 'iPhone 14 Pro', image: 'https://via.placeholder.com/100', quantity: 1 },
        { name: 'AirPods Pro', image: 'https://via.placeholder.com/100', quantity: 1 },
        { name: 'Coque iPhone', image: 'https://via.placeholder.com/100', quantity: 1 },
      ],
    },
    {
      id: '2',
      orderNumber: 'CMD-2024-002',
      date: '20 Jan 2024',
      status: 'pending',
      statusLabel: 'En préparation',
      statusColor: '#FFA726',
      total: 85000,
      itemsCount: 2,
      items: [
        { name: 'Nike Air Max', image: 'https://via.placeholder.com/100', quantity: 1 },
        { name: 'T-shirt Nike', image: 'https://via.placeholder.com/100', quantity: 1 },
      ],
    },
    {
      id: '3',
      orderNumber: 'CMD-2024-003',
      date: '22 Jan 2024',
      status: 'pending',
      statusLabel: 'En livraison',
      statusColor: '#667eea',
      total: 450000,
      itemsCount: 1,
      items: [
        { name: 'Samsung TV 55"', image: 'https://via.placeholder.com/100', quantity: 1 },
      ],
    },
    {
      id: '4',
      orderNumber: 'CMD-2024-004',
      date: '10 Jan 2024',
      status: 'cancelled',
      statusLabel: 'Annulée',
      statusColor: '#F44336',
      total: 35000,
      itemsCount: 1,
      items: [
        { name: 'Casque Bluetooth', image: 'https://via.placeholder.com/100', quantity: 1 },
      ],
    },
  ];

  const filteredOrders = selectedTab === 'all'
    ? orders
    : orders.filter(order => order.status === selectedTab);

  const getStatusIcon = (status) => {
    switch (status) {
      case 'delivered':
        return 'check-circle';
      case 'pending':
        return 'access-time';
      case 'cancelled':
        return 'cancel';
      default:
        return 'info';
    }
  };

  const renderTab = ({ item }) => (
    <TouchableOpacity
      style={[
        styles.tab,
        selectedTab === item.id && styles.tabActive
      ]}
      onPress={() => setSelectedTab(item.id)}
    >
      <Text style={[
        styles.tabText,
        selectedTab === item.id && styles.tabTextActive
      ]}>
        {item.label}
      </Text>
    </TouchableOpacity>
  );

  const renderOrderItem = ({ item: orderItem }) => (
    <View style={styles.orderItem}>
      <Image source={{ uri: orderItem.image }} style={styles.orderItemImage} />
      <Text style={styles.orderItemName} numberOfLines={1}>
        {orderItem.name}
      </Text>
      <Text style={styles.orderItemQuantity}>x{orderItem.quantity}</Text>
    </View>
  );

  const renderOrder = ({ item }) => (
    <TouchableOpacity style={styles.orderCard}>
      <View style={styles.orderHeader}>
        <View>
          <Text style={styles.orderNumber}>{item.orderNumber}</Text>
          <Text style={styles.orderDate}>{item.date}</Text>
        </View>
        <View style={[styles.statusBadge, { backgroundColor: `${item.statusColor}20` }]}>
          <Icon name={getStatusIcon(item.status)} size={16} color={item.statusColor} />
          <Text style={[styles.statusText, { color: item.statusColor }]}>
            {item.statusLabel}
          </Text>
        </View>
      </View>

      <FlatList
        horizontal
        data={item.items}
        renderItem={renderOrderItem}
        keyExtractor={(orderItem, index) => index.toString()}
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.orderItemsList}
      />

      <View style={styles.orderFooter}>
        <View>
          <Text style={styles.itemsCount}>{item.itemsCount} article(s)</Text>
          <Text style={styles.orderTotal}>{item.total.toLocaleString()} FCFA</Text>
        </View>
        <TouchableOpacity style={styles.detailButton}>
          <Text style={styles.detailButtonText}>Voir détails</Text>
          <Icon name="chevron-right" size={20} color="#667eea" />
        </TouchableOpacity>
      </View>
    </TouchableOpacity>
  );

  return (
    <SafeAreaView style={styles.container}>
      {/* Tabs */}
      <FlatList
        horizontal
        data={tabs}
        renderItem={renderTab}
        keyExtractor={item => item.id}
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.tabsContainer}
      />

      {/* Orders List */}
      {filteredOrders.length === 0 ? (
        <View style={styles.emptyContainer}>
          <Icon name="receipt-long" size={80} color="#e0e0e0" />
          <Text style={styles.emptyTitle}>Aucune commande</Text>
          <Text style={styles.emptySubtitle}>Vous n'avez pas encore de commande dans cette catégorie</Text>
        </View>
      ) : (
        <FlatList
          data={filteredOrders}
          renderItem={renderOrder}
          keyExtractor={item => item.id}
          contentContainerStyle={styles.ordersList}
          showsVerticalScrollIndicator={false}
        />
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f5f5f5',
  },
  tabsContainer: {
    paddingHorizontal: 15,
    paddingVertical: 15,
    backgroundColor: '#fff',
    borderBottomWidth: 1,
    borderBottomColor: '#f0f0f0',
  },
  tab: {
    paddingHorizontal: 20,
    paddingVertical: 8,
    marginRight: 10,
    borderRadius: 20,
    backgroundColor: '#f0f0f0',
  },
  tabActive: {
    backgroundColor: '#667eea',
  },
  tabText: {
    fontSize: 14,
    fontWeight: '500',
    color: '#666',
  },
  tabTextActive: {
    color: '#fff',
  },
  ordersList: {
    padding: 15,
  },
  orderCard: {
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
  orderHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 15,
  },
  orderNumber: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 4,
  },
  orderDate: {
    fontSize: 12,
    color: '#999',
  },
  statusBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 15,
  },
  statusText: {
    fontSize: 12,
    fontWeight: '600',
    marginLeft: 5,
  },
  orderItemsList: {
    paddingBottom: 15,
  },
  orderItem: {
    marginRight: 15,
    alignItems: 'center',
  },
  orderItemImage: {
    width: 60,
    height: 60,
    borderRadius: 10,
    backgroundColor: '#f0f0f0',
    marginBottom: 5,
  },
  orderItemName: {
    fontSize: 11,
    color: '#666',
    width: 60,
    textAlign: 'center',
  },
  orderItemQuantity: {
    fontSize: 10,
    color: '#999',
    marginTop: 2,
  },
  orderFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    borderTopWidth: 1,
    borderTopColor: '#f0f0f0',
    paddingTop: 15,
  },
  itemsCount: {
    fontSize: 12,
    color: '#999',
    marginBottom: 4,
  },
  orderTotal: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#333',
  },
  detailButton: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  detailButtonText: {
    fontSize: 14,
    color: '#667eea',
    fontWeight: '500',
    marginRight: 5,
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
    textAlign: 'center',
  },
});
