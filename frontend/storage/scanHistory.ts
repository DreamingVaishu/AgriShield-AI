import * as SQLite from 'expo-sqlite';
import { Platform } from 'react-native';
import { GeoLocation } from '../utils/geoUtils';

// ... interface definitions ...

export interface ScanRecord {
    id?: number;
    diseaseId: number;
    diseaseName: string;
    confidence: number;
    imageUri: string;
    latitude: number | null;
    longitude: number | null;
    locationName: string;
    timestamp: number;
    synced: boolean;
}

const DB_NAME = 'agrishield.db';
let db: SQLite.SQLiteDatabase | null = null;

export async function initializeDatabase(): Promise<void> {
    if (Platform.OS === 'web') {
        console.log('Running on web - using mock storage');
        return;
    }

    try {
        db = await SQLite.openDatabaseAsync(DB_NAME);

        await db.execAsync(`
      CREATE TABLE IF NOT EXISTS scans (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        diseaseId INTEGER NOT NULL,
        diseaseName TEXT NOT NULL,
        confidence REAL NOT NULL,
        imageUri TEXT NOT NULL,
        latitude REAL,
        longitude REAL,
        locationName TEXT,
        timestamp INTEGER NOT NULL,
        synced INTEGER DEFAULT 0
      );
      
      CREATE INDEX IF NOT EXISTS idx_timestamp ON scans(timestamp DESC);
      CREATE INDEX IF NOT EXISTS idx_synced ON scans(synced);
    `);

        console.log('Database initialized successfully');
    } catch (error) {
        console.error('Error initializing database:', error);
        throw new Error('Failed to initialize database');
    }
}

export async function saveScan(record: Omit<ScanRecord, 'id' | 'synced'>): Promise<number> {
    try {
        if (!db) {
            await initializeDatabase();
        }

        const result = await db!.runAsync(
            `INSERT INTO scans (diseaseId, diseaseName, confidence, imageUri, latitude, longitude, locationName, timestamp, synced)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, 0)`,
            [
                record.diseaseId,
                record.diseaseName,
                record.confidence,
                record.imageUri,
                record.latitude,
                record.longitude,
                record.locationName,
                record.timestamp,
            ]
        );

        console.log('Scan saved with ID:', result.lastInsertRowId);
        return result.lastInsertRowId;
    } catch (error) {
        console.error('Error saving scan:', error);
        throw new Error('Failed to save scan record');
    }
}

export async function getAllScans(limit: number = 100): Promise<ScanRecord[]> {
    try {
        if (!db) {
            await initializeDatabase();
        }

        const rows = await db!.getAllAsync<ScanRecord>(
            'SELECT * FROM scans ORDER BY timestamp DESC LIMIT ?',
            [limit]
        );

        return rows.map(row => ({
            ...row,
            synced: row.synced === 1,
        }));
    } catch (error) {
        console.error('Error getting scans:', error);
        return [];
    }
}

export async function getUnsyncedScans(): Promise<ScanRecord[]> {
    try {
        if (!db) {
            await initializeDatabase();
        }

        const rows = await db!.getAllAsync<ScanRecord>(
            'SELECT * FROM scans WHERE synced = 0 ORDER BY timestamp ASC'
        );

        return rows.map(row => ({
            ...row,
            synced: false,
        }));
    } catch (error) {
        console.error('Error getting unsynced scans:', error);
        return [];
    }
}

export async function markAsSynced(ids: number[]): Promise<void> {
    try {
        if (!db || ids.length === 0) {
            return;
        }

        const placeholders = ids.map(() => '?').join(',');
        await db.runAsync(
            `UPDATE scans SET synced = 1 WHERE id IN (${placeholders})`,
            ids
        );

        console.log(`Marked ${ids.length} scans as synced`);
    } catch (error) {
        console.error('Error marking scans as synced:', error);
    }
}

export async function getScanStats(): Promise<{
    total: number;
    synced: number;
    unsynced: number;
}> {
    try {
        if (!db) {
            await initializeDatabase();
        }

        const totalResult = await db!.getFirstAsync<{ count: number }>(
            'SELECT COUNT(*) as count FROM scans'
        );
        const syncedResult = await db!.getFirstAsync<{ count: number }>(
            'SELECT COUNT(*) as count FROM scans WHERE synced = 1'
        );

        const total = totalResult?.count || 0;
        const synced = syncedResult?.count || 0;

        return {
            total,
            synced,
            unsynced: total - synced,
        };
    } catch (error) {
        console.error('Error getting scan stats:', error);
        return { total: 0, synced: 0, unsynced: 0 };
    }
}

export async function deleteOldScans(days: number = 90): Promise<void> {
    try {
        if (!db) {
            return;
        }

        const cutoffTime = Date.now() - days * 24 * 60 * 60 * 1000;
        await db.runAsync('DELETE FROM scans WHERE timestamp < ? AND synced = 1', [cutoffTime]);

        console.log(`Deleted scans older than ${days} days`);
    } catch (error) {
        console.error('Error deleting old scans:', error);
    }
}
