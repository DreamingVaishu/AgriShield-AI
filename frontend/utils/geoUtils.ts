import * as Location from 'expo-location';

export interface GeoLocation {
    latitude: number;
    longitude: number;
    accuracy: number;
    timestamp: number;
}

export async function requestLocationPermission(): Promise<boolean> {
    try {
        const { status } = await Location.requestForegroundPermissionsAsync();
        return status === 'granted';
    } catch (error) {
        console.error('Error requesting location permission:', error);
        return false;
    }
}

export async function getCurrentLocation(): Promise<GeoLocation | null> {
    try {
        const hasPermission = await requestLocationPermission();
        if (!hasPermission) {
            console.warn('Location permission denied');
            return null;
        }

        const location = await Location.getCurrentPositionAsync({
            accuracy: Location.Accuracy.Balanced,
        });

        const roundedLocation: GeoLocation = {
            latitude: roundToDecimalPlaces(location.coords.latitude, 2),
            longitude: roundToDecimalPlaces(location.coords.longitude, 2),
            accuracy: location.coords.accuracy || 0,
            timestamp: location.timestamp,
        };

        return roundedLocation;
    } catch (error) {
        console.error('Error getting location:', error);
        return null;
    }
}

function roundToDecimalPlaces(num: number, decimals: number): number {
    const factor = Math.pow(10, decimals);
    return Math.round(num * factor) / factor;
}

export function formatLocation(location: GeoLocation | null): string {
    if (!location) {
        return 'Location unavailable';
    }
    return `${location.latitude.toFixed(2)}, ${location.longitude.toFixed(2)}`;
}

export async function getLocationName(location: GeoLocation | null): Promise<string> {
    if (!location) {
        return 'Unknown Location';
    }

    try {
        const [address] = await Location.reverseGeocodeAsync({
            latitude: location.latitude,
            longitude: location.longitude,
        });

        if (address) {
            return address.city || address.subregion || address.region || formatLocation(location);
        }
    } catch (error) {
        console.log('Reverse geocoding unavailable, using coordinates');
    }

    return formatLocation(location);
}
