# Bobby Salon — Premium Booking Web Application

A full-stack, responsive, and performance-optimized web application for **Bobby Salon**. Designed with modern aesthetics, an interactive services menu, a secure admin CRUD and analytics dashboard, Progressive Web App (PWA) support, and a free-of-cost automated WhatsApp notification system.

---

## Features

### 1. Interactive Services Catalog
- Categorized services list with filters (**ALL**, **MALE**, **FEMALE**).
- Real-time text search for active services.
- **Quick Book Shortcut**: Clicking any card scrolls directly to the booking form and pre-fills the Gender and Service options automatically.

### 2. Transaction-Safe Booking System
- **Race Condition Prevention**: Employs MongoDB transactions and slot locking (`bookingLocks` collection) to serialize concurrent slot inserts.
- **Automated Waitlist**: Seamlessly transitions overflow bookings to a waitlist queue if salon capacity is reached.
- **Strict Validation**: Validates client-side requests against the database list, preventing scheduling for past time slots, closed salon dates, or mismatched services.

### 3. Fully-Featured Admin Dashboard (`#admin`)
- Accessible via `http://localhost:3000/?bypass=1#admin` locally or with password verification.
- **Real-Time Bookings Manager**: View, delete, or complete active appointments and approve waitlisted slots.
- **Service CRUD Editor**: Create, edit, and soft-delete/deactivate salon services dynamically.
- **Operational Settings**: Modify opening/closing hours and manage holidays/blocked dates.
- **Portfolio Manager**: Direct upload of images/videos to Cloudinary, display ordering (drag-and-drop), and display name editing.
- **Analytics Metrics**: Real-time performance dashboards tracking completed revenue, projected earnings, booking breakdown by gender, and service popularity charts.

### 4. 100% Free WhatsApp Alerts
- Integrates the **CallMeBot API** to notify the admin immediately upon new bookings/waitlist submissions.
- Zero-cost operation bypassing paid Meta or Twilio APIs.
- Silent fallbacks when credentials are not configured in `.env`.

### 5. Progressive Web App (PWA) Support
- Offline asset caching using service workers (`sw.js`) for near-instantaneous page reloads.
- Standalone app experience on iOS and Android devices configured via `manifest.json`.
- Premium custom UI install prompts.

---

## Tech Stack

- **Frontend**: HTML5, Vanilla CSS3 (custom variables, grid, flexbox), TypeScript (Vite client compilation)
- **Backend**: Node.js, Express.js
- **Database**: MongoDB (Atlas/Community Server with transaction support)
- **Asset Storage**: Cloudinary (Image & Video hosting)
- **Service Workers**: Workbox/ServiceWorker cache API
- **Automation**: CallMeBot WhatsApp Gateway

---

## Configuration (`.env`)

Create a `.env` file in the root directory:

```env
# MongoDB Connection
MONGODB_URI=your_mongodb_connection_string
MONGODB_DB=Bobby-salon

# Cloudinary Credentials (for Portfolio Gallery)
CLOUDINARY_CLOUD_NAME=your_cloud_name
CLOUDINARY_API_KEY=your_api_key
CLOUDINARY_API_SECRET=your_api_secret

# Admin Dashboard Password (used for server-side route authentication)
ADMIN_PASSWORD=bobby123

# Free WhatsApp Alerts (CallMeBot)
ADMIN_PHONE=your_phone_number_with_country_code # e.g. 919876543210
CALLMEBOT_API_KEY=your_callmebot_api_key
```

---

## Quick Start

### Installation
Install dependencies for both the Express server and Vite builder:
```bash
npm install
```

### Local Development
Launches the backend server (on `http://localhost:3001`) and the Vite dev client (on `http://localhost:3000`):
```bash
npm run dev
```

### Build Validation
Compiles production-ready assets to the `dist/` directory:
```bash
npm run build
```

### Linter Check
Executes TypeScript & ESLint analysis across codebase files:
```bash
npm run lint
```
