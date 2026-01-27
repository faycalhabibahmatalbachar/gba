import 'package:flutter/material.dart';
import '../localization/app_localizations.dart';

class AppDrawer extends StatelessWidget {
  const AppDrawer({Key? key}) : super(key: key);

  @override
  Widget build(BuildContext context) {
    final localizations = AppLocalizations.of(context);
    return Drawer(
      child: ListView(
        padding: EdgeInsets.zero,
        children: [
          DrawerHeader(
            decoration: BoxDecoration(
              gradient: LinearGradient(
                colors: [
                  Theme.of(context).primaryColor,
                  Theme.of(context).primaryColor.withOpacity(0.8),
                ],
                begin: Alignment.topLeft,
                end: Alignment.bottomRight,
              ),
            ),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              mainAxisAlignment: MainAxisAlignment.end,
              children: [
                Icon(
                  Icons.person,
                  size: 40,
                  color: Colors.white,
                ),
                const SizedBox(height: 10),
                Text(
                  localizations.translate('menu'),
                  style: const TextStyle(
                    color: Colors.white,
                    fontSize: 24,
                    fontWeight: FontWeight.bold,
                  ),
                ),
              ],
            ),
          ),
          ListTile(
            leading: const Icon(Icons.home),
            title: Text(localizations.translate('home')),
            onTap: () {
              if (Navigator.canPop(context)) {
                Navigator.pop(context);
              }
            },
          ),
          ListTile(
            leading: const Icon(Icons.shopping_cart),
            title: Text(localizations.translate('cart')),
            onTap: () {
              if (Navigator.canPop(context)) {
                Navigator.pop(context);
              }
            },
          ),
          ListTile(
            leading: const Icon(Icons.favorite),
            title: Text(localizations.translate('favorites')),
            onTap: () {
              if (Navigator.canPop(context)) {
                Navigator.pop(context);
              }
            },
          ),
          ListTile(
            leading: const Icon(Icons.person),
            title: Text(localizations.translate('profile')),
            onTap: () {
              if (Navigator.canPop(context)) {
                Navigator.pop(context);
              }
            },
          ),
          ListTile(
            leading: Icon(Icons.support_agent, color: Colors.orange[700]),
            title: Text(localizations.translate('support_admin')),
            onTap: () {
              if (Navigator.canPop(context)) {
                Navigator.pop(context);
              }
              Navigator.pushNamed(context, '/admin-chat');
            },
            trailing: Container(
              padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 4),
              decoration: BoxDecoration(
                color: Colors.orange[100],
                borderRadius: BorderRadius.circular(12),
              ),
              child: Text(
                localizations.translate('chat'),
                style: TextStyle(
                  fontSize: 12,
                  color: Colors.orange[700],
                  fontWeight: FontWeight.bold,
                ),
              ),
            ),
          ),
          const Divider(),
          ListTile(
            leading: const Icon(Icons.settings),
            title: Text(localizations.translate('settings')),
            onTap: () {
              if (Navigator.canPop(context)) {
                Navigator.pop(context);
              }
            },
          ),
          ListTile(
            leading: const Icon(Icons.logout),
            title: Text(localizations.translate('logout')),
            onTap: () {
              if (Navigator.canPop(context)) {
                Navigator.pop(context);
              }
            },
          ),
        ],
      ),
    );
  }
}
