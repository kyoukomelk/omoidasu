# Omoidasu

Omoidasu is a personal information management suite It consolidates calendars, contacts, and notes into a unified, local-first dashboard. The application features multi-account isolation, offline-first persistence, server-side scoping, and WebDAV synchronization.

---

## Key Features

### Central Dashboard
* Daily Schedule: Dynamic agenda view matching time-of-day contexts.
* Weather Integration: Location-based forecast updates retrieved from Open-Meteo geocoding and forecast APIs.
* Customizable Layout: Layout widgets (Appointments, Favorites, Notes) can be rearranged via native drag-and-drop or toggled for visibility.
* Birthday Banners: Automated notifications highlighting upcoming contact birthdays.

### Calendars
* Layout options: Split sidebar view for schedules on desktop/tablet viewports, and vertical stacking for mobile screens.
* Calendar imports: Bulk upload `.ics` files to construct separate, color-coded calendars.
* Management Panel: Dedicated dashboard to create, recolor, filter, and delete calendar feeds.

### Contacts
* Data Importing: Import standard `.vcf` vCards directly into the contact book.
* Avatars and Photos: Generates letter-initial badges and compresses profile image uploads locally using HTML5 canvas.
* Favorites: Pin select contacts to the dashboard for quick navigation.

### Notes
* Markdown Code Snippets: In-editor rendering of code blocks inside a dark theme preview container with direct clipboard copying.
* Categorization: Inline tagging with dynamically populated tag filter chips.
* Attachments: base64 photo attachments, complete with fullscreen lightbox zoom and local download triggers.
* Checklists: Toggle notes into interactive checklists.

### Identity & Security
* Multi-Account Access: Switch local account sessions on the same device without data leakage.
* Cryptographic Security: Passwords salted and hashed via PBKDF2 stretching.
* Administrative Operations: Oldest registered user gains root administrator status to promote users and toggle public registration limits.
* Scoped Data: SQL tables are partitioned by unique user identifiers.

---

## Technical Stack
* Frontend: React, Vite, Vanilla CSS (Material 3 variables and elevation specs)
* Backend: Node.js, Express, SQLite (via `sqlite3` driver)
* Sync Protocol: REST API endpoints and WebDAV server integration

---

## Getting Started

### Prerequisites
* Node.js (v18+)
* npm

### Local Installation

1. Clone the repository:
   ```bash
   git clone https://github.com/kyoukomelk/omoidasu.git
   cd omoidasu
   ```

2. Install backend dependencies:
   ```bash
   npm install
   ```

3. Install frontend dependencies:
   ```bash
   cd frontend
   npm install
   cd ..
   ```

4. Run the application:
   Start the backend API server (port 8080):
   ```bash
   npm start
   ```
   Start the Vite frontend development server (port 5173):
   ```bash
   cd frontend
   npm run dev
   ```
   Open `http://localhost:5173` in your browser.

---

## Production Deployment

### Docker Compose
Deploy the server stack instantly using:
```bash
docker compose up -d
```
The application will bind to port 8080.

### CasaOS Deployment
1. Open the CasaOS dashboard and select App Store.
2. Click Custom Install in the top right.
3. Choose Import and paste the contents of `docker-compose.yml`.
4. Submit the configuration. Volume allocations preserve SQLite tables under the local `./data/` folder.
