import NetInfo from '@react-native-community/netinfo';
import { getUnsyncedScans, markAsSynced, ScanRecord } from '../storage/scanHistory';

const BACKEND_URL = 'http://localhost:8000';
const SYNC_INTERVAL = 5 * 60 * 1000;

let syncInterval: NodeJS.Timeout | null = null;
let isSyncing = false;

export function startSyncService(): void {
    console.log('Starting sync service...');

    syncNow();

    if (syncInterval) {
        clearInterval(syncInterval);
    }

    syncInterval = setInterval(() => {
        syncNow();
    }, SYNC_INTERVAL);

    NetInfo.addEventListener(state => {
        if (state.isConnected && !isSyncing) {
            console.log('Network connected, triggering sync...');
            syncNow();
        }
    });
}

export function stopSyncService(): void {
    if (syncInterval) {
        clearInterval(syncInterval);
        syncInterval = null;
    }
    console.log('Sync service stopped');
}

export async function syncNow(): Promise<boolean> {
    if (isSyncing) {
        console.log('Sync already in progress');
        return false;
    }

    try {
        isSyncing = true;

        const netInfo = await NetInfo.fetch();
        if (!netInfo.isConnected) {
            console.log('No internet connection, skipping sync');
            return false;
        }

        const unsyncedScans = await getUnsyncedScans();
        if (unsyncedScans.length === 0) {
            console.log('No scans to sync');
            return true;
        }

        console.log(`Syncing ${unsyncedScans.length} scans...`);

        const success = await sendToBackend(unsyncedScans);

        if (success) {
            const ids = unsyncedScans.map(scan => scan.id!).filter(id => id !== undefined);
            await markAsSynced(ids);
            console.log(`Successfully synced ${ids.length} scans`);
            return true;
        }

        return false;
    } catch (error) {
        console.error('Error during sync:', error);
        return false;
    } finally {
        isSyncing = false;
    }
}

async function sendToBackend(scans: ScanRecord[]): Promise<boolean> {
    try {
        const syncData = scans.map(scan => ({
            diseaseId: scan.diseaseId,
            diseaseName: scan.diseaseName,
            confidence: scan.confidence,
            latitude: scan.latitude,
            longitude: scan.longitude,
            timestamp: scan.timestamp,
        }));

        const response = await fetch(`${BACKEND_URL}/sync`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({ scans: syncData }),
            signal: AbortSignal.timeout(30000),
        });

        if (!response.ok) {
            console.error('Backend sync failed:', response.status);
            return false;
        }

        const result = await response.json();
        console.log('Backend response:', result);
        return true;
    } catch (error) {
        console.error('Error sending to backend:', error);
        return false;
    }
}

export function isSyncInProgress(): boolean {
    return isSyncing;
}

export async function getSyncStatus(): Promise<{
    isConnected: boolean;
    isSyncing: boolean;
    unsyncedCount: number;
}> {
    const netInfo = await NetInfo.fetch();
    const unsyncedScans = await getUnsyncedScans();

    return {
        isConnected: netInfo.isConnected || false,
        isSyncing,
        unsyncedCount: unsyncedScans.length,
    };
}
