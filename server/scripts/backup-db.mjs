/**
 * Bobby Salon — Database Backup Script
 * Usage: node server/scripts/backup-db.mjs
 * 
 * Exports all MongoDB collections to a timestamped JSON file in backups/
 */
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import dns from 'dns';
dns.setServers(['8.8.8.8', '1.1.1.1']);
import dotenv from 'dotenv';
import { MongoClient } from 'mongodb';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const appRoot = path.resolve(__dirname, '../..');

dotenv.config({ path: path.join(appRoot, '.env') });

const uri = process.env.MONGODB_URI;
const dbName = process.env.MONGODB_DB || 'Bobby-salon';

if (!uri) {
  console.error("❌ MONGODB_URI not found in .env file.");
  process.exit(1);
}

async function runBackup() {
  const client = new MongoClient(uri, { serverSelectionTimeoutMS: 8000 });
  try {
    console.log(`Connecting to MongoDB Atlas (${dbName})...`);
    await client.connect();
    const db = client.db(dbName);

    const collections = [
      'bookings',
      'completedBookings',
      'queue',
      'services',
      'settings',
      'galleryOrder'
    ];

    const backupData = {
      createdAt: new Date().toISOString(),
      database: dbName,
      collections: {}
    };

    let totalRecords = 0;
    for (const colName of collections) {
      const items = await db.collection(colName).find({}).toArray();
      backupData.collections[colName] = items;
      totalRecords += items.length;
      console.log(`✓ Backed up ${colName}: ${items.length} records`);
    }

    const backupDir = path.join(appRoot, 'backups');
    if (!fs.existsSync(backupDir)) {
      fs.mkdirSync(backupDir, { recursive: true });
    }

    const dateStr = new Date().toISOString().slice(0, 10);
    const timeStr = new Date().toISOString().slice(11, 19).replace(/:/g, '-');
    const filename = `bobby_salon_backup_${dateStr}_${timeStr}.json`;
    const filePath = path.join(backupDir, filename);

    fs.writeFileSync(filePath, JSON.stringify(backupData, null, 2), 'utf-8');
    console.log(`\n🎉 Backup successfully created!`);
    console.log(`📁 File: ${filePath}`);
    console.log(`📊 Total records exported: ${totalRecords}`);
  } catch (err) {
    console.error("❌ Backup failed:", err.message);
  } finally {
    await client.close();
  }
}

runBackup();
