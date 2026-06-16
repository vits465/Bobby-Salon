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
  if (db) return db;
  if (connectionPromise) return connectionPromise;

  connectionPromise = (async () => {
    if (!MONGODB_URI) {
      console.warn("⚠️ MONGODB_URI is not defined. Falling back to local mock database.");
      db = createMockDB();
      return db;
    }
    try {
      client = new MongoClient(MONGODB_URI);
      await client.connect();
      db = client.db(MONGODB_DB);
      console.log(`✅ Connected to MongoDB: ${MONGODB_DB}`);
      
      // Automatically create database indexes
      await initializeIndexes(db);
    } catch (err) {
      console.error(`❌ Connection to MongoDB failed: ${err.message}. Falling back to local mock database.`);
      db = createMockDB();
    }
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
  if (!client) {
    if (db) {
      return {
        startSession: () => ({
          withTransaction: async (callback) => callback(),
          endSession: () => {}
        })
      };
    }
    throw new Error('Database client not connected. Call connectDB() first.');
  }
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

function createMockDB() {
  const store = {
    bookings: [],
    completedBookings: [],
    queue: [],
    galleryOrder: [],
    settings: [{
      _id: 'blocked_dates',
      dates: []
    }],
    services: [
      // Male
      { name: "Haircut + Beard (40 Min)", gender: "Male", duration: 40, price: 110, active: true },
      { name: "Only Haircut (25 Min)", gender: "Male", duration: 25, price: 65, active: true },
      { name: "Only Beard (15 Min)", gender: "Male", duration: 15, price: 45, active: true },
      { name: "Clean Shave (15 Min)", gender: "Male", duration: 15, price: 45, active: true },
      { name: "Face Massage (30 Min)", gender: "Male", duration: 30, price: 50, active: true },
      { name: "Face Cleanup (30 Min)", gender: "Male", duration: 30, price: 50, active: true },
      { name: "Facial (1 Hour)", gender: "Male", duration: 60, price: 80, active: true },
      { name: "Hydra Facial (1 Hour)", gender: "Male", duration: 60, price: 80, active: true },
      { name: "Hair Color (45 Min)", gender: "Male", duration: 45, price: 70, active: true },
      { name: "Haircut + Hair Color (1 Hour)", gender: "Male", duration: 60, price: 120, active: true },
      // Female
      { name: "Haircut (1 Hour)", gender: "Female", duration: 60, price: 65, active: true },
      { name: "Hair Wash (30 Min)", gender: "Female", duration: 30, price: 30, active: true },
      { name: "Hair Wash + Blow Dry (45 Min)", gender: "Female", duration: 45, price: 45, active: true },
      { name: "Hair Color (1 Hour 20 Min)", gender: "Female", duration: 80, price: 70, active: true },
      { name: "Hair Color Touch Up (1 Hour)", gender: "Female", duration: 60, price: 70, active: true },
      { name: "Face Cleanup (30 Min)", gender: "Female", duration: 30, price: 50, active: true },
      { name: "Facial (1 Hour)", gender: "Female", duration: 60, price: 80, active: true },
      { name: "Hair Treatment (4 Hour)", gender: "Female", duration: 240, price: 80, active: true },
      { name: "Hair Spa (1 Hour)", gender: "Female", duration: 60, price: 80, active: true }
    ].map((s, idx) => ({ _id: `s${idx}`, ...s })),
    admins: [{
      username: 'admin',
      passwordHash: 'c4ca4238a0b923820dcc509a6f75849b',
      salt: 'salt'
    }],
    sessions: []
  };

  function matchQuery(item, query) {
    if (!query || Object.keys(query).length === 0) return true;
    return Object.entries(query).every(([k, v]) => {
      const itemVal = item[k];
      if (v && typeof v === 'object') {
        if ('$ne' in v) {
          return itemVal !== v.$ne;
        }
        if ('$in' in v) {
          return Array.isArray(v.$in) && v.$in.includes(itemVal);
        }
      }
      return itemVal === v;
    });
  }

  const createMockCollection = (name) => {
    if (!store[name]) store[name] = [];
    const list = store[name];
    
    return {
      find: (query = {}, options = {}) => {
        let filtered = list.filter(item => matchQuery(item, query));
        return {
          toArray: async () => filtered,
          sort: function() { return this; },
          limit: function() { return this; }
        };
      },
      findOne: async (query = {}) => {
        let filtered = list.filter(item => matchQuery(item, query));
        return filtered[0] || null;
      },
      insertOne: async (doc) => {
        const newDoc = { _id: doc._id || Math.random().toString(36).substring(2, 9), ...doc };
        list.push(newDoc);
        return { insertedId: newDoc._id, acknowledged: true };
      },
      insertMany: async (docs) => {
        docs.forEach(doc => {
          list.push({ _id: doc._id || Math.random().toString(36).substring(2, 9), ...doc });
        });
        return { acknowledged: true };
      },
      updateOne: async (query, update) => {
        let item = list.find(item => matchQuery(item, query));
        if (item) {
          if (update.$set) {
            Object.assign(item, update.$set);
          }
          if (update.$inc) {
            Object.entries(update.$inc).forEach(([k, v]) => {
              item[k] = (item[k] || 0) + v;
            });
          }
        }
        return { matchedCount: item ? 1 : 0, modifiedCount: item ? 1 : 0 };
      },
      updateMany: async (query, update) => {
        let count = 0;
        list.forEach(item => {
          if (matchQuery(item, query)) {
            if (update.$set) {
              Object.assign(item, update.$set);
            }
            if (update.$inc) {
              Object.entries(update.$inc).forEach(([k, v]) => {
                item[k] = (item[k] || 0) + v;
              });
            }
            count++;
          }
        });
        return { matchedCount: count, modifiedCount: count };
      },
      deleteOne: async (query) => {
        const idx = list.findIndex(item => matchQuery(item, query));
        if (idx !== -1) {
          list.splice(idx, 1);
          return { deletedCount: 1 };
        }
        return { deletedCount: 0 };
      },
      deleteMany: async (query) => {
        let deletedCount = 0;
        for (let i = list.length - 1; i >= 0; i--) {
          const item = list[i];
          if (matchQuery(item, query)) {
            list.splice(i, 1);
            deletedCount++;
          }
        }
        return { deletedCount };
      },
      countDocuments: async (query = {}) => {
        let filtered = list.filter(item => matchQuery(item, query));
        return filtered.length;
      },
      createIndex: async () => {}
    };
  };

  return {
    collection: (name) => createMockCollection(name)
  };
}
