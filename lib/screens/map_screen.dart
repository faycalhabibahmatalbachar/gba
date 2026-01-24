import 'package:flutter/material.dart';
import 'package:flutter/foundation.dart';
import 'package:flutter_map/flutter_map.dart';
import 'package:latlong2/latlong.dart';
import 'package:geolocator/geolocator.dart';
import 'package:permission_handler/permission_handler.dart';
import '../localization/app_localizations.dart';

class MapScreen extends StatefulWidget {
  const MapScreen({super.key});

  @override
  State<MapScreen> createState() => _MapScreenState();
}

class _MapScreenState extends State<MapScreen> {
  late MapController mapController;
  LatLng? currentLocation;
  bool isLoading = true;

  @override
  void initState() {
    super.initState();
    mapController = MapController();
    isLoading = false;
  }

  @override
  void dispose() {
    mapController.dispose();
    super.dispose();
  }

  Future<void> _getCurrentLocation() async {
    setState(() => isLoading = true);
    try {
      if (kIsWeb) {
        var permission = await Geolocator.checkPermission();
        if (permission == LocationPermission.denied) {
          permission = await Geolocator.requestPermission();
        }
        if (permission == LocationPermission.denied ||
            permission == LocationPermission.deniedForever) {
          setState(() => isLoading = false);
          return;
        }
      } else {
        final permission = await Permission.location.request();
        if (!permission.isGranted) {
          setState(() => isLoading = false);
          return;
        }
      }

      final position = await Geolocator.getCurrentPosition(
        desiredAccuracy: LocationAccuracy.high,
        timeLimit: const Duration(seconds: 10),
      );
        
      setState(() {
        currentLocation = LatLng(position.latitude, position.longitude);
        isLoading = false;
      });
        
      // Move map to current location
      mapController.move(currentLocation!, 13.0);
    } catch (e) {
      setState(() {
        isLoading = false;
      });
    }
  }

  @override
  Widget build(BuildContext context) {
    final localizations = AppLocalizations.of(context);
    
    return Scaffold(
      appBar: AppBar(
        title: Text('Location Map'),
      ),
      body: isLoading
          ? const Center(child: CircularProgressIndicator())
          : currentLocation == null
              ? const Center(
                  child: Text('Unable to get current location'),
                )
              : FlutterMap(
                  mapController: mapController,
                  options: MapOptions(
                    initialCenter: currentLocation!,
                    initialZoom: 13.0,
                  ),
                  children: [
                    TileLayer(
                      urlTemplate: 'https://tile.openstreetmap.org/{z}/{x}/{y}.png',
                      userAgentPackageName: 'com.example.ecommerce_client',
                    ),
                    MarkerLayer(
                      markers: [
                        Marker(
                          point: currentLocation!,
                          child: Icon(
                            Icons.location_on,
                            color: Theme.of(context).colorScheme.primary,
                            size: 40,
                          ),
                        ),
                      ],
                    ),
                  ],
                ),
      floatingActionButton: FloatingActionButton(
        onPressed: _getCurrentLocation,
        child: const Icon(Icons.my_location),
      ),
    );
  }
}
