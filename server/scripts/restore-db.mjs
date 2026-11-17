/**
 * Bobby Salon — Database Restore Script
 * Usage: node server/scripts/restore-db.mjs <backup-file.json>
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

const backupFile = process.argv[2];
if (!backupFile) {
  console.error("❌ Please provide backup file path. Example: node server/scripts/restore-db.mjs backups/filename.json");
  process.exit(1);
}

const resolvedPath = path.isAbsolute(backupFile) ? backupFile : path.join(appRoot, backupFile);
if (!fs.existsSync(resolvedPath)) {
  console.error(`❌ Backup file not found at: ${resolvedPath}`);
  process.exit(1);
}

async function runRestore() {
  const client = new MongoClient(uri, { serverSelectionTimeoutMS: 8000 });
  try {
    const rawData = fs.readFileSync(resolvedPath, 'utf-8');
    const backupData = JSON.parse(rawData);

    if (!backupData.collections) {
      console.error("❌ Invalid backup file format.");
      process.exit(1);
    }

    console.log(`Connecting to MongoDB Atlas (${dbName})...`);
    await client.connect();
    const db = client.db(dbName);

    console.log(`Starting restore from backup dated: ${backupData.createdAt}...`);

    for (const [colName, docs] of Object.entries(backupData.collections)) {
      if (!Array.isArray(docs) || docs.length === 0) continue;
      
      const col = db.collection(colName);
      // Upsert documents by _id or insert
      for (const doc of docs) {
        if (doc._id) {
          await col.replaceOne({ _id: doc._id }, doc, { upsert: true });
        } else {
          await col.insertOne(doc);
        }
      }
      console.log(`✓ Restored ${colName}: ${docs.length} documents`);
    }

    console.log("\n🎉 Database restore completed successfully!");
  } catch (err) {
    console.error("❌ Restore failed:", err.message);
  } finally {
    await client.close();
  }
}

runRestore();
