import 'package:flutter/material.dart';

class OrderProvider extends ChangeNotifier {
  List<dynamic> _orders = [];
  
  List<dynamic> get orders => _orders;
  
  void addOrder(dynamic order) {
    _orders.add(order);
    notifyListeners();
  }
}
