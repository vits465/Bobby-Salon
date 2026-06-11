/**
 * One-time migration script: database.json → MongoDB Atlas
 * 
 * Run with: node migrate-to-mongo.mjs
 */
import { MongoClient } from 'mongodb';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import dotenv from 'dotenv';
dotenv.config();

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DB_FILE = path.join(__dirname, 'database.json');

const MONGODB_URI = process.env.MONGODB_URI;
const MONGODB_DB = process.env.MONGODB_DB || 'Bobby-salon';

if (!MONGODB_URI) {
  console.error('❌ MONGODB_URI is not set in .env');
  process.exit(1);
}

if (!fs.existsSync(DB_FILE)) {
  console.error('❌ database.json not found — nothing to migrate.');
  process.exit(1);
}

const data = JSON.parse(fs.readFileSync(DB_FILE, 'utf8'));

async function migrate() {
  const client = new MongoClient(MONGODB_URI);
  
  try {
    await client.connect();
    console.log('✅ Connected to MongoDB Atlas');
    
    const db = client.db(MONGODB_DB);
    
    // 1. Migrate bookedSlots → bookings
    if (data.bookedSlots && data.bookedSlots.length > 0) {
      await db.collection('bookings').deleteMany({});
      const result = await db.collection('bookings').insertMany(data.bookedSlots);
      console.log(`📋 Migrated ${result.insertedCount} booked slots → bookings`);
    } else {
      console.log('📋 No booked slots to migrate');
    }
    
    // 2. Migrate completedSlots → completedBookings
    if (data.completedSlots && data.completedSlots.length > 0) {
      await db.collection('completedBookings').deleteMany({});
      const result = await db.collection('completedBookings').insertMany(data.completedSlots);
      console.log(`✅ Migrated ${result.insertedCount} completed slots → completedBookings`);
    } else {
      console.log('✅ No completed slots to migrate');
    }
    
    // 3. Migrate queue → queue
    if (data.queue && data.queue.length > 0) {
      await db.collection('queue').deleteMany({});
      const result = await db.collection('queue').insertMany(data.queue);
      console.log(`⏳ Migrated ${result.insertedCount} queue items → queue`);
    } else {
      console.log('⏳ No queue items to migrate');
    }
    
    // 4. Migrate galleryOrder → galleryOrder (as metadata only — files stay local until re-uploaded to Cloudinary)
    if (data.galleryOrder && data.galleryOrder.length > 0) {
      // Store as legacy filenames — these won't have Cloudinary URLs yet
      // They'll be replaced when files are re-uploaded through the admin panel
      console.log(`🖼  Gallery order has ${data.galleryOrder.length} items (filenames only — re-upload to Cloudinary via admin panel)`);
      console.log('   Gallery order NOT migrated to MongoDB — upload files through admin to populate Cloudinary.');
    }
    
    // 5. Migrate timings → settings
    if (data.timings) {
      await db.collection('settings').updateOne(
        { _id: 'timings' },
        { $set: data.timings },
        { upsert: true }
      );
      console.log('⚙️  Migrated timings → settings');
    } else {
      console.log('⚙️  No custom timings to migrate (using defaults)');
    }
    
    console.log('\n🏁 Migration complete!');
    console.log('\n📝 Next steps:');
    console.log('   1. Start the server: npm run dev');
    console.log('   2. Test booking flow on the site');
    console.log('   3. Go to Admin → Gallery tab and re-upload your media files');
    console.log('      (they will now be stored on Cloudinary instead of locally)');
    
  } catch (err) {
    console.error('❌ Migration failed:', err);
  } finally {
    await client.close();
    console.log('\nMongoDB connection closed.');
  }
}

migrate();
