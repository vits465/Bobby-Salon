import express from 'express';
import cors from 'cors';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import dotenv from 'dotenv';
import crypto, { timingSafeEqual } from 'crypto';
dotenv.config();

import helmet from 'helmet';
import rateLimit from 'express-rate-limit';

import { connectDB, getClient, getDB, getBookingsCollection, getCompletedCollection, getQueueCollection, getGalleryOrderCollection, getSettingsCollection, getServicesCollection, getAdminsCollection, getSessionsCollection } from './db.js';
import { cloudinary, upload } from './cloudinaryConfig.js';
import { ObjectId } from 'mongodb';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = process.env.PORT || 3001;

const allowedOrigins = (process.env.CORS_ORIGIN || '')
  .split(',')
  .map(origin => origin.trim())
  .filter(Boolean);

app.use(cors({
  origin(origin, callback) {
    if (!origin) return callback(null, true);
    // Allow localhost, explicitly listed origins, and any Vercel deployment
    if (
      allowedOrigins.includes(origin) ||
      /^https?:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/.test(origin) ||
      /^https:\/\/[a-z0-9-]+\.vercel\.app$/.test(origin)
    ) {
      return callback(null, true);
    }
    return callback(new Error('Not allowed by CORS'));
  }
}));
app.use(express.json({ limit: '1mb' }));

// ─── Security Middlewares ────────────────────────────────────────────────────

// Set security HTTP headers (disable CSP and COEP to prevent breaking Vite/YouTube/Cloudinary)
app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      scriptSrc: ["'self'"],
      styleSrc: ["'self'", "'unsafe-inline'", 'https://fonts.googleapis.com'],
      fontSrc: ["'self'", 'https://fonts.gstatic.com'],
      imgSrc: ["'self'", 'data:', 'https://res.cloudinary.com', 'https://*.cloudinary.com'],
      mediaSrc: ["'self'", 'https://res.cloudinary.com', 'https://*.cloudinary.com'],
      frameSrc: ['https://www.youtube.com'],
      connectSrc: ["'self'"],
      objectSrc: ["'none'"],
      baseUri: ["'self'"],
      formAction: ["'self'"]
    }
  },
  crossOriginEmbedderPolicy: false
}));

// Sanitize user-supplied data to prevent MongoDB Operator Injection
function cleanInput(obj) {
  if (obj && typeof obj === 'object') {
    for (const key in obj) {
      if (key.startsWith('$') || key.includes('.')) {
        delete obj[key];
      } else {
        cleanInput(obj[key]);
      }
    }
  }
}

function safeCompare(a, b) {
  const aBuffer = Buffer.from(a);
  const bBuffer = Buffer.from(b);
  return aBuffer.length === bBuffer.length && timingSafeEqual(aBuffer, bBuffer);
}

function hashPassword(password, salt) {
  return crypto.pbkdf2Sync(password, salt, 1000, 64, 'sha512').toString('hex');
}

function generateSalt() {
  return crypto.randomBytes(16).toString('hex');
}

async function seedAdminsIfNeeded() {
  try {
    const adminsCol = getAdminsCollection();
    const count = await adminsCol.countDocuments();
    if (count === 0) {
      const defaultPassword = process.env.ADMIN_PASSWORD || 'bobby123';
      const usernames = ['admin', 'bobby', 'sumit', 'receptionist'];
      const adminDocs = usernames.map(username => {
        const salt = generateSalt();
        const passwordHash = hashPassword(defaultPassword, salt);
        return {
          username: username.toLowerCase(),
          salt,
          passwordHash,
          createdAt: new Date()
        };
      });
      await adminsCol.insertMany(adminDocs);
      console.log("🌱 Default admins seeded successfully in database!");
    }
  } catch (err) {
    console.error("❌ Failed to seed admins:", err);
  }
}

async function requireAdmin(req, res, next) {
  const authHeader = req.get('authorization') || '';
  const bearerToken = authHeader.startsWith('Bearer ') ? authHeader.slice(7) : '';
  const headerToken = req.get('x-admin-password') || '';
  const supplied = bearerToken || headerToken;

  if (!supplied) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  // 1. Fallback comparison (for legacy or development bypass)
  const expected = process.env.ADMIN_PASSWORD || process.env.ADMIN_TOKEN;
  if (expected) {
    try {
      if (safeCompare(supplied, expected)) {
        req.adminUsername = 'legacy-admin';
        return next();
      }
    } catch (err) {
      // safeCompare might fail on mismatching lengths, handled gracefully
    }
  }

  // 2. Query sessions collection in database
  try {
    const sessionsCol = getSessionsCollection();
    const session = await sessionsCol.findOne({ token: supplied });
    if (session) {
      req.adminUsername = session.username;
      return next();
    }
  } catch (err) {
    console.error('Error verifying admin session:', err);
  }

  return res.status(401).json({ error: 'Unauthorized' });
}
app.use((req, res, next) => {
  cleanInput(req.body);
  cleanInput(req.query);
  cleanInput(req.params);
  next();
});

// Global API Rate Limiting (100 requests per 15 minutes per IP)
const apiLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 100,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Too many requests, please try again later.' }
});
app.use('/api/', apiLimiter);
// ─── Authentication API ──────────────────────────────────────────────────────

app.post('/api/auth/login', async (req, res) => {
  try {
    const { username, password } = req.body;
    if (!username || !password) {
      return res.status(400).json({ error: 'Username and password are required.' });
    }

    const adminsCol = getAdminsCollection();
    const admin = await adminsCol.findOne({ username: username.toLowerCase() });
    
    if (!admin) {
      return res.status(401).json({ error: 'Invalid username or password.' });
    }

    const calculatedHash = hashPassword(password, admin.salt);
    if (calculatedHash !== admin.passwordHash) {
      return res.status(401).json({ error: 'Invalid username or password.' });
    }

    // Create session
    const token = crypto.randomBytes(32).toString('hex');
    const sessionsCol = getSessionsCollection();
    await sessionsCol.insertOne({
      token,
      username: admin.username,
      createdAt: new Date()
    });

    res.json({ token, username: admin.username });
  } catch (err) {
    console.error('Error logging in admin:', err);
    res.status(500).json({ error: 'Server error during login.' });
  }
});

app.post('/api/auth/logout', async (req, res) => {
  try {
    const authHeader = req.get('authorization') || '';
    const token = authHeader.startsWith('Bearer ') ? authHeader.slice(7) : '';
    if (token) {
      const sessionsCol = getSessionsCollection();
      await sessionsCol.deleteOne({ token });
    }
    res.json({ success: true });
  } catch (err) {
    console.error('Error during logout:', err);
    res.status(500).json({ error: 'Server error during logout.' });
  }
});

app.use('/api/admin', requireAdmin);

app.get('/api/health', (req, res) => {
  res.json({
    status: 'ok',
    environment: {
      has_mongodb_uri: !!process.env.MONGODB_URI,
      mongodb_db: process.env.MONGODB_DB || 'not_set',
      has_cloudinary_cloud_name: !!process.env.CLOUDINARY_CLOUD_NAME,
      has_cloudinary_api_key: !!process.env.CLOUDINARY_API_KEY,
      has_cloudinary_api_secret: !!process.env.CLOUDINARY_API_SECRET
    }
  });
});

// Ensure database is connected before handling any API request
app.use('/api', async (req, res, next) => {
  try {
    await connectDB();
    next();
  } catch (err) {
    console.error('Database connection error in middleware:', err);
    res.status(500).json({ error: 'Database connection failed. Please check backend logs or Environment Variables.' });
  }
});

// In production: serve Vite-built static files from dist/
const distPath = path.join(__dirname, 'dist');
if (fs.existsSync(distPath)) {
  app.use(express.static(distPath));
}

// Also serve public/ for images, logos, videos
app.use(express.static(path.join(__dirname, 'public')));

// ─── Helper Functions ────────────────────────────────────────────────────────

/**
 * Fixed salon slot schedule.
 * type: 'haircut_beard' = Haircut+Beard slot (40 min)
 *       'beard_only'    = Beard-only slot (30 min)
 *       'break'         = Non-bookable break period
 *
 * time: 24-hour minutes-from-midnight for easy comparison
 * displayTime: the AM/PM string shown to customers
 */
const FIXED_SLOT_SCHEDULE = [
  { displayTime: '09:00 AM', endDisplayTime: '09:40 AM', type: 'haircut_beard' },
  { displayTime: '09:30 AM', endDisplayTime: '10:00 AM', type: 'beard_only' },
  { displayTime: '10:00 AM', endDisplayTime: '10:40 AM', type: 'haircut_beard' },
  { displayTime: '10:30 AM', endDisplayTime: '11:00 AM', type: 'beard_only' },
  { displayTime: '11:00 AM', endDisplayTime: '11:40 AM', type: 'haircut_beard' },
  { displayTime: '11:30 AM', endDisplayTime: '12:00 PM', type: 'beard_only' },
  { displayTime: '12:00 PM', endDisplayTime: '12:40 PM', type: 'haircut_beard' },
  { displayTime: '12:30 PM', endDisplayTime: '01:00 PM', type: 'beard_only' },
  // LUNCH BREAK: 1:00 PM – 2:00 PM
  { displayTime: '01:00 PM', endDisplayTime: '02:00 PM', type: 'break', label: '🍽️ Lunch Break (1:00 PM – 2:00 PM)' },
  { displayTime: '02:00 PM', endDisplayTime: '02:40 PM', type: 'haircut_beard' },
  { displayTime: '02:30 PM', endDisplayTime: '03:00 PM', type: 'beard_only' },
  { displayTime: '03:00 PM', endDisplayTime: '03:40 PM', type: 'haircut_beard' },
  { displayTime: '03:30 PM', endDisplayTime: '04:00 PM', type: 'beard_only' },
  { displayTime: '04:00 PM', endDisplayTime: '04:40 PM', type: 'haircut_beard' },
  { displayTime: '04:30 PM', endDisplayTime: '05:00 PM', type: 'beard_only' },
  { displayTime: '05:00 PM', endDisplayTime: '05:40 PM', type: 'haircut_beard' },
  { displayTime: '05:30 PM', endDisplayTime: '06:00 PM', type: 'beard_only' },
  { displayTime: '06:00 PM', endDisplayTime: '06:40 PM', type: 'haircut_beard' },
  { displayTime: '06:30 PM', endDisplayTime: '07:00 PM', type: 'beard_only' },
  { displayTime: '07:00 PM', endDisplayTime: '07:40 PM', type: 'haircut_beard' },
  { displayTime: '07:30 PM', endDisplayTime: '08:00 PM', type: 'beard_only' },
  // EVENING BREAK: 8:00 PM – 8:20 PM
  { displayTime: '08:00 PM', endDisplayTime: '08:20 PM', type: 'break', label: '☕ Break (8:00 PM – 8:20 PM)' },
  { displayTime: '08:20 PM', endDisplayTime: '09:00 PM', type: 'haircut_beard' },
];

// Parse a displayTime string like '09:00 AM' into minutes from midnight
function parseDisplayTimeToMinutes(displayTime) {
  const match = /^(\d{1,2}):(\d{2})\s?(AM|PM)$/i.exec(displayTime || '');
  if (!match) return null;
  let hour = parseInt(match[1], 10);
  const min = parseInt(match[2], 10);
  const period = match[3].toUpperCase();
  if (period === 'PM' && hour !== 12) hour += 12;
  if (period === 'AM' && hour === 12) hour = 0;
  return hour * 60 + min;
}

// Returns all valid slot displayTimes (non-break) for booking validation
function getAllValidSlotTimes() {
  return FIXED_SLOT_SCHEDULE
    .filter(s => s.type !== 'break')
    .map(s => s.displayTime);
}

const getDurationDynamic = (serviceName, servicesMap) => {
  if (!serviceName) return 40;
  if (servicesMap && servicesMap.has(serviceName)) {
    return servicesMap.get(serviceName).duration;
  }
  const s = serviceName.toLowerCase();
  if (s.includes('4 hour')) return 240;
  if (s.includes('1 hour 20 min')) return 80;
  if (s.includes('1 hour')) return 60;
  if (s.includes('45 min')) return 45;
  if (s.includes('40 min')) return 40;
  if (s.includes('30 min')) return 30;
  if (s.includes('25 min')) return 25;
  if (s.includes('15 min')) return 15;
  return 40;
};

// Determine slot type from service name
function getSlotTypeForService(serviceName) {
  if (!serviceName) return null;
  const s = serviceName.toLowerCase();
  // Beard-only services
  if ((s.includes('beard') || s.includes('shave')) && !s.includes('haircut') && !s.includes('hair cut')) {
    return 'beard_only';
  }
  // Haircut+Beard or Haircut-only → goes to haircut_beard slots
  return 'haircut_beard';
}

function isValidDateString(dateStr) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(dateStr)) return false;
  const [year, month, day] = dateStr.split('-').map(Number);
  const date = new Date(Date.UTC(year, month - 1, day));
  return (
    date.getUTCFullYear() === year &&
    date.getUTCMonth() === month - 1 &&
    date.getUTCDate() === day
  );
}

function getIndiaNow() {
  const now = new Date();
  const utc = now.getTime() + (now.getTimezoneOffset() * 60000);
  return new Date(utc + (3600000 * 5.5));
}

function getIndiaDateString(date = getIndiaNow()) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function parseSlotHour(time) {
  const match = /^(\d{1,2}):(\d{2})\s?(AM|PM)$/i.exec(time || '');
  if (!match) return null;

  let hour = parseInt(match[1], 10);
  const minute = parseInt(match[2], 10);
  const period = match[3].toUpperCase();
  if (hour < 1 || hour > 12 || minute < 0 || minute > 59) return null;
  if (period === 'PM' && hour !== 12) hour += 12;
  if (period === 'AM' && hour === 12) hour = 0;
  return { hour, minute };
}

function isPastSlot(dateStr, time) {
  const indiaNow = getIndiaNow();
  const today = getIndiaDateString(indiaNow);
  if (dateStr < today) return true;
  if (dateStr > today) return false;

  const slot = parseSlotHour(time);
  if (!slot) return true;
  const slotTime = new Date(indiaNow);
  slotTime.setHours(slot.hour, slot.minute, 0, 0);
  return indiaNow > slotTime;
}

function validateObjectId(id) {
  return ObjectId.isValid(id) ? new ObjectId(id) : null;
}

function httpError(status, message) {
  const error = new Error(message);
  error.status = status;
  return error;
}

function normalizeServicePayload(body) {
  const name = String(body.name || '').trim();
  const gender = String(body.gender || '').trim();
  const duration = Number.parseInt(body.duration, 10);
  const price = Number.parseFloat(body.price);

  if (name.length < 2 || name.length > 120) return null;
  if (!['Male', 'Female'].includes(gender)) return null;
  if (!Number.isInteger(duration) || duration < 5 || duration > 480) return null;
  if (!Number.isFinite(price) || price < 0 || price > 100000) return null;

  return { name, gender, duration, price };
}

function normalizeGalleryOrder(order) {
  if (!Array.isArray(order) || order.length > 300) return null;

  return order.map(item => {
    const filename = String(item.filename || '').trim().slice(0, 180);
    const url = String(item.url || '').trim();
    const publicId = String(item.public_id || '').trim();
    const resourceType = item.resource_type === 'video' ? 'video' : 'image';

    if (!filename || !url || !publicId) return null;
    if (!/^https?:\/\//i.test(url)) return null;
    if (publicId.length > 240) return null;

    return {
      filename,
      url,
      public_id: publicId,
      resource_type: resourceType
    };
  });
}

// CallMeBot Free WhatsApp Alerts helper
const sendWhatsAppAlert = async (bookingDetails) => {
  const apikey = process.env.CALLMEBOT_API_KEY;
  const phone = process.env.ADMIN_PHONE;
  if (!apikey || !phone) {
    console.log("⚠️ CallMeBot credentials missing in .env. Skipping free WhatsApp alert.");
    return;
  }

  const statusText = bookingDetails.isQueue ? 'WAITLIST QUEUE REQUEST' : 'NEW APPOINTMENT';
  const msg = `*Bobby Salon - ${statusText}*\n\n` +
              `👤 Name: ${bookingDetails.name}\n` +
              `📞 Phone: ${bookingDetails.phone}\n` +
              `🚻 Gender: ${bookingDetails.gender}\n` +
              `💇 Service: ${bookingDetails.service}\n` +
              `💈 Barber: ${bookingDetails.barber}\n` +
              `📅 Date: ${bookingDetails.date}\n` +
              `⏰ Time: ${bookingDetails.time}`;

  const url = `https://api.callmebot.com/whatsapp.php?phone=${encodeURIComponent(phone)}&text=${encodeURIComponent(msg)}&apikey=${encodeURIComponent(apikey)}`;
  
  try {
    const res = await fetch(url);
    if (res.ok) {
      console.log("✅ Free WhatsApp alert sent successfully to admin!");
    } else {
      console.error("❌ Failed to send WhatsApp alert via CallMeBot:", res.statusText);
    }
  } catch (err) {
    console.error("❌ Error sending CallMeBot request:", err);
  }
};

// Seed default services in DB if empty
async function seedServicesIfNeeded() {
  try {
    const servicesCol = getServicesCollection();
    const count = await servicesCol.countDocuments();
    if (count === 0) {
      const defaultServices = [
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
      ];
      await servicesCol.insertMany(defaultServices);
      console.log("🌱 Default services database seeded successfully!");
    }
  } catch (err) {
    console.error("Failed to seed services:", err);
  }
}

// ─── Rate Limiter ────────────────────────────────────────────────────────────

const ipRequests = new Map();

const bookingRateLimit = (req, res, next) => {
  const ip = req.ip || req.connection?.remoteAddress || 'unknown';
  const now = Date.now();
  if (!ipRequests.has(ip)) ipRequests.set(ip, []);

  const requests = ipRequests.get(ip).filter(timestamp => now - timestamp < 3600000);
  if (requests.length >= 20) {
    return res.status(429).json({ error: 'Too many booking requests. Please try again later.' });
  }

  requests.push(now);
  ipRequests.set(ip, requests);
  next();
};

// ─── Booking API Routes ──────────────────────────────────────────────────────

// GET /api/slots?date=YYYY-MM-DD
app.get('/api/slots', async (req, res) => {
  const { date } = req.query;
  if (!date) {
    return res.status(400).json({ error: 'Date is required' });
  }
  if (typeof date !== 'string' || !isValidDateString(date)) {
    return res.status(400).json({ error: 'Invalid date format. Use YYYY-MM-DD.' });
  }

  try {
    const bookings = getBookingsCollection();
    const settings = getSettingsCollection();
    const servicesCol = getServicesCollection();

    const blockedDoc = await settings.findOne({ _id: 'blocked_dates' });
    if (blockedDoc && blockedDoc.dates && blockedDoc.dates.includes(date)) {
      return res.json({ date, slots: [], closed: true, message: 'Salon is closed on this date (Holiday/Weekly Off)' });
    }

    const bookedForDate = await bookings.find({ date }).toArray();
    const servicesList = await servicesCol.find({}).toArray();
    const servicesMap = new Map(servicesList.map(s => [s.name, s]));

    const indiaNow = getIndiaNow();
    const todayDateStr = getIndiaDateString(indiaNow);
    const nowMinutes = indiaNow.getHours() * 60 + indiaNow.getMinutes();
    const isToday = date === todayDateStr;

    const slotsStatus = [];

    for (const slotDef of FIXED_SLOT_SCHEDULE) {
      // Always include break slots so the frontend can render them as separators
      if (slotDef.type === 'break') {
        slotsStatus.push({
          time: slotDef.displayTime,
          endTime: slotDef.endDisplayTime,
          type: 'break',
          label: slotDef.label,
          isBreak: true,
          taken: true,
          bookingCount: 0,
          maxBookings: 0,
          bookings: []
        });
        continue;
      }

      // Skip past slots for today
      if (isToday) {
        const slotMinutes = parseDisplayTimeToMinutes(slotDef.displayTime);
        if (slotMinutes !== null && nowMinutes > slotMinutes) {
          continue; // past slot, skip
        }
      }

      const slotBookings = bookedForDate.filter(b => b.time === slotDef.displayTime);

      // Capacity per slot type:
      //  beard_only    slots → 30 min window ÷ 15 min per service = 2 per barber → max 4 total
      //  haircut_beard slots → 40 min window ÷ 40 min per service = 1 per barber → max 2 total
      const perBarberMax = slotDef.type === 'beard_only' ? 2 : 1;
      const maxBookings  = perBarberMax * 2; // Bobby + Sumit

      const bobbyBookings = slotBookings.filter(b => b.barber === 'Bobby');
      const sumitBookings = slotBookings.filter(b => b.barber === 'Sumit');
      const anyBookings   = slotBookings.filter(b => b.barber === 'Any Available');

      // "Any Available" bookings fill Bobby first, then Sumit
      const anyCount = anyBookings.length;
      const effectiveBobbyCount = bobbyBookings.length + Math.min(anyCount, perBarberMax);
      const effectiveSumitCount = sumitBookings.length + Math.max(anyCount - perBarberMax, 0);

      const bobbyFull = effectiveBobbyCount >= perBarberMax;
      const sumitFull = effectiveSumitCount >= perBarberMax;
      const isFull    = bobbyFull && sumitFull;

      const bookingCount = slotBookings.length;
      const spotsLeft = Math.max(maxBookings - bookingCount, 0);

      slotsStatus.push({
        time: slotDef.displayTime,
        endTime: slotDef.endDisplayTime,
        label: `${slotDef.displayTime.replace(' AM', '').replace(' PM', '')} – ${slotDef.endDisplayTime}`,
        type: slotDef.type,
        isBreak: false,
        taken: isFull,
        bookingCount,
        maxBookings,
        spotsLeft,
        bobbyAvailable: !bobbyFull,
        sumitAvailable: !sumitFull,
        // Detailed per-barber status so UI can show "Bobby: 1/2"
        barberStatus: {
          bobby: { count: effectiveBobbyCount, max: perBarberMax, full: bobbyFull },
          sumit: { count: effectiveSumitCount, max: perBarberMax, full: sumitFull }
        }
      });
    }

    res.json({ date, slots: slotsStatus });
  } catch (err) {
    console.error('Error fetching slots:', err);
    res.status(500).json({ error: 'Server error' });
  }
});

// POST /api/book
app.post('/api/book', bookingRateLimit, async (req, res) => {
  const { date, time, name, phone, gender, service, barber, isQueue } = req.body;
  if (!date || !time || !name || !phone || !gender || !service || !barber) {
    return res.status(400).json({ error: 'Missing required fields' });
  }
  if (!isValidDateString(date)) {
    return res.status(400).json({ error: 'Invalid date format. Use YYYY-MM-DD.' });
  }

  try {
    const normalizedName = String(name).trim();
    const normalizedPhone = String(phone).replace(/\D/g, '');
    const normalizedGender = String(gender);
    const normalizedService = String(service);
    const normalizedBarber = String(barber);
    const queueRequested = Boolean(isQueue);

    if (normalizedName.length < 2 || normalizedName.length > 80) {
      return res.status(400).json({ error: 'Name must be between 2 and 80 characters.' });
    }
    if (!/^\d{10,15}$/.test(normalizedPhone)) {
      return res.status(400).json({ error: 'Phone number must contain 10 to 15 digits.' });
    }
    if (!['Male', 'Female'].includes(normalizedGender)) {
      return res.status(400).json({ error: 'Invalid gender.' });
    }
    if (!['Any Available', 'Bobby', 'Sumit'].includes(normalizedBarber)) {
      return res.status(400).json({ error: 'Invalid barber selection.' });
    }
    if (normalizedGender === 'Female' && normalizedBarber !== 'Sumit') {
      return res.status(400).json({ error: 'Female services must be booked with Sumit.' });
    }
    if (isPastSlot(date, time)) {
      return res.status(400).json({ error: 'Cannot book a past time slot.' });
    }

    // Validate that time is a valid slot in the fixed schedule (non-break)
    const validSlotTimes = getAllValidSlotTimes();
    if (!validSlotTimes.includes(time)) {
      return res.status(400).json({ error: 'Invalid time slot.' });
    }

    // Find the slot definition for service/slot-type validation
    const slotDef = FIXED_SLOT_SCHEDULE.find(s => s.displayTime === time);
    if (!slotDef || slotDef.type === 'break') {
      return res.status(400).json({ error: 'Cannot book a break time slot.' });
    }

    const settings = getSettingsCollection();
    const servicesCol = getServicesCollection();
    const [blockedDoc, serviceDoc] = await Promise.all([
      settings.findOne({ _id: 'blocked_dates' }),
      servicesCol.findOne({ name: normalizedService, gender: normalizedGender, active: { $ne: false } })
    ]);

    if (blockedDoc && blockedDoc.dates && blockedDoc.dates.includes(date)) {
      return res.status(400).json({ error: 'Salon is closed on this date.' });
    }
    if (!serviceDoc) {
      return res.status(400).json({ error: 'Invalid service for the selected gender.' });
    }

    // Validate service type vs slot type
    const serviceSlotType = getSlotTypeForService(normalizedService);
    if (slotDef.type === 'beard_only' && serviceSlotType !== 'beard_only') {
      return res.status(400).json({ error: 'This time slot is only available for beard/shave services.' });
    }
    // haircut_beard slots accept both types

    const requestedDuration = Number(serviceDoc.duration) || getDurationDynamic(normalizedService);
    if (!Number.isFinite(requestedDuration) || requestedDuration < 5 || requestedDuration > 480) {
      return res.status(400).json({ error: 'Invalid service duration.' });
    }

    const bookingDetails = {
      date,
      time,
      name: normalizedName,
      phone: normalizedPhone,
      gender: normalizedGender,
      service: normalizedService,
      barber: normalizedBarber,
      isQueue: queueRequested
    };

    const client = getClient();
    const session = client.startSession();
    let responseMessage = queueRequested ? 'Added to queue' : 'Booking confirmed';

    try {
      await session.withTransaction(async () => {
        const db = getDB();
        const slotLocks = db.collection('bookingLocks');
        const bookings = getBookingsCollection();
        const queueCol = getQueueCollection();

        await slotLocks.updateOne(
          { _id: `${date}|${time}` },
          {
            $inc: { version: 1 },
            $set: { updatedAt: new Date() }
          },
          { upsert: true, session }
        );

        const bookingsForSlot = await bookings.find({ date, time }, { session }).toArray();

        if (!queueRequested) {
          // Capacity per slot type:
          //  beard_only    → 2 customers per barber (15 min × 2 = 30 min window)
          //  haircut_beard → 1 customer  per barber (40 min = 40 min window)
          const perBarberMax = slotDef.type === 'beard_only' ? 2 : 1;

          const bobbyCount = bookingsForSlot.filter(b => b.barber === 'Bobby').length;
          const sumitCount = bookingsForSlot.filter(b => b.barber === 'Sumit').length;
          const anyCount   = bookingsForSlot.filter(b => b.barber === 'Any Available').length;

          // "Any" bookings fill Bobby first, then Sumit
          const effectiveBobby = bobbyCount + Math.min(anyCount, perBarberMax);
          const effectiveSumit = sumitCount + Math.max(anyCount - perBarberMax, 0);

          const bobbyFull = effectiveBobby >= perBarberMax;
          const sumitFull = effectiveSumit >= perBarberMax;

          if (normalizedBarber === 'Bobby') {
            if (bobbyFull) {
              const slotsLeft = perBarberMax - effectiveBobby;
              throw httpError(400, `Bobby is fully booked for this slot (${perBarberMax}/${perBarberMax}). Please choose another slot or barber.`);
            }
          } else if (normalizedBarber === 'Sumit') {
            if (sumitFull) {
              throw httpError(400, `Sumit is fully booked for this slot (${perBarberMax}/${perBarberMax}). Please choose another slot or barber.`);
            }
          } else if (normalizedBarber === 'Any Available') {
            if (bobbyFull && sumitFull) {
              throw httpError(400, 'This slot is fully booked. Both barbers are at full capacity. Please choose another slot.');
            }
          }

          if (normalizedGender === 'Female') {
            const hasFemale = bookingsForSlot.some(slot => slot.gender === 'Female');
            if (hasFemale) {
              throw httpError(400, 'Only one female appointment is available per slot.');
            }
          }

          await bookings.insertOne({
            date,
            time,
            name: normalizedName,
            phone: normalizedPhone,
            gender: normalizedGender,
            service: normalizedService,
            barber: normalizedBarber,
            slotType: slotDef.type,
            type: 'BOOKING',
            createdAt: new Date().toISOString()
          }, { session });
        } else {
          await queueCol.insertOne({
            date,
            time,
            name: normalizedName,
            phone: normalizedPhone,
            gender: normalizedGender,
            service: normalizedService,
            barber: normalizedBarber,
            slotType: slotDef.type,
            type: 'QUEUE',
            createdAt: new Date().toISOString()
          }, { session });
        }
      }, {
        readConcern: { level: 'snapshot' },
        writeConcern: { w: 'majority' },
        readPreference: 'primary'
      });
    } finally {
      await session.endSession();
    }

    sendWhatsAppAlert(bookingDetails).catch(err => {
      console.error("Failed to send WhatsApp alert:", err);
    });

    res.json({ success: true, message: responseMessage });
  } catch (err) {
    console.error('Error booking:', err);
    res.status(err.status || 500).json({ error: err.status ? err.message : 'Server error' });
  }
});

// ─── Settings API ────────────────────────────────────────────────────────────

app.get('/api/settings', async (req, res) => {
  try {
    const settings = getSettingsCollection();
    const doc = await settings.findOne({ _id: 'timings' });
    res.json(doc || {
      weekday: { start: 9, end: 20 },
      saturday: { start: 14, end: 20 },
      sunday: { start: 9, end: 21 },
    });
  } catch (err) {
    console.error('Error fetching settings:', err);
    res.status(500).json({ error: 'Server error' });
  }
});

app.post('/api/settings', requireAdmin, async (req, res) => {
  try {
    const settings = getSettingsCollection();
    const { weekday, saturday, sunday } = req.body;
    if (!weekday || !saturday || !sunday) {
      return res.status(400).json({ error: 'Missing timings configuration' });
    }
    const normalizeHours = (value) => {
      const start = parseInt(value.start, 10);
      const end = parseInt(value.end, 10);
      if (!Number.isInteger(start) || !Number.isInteger(end) || start < 0 || end > 23 || start >= end) {
        return null;
      }
      return { start, end };
    };
    const normalizedWeekday = normalizeHours(weekday);
    const normalizedSaturday = normalizeHours(saturday);
    const normalizedSunday = normalizeHours(sunday);
    if (!normalizedWeekday || !normalizedSaturday || !normalizedSunday) {
      return res.status(400).json({ error: 'Invalid timing range.' });
    }
    const timingsData = {
      weekday: normalizedWeekday,
      saturday: normalizedSaturday,
      sunday: normalizedSunday
    };
    await settings.updateOne(
      { _id: 'timings' },
      { $set: timingsData },
      { upsert: true }
    );
    res.json({ success: true });
  } catch (err) {
    console.error('Error saving settings:', err);
    res.status(500).json({ error: 'Server error' });
  }
});

// GET /api/settings/blocked-dates
app.get('/api/settings/blocked-dates', async (req, res) => {
  try {
    const settings = getSettingsCollection();
    const doc = await settings.findOne({ _id: 'blocked_dates' });
    res.json(doc ? doc.dates : []);
  } catch (err) {
    console.error('Error fetching blocked dates:', err);
    res.status(500).json({ error: 'Server error' });
  }
});

// POST /api/settings/blocked-dates
app.post('/api/settings/blocked-dates', requireAdmin, async (req, res) => {
  try {
    const settings = getSettingsCollection();
    const { action, date } = req.body;
    if (!date || !isValidDateString(date)) {
      return res.status(400).json({ error: 'Valid date is required' });
    }
    if (action === 'add') {
      await settings.updateOne(
        { _id: 'blocked_dates' },
        { $addToSet: { dates: date } },
        { upsert: true }
      );
    } else if (action === 'remove') {
      await settings.updateOne(
        { _id: 'blocked_dates' },
        { $pull: { dates: date } }
      );
    } else {
      return res.status(400).json({ error: 'Invalid action' });
    }
    res.json({ success: true });
  } catch (err) {
    console.error('Error saving blocked date:', err);
    res.status(500).json({ error: 'Server error' });
  }
});

// ─── Gallery API (Cloudinary) ────────────────────────────────────────────────

// ─── Services API (MongoDB) ──────────────────────────────────────────────────

// GET /api/services  (public — only active + visible)
app.get('/api/services', async (req, res) => {
  try {
    const servicesCol = getServicesCollection();
    // active !== false  → not soft-deleted
    // visible !== false → not hidden by admin
    const services = await servicesCol.find(
      { active: { $ne: false }, visible: { $ne: false } },
      { projection: { price: 0 } }
    ).toArray();
    res.json(services);
  } catch (err) {
    console.error('Error fetching services:', err);
    res.status(500).json({ error: 'Server error' });
  }
});

// GET /api/admin/services  (admin — all non-deleted, incl. hidden)
app.get('/api/admin/services', async (req, res) => {
  try {
    const servicesCol = getServicesCollection();
    const services = await servicesCol.find({ active: { $ne: false } }).toArray();
    res.json(services);
  } catch (err) {
    console.error('Error fetching admin services:', err);
    res.status(500).json({ error: 'Server error' });
  }
});

// POST /api/admin/services
app.post('/api/admin/services', async (req, res) => {
  try {
    const servicePayload = normalizeServicePayload(req.body);
    if (!servicePayload) {
      return res.status(400).json({ error: 'Invalid service fields' });
    }
    const servicesCol = getServicesCollection();
    await servicesCol.insertOne({
      ...servicePayload,
      active: true,
      visible: true
    });
    res.json({ success: true });
  } catch (err) {
    console.error('Error creating service:', err);
    res.status(500).json({ error: 'Server error' });
  }
});

// PUT /api/admin/services/:id
app.put('/api/admin/services/:id', async (req, res) => {
  try {
    const id = validateObjectId(req.params.id);
    const servicePayload = normalizeServicePayload(req.body);
    if (!id) return res.status(400).json({ error: 'Invalid service id' });
    if (!servicePayload) {
      return res.status(400).json({ error: 'Invalid service fields' });
    }
    const servicesCol = getServicesCollection();
    await servicesCol.updateOne(
      { _id: id },
      { $set: servicePayload }
    );
    res.json({ success: true });
  } catch (err) {
    console.error('Error updating service:', err);
    res.status(500).json({ error: 'Server error' });
  }
});

// PATCH /api/admin/services/:id/visibility  — toggle show/hide
app.patch('/api/admin/services/:id/visibility', async (req, res) => {
  try {
    const id = validateObjectId(req.params.id);
    if (!id) return res.status(400).json({ error: 'Invalid service id' });
    const { visible } = req.body;
    if (typeof visible !== 'boolean') return res.status(400).json({ error: 'visible must be boolean' });
    const servicesCol = getServicesCollection();
    await servicesCol.updateOne({ _id: id }, { $set: { visible } });
    res.json({ success: true, visible });
  } catch (err) {
    console.error('Error updating visibility:', err);
    res.status(500).json({ error: 'Server error' });
  }
});

// DELETE /api/admin/services/:id
app.delete('/api/admin/services/:id', async (req, res) => {
  try {
    const id = validateObjectId(req.params.id);
    if (!id) return res.status(400).json({ error: 'Invalid service id' });
    const servicesCol = getServicesCollection();
    // Soft delete — keeps record but removes from all views
    await servicesCol.updateOne(
      { _id: id },
      { $set: { active: false } }
    );
    res.json({ success: true });
  } catch (err) {
    console.error('Error deleting service:', err);
    res.status(500).json({ error: 'Server error' });
  }
});

// GET /api/gallery — returns gallery items with Cloudinary URLs
app.get('/api/gallery', async (req, res) => {
  try {
    const galleryOrder = getGalleryOrderCollection();
    const doc = await galleryOrder.findOne({ _id: 'gallery_order' });
    const items = (doc && doc.items) ? doc.items : [];
    res.json(items);
  } catch (error) {
    console.error('Error reading gallery:', error);
    res.json([]);
  }
});

// ─── Admin API Routes ────────────────────────────────────────────────────────

// GET /api/admin/bookings
app.get('/api/admin/bookings', async (req, res) => {
  try {
    const bookings = getBookingsCollection();
    const completed = getCompletedCollection();
    const queueCol = getQueueCollection();

    const [bookedSlots, completedSlots, queue] = await Promise.all([
      bookings.find({}).toArray(),
      completed.find({}).toArray(),
      queueCol.find({}).toArray()
    ]);

    res.json({ bookedSlots, completedSlots, queue });
  } catch (err) {
    console.error('Error fetching admin bookings:', err);
    res.status(500).json({ error: 'Server error' });
  }
});

// DELETE /api/admin/bookings/:id
app.delete('/api/admin/bookings/:id', async (req, res) => {
  try {
    const id = req.params.id;
    const bookings = getBookingsCollection();
    const queueCol = getQueueCollection();

    await Promise.all([
      bookings.deleteOne({ createdAt: id }),
      queueCol.deleteOne({ createdAt: id })
    ]);

    res.json({ success: true });
  } catch (err) {
    console.error('Error deleting booking:', err);
    res.status(500).json({ error: 'Server error' });
  }
});

// POST /api/admin/bookings/:id/complete
app.post('/api/admin/bookings/:id/complete', async (req, res) => {
  try {
    const id = req.params.id;
    const bookings = getBookingsCollection();
    const completed = getCompletedCollection();

    const slot = await bookings.findOneAndDelete({ createdAt: id });
    if (slot) {
      // Remove MongoDB _id before inserting into completed
      const { _id, ...slotData } = slot;
      await completed.insertOne(slotData);
      return res.json({ success: true });
    }

    res.status(404).json({ error: 'Booking not found' });
  } catch (err) {
    console.error('Error completing booking:', err);
    res.status(500).json({ error: 'Server error' });
  }
});

// POST /api/admin/queue/:id/approve
app.post('/api/admin/queue/:id/approve', async (req, res) => {
  try {
    const id = req.params.id;
    const queueCol = getQueueCollection();
    const bookings = getBookingsCollection();

    const item = await queueCol.findOneAndDelete({ createdAt: id });
    if (item) {
      const { _id, ...itemData } = item;
      itemData.type = 'BOOKING';
      await bookings.insertOne(itemData);
      return res.json({ success: true });
    }

    res.status(404).json({ error: 'Queue item not found' });
  } catch (err) {
    console.error('Error approving queue item:', err);
    res.status(500).json({ error: 'Server error' });
  }
});

// ─── Gallery CRUD (Cloudinary) ───────────────────────────────────────────────

// POST /api/admin/gallery/upload — upload one or more files to Cloudinary
app.post('/api/admin/gallery/upload', upload.array('files', 30), async (req, res) => {
  if (!req.files || req.files.length === 0) {
    return res.status(400).json({ error: 'No files uploaded' });
  }

  try {
    const uploaded = req.files.map(f => ({
      filename: f.originalname,
      url: f.path, // Cloudinary URL
      public_id: f.filename, // Cloudinary public_id
      resource_type: f.mimetype.startsWith('video/') ? 'video' : 'image'
    }));

    // Append new items to gallery order
    const galleryOrder = getGalleryOrderCollection();
    const doc = await galleryOrder.findOne({ _id: 'gallery_order' });
    const currentItems = (doc && doc.items) ? doc.items : [];
    const updatedItems = [...currentItems, ...uploaded];

    await galleryOrder.updateOne(
      { _id: 'gallery_order' },
      { $set: { items: updatedItems } },
      { upsert: true }
    );

    console.log(`Gallery: uploaded ${uploaded.length} file(s) to Cloudinary`);
    res.json({ success: true, files: uploaded });
  } catch (err) {
    console.error('Error uploading gallery:', err);
    res.status(500).json({ error: 'Upload failed' });
  }
});

// DELETE /api/admin/gallery/:public_id — delete a file from Cloudinary
app.delete('/api/admin/gallery/:public_id', async (req, res) => {
  const public_id = decodeURIComponent(req.params.public_id);

  try {
    // Try deleting as image first, then as video
    let result = await cloudinary.uploader.destroy(public_id, { resource_type: 'image' });
    if (result.result !== 'ok') {
      result = await cloudinary.uploader.destroy(public_id, { resource_type: 'video' });
    }

    // Remove from gallery order
    const galleryOrder = getGalleryOrderCollection();
    const doc = await galleryOrder.findOne({ _id: 'gallery_order' });
    if (doc && doc.items) {
      const updatedItems = doc.items.filter(item => item.public_id !== public_id);
      await galleryOrder.updateOne(
        { _id: 'gallery_order' },
        { $set: { items: updatedItems } }
      );
    }

    console.log(`Gallery: deleted ${public_id} from Cloudinary`);
    res.json({ success: true });
  } catch (err) {
    console.error('Error deleting gallery item:', err);
    res.status(500).json({ error: `Failed to delete: ${public_id}` });
  }
});

// PATCH /api/admin/gallery/:public_id — rename a file (update display name)
app.patch('/api/admin/gallery/:public_id', async (req, res) => {
  const public_id = decodeURIComponent(req.params.public_id);
  const { newName } = req.body;
  if (!newName) return res.status(400).json({ error: 'newName is required' });

  try {
    // Update the display name in gallery order
    const galleryOrder = getGalleryOrderCollection();
    const doc = await galleryOrder.findOne({ _id: 'gallery_order' });
    if (doc && doc.items) {
      const updatedItems = doc.items.map(item => {
        if (item.public_id === public_id) {
          return { ...item, filename: newName };
        }
        return item;
      });
      await galleryOrder.updateOne(
        { _id: 'gallery_order' },
        { $set: { items: updatedItems } }
      );
    }

    console.log(`Gallery: renamed ${public_id} display name to ${newName}`);
    res.json({ success: true, filename: newName });
  } catch (err) {
    console.error('Error renaming gallery item:', err);
    res.status(500).json({ error: `Failed to rename` });
  }
});

// PUT /api/admin/gallery/order — save the display order
app.put('/api/admin/gallery/order', async (req, res) => {
  const { order } = req.body;
  if (!Array.isArray(order)) {
    return res.status(400).json({ error: 'order must be an array' });
  }

  try {
    const galleryOrder = getGalleryOrderCollection();
    await galleryOrder.updateOne(
      { _id: 'gallery_order' },
      { $set: { items: order } },
      { upsert: true }
    );
    console.log(`Gallery: saved order for ${order.length} items`);
    res.json({ success: true });
  } catch (err) {
    console.error('Error saving gallery order:', err);
    res.status(500).json({ error: 'Server error' });
  }
});

// Redirect legacy /admin path to hash route
app.get('/admin', (req, res) => {
  res.redirect('/#admin');
});
app.get('/admin/', (req, res) => {
  res.redirect('/#admin');
});

// ─── SPA Fallback ────────────────────────────────────────────────────────────

if (fs.existsSync(distPath)) {
  app.get('/{*path}', (req, res, next) => {
    if (req.path.startsWith('/api/') || req.path.startsWith('/gallery/')) {
      return next();
    }
    res.sendFile(path.join(distPath, 'index.html'));
  });
}

// ─── Start Server ────────────────────────────────────────────────────────────

async function startServer() {
  try {
    await connectDB();
    await seedServicesIfNeeded();
    await seedAdminsIfNeeded();
    app.listen(PORT, '0.0.0.0', () => {
      console.log(`Bobby Salon Server running on http://localhost:${PORT}`);
    });
  } catch (err) {
    console.error('Failed to start server:', err);
    process.exit(1);
  }
}

if (!process.env.VERCEL) {
  startServer();
} else {
  // In serverless environments, connect to DB but let Vercel handle the request wrapping
  connectDB()
    .then(async () => {
      await seedServicesIfNeeded();
      await seedAdminsIfNeeded();
    })
    .catch(err => console.error('DB Connection Failed:', err));
}

// Export for Vercel serverless deployment
export default app;
