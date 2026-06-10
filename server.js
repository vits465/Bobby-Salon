import express from 'express';
import cors from 'cors';
import fs from 'fs';
import { promises as fsPromises } from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { createRequire } from 'module';
const require = createRequire(import.meta.url);
const multer = require('multer');

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = process.env.PORT || 3001;
const DB_FILE = path.join(__dirname, 'database.json');

app.use(cors());
app.use(express.json());

// Serve gallery collection files statically
const GALLERY_DIR = path.join(__dirname, 'public', 'gallery', 'collection');
app.use('/gallery/collection', express.static(GALLERY_DIR));

// In production: serve Vite-built static files from dist/
const distPath = path.join(__dirname, 'dist');
if (fs.existsSync(distPath)) {
  app.use(express.static(distPath));
}

// Also serve public/ for images, logos, videos
app.use(express.static(path.join(__dirname, 'public')));

// Multer storage: saves uploaded files directly into gallery collection dir
const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, GALLERY_DIR),
  filename: (req, file, cb) => {
    // Preserve original name but sanitize it
    const safe = file.originalname.replace(/[^a-zA-Z0-9._-]/g, '_');
    // Avoid overwriting existing files by prepending timestamp if name exists
    const dest = path.join(GALLERY_DIR, safe);
    const finalName = fs.existsSync(dest)
      ? `${Date.now()}_${safe}`
      : safe;
    cb(null, finalName);
  }
});

const ALLOWED_MIME = [
  'image/jpeg', 'image/png', 'image/webp', 'image/gif',
  'video/mp4', 'video/quicktime', 'video/webm'
];

const upload = multer({
  storage,
  limits: { fileSize: 200 * 1024 * 1024 }, // 200 MB max
  fileFilter: (req, file, cb) => {
    if (ALLOWED_MIME.includes(file.mimetype)) cb(null, true);
    else cb(new Error(`Unsupported file type: ${file.mimetype}`));
  }
});

// Initialize database if it doesn't exist
if (!fs.existsSync(DB_FILE)) {
  fs.writeFileSync(DB_FILE, JSON.stringify({ bookedSlots: [] }, null, 2));
}

const getAvailableSlots = (dateStr, db) => {
  const timings = db.timings || {
    weekday: { start: 9, end: 20 }, // 9 AM to 8 PM
    saturday: { start: 14, end: 20 }, // 2 PM to 8 PM
    sunday: { start: 9, end: 21 }, // 9 AM to 9 PM
  };

  const dateObj = new Date(dateStr);
  const day = dateObj.getDay(); 
  
  let startHour, endHour;
  if (day === 0) { // Sunday
    startHour = timings.sunday.start;
    endHour = timings.sunday.end;
  } else if (day === 6) { // Saturday
    startHour = timings.saturday.start;
    endHour = timings.saturday.end;
  } else { // Monday-Friday
    startHour = timings.weekday.start;
    endHour = timings.weekday.end;
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

let dbCache = null;

// Read database (from memory)
const getDB = () => {
  if (dbCache) return dbCache;
  const data = fs.readFileSync(DB_FILE, 'utf8');
  dbCache = JSON.parse(data);
  return dbCache;
};

// Write database (async flush)
const saveDB = (data) => {
  dbCache = data;
  fsPromises.writeFile(DB_FILE, JSON.stringify(data, null, 2))
    .catch(err => console.error("Failed to write to database:", err));
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

// GET /api/slots?date=YYYY-MM-DD
// Returns an array of objects { time: '09:00 AM', taken: boolean }
app.get('/api/slots', (req, res) => {
  const { date } = req.query;
  if (!date) {
    return res.status(400).json({ error: 'Date is required' });
  }

  const db = getDB();
  const bookedForDate = db.bookedSlots.filter(s => s.date === date).map(s => s.time);

  const todayDateStr = new Date().toISOString().split('T')[0];
  const isToday = date === todayDateStr;
  const now = new Date();

  const slotsStatus = [];
  const currentSlots = getAvailableSlots(date, db);
  
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
      const slotBookings = db.bookedSlots.filter(s => s.date === date && s.time === time);
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
});

const ipRequests = new Map();

const rateLimit = (req, res, next) => {
  const ip = req.ip || req.connection?.remoteAddress || 'unknown';
  const now = Date.now();
  if (!ipRequests.has(ip)) ipRequests.set(ip, []);
  
  const requests = ipRequests.get(ip).filter(timestamp => now - timestamp < 3600000); // 1 hour window
  if (requests.length >= 20) {
    return res.status(429).json({ error: 'Too many booking requests. Please try again later.' });
  }
  
  requests.push(now);
  ipRequests.set(ip, requests);
  next();
};

// POST /api/book
// { date: 'YYYY-MM-DD', time: '10:00 AM', name: 'John Doe', phone: '123' }
app.post('/api/book', rateLimit, (req, res) => {
  const { date, time, name, phone, gender, service, barber, isQueue } = req.body;
  if (!date || !time || !name || !phone || !gender) {
    return res.status(400).json({ error: 'Missing required fields' });
  }

  const db = getDB();
  
  // Check if already booked
  const bookingsForSlot = db.bookedSlots.filter(s => s.date === date && s.time === time);
  
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
    // Save normal booking
    db.bookedSlots.push({ date, time, name, phone, gender, service, barber, type: 'BOOKING', createdAt: new Date().toISOString() });
  } else {
    // Save queue request (doesn't block the slot since it's already blocked, just logs it)
    if (!db.queue) db.queue = [];
    db.queue.push({ date, time, name, phone, gender, service, barber, type: 'QUEUE', createdAt: new Date().toISOString() });
  }

  saveDB(db);
  res.json({ success: true, message: isQueue ? 'Added to queue' : 'Booking confirmed' });
});

// Settings APIs
app.get('/api/settings', (req, res) => {
  const db = getDB();
  res.json(db.timings || {
    weekday: { start: 9, end: 20 },
    saturday: { start: 14, end: 20 },
    sunday: { start: 9, end: 21 },
  });
});

app.post('/api/settings', express.json(), (req, res) => {
  const db = getDB();
  db.timings = req.body;
  saveDB(db);
  res.json({ success: true });
});

// GET /api/gallery
// Returns all supported images and videos in saved order
app.get('/api/gallery', async (req, res) => {
  try {
    const galleryDir = path.join(process.cwd(), 'public', 'gallery', 'collection');
    const files = await fsPromises.readdir(galleryDir);

    // Only supported browser-compatible formats
    const supported = new Set(files.filter(f => {
      const ext = path.extname(f).toLowerCase();
      return ['.jpg', '.jpeg', '.png', '.webp', '.mp4'].includes(ext);
    }));

    // Apply saved order from database
    const db = getDB();
    const savedOrder = (db.galleryOrder || []).filter(f => supported.has(f));

    // Any new files not yet in saved order go to the end
    const ordered = [
      ...savedOrder,
      ...[...supported].filter(f => !savedOrder.includes(f))
    ];

    res.json(ordered);
  } catch (error) {
    console.error('Error reading gallery directory:', error);
    res.json([]);
  }
});

// SPA fallback — serve index.html for all non-API routes (production)
if (fs.existsSync(distPath)) {
  app.get('/{*path}', (req, res, next) => {
    // Skip API routes and static files
    if (req.path.startsWith('/api/') || req.path.startsWith('/gallery/')) {
      return next();
    }
    res.sendFile(path.join(distPath, 'index.html'));
  });
}

app.listen(PORT, '0.0.0.0', () => {
  console.log(`Bobby Salon Server running on http://localhost:${PORT}`);
});

// GET /api/admin/bookings
app.get('/api/admin/bookings', (req, res) => {
  const db = getDB();
  res.json({
    bookedSlots: db.bookedSlots || [],
    queue: db.queue || [],
    completedSlots: db.completedSlots || []
  });
});

// DELETE /api/admin/bookings/:id
app.delete('/api/admin/bookings/:id', (req, res) => {
  const db = getDB();
  const id = req.params.id;
  
  if (db.bookedSlots) db.bookedSlots = db.bookedSlots.filter(s => s.createdAt !== id);
  if (db.queue) db.queue = db.queue.filter(s => s.createdAt !== id);
  
  saveDB(db);
  res.json({ success: true });
});

// POST /api/admin/bookings/:id/complete
app.post('/api/admin/bookings/:id/complete', (req, res) => {
  const db = getDB();
  const id = req.params.id;
  
  const slotIndex = db.bookedSlots ? db.bookedSlots.findIndex(s => s.createdAt === id) : -1;
  if (slotIndex !== -1) {
    const slot = db.bookedSlots.splice(slotIndex, 1)[0];
    if (!db.completedSlots) db.completedSlots = [];
    db.completedSlots.push(slot);
    saveDB(db);
    return res.json({ success: true });
  }
  
  res.status(404).json({ error: 'Booking not found' });
});

// POST /api/admin/queue/:id/approve
app.post('/api/admin/queue/:id/approve', (req, res) => {
  const db = getDB();
  const id = req.params.id;
  
  const queueIndex = db.queue ? db.queue.findIndex(s => s.createdAt === id) : -1;
  if (queueIndex !== -1) {
    const item = db.queue.splice(queueIndex, 1)[0];
    item.type = 'BOOKING';
    if (!db.bookedSlots) db.bookedSlots = [];
    db.bookedSlots.push(item);
    saveDB(db);
    return res.json({ success: true });
  }
  
  res.status(404).json({ error: 'Queue item not found' });
});

// ─── Gallery CRUD ────────────────────────────────────────────────────────────

// POST /api/admin/gallery/upload — upload one or more files
app.post('/api/admin/gallery/upload', upload.array('files', 30), (req, res) => {
  if (!req.files || req.files.length === 0) {
    return res.status(400).json({ error: 'No files uploaded' });
  }
  const uploaded = req.files.map(f => f.filename);
  // Append new files to the end of galleryOrder
  const db = getDB();
  if (!db.galleryOrder) db.galleryOrder = [];
  uploaded.forEach(f => { if (!db.galleryOrder.includes(f)) db.galleryOrder.push(f); });
  saveDB(db);
  console.log(`Gallery: uploaded ${uploaded.length} file(s):`, uploaded);
  res.json({ success: true, files: uploaded });
});

// DELETE /api/admin/gallery/:filename — delete a file
app.delete('/api/admin/gallery/:filename', async (req, res) => {
  const { filename } = req.params;
  const safe = path.basename(filename);
  const filePath = path.join(GALLERY_DIR, safe);
  try {
    await fsPromises.unlink(filePath);
    // Remove from order
    const db = getDB();
    if (db.galleryOrder) db.galleryOrder = db.galleryOrder.filter(f => f !== safe);
    saveDB(db);
    console.log(`Gallery: deleted ${safe}`);
    res.json({ success: true });
  } catch (err) {
    res.status(404).json({ error: `File not found: ${safe}` });
  }
});

// PATCH /api/admin/gallery/:filename — rename a file
app.patch('/api/admin/gallery/:filename', async (req, res) => {
  const { filename } = req.params;
  const { newName } = req.body;
  if (!newName) return res.status(400).json({ error: 'newName is required' });

  const oldSafe = path.basename(filename);
  const newSafe = path.basename(newName).replace(/[^a-zA-Z0-9._-]/g, '_');
  const oldPath = path.join(GALLERY_DIR, oldSafe);
  const newPath = path.join(GALLERY_DIR, newSafe);

  try {
    await fsPromises.rename(oldPath, newPath);
    // Update name in galleryOrder
    const db = getDB();
    if (db.galleryOrder) {
      const idx = db.galleryOrder.indexOf(oldSafe);
      if (idx !== -1) db.galleryOrder[idx] = newSafe;
    }
    saveDB(db);
    console.log(`Gallery: renamed ${oldSafe} → ${newSafe}`);
    res.json({ success: true, filename: newSafe });
  } catch (err) {
    res.status(404).json({ error: `File not found: ${oldSafe}` });
  }
});

// PUT /api/admin/gallery/order — save the display order
app.put('/api/admin/gallery/order', (req, res) => {
  const { order } = req.body;
  if (!Array.isArray(order)) {
    return res.status(400).json({ error: 'order must be an array' });
  }
  const db = getDB();
  db.galleryOrder = order.map(f => path.basename(f)); // sanitize
  saveDB(db);
  console.log(`Gallery: saved order for ${order.length} items`);
  res.json({ success: true });
});
