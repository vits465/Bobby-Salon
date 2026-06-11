import express from 'express';
import cors from 'cors';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import dotenv from 'dotenv';
dotenv.config();

import helmet from 'helmet';
import rateLimit from 'express-rate-limit';
import mongoSanitize from 'express-mongo-sanitize';

import { connectDB, getBookingsCollection, getCompletedCollection, getQueueCollection, getGalleryOrderCollection, getSettingsCollection } from './db.js';
import { cloudinary, upload } from './cloudinaryConfig.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = process.env.PORT || 3001;

app.use(cors());
app.use(express.json());

// ─── Security Middlewares ────────────────────────────────────────────────────

// Set security HTTP headers (disable CSP and COEP to prevent breaking Vite/YouTube/Cloudinary)
app.use(helmet({
  contentSecurityPolicy: false,
  crossOriginEmbedderPolicy: false
}));

// Sanitize user-supplied data to prevent MongoDB Operator Injection
app.use(mongoSanitize());

// Global API Rate Limiting (100 requests per 15 minutes per IP)
const apiLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 100,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Too many requests, please try again later.' }
});
app.use('/api/', apiLimiter);

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

const getDuration = (serviceName) => {
  if (!serviceName) return 60;
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

  try {
    const bookings = getBookingsCollection();
    const settings = getSettingsCollection();

    const timingsDoc = await settings.findOne({ _id: 'timings' });
    const timings = timingsDoc || undefined;

    const bookedForDate = await bookings.find({ date }).toArray();

    const todayDateStr = new Date().toISOString().split('T')[0];
    const isToday = date === todayDateStr;
    const now = new Date();

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

        const slotTime = new Date();
        slotTime.setHours(hour, parseInt(minStr, 10), 0, 0);

        if (now > slotTime) {
          showSlot = false;
        }
      }

      if (showSlot) {
        const slotBookings = bookedForDate.filter(s => s.time === time);
        let bobbyTime = slotBookings.filter(s => s.barber === 'Bobby').reduce((sum, b) => sum + getDuration(b.service), 0);
        let sumitTime = slotBookings.filter(s => s.barber === 'Sumit').reduce((sum, b) => sum + getDuration(b.service), 0);
        let anyTime = slotBookings.filter(s => s.barber === 'Any Available').reduce((sum, b) => sum + getDuration(b.service), 0);

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
  if (!date || !time || !name || !phone || !gender) {
    return res.status(400).json({ error: 'Missing required fields' });
  }

  try {
    const bookings = getBookingsCollection();
    const queueCol = getQueueCollection();

    const bookingsForSlot = await bookings.find({ date, time }).toArray();

    if (!isQueue) {
      if (gender === 'Female') {
        const hasFemale = bookingsForSlot.some(s => s.gender === 'Female');
        if (hasFemale) {
          return res.status(400).json({ error: 'Only one female appointment is available per slot.' });
        }
      }

      const requestedDuration = getDuration(service);
      let bobbyTime = bookingsForSlot.filter(s => s.barber === 'Bobby').reduce((sum, b) => sum + getDuration(b.service), 0);
      let sumitTime = bookingsForSlot.filter(s => s.barber === 'Sumit').reduce((sum, b) => sum + getDuration(b.service), 0);
      let anyTime = bookingsForSlot.filter(s => s.barber === 'Any Available').reduce((sum, b) => sum + getDuration(b.service), 0);

      if (barber === 'Any Available') {
        if (bobbyTime + sumitTime + anyTime + requestedDuration > 120) {
          return res.status(400).json({ error: 'Not enough time available in this slot.' });
        }
      } else if (barber === 'Bobby') {
        if (bobbyTime + requestedDuration > 60) {
          return res.status(400).json({ error: `Bobby does not have enough time (${requestedDuration} mins needed) in this slot.` });
        }
        if (bobbyTime + sumitTime + anyTime + requestedDuration > 120) {
          return res.status(400).json({ error: 'Not enough time available in this slot overall.' });
        }
      } else if (barber === 'Sumit') {
        if (sumitTime + requestedDuration > 60) {
          return res.status(400).json({ error: `Sumit does not have enough time (${requestedDuration} mins needed) in this slot.` });
        }
        if (bobbyTime + sumitTime + anyTime + requestedDuration > 120) {
          return res.status(400).json({ error: 'Not enough time available in this slot overall.' });
        }
      }

      await bookings.insertOne({
        date, time, name, phone, gender, service, barber,
        type: 'BOOKING',
        createdAt: new Date().toISOString()
      });
    } else {
      await queueCol.insertOne({
        date, time, name, phone, gender, service, barber,
        type: 'QUEUE',
        createdAt: new Date().toISOString()
      });
    }

    res.json({ success: true, message: isQueue ? 'Added to queue' : 'Booking confirmed' });
  } catch (err) {
    console.error('Error booking:', err);
    res.status(500).json({ error: 'Server error' });
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

app.post('/api/settings', async (req, res) => {
  try {
    const settings = getSettingsCollection();
    const { _id, ...timingsData } = req.body;
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

// ─── Gallery API (Cloudinary) ────────────────────────────────────────────────

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
  connectDB().catch(err => console.error('DB Connection Failed:', err));
}

// Export for Vercel serverless deployment
export default app;
