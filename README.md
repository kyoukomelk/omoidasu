# Omoidasu (M3 Sync Hub)

Omoidasu is a premium, responsive, local-first web application designed with the **Material 3 Design System**. It consolidates Calendar events, Contacts, and Notes into a unified dashboard, featuring multi-account support, local-first offline capabilities, server-side data isolation, and a built-in WebDAV synchronization engine.

---

## ✨ Features

### 📅 Dashboard & Home
- **Dynamic Welcome & Header**: Interactive greeting adapting to the time of day with custom animations.
- **Weather Widget**: Real-time city weather tracking powered by the Open-Meteo Geocoding & Forecast APIs.
- **Draggable & Customizable Sections**: Customize section orders (Appointments, Favorites, Notes) using native drag-and-drop, and toggle section visibility.
- **Birthday Alerts**: Automated banners celebrating contact birthdays.

### 🗓️ Multi-Calendar
- **Responsive Split Layout**: View calendar dates side-by-side with daily schedules on desktop/tablet viewports, and clean stacking on mobile.
- **Color-Coded Calendars**: Bulk import `.ics` files to generate distinct, color-coded custom calendars.
- **Interactive Calendar Manager**: Create, edit, recolor, toggle visibility, and delete multiple calendar structures.

### 📇 Contacts Book
- **Bulk Importing**: Instantly upload `.vcf` vCards to populate your contacts database.
- **Avatars**: Initialized letter-badge avatars and base64 profile photo compression.
- **Favorites Carousel**: Pin vital contacts to the dashboard.

### 📝 Notes Manager
- **Markdown & Code Snippets**: Separates prose from code blocks, displaying snippets inside a premium dark theme container with a one-click clipboard copier.
- **Custom Tagging**: Inline tagging pills with tag filtering buttons.
- **Photo Attachments**: Upload photos directly into notes, including a fullscreen lightbox with download capabilities.
- **Checklist Mode**: Switch notes into interactive checklist tasks.

### 🔒 Accounts & Security
- **Multi-Account Sessions**: Switch accounts locally on a single device or logout, preserving separate local storage keys.
- **PBKDF2 Password Hashing**: Standard password protection for registered users.
- **Admin Privilege System**: Designated administrators can promo/demote users and disable user registration settings.
- **SQLite Scoping**: Entire backend database tables (`events`, `calendars`, `contacts`, `notes`) are scoped securely by `user_id`.

---

## 🛠️ Technology Stack
- **Frontend**: React, Vite, Vanilla CSS (Material 3 tokens, elevations, curves)
- **Backend**: Node.js, Express, SQLite (`sqlite3` module)
- **Protocols**: REST API, WebDAV Server integration (for calendar/contacts syncing)

---

## 🚀 Getting Started

### Prerequisites
- [Node.js](https://nodejs.org/) (v18+)
- [npm](https://www.npmjs.com/)

### Local Development Setup

1. **Clone the repository**:
   ```bash
   git clone https://github.com/kyoukomelk/omoidasu.git
   cd omoidasu
   ```

2. **Install Backend Dependencies**:
   ```bash
   npm install
   ```

3. **Install Frontend Dependencies**:
   ```bash
   cd frontend
   npm install
   cd ..
   ```

4. **Run the Application**:
   You can run the backend and frontend concurrently. 
   - Start the backend server (on port `8080`):
     ```bash
     npm start
     ```
   - Start the Vite development server (on port `5173`):
     ```bash
     cd frontend
     npm run dev
     ```
   Open your browser and navigate to `http://localhost:5173`.

---

## 🐳 Docker & CasaOS Deployment

Omoidasu is fully containerized and ready for single-command deployments.

### Running with Docker Compose
Run the following command at the root directory:
```bash
docker compose up -d
```
The application will build and run on port `8080`.

### Custom Install in CasaOS
1. Open the **CasaOS Dashboard**.
2. Click **App Store** -> **Custom Install** (top-right).
3. Click **Import** (top-right) and paste the contents of `docker-compose.yml`.
4. Submit and install. Volume mappings will preserve the database sqlite file under `./data/sync.db`.
