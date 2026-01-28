import { openDB, type DBSchema, type IDBPDatabase } from 'idb';
import type { DiseaseLabel } from './classifier';

export interface ScanRecord {
    id: string;
    disease: DiseaseLabel;
    confidence: number;
    imageUri: string; // Data URL for web
    timestamp: number;
    locationName?: string;
    synced: number; // 0 = false, 1 = true
}

interface AgriShieldDB extends DBSchema {
    scans: {
        key: string;
        value: ScanRecord;
        indexes: { 'by-synced': number; 'by-timestamp': number };
    };
}

const DB_NAME = 'AgriShieldDB';
const DB_VERSION = 1;

export const initDB = async (): Promise<IDBPDatabase<AgriShieldDB>> => {
    return openDB<AgriShieldDB>(DB_NAME, DB_VERSION, {
        upgrade(db) {
            if (!db.objectStoreNames.contains('scans')) {
                const store = db.createObjectStore('scans', { keyPath: 'id' });
                store.createIndex('by-synced', 'synced');
                store.createIndex('by-timestamp', 'timestamp');
            }
        },
    });
};

export async function saveScan(record: Omit<ScanRecord, 'id' | 'timestamp' | 'synced'>): Promise<ScanRecord> {
    const db = await initDB();
    const newRecord: ScanRecord = {
        ...record,
        id: crypto.randomUUID(),
        timestamp: Date.now(),
        synced: 0
    };
    await db.put('scans', newRecord);
    return newRecord;
}

export async function getScans(): Promise<ScanRecord[]> {
    const db = await initDB();
    return db.getAllFromIndex('scans', 'by-timestamp');
}

export async function getPendingScans(): Promise<ScanRecord[]> {
    const db = await initDB();
    return db.getAllFromIndex('scans', 'by-synced', 0);
}

export async function markSynced(ids: string[]) {
    const db = await initDB();
    const tx = db.transaction('scans', 'readwrite');
    const store = tx.objectStore('scans');

    for (const id of ids) {
        const scan = await store.get(id);
        if (scan) {
            scan.synced = 1;
            await store.put(scan);
        }
    }
    await tx.done;
}

const BACKEND_URL = 'http://localhost:5000'; // Update for production

export const syncWithBackend = async (): Promise<{ synced: number, error?: string }> => {
    try {
        const pending = await getPendingScans();
        if (pending.length === 0) return { synced: 0 };

        // Format for backend (map fields if necessary)
        // Backend expects: id, disease_name, confidence, timestamp, etc.
        const payload = pending.map(s => ({
            id: s.id,
            disease_name: s.disease.name,
            confidence: s.confidence,
            timestamp: s.timestamp,
            // image: s.imageUri // Optional: send image if backend handles it
        }));

        const response = await fetch(`${BACKEND_URL}/api/sync`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ scans: payload }),
        });

        if (response.ok) {
            const ids = pending.map(s => s.id);
            await markSynced(ids);
            console.log(`Synced ${ids.length} scans.`);
            return { synced: ids.length };
        } else {
            const text = await response.text();
            console.error("Sync failed:", text);
            return { synced: 0, error: text };
        }
    } catch (error) {
        const message = error instanceof Error ? error.message : 'Unknown error';
        console.error("Sync error:", message);
        return { synced: 0, error: message };
    }
};

export function clearHistory(): void {
    // Drop database or clear store
    // For now clear store
    initDB().then(db => db.clear('scans'));
}
