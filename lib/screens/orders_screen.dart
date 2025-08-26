import 'package:flutter/material.dart';
import 'package:go_router/go_router.dart';
import '../localization/app_localizations.dart';

class OrdersScreen extends StatelessWidget {
  const OrdersScreen({super.key});

  @override
  Widget build(BuildContext context) {
    final localizations = AppLocalizations.of(context);
    
    return DefaultTabController(
      length: 2,
      child: Scaffold(
        appBar: AppBar(
          title: Text(localizations.translate('orders')),
          bottom: TabBar(
            tabs: [
              Tab(text: localizations.translate('orderHistory')),
              Tab(text: localizations.translate('specialOrder')),
            ],
          ),
        ),
        body: TabBarView(
          children: [
            OrderHistoryTab(),
            SpecialOrdersTab(),
          ],
        ),
      ),
    );
  }
}

class OrderHistoryTab extends StatelessWidget {
  @override
  Widget build(BuildContext context) {
    final localizations = AppLocalizations.of(context);
    
    return Padding(
      padding: const EdgeInsets.all(16.0),
      child: ListView.builder(
        itemCount: 5, // Sample order count
        itemBuilder: (context, index) {
          return Card(
            child: ListTile(
              title: Text('Order #${index + 1}'),
              subtitle: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text('Date: ${DateTime.now().subtract(Duration(days: index)).toString().split(' ')[0]}'),
                  const SizedBox(height: 4),
                  Text('Status: ${['Delivered', 'Shipped', 'Processing'][index % 3]}'),
                ],
              ),
              trailing: Text('\$${(index + 1) * 25.99}'),
              onTap: () {
                // TODO: Navigate to order details
              },
            ),
          );
        },
      ),
    );
  }
}

class SpecialOrdersTab extends StatelessWidget {
  @override
  Widget build(BuildContext context) {
    final localizations = AppLocalizations.of(context);
    
    return Padding(
      padding: const EdgeInsets.all(16.0),
      child: Column(
        children: [
          Expanded(
            child: ListView.builder(
              itemCount: 3, // Sample special order count
              itemBuilder: (context, index) {
                return Card(
                  child: ListTile(
                    title: Text('Special Order #${index + 1}'),
                    subtitle: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Text('Date: ${DateTime.now().subtract(Duration(days: index)).toString().split(' ')[0]}'),
                        const SizedBox(height: 4),
                        Text('Status: ${['Pending', 'In Progress', 'Completed'][index % 3]}'),
                      ],
                    ),
                    trailing: IconButton(
                      icon: const Icon(Icons.message),
                      onPressed: () {
                        context.go('/messaging');
                      },
                    ),
                    onTap: () {
                      // TODO: Navigate to special order details
                    },
                  ),
                );
              },
            ),
          ),
          SizedBox(
            width: double.infinity,
            child: ElevatedButton(
              onPressed: () {
                context.go('/special-order');
              },
              child: Text(localizations.translate('specialOrder')),
            ),
          ),
        ],
      ),
    );
  }
}
