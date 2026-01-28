const express = require('express');
const cors = require('cors');
const bodyParser = require('body-parser');
const sqlite3 = require('sqlite3').verbose();
const path = require('path');

const app = express();
const PORT = process.env.PORT || 5000;

// Middleware
app.use(cors());
app.use(bodyParser.json({ limit: '20mb' }));

// Database Setup
const dbPath = path.resolve(__dirname, 'agrishield.db');
const db = new sqlite3.Database(dbPath, (err) => {
  if (err) {
    console.error('Error opening database ' + dbPath + ': ' + err.message);
  } else {
    console.log('Connected to the SQLite database.');
    initDb();
  }
});

function initDb() {
  db.run(
    `CREATE TABLE IF NOT EXISTS scans (
      id TEXT PRIMARY KEY,
      disease_name TEXT,
      confidence REAL,
      timestamp INTEGER,
      latitude REAL,
      longitude REAL,
      device_id TEXT,
      synced_at INTEGER
    )`,
    (err) => {
      if (err) {
        console.error('Error creating table:', err.message);
      } else {
        console.log('Scans table ready.');
      }
    }
  );
}

// Routes
app.get('/', (req, res) => {
  res.send('AgriShield Backend is running.');
});

// Sync Endpoint - Receives array of offline scans
app.post('/api/sync', (req, res) => {
  const scans = req.body.scans;

  if (!Array.isArray(scans)) {
    return res.status(400).json({ error: 'Invalid payload: scans array required.' });
  }

  console.log(`Received ${scans.length} scans for sync.`);
  const stmt = db.prepare(
    `INSERT OR IGNORE INTO scans 
     (id, disease_name, confidence, timestamp, latitude, longitude, device_id, synced_at) 
     VALUES (?, ?, ?, ?, ?, ?, ?, ?)`
  );

  let successCount = 0;
  const now = Date.now();

  db.serialize(() => {
    db.run('BEGIN TRANSACTION');
    scans.forEach((scan) => {
      stmt.run(
        scan.id,
        scan.disease_name,
        scan.confidence,
        scan.timestamp,
        scan.latitude ?? null,
        scan.longitude ?? null,
        scan.device_id ?? 'unknown',
        now,
        function (err) {
          if (!err) successCount++;
        }
      );
    });
    db.run('COMMIT');
    stmt.finalize();

    res.json({
      success: true,
      received: scans.length,
      synced: successCount,
      synced_at: now,
      message: `Processed ${successCount}/${scans.length} scans`,
    });
  });
});

// Recent scans
app.get('/api/scans', (req, res) => {
  db.all('SELECT * FROM scans ORDER BY timestamp DESC LIMIT 50', [], (err, rows) => {
    if (err) {
      res.status(500).json({ error: err.message });
      return;
    }
    res.json({ data: rows });
  });
});

// Stats: counts by disease, avg confidence
app.get('/api/scans/stats', (req, res) => {
  const statsQuery = `
    SELECT disease_name, 
           COUNT(*) AS count,
           ROUND(AVG(confidence), 2) AS avg_confidence
    FROM scans
    GROUP BY disease_name
    ORDER BY count DESC
  `;

  db.all(statsQuery, [], (err, rows) => {
    if (err) {
      res.status(500).json({ error: err.message });
      return;
    }
    res.json({ stats: rows });
  });
});

app.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
});
