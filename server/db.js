import { MongoClient } from 'mongodb';
import dotenv from 'dotenv';
dotenv.config();

const MONGODB_URI = process.env.MONGODB_URI;
const MONGODB_DB = process.env.MONGODB_DB || 'Bobby-salon';

let client = null;
let db = null;
let connectionPromise = null;

/**
 * Connect to MongoDB Atlas.
 * Reuses existing connection if already connected.
 */
export async function connectDB() {
  if (!MONGODB_URI) {
    throw new Error('MONGODB_URI is not defined in Vercel Environment Variables. Please add it in the Vercel Dashboard.');
  }
  
  if (db) return db;
  if (connectionPromise) return connectionPromise;

  connectionPromise = (async () => {
    client = new MongoClient(MONGODB_URI);
    await client.connect();
    db = client.db(MONGODB_DB);
    console.log(`✅ Connected to MongoDB: ${MONGODB_DB}`);
    
    // Automatically create database indexes
    await initializeIndexes(db);
    
    return db;
  })();

  return connectionPromise;
}

async function initializeIndexes(dbInstance) {
  try {
    await dbInstance.collection('bookings').createIndex({ date: 1, time: 1 });
    await dbInstance.collection('sessions').createIndex({ token: 1 }, { unique: true });
    await dbInstance.collection('sessions').createIndex({ createdAt: 1 }, { expireAfterSeconds: 604800 }); // Auto-expire after 7 days
    await dbInstance.collection('admins').createIndex({ username: 1 }, { unique: true });
    console.log("⚡ MongoDB indexes successfully verified/created.");
  } catch (err) {
    console.error("❌ Failed to initialize MongoDB indexes:", err);
  }
}

/**
 * Close the MongoDB connection gracefully.
 */
export async function closeDB() {
  if (client) {
    await client.close();
    client = null;
    db = null;
    console.log('MongoDB connection closed.');
  }
}

/**
 * Get a reference to the database (must call connectDB first).
 */
export function getDB() {
  if (!db) throw new Error('Database not connected. Call connectDB() first.');
  return db;
}

export function getClient() {
  if (!client) throw new Error('Database client not connected. Call connectDB() first.');
  return client;
}

// Collection accessors
export function getBookingsCollection() {
  return getDB().collection('bookings');
}

export function getCompletedCollection() {
  return getDB().collection('completedBookings');
}

export function getQueueCollection() {
  return getDB().collection('queue');
}

export function getGalleryOrderCollection() {
  return getDB().collection('galleryOrder');
}

export function getSettingsCollection() {
  return getDB().collection('settings');
}

export function getServicesCollection() {
  return getDB().collection('services');
}

export function getAdminsCollection() {
  return getDB().collection('admins');
}

export function getSessionsCollection() {
  return getDB().collection('sessions');
}

