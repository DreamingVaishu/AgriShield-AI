import type { DiseaseLabel } from './classifier';

export interface ScanRecord {
    id: string;
    disease: DiseaseLabel;
    confidence: number;
    imageUri: string; // Data URL for web
    timestamp: number;
    locationName?: string;
}

const STORAGE_KEY = 'agrishield_scans';

export function saveScan(record: Omit<ScanRecord, 'id' | 'timestamp'>): ScanRecord {
    const scans = getScans();

    const newRecord: ScanRecord = {
        ...record,
        id: crypto.randomUUID(),
        timestamp: Date.now()
    };

    scans.unshift(newRecord); // Add to beginning

    try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(scans));
    } catch (e) {
        console.error('Storage full or error', e);
        // If full, remove oldest
        if (scans.length > 50) {
            scans.pop();
            localStorage.setItem(STORAGE_KEY, JSON.stringify(scans));
        }
    }

    return newRecord;
}

export function getScans(): ScanRecord[] {
    try {
        const data = localStorage.getItem(STORAGE_KEY);
        return data ? JSON.parse(data) : [];
    } catch (e) {
        console.error('Error reading storage', e);
        return [];
    }
}

export function clearHistory(): void {
    localStorage.removeItem(STORAGE_KEY);
}
