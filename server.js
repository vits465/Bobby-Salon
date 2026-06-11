import express from 'express';
import cors from 'cors';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import dotenv from 'dotenv';
import { timingSafeEqual } from 'crypto';
dotenv.config();

import helmet from 'helmet';
import rateLimit from 'express-rate-limit';

import { connectDB, getClient, getDB, getBookingsCollection, getCompletedCollection, getQueueCollection, getGalleryOrderCollection, getSettingsCollection, getServicesCollection } from './db.js';
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

function requireAdmin(req, res, next) {
  const expected = process.env.ADMIN_PASSWORD || process.env.ADMIN_TOKEN;
  if (!expected) {
    return res.status(503).json({ error: 'Admin access is not configured.' });
  }

  const authHeader = req.get('authorization') || '';
  const bearerToken = authHeader.startsWith('Bearer ') ? authHeader.slice(7) : '';
  const headerToken = req.get('x-admin-password') || '';
  const supplied = bearerToken || headerToken;

  if (!supplied || !safeCompare(supplied, expected)) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  next();
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

const getAvailableSlots = (dateStr, timings) => {
  const defaultTimings = {
    weekday: { start: 9, end: 20 },
    saturday: { start: 14, end: 20 },
    sunday: { start: 9, end: 21 },
  };
  const t = timings || defaultTimings;

  const dateObj = new Date(dateStr);
  const day = dateObj.getDay();

  let startHour, endHour;
  if (day === 0) {
    startHour = t.sunday.start;
    endHour = t.sunday.end;
  } else if (day === 6) {
    startHour = t.saturday.start;
    endHour = t.saturday.end;
  } else {
    startHour = t.weekday.start;
    endHour = t.weekday.end;
  }

  const slots = [];
  for (let h = startHour; h <= endHour; h++) {
    const period = h >= 12 ? 'PM' : 'AM';
    const displayHour = h > 12 ? h - 12 : (h === 0 ? 12 : h);
    const hourStr = displayHour < 10 ? `0${displayHour}` : displayHour.toString();
    slots.push(`${hourStr}:00 ${period}`);
  }
  return slots;
};

const getDurationDynamic = (serviceName, servicesMap) => {
  if (!serviceName) return 60;
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
  return 60;
};

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

    const timingsDoc = await settings.findOne({ _id: 'timings' });
    const timings = timingsDoc || undefined;

    const bookedForDate = await bookings.find({ date }).toArray();
    const servicesList = await servicesCol.find({}).toArray();
    const servicesMap = new Map(servicesList.map(s => [s.name, s]));

    const indiaNow = getIndiaNow();
    const todayDateStr = getIndiaDateString(indiaNow);

    const isToday = date === todayDateStr;

    const slotsStatus = [];
    const currentSlots = getAvailableSlots(date, timings);

    for (const time of currentSlots) {
      let showSlot = true;
      if (isToday) {
        const [timeStr, period] = time.split(' ');
        let [hourStr, minStr] = timeStr.split(':');
        let hour = parseInt(hourStr, 10);
        if (period === 'PM' && hour !== 12) hour += 12;
        if (period === 'AM' && hour === 12) hour = 0;

        const slotTime = new Date(indiaNow);
        slotTime.setHours(hour, parseInt(minStr, 10), 0, 0);

        if (indiaNow > slotTime) {
          showSlot = false;
        }
      }

      if (showSlot) {
        const slotBookings = bookedForDate.filter(s => s.time === time);
        
        let bobbyTime = 0;
        let sumitTime = 0;
        let anyTime = 0;
        for (const b of slotBookings) {
          const dur = getDurationDynamic(b.service, servicesMap);
          if (b.barber === 'Bobby') bobbyTime += dur;
          else if (b.barber === 'Sumit') sumitTime += dur;
          else if (b.barber === 'Any Available') anyTime += dur;
        }

        const totalTime = bobbyTime + sumitTime + anyTime;
        const isCompletelyFull = totalTime > 105;
        const hasFemale = slotBookings.some(s => s.gender === 'Female');

        const availableForFemale = !hasFemale && (sumitTime <= 30) && (totalTime <= 90);

        slotsStatus.push({
          time,
          taken: isCompletelyFull,
          availableForFemale
        });
      }
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

    const settings = getSettingsCollection();
    const servicesCol = getServicesCollection();
    const [blockedDoc, timingsDoc, serviceDoc] = await Promise.all([
      settings.findOne({ _id: 'blocked_dates' }),
      settings.findOne({ _id: 'timings' }),
      servicesCol.findOne({ name: normalizedService, gender: normalizedGender, active: { $ne: false } })
    ]);

    if (blockedDoc && blockedDoc.dates && blockedDoc.dates.includes(date)) {
      return res.status(400).json({ error: 'Salon is closed on this date.' });
    }
    if (!getAvailableSlots(date, timingsDoc || undefined).includes(time)) {
      return res.status(400).json({ error: 'Invalid time slot for the selected date.' });
    }
    if (!serviceDoc) {
      return res.status(400).json({ error: 'Invalid service for the selected gender.' });
    }

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
          if (normalizedGender === 'Female') {
            const hasFemale = bookingsForSlot.some(slot => slot.gender === 'Female');
            if (hasFemale) {
              throw httpError(400, 'Only one female appointment is available per slot.');
            }
          }

          let bobbyTime = 0;
          let sumitTime = 0;
          let anyTime = 0;
          for (const slot of bookingsForSlot) {
            const duration = getDurationDynamic(slot.service);
            if (slot.barber === 'Bobby') bobbyTime += duration;
            else if (slot.barber === 'Sumit') sumitTime += duration;
            else if (slot.barber === 'Any Available') anyTime += duration;
          }

          const totalBookedTime = bobbyTime + sumitTime + anyTime;
          if (normalizedBarber === 'Any Available') {
            if (totalBookedTime + requestedDuration > 120) {
              throw httpError(400, 'Not enough time available in this slot.');
            }
          } else if (normalizedBarber === 'Bobby') {
            if (bobbyTime + requestedDuration > 60) {
              throw httpError(400, `Bobby does not have enough time (${requestedDuration} mins needed) in this slot.`);
            }
            if (totalBookedTime + requestedDuration > 120) {
              throw httpError(400, 'Not enough time available in this slot overall.');
            }
          } else if (normalizedBarber === 'Sumit') {
            if (sumitTime + requestedDuration > 60) {
              throw httpError(400, `Sumit does not have enough time (${requestedDuration} mins needed) in this slot.`);
            }
            if (totalBookedTime + requestedDuration > 120) {
              throw httpError(400, 'Not enough time available in this slot overall.');
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

// GET /api/services
app.get('/api/services', async (req, res) => {
  try {
    const servicesCol = getServicesCollection();
    const services = await servicesCol.find({ active: { $ne: false } }).toArray();
    res.json(services);
  } catch (err) {
    console.error('Error fetching services:', err);
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
      active: true
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

// DELETE /api/admin/services/:id
app.delete('/api/admin/services/:id', async (req, res) => {
  try {
    const id = validateObjectId(req.params.id);
    if (!id) return res.status(400).json({ error: 'Invalid service id' });
    const servicesCol = getServicesCollection();
    // Soft delete
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
    .then(() => seedServicesIfNeeded())
    .catch(err => console.error('DB Connection Failed:', err));
}

// Export for Vercel serverless deployment
export default app;
