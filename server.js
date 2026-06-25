import express from 'express';
import cors from 'cors';
import sqlite3 from 'sqlite3';
import { dirname, join } from 'path';
import { fileURLToPath } from 'url';
import fs from 'fs';
import crypto from 'crypto';

const __dirname = dirname(fileURLToPath(import.meta.url));
const PORT = process.env.PORT || 8080;
const DB_PATH = process.env.DB_PATH || join(__dirname, 'data', 'sync.db');

// Ensure data directory exists
if (!fs.existsSync(dirname(DB_PATH))) {
  fs.mkdirSync(dirname(DB_PATH), { recursive: true });
}

const app = express();

// WebDAV OPTIONS interception before CORS preflight
app.options('/:username/webdav/:filename?', (req, res) => {
  res.setHeader('Allow', 'OPTIONS, PROPFIND, GET, PUT, DELETE');
  res.setHeader('DAV', '1');
  return res.status(200).send();
});

app.use(cors());
app.use(express.json({ limit: '10mb' }));

// Open SQLite Database
const db = new sqlite3.Database(DB_PATH, (err) => {
  if (err) {
    console.error('Database connection error:', err.message);
  } else {
    console.log('Connected to the SQLite database at:', DB_PATH);
    initializeDatabase();
  }
});

// Helper for database operations using promises
const dbRun = (sql, params = []) => {
  return new Promise((resolve, reject) => {
    db.run(sql, params, function (err) {
      if (err) reject(err);
      else resolve(this);
    });
  });
};

const dbAll = (sql, params = []) => {
  return new Promise((resolve, reject) => {
    db.all(sql, params, (err, rows) => {
      if (err) reject(err);
      else resolve(rows);
    });
  });
};

const dbGet = (sql, params = []) => {
  return new Promise((resolve, reject) => {
    db.get(sql, params, (err, row) => {
      if (err) reject(err);
      else resolve(row);
    });
  });
};

// Initialize Database Tables
async function initializeDatabase() {
  try {
    // Users table
    await dbRun(`
      CREATE TABLE IF NOT EXISTS users (
        id TEXT PRIMARY KEY,
        username TEXT UNIQUE,
        password_hash TEXT,
        display_name TEXT,
        birthday TEXT,
        location TEXT,
        theme_hue TEXT DEFAULT '270',
        theme_mode TEXT DEFAULT 'dark',
        profile_picture TEXT,
        is_admin INTEGER DEFAULT 0,
        updated_at INTEGER
      )
    `);

    try {
      await dbRun('ALTER TABLE users ADD COLUMN profile_picture TEXT');
    } catch (_) {
      // Column already exists
    }

    try {
      await dbRun('ALTER TABLE users ADD COLUMN is_admin INTEGER DEFAULT 0');
    } catch (_) {
      // Column already exists
    }

    // Calendar events
    await dbRun(`
      CREATE TABLE IF NOT EXISTS events (
        id TEXT PRIMARY KEY,
        title TEXT,
        description TEXT,
        start_time TEXT,
        end_time TEXT,
        location TEXT,
        all_day INTEGER DEFAULT 0,
        calendar_id TEXT,
        user_id TEXT,
        updated_at INTEGER,
        deleted INTEGER DEFAULT 0
      )
    `);

    // Calendars
    await dbRun(`
      CREATE TABLE IF NOT EXISTS calendars (
        id TEXT PRIMARY KEY,
        name TEXT,
        color TEXT,
        user_id TEXT,
        updated_at INTEGER,
        deleted INTEGER DEFAULT 0
      )
    `);

    // Contacts
    await dbRun(`
      CREATE TABLE IF NOT EXISTS contacts (
        id TEXT PRIMARY KEY,
        first_name TEXT,
        last_name TEXT,
        email TEXT,
        phone TEXT,
        phone_2 TEXT,
        website TEXT,
        address TEXT,
        birthday TEXT,
        notes TEXT,
        avatar TEXT,
        favorite INTEGER DEFAULT 0,
        photo TEXT,
        user_id TEXT,
        updated_at INTEGER,
        deleted INTEGER DEFAULT 0
      )
    `);

    // Notes
    await dbRun(`
      CREATE TABLE IF NOT EXISTS notes (
        id TEXT PRIMARY KEY,
        title TEXT,
        content TEXT,
        color TEXT,
        favorite INTEGER DEFAULT 0,
        photo TEXT,
        checklist TEXT,
        tags TEXT,
        user_id TEXT,
        updated_at INTEGER,
        deleted INTEGER DEFAULT 0
      )
    `);

    // Migrations for existing databases
    try { await dbRun('ALTER TABLE notes ADD COLUMN favorite INTEGER DEFAULT 0'); } catch(e) {}
    try { await dbRun('ALTER TABLE notes ADD COLUMN photo TEXT'); } catch(e) {}
    try { await dbRun('ALTER TABLE notes ADD COLUMN checklist TEXT'); } catch(e) {}
    try { await dbRun('ALTER TABLE notes ADD COLUMN tags TEXT'); } catch(e) {}
    try { await dbRun('ALTER TABLE events ADD COLUMN calendar_id TEXT'); } catch(e) {}
    try { await dbRun('ALTER TABLE events ADD COLUMN user_id TEXT'); } catch(e) {}
    try { await dbRun('ALTER TABLE calendars ADD COLUMN user_id TEXT'); } catch(e) {}
    try { await dbRun('ALTER TABLE contacts ADD COLUMN user_id TEXT'); } catch(e) {}
    try { await dbRun('ALTER TABLE notes ADD COLUMN user_id TEXT'); } catch(e) {}

    // System settings table
    await dbRun(`
      CREATE TABLE IF NOT EXISTS system_settings (
        key TEXT PRIMARY KEY,
        value TEXT
      )
    `);

    // Load or generate persistent JWT secret key
    if (!JWT_SECRET) {
      const secretRow = await dbGet("SELECT value FROM system_settings WHERE key = 'jwt_secret'");
      if (secretRow) {
        JWT_SECRET = secretRow.value;
      } else {
        JWT_SECRET = crypto.randomBytes(32).toString('hex');
        await dbRun("INSERT INTO system_settings (key, value) VALUES ('jwt_secret', ?)", [JWT_SECRET]);
      }
    }

    console.log('Database tables verified/created successfully.');
  } catch (error) {
    console.error('Error initializing database:', error);
  }
}

// Password Hashing helpers
function hashPassword(password) {
  const salt = crypto.randomBytes(16).toString('hex');
  const hash = crypto.pbkdf2Sync(password, salt, 1000, 64, 'sha512').toString('hex');
  return `${salt}:${hash}`;
}

function verifyPassword(password, stored) {
  if (!stored || !stored.includes(':')) return false;
  const [salt, hash] = stored.split(':');
  const checkHash = crypto.pbkdf2Sync(password, salt, 1000, 64, 'sha512').toString('hex');
  return hash === checkHash;
}

// Token validation helpers
let JWT_SECRET = process.env.JWT_SECRET;

function generateToken(payload) {
  const header = Buffer.from(JSON.stringify({ alg: 'HS256', typ: 'JWT' })).toString('base64url');
  const body = Buffer.from(JSON.stringify({ ...payload, exp: Date.now() + 30 * 24 * 60 * 60 * 1000 })).toString('base64url');
  const signature = crypto.createHmac('sha256', JWT_SECRET).update(`${header}.${body}`).digest('base64url');
  return `${header}.${body}.${signature}`;
}

function verifyToken(token) {
  try {
    const [header, body, signature] = token.split('.');
    const expectedSig = crypto.createHmac('sha256', JWT_SECRET).update(`${header}.${body}`).digest('base64url');
    if (signature !== expectedSig) return null;
    const decodedBody = JSON.parse(Buffer.from(body, 'base64url').toString('utf8'));
    if (Date.now() > decodedBody.exp) return null;
    return decodedBody;
  } catch (e) {
    return null;
  }
}

const authMiddleware = async (req, res, next) => {
  const authHeader = req.headers['authorization'];
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Unauthorized: Missing token' });
  }
  const token = authHeader.split(' ')[1];
  const payload = verifyToken(token);
  if (!payload) {
    return res.status(401).json({ error: 'Unauthorized: Invalid token' });
  }
  req.userId = payload.userId;
  req.username = payload.username;
  next();
};

// WebDAV Basic Authentication middleware helper
async function authenticateBasic(req, res) {
  const authHeader = req.headers['authorization'];
  if (!authHeader || !authHeader.startsWith('Basic ')) {
    res.setHeader('WWW-Authenticate', 'Basic realm="Omoidasu WebDAV"');
    res.status(401).send('Authentication required');
    return null;
  }
  try {
    const credentials = Buffer.from(authHeader.split(' ')[1], 'base64').toString('utf8');
    const [username, password] = credentials.split(':');
    const user = await dbGet('SELECT * FROM users WHERE username = ?', [username.toLowerCase()]);
    if (!user || !verifyPassword(password, user.password_hash)) {
      res.setHeader('WWW-Authenticate', 'Basic realm="Omoidasu WebDAV"');
      res.status(401).send('Invalid credentials');
      return null;
    }
    if (req.params.username.toLowerCase() !== username.toLowerCase()) {
      res.status(403).send('Forbidden: Access denied to other user collections');
      return null;
    }
    return user;
  } catch (e) {
    res.status(500).send('Authentication error');
    return null;
  }
}

// ICS & VCF Helper Serializers and Parsers
function formatIcsDate(timestamp) {
  const date = new Date(timestamp);
  return date.toISOString().replace(/[-:]/g, '').split('.')[0] + 'Z';
}

function serializeToIcs(events) {
  let ics = 'BEGIN:VCALENDAR\r\nVERSION:2.0\r\nPRODID:-//Omoidasu//Sync Server//EN\r\nCALSCALE:GREGORIAN\r\n';
  for (const ev of events) {
    if (ev.deleted) continue;
    ics += 'BEGIN:VEVENT\r\n';
    ics += `UID:${ev.id}\r\n`;
    ics += `DTSTAMP:${formatIcsDate(ev.updated_at || Date.now())}\r\n`;
    if (ev.start_time) {
      const cleanStart = ev.start_time.replace(/[-:]/g, '').split('.')[0];
      if (ev.all_day) {
        ics += `DTSTART;VALUE=DATE:${cleanStart.split('T')[0]}\r\n`;
      } else {
        ics += `DTSTART:${cleanStart}\r\n`;
      }
    }
    if (ev.end_time) {
      const cleanEnd = ev.end_time.replace(/[-:]/g, '').split('.')[0];
      if (ev.all_day) {
        ics += `DTEND;VALUE=DATE:${cleanEnd.split('T')[0]}\r\n`;
      } else {
        ics += `DTEND:${cleanEnd}\r\n`;
      }
    }
    if (ev.title) ics += `SUMMARY:${ev.title}\r\n`;
    if (ev.description) ics += `DESCRIPTION:${ev.description}\r\n`;
    if (ev.location) ics += `LOCATION:${ev.location}\r\n`;
    ics += 'END:VEVENT\r\n';
  }
  ics += 'END:VCALENDAR\r\n';
  return ics;
}

function serializeToVcf(contacts) {
  let vcf = '';
  for (const c of contacts) {
    if (c.deleted) continue;
    vcf += 'BEGIN:VCARD\r\nVERSION:3.0\r\n';
    vcf += `FN:${c.first_name || ''} ${c.last_name || ''}\r\n`;
    vcf += `N:${c.last_name || ''};${c.first_name || ''};;;\r\n`;
    if (c.email) {
      try {
        const emails = JSON.parse(c.email);
        if (Array.isArray(emails)) {
          emails.forEach(email => vcf += `EMAIL;TYPE=INTERNET:${email}\r\n`);
        }
      } catch(e) {
        vcf += `EMAIL;TYPE=INTERNET:${c.email}\r\n`;
      }
    }
    if (c.phone) {
      try {
        const phones = JSON.parse(c.phone);
        if (Array.isArray(phones)) {
          phones.forEach(phone => vcf += `TEL;TYPE=VOICE:${phone}\r\n`);
        }
      } catch(e) {
        vcf += `TEL;TYPE=VOICE:${c.phone}\r\n`;
      }
    }
    if (c.address) vcf += `ADR;TYPE=HOME:;;${c.address};;;;\r\n`;
    if (c.birthday) vcf += `BDAY:${c.birthday.replace(/-/g, '')}\r\n`;
    if (c.notes) vcf += `NOTE:${c.notes}\r\n`;
    if (c.website) vcf += `URL:${c.website}\r\n`;
    vcf += 'END:VCARD\r\n';
  }
  return vcf;
}

function parseIcsDate(value) {
  if (value.length === 8 && /^\d+$/.test(value)) {
    const y = value.slice(0, 4);
    const m = value.slice(4, 6);
    const d = value.slice(6, 8);
    return { date: `${y}-${m}-${d}T00:00:00`, allDay: true };
  }
  const match = value.match(/^(\d{4})(\d{2})(\d{2})T(\d{2})(\d{2})(\d{2})(Z)?$/);
  if (match) {
    const [_, y, m, d, hh, mm, ss, z] = match;
    if (z) {
      const utcDate = new Date(`${y}-${m}-${d}T${hh}:${mm}:${ss}Z`);
      if (!isNaN(utcDate.getTime())) {
        const localY = utcDate.getFullYear();
        const localM = String(utcDate.getMonth() + 1).padStart(2, '0');
        const localD = String(utcDate.getDate()).padStart(2, '0');
        const localH = String(utcDate.getHours()).padStart(2, '0');
        const localMin = String(utcDate.getMinutes()).padStart(2, '0');
        return { date: `${localY}-${localM}-${localD}T${localH}:${localMin}:00`, allDay: false };
      }
    }
    return { date: `${y}-${m}-${d}T${hh}:${mm}:00`, allDay: false };
  }
  return { date: null, allDay: false };
}

function parseIcs(text) {
  const unfolded = text.replace(/\r?\n[ \t]/g, '');
  const lines = unfolded.split(/\r?\n/);
  const events = [];
  let currentEvent = null;
  let inEvent = false;

  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed) continue;

    if (trimmed === 'BEGIN:VEVENT') {
      currentEvent = {};
      inEvent = true;
      continue;
    }

    if (trimmed === 'END:VEVENT') {
      if (currentEvent && currentEvent.title) {
        events.push(currentEvent);
      }
      inEvent = false;
      currentEvent = null;
      continue;
    }

    if (inEvent && currentEvent) {
      const separatorIndex = trimmed.indexOf(':');
      if (separatorIndex === -1) continue;
      
      const keyPart = trimmed.slice(0, separatorIndex);
      const value = trimmed.slice(separatorIndex + 1);
      const name = keyPart.split(';')[0].toUpperCase();

      const cleanValue = value
        .replace(/\\,/g, ',')
        .replace(/\\;/g, ';')
        .replace(/\\n/g, '\n')
        .replace(/\\N/g, '\n')
        .replace(/\\\\/g, '\\');

      if (name === 'SUMMARY') {
        currentEvent.title = cleanValue;
      } else if (name === 'DESCRIPTION') {
        currentEvent.description = cleanValue;
      } else if (name === 'LOCATION') {
        currentEvent.location = cleanValue;
      } else if (name === 'DTSTART') {
        const parsed = parseIcsDate(value);
        if (parsed.date) {
          currentEvent.start_time = parsed.date;
          currentEvent.all_day = parsed.allDay;
        }
      } else if (name === 'DTEND') {
        const parsed = parseIcsDate(value);
        if (parsed.date) {
          currentEvent.end_time = parsed.date;
        }
      } else if (name === 'UID') {
        currentEvent.id = value;
      }
    }
  }
  return events;
}

function parseVcf(text) {
  const unfolded = text.replace(/\r?\n[ \t]/g, '');
  const lines = unfolded.split(/\r?\n/);
  const contacts = [];
  let currentContact = null;
  let inContact = false;

  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed) continue;

    if (trimmed === 'BEGIN:VCARD') {
      currentContact = { phone: [], email: [] };
      inContact = true;
      continue;
    }

    if (trimmed === 'END:VCARD') {
      if (currentContact && (currentContact.first_name || currentContact.last_name || currentContact.email.length > 0 || currentContact.phone.length > 0)) {
        currentContact.phone = JSON.stringify(currentContact.phone);
        currentContact.email = JSON.stringify(currentContact.email);
        contacts.push(currentContact);
      }
      inContact = false;
      currentContact = null;
      continue;
    }

    if (inContact && currentContact) {
      const separatorIndex = trimmed.indexOf(':');
      if (separatorIndex === -1) continue;
      
      const keyPart = trimmed.slice(0, separatorIndex);
      const value = trimmed.slice(separatorIndex + 1);
      const name = keyPart.split(';')[0].toUpperCase();

      const cleanValue = value
        .replace(/\\,/g, ',')
        .replace(/\\;/g, ';')
        .replace(/\\n/g, '\n')
        .replace(/\\N/g, '\n')
        .replace(/\\\\/g, '\\');

      if (name === 'N') {
        const parts = cleanValue.split(';');
        currentContact.last_name = parts[0]?.trim() || '';
        currentContact.first_name = parts[1]?.trim() || '';
      } else if (name === 'FN') {
        if (!currentContact.first_name && !currentContact.last_name) {
          const parts = cleanValue.split(' ');
          currentContact.first_name = parts[0]?.trim() || '';
          currentContact.last_name = parts.slice(1).join(' ')?.trim() || '';
        }
      } else if (name === 'TEL') {
        currentContact.phone.push(cleanValue);
      } else if (name === 'EMAIL') {
        currentContact.email.push(cleanValue);
      } else if (name === 'URL') {
        currentContact.website = cleanValue;
      } else if (name === 'ADR') {
        const parts = cleanValue.split(';').map(p => p.trim()).filter(Boolean);
        currentContact.address = parts.join(', ');
      } else if (name === 'BDAY') {
        let bday = cleanValue.trim();
        if (bday.length === 8 && /^\d+$/.test(bday)) {
          bday = `${bday.slice(0, 4)}-${bday.slice(4, 6)}-${bday.slice(6, 8)}`;
        }
        currentContact.birthday = bday;
      } else if (name === 'NOTE') {
        currentContact.notes = cleanValue;
      }
    }
  }
  return contacts;
}

// Global server sync timestamp
// Global server sync timestamp
const getServerTime = () => Date.now();

// Helper to determine Admin User
async function getAdminUserId() {
  try {
    const firstUser = await dbGet('SELECT id FROM users ORDER BY rowid ASC LIMIT 1');
    return firstUser ? firstUser.id : null;
  } catch (err) {
    console.error('Error fetching admin user ID:', err);
    return null;
  }
}

async function isUserAdmin(userId) {
  try {
    const row = await dbGet('SELECT is_admin FROM users WHERE id = ?', [userId]);
    if (row && row.is_admin === 1) return true;
    const adminId = await getAdminUserId();
    return adminId === userId;
  } catch (err) {
    return false;
  }
}

// Auth Endpoints
app.post('/api/auth/register', async (req, res) => {
  const { username, password, displayName, birthday, location, profilePicture } = req.body;
  if (!username || !password) {
    return res.status(400).json({ error: 'Username and password are required' });
  }

  try {
    // Check if new user registration is disabled by admin
    const regDisabledSetting = await dbGet("SELECT value FROM system_settings WHERE key = 'registration_disabled'");
    const regDisabled = regDisabledSetting && regDisabledSetting.value === 'true';
    
    // Allow registration if there are no users yet (so the 1st user can register to become admin)
    const usersCountObj = await dbGet('SELECT COUNT(*) as count FROM users');
    const hasUsers = usersCountObj && usersCountObj.count > 0;
    
    if (regDisabled && hasUsers) {
      return res.status(403).json({ error: 'User registration has been disabled by the administrator' });
    }

    const existing = await dbGet('SELECT id FROM users WHERE username = ?', [username.toLowerCase()]);
    if (existing) {
      return res.status(400).json({ error: 'Username is already taken' });
    }

    const id = crypto.randomUUID();
    const passwordHash = hashPassword(password);
    const isAdminVal = !hasUsers ? 1 : 0;
    await dbRun(
      `INSERT INTO users (id, username, password_hash, display_name, birthday, location, profile_picture, is_admin, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [id, username.toLowerCase(), passwordHash, displayName || username, birthday || '', location || '', profilePicture || '', isAdminVal, Date.now()]
    );

    const token = generateToken({ userId: id, username: username.toLowerCase() });
    
    res.json({
      token,
      user: {
        id,
        username: username.toLowerCase(),
        displayName: displayName || username,
        birthday: birthday || '',
        location: location || '',
        profilePicture: profilePicture || '',
        themeHue: '270',
        themeMode: 'dark',
        isAdmin: isAdminVal === 1
      }
    });
  } catch (err) {
    console.error('Registration error:', err);
    res.status(500).json({ error: 'Registration failed: ' + err.message });
  }
});

app.get('/api/auth/users', async (req, res) => {
  try {
    const adminId = await getAdminUserId();
    const users = await dbAll('SELECT id, username, display_name as displayName, birthday, location, profile_picture as profilePicture, theme_hue as themeHue, theme_mode as themeMode, is_admin FROM users');
    const usersWithAdmin = users.map(u => ({
      ...u,
      isAdmin: u.id === adminId || u.is_admin === 1,
      isPrimaryAdmin: u.id === adminId
    }));
    res.json(usersWithAdmin);
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch users: ' + err.message });
  }
});

app.post('/api/auth/login', async (req, res) => {
  const { username, password } = req.body;
  if (!username || !password) {
    return res.status(400).json({ error: 'Username and password are required' });
  }

  try {
    const user = await dbGet('SELECT * FROM users WHERE username = ?', [username.toLowerCase()]);
    if (!user || !verifyPassword(password, user.password_hash)) {
      return res.status(400).json({ error: 'Invalid username or password' });
    }

    const token = generateToken({ userId: user.id, username: user.username });
    const adminId = await getAdminUserId();
    
    res.json({
      token,
      user: {
        id: user.id,
        username: user.username,
        displayName: user.display_name,
        birthday: user.birthday,
        location: user.location,
        profilePicture: user.profile_picture || '',
        themeHue: user.theme_hue || '270',
        themeMode: user.theme_mode || 'light',
        isAdmin: user.id === adminId || user.is_admin === 1
      }
    });
  } catch (err) {
    console.error('Login error:', err);
    res.status(500).json({ error: 'Login failed: ' + err.message });
  }
});

// System Settings Endpoints
app.get('/api/system/settings', async (req, res) => {
  try {
    const regDisabled = await dbGet("SELECT value FROM system_settings WHERE key = 'registration_disabled'");
    res.json({ registrationDisabled: regDisabled ? regDisabled.value === 'true' : false });
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch settings: ' + err.message });
  }
});

app.post('/api/system/settings', authMiddleware, async (req, res) => {
  try {
    const isAdmin = await isUserAdmin(req.userId);
    if (!isAdmin) {
      return res.status(403).json({ error: 'Only the administrator can modify system settings' });
    }
    const { registrationDisabled } = req.body;
    await dbRun(
      "INSERT INTO system_settings (key, value) VALUES ('registration_disabled', ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value",
      [registrationDisabled ? 'true' : 'false']
    );
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: 'Failed to update settings: ' + err.message });
  }
});

app.post('/api/system/wipe-users', authMiddleware, async (req, res) => {
  try {
    const isAdmin = await isUserAdmin(req.userId);
    if (!isAdmin) {
      return res.status(403).json({ error: 'Only the administrator can delete all users' });
    }
    // Wipe all user data
    await dbRun('DELETE FROM events');
    await dbRun('DELETE FROM contacts');
    await dbRun('DELETE FROM notes');
    await dbRun('DELETE FROM calendars');
    await dbRun('DELETE FROM users');
    await dbRun('DELETE FROM system_settings');
    res.json({ success: true, message: 'All users and data deleted successfully' });
  } catch (err) {
    console.error('Wipe error:', err);
    res.status(500).json({ error: 'Wipe failed: ' + err.message });
  }
});

app.post('/api/system/toggle-admin', authMiddleware, async (req, res) => {
  try {
    const isAdmin = await isUserAdmin(req.userId);
    if (!isAdmin) {
      return res.status(403).json({ error: 'Only the administrator can change admin status of users' });
    }
    const { targetUserId, makeAdmin } = req.body;
    if (!targetUserId) {
      return res.status(400).json({ error: 'Target user ID is required' });
    }

    // Determine the primary admin (the first registered user)
    const primaryAdminId = await getAdminUserId();
    if (targetUserId === primaryAdminId) {
      return res.status(400).json({ error: 'Cannot modify the admin privilege of the primary administrator' });
    }

    await dbRun(
      'UPDATE users SET is_admin = ? WHERE id = ?',
      [makeAdmin ? 1 : 0, targetUserId]
    );
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: 'Failed to update user admin privilege: ' + err.message });
  }
});

app.post('/api/auth/update-profile', authMiddleware, async (req, res) => {
  const { displayName, birthday, location, profilePicture, themeHue, themeMode } = req.body;
  try {
    await dbRun(
      `UPDATE users SET display_name = ?, birthday = ?, location = ?, profile_picture = ?, theme_hue = ?, theme_mode = ?, updated_at = ? WHERE id = ?`,
      [displayName, birthday, location, profilePicture, themeHue, themeMode, Date.now(), req.userId]
    );
    res.json({ success: true });
  } catch (err) {
    console.error('Update profile error:', err);
    res.status(500).json({ error: 'Failed to update profile: ' + err.message });
  }
});

app.post('/api/auth/delete-account', authMiddleware, async (req, res) => {
  const userId = req.userId;
  try {
    // Scrub user records sequentially
    await dbRun('DELETE FROM events WHERE user_id = ?', [userId]);
    await dbRun('DELETE FROM contacts WHERE user_id = ?', [userId]);
    await dbRun('DELETE FROM notes WHERE user_id = ?', [userId]);
    await dbRun('DELETE FROM calendars WHERE user_id = ?', [userId]);
    await dbRun('DELETE FROM users WHERE id = ?', [userId]);
    res.json({ success: true, message: 'Account and all data deleted successfully' });
  } catch (err) {
    console.error('Delete account error:', err);
    res.status(500).json({ error: 'Failed to delete account: ' + err.message });
  }
});

// Bidirectional Sync Endpoint (scoped to authenticated user)
app.post('/api/sync', authMiddleware, async (req, res) => {
  const { lastSyncTimestamp, changes } = req.body;
  const serverTime = getServerTime();
  const userId = req.userId;

  if (typeof lastSyncTimestamp !== 'number') {
    return res.status(400).json({ error: 'Invalid lastSyncTimestamp' });
  }

  const clientSyncTime = lastSyncTimestamp;

  try {
    // Process client changes inside a transaction-like sequential flow
    db.serialize(async () => {
      // Process events changes
      if (changes?.calendar && Array.isArray(changes.calendar)) {
        for (const item of changes.calendar) {
          const existing = await dbGet('SELECT updated_at, user_id FROM events WHERE id = ?', [item.id]);
          if (!existing || (existing.user_id === userId && item.updated_at > existing.updated_at)) {
            await dbRun(
              `INSERT INTO events (id, title, description, start_time, end_time, location, all_day, calendar_id, user_id, updated_at, deleted)
               VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
               ON CONFLICT(id) DO UPDATE SET
                 title=excluded.title,
                 description=excluded.description,
                 start_time=excluded.start_time,
                 end_time=excluded.end_time,
                 location=excluded.location,
                 all_day=excluded.all_day,
                 calendar_id=excluded.calendar_id,
                 user_id=excluded.user_id,
                 updated_at=excluded.updated_at,
                 deleted=excluded.deleted`,
              [
                item.id,
                item.title,
                item.description,
                item.start_time,
                item.end_time,
                item.location,
                item.all_day ? 1 : 0,
                item.calendar_id || null,
                userId,
                item.updated_at,
                item.deleted ? 1 : 0
              ]
            );
          }
        }
      }

      // Process calendars changes
      if (changes?.calendars && Array.isArray(changes.calendars)) {
        for (const item of changes.calendars) {
          const existing = await dbGet('SELECT updated_at, user_id FROM calendars WHERE id = ?', [item.id]);
          if (!existing || (existing.user_id === userId && item.updated_at > existing.updated_at)) {
            await dbRun(
              `INSERT INTO calendars (id, name, color, user_id, updated_at, deleted)
               VALUES (?, ?, ?, ?, ?, ?)
               ON CONFLICT(id) DO UPDATE SET
                 name=excluded.name,
                 color=excluded.color,
                 user_id=excluded.user_id,
                 updated_at=excluded.updated_at,
                 deleted=excluded.deleted`,
              [
                item.id,
                item.name,
                item.color,
                userId,
                item.updated_at,
                item.deleted ? 1 : 0
              ]
            );
          }
        }
      }

      // Process contacts changes
      if (changes?.contacts && Array.isArray(changes.contacts)) {
        for (const item of changes.contacts) {
          const existing = await dbGet('SELECT updated_at, user_id FROM contacts WHERE id = ?', [item.id]);
          if (!existing || (existing.user_id === userId && item.updated_at > existing.updated_at)) {
            await dbRun(
              `INSERT INTO contacts (id, first_name, last_name, email, phone, phone_2, website, address, birthday, notes, avatar, favorite, photo, user_id, updated_at, deleted)
               VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
               ON CONFLICT(id) DO UPDATE SET
                 first_name=excluded.first_name,
                 last_name=excluded.last_name,
                 email=excluded.email,
                 phone=excluded.phone,
                 phone_2=excluded.phone_2,
                 website=excluded.website,
                 address=excluded.address,
                 birthday=excluded.birthday,
                 notes=excluded.notes,
                 avatar=excluded.avatar,
                 favorite=excluded.favorite,
                 photo=excluded.photo,
                 user_id=excluded.user_id,
                 updated_at=excluded.updated_at,
                 deleted=excluded.deleted`,
              [
                item.id,
                item.first_name,
                item.last_name,
                item.email,
                item.phone,
                item.phone_2,
                item.website,
                item.address,
                item.birthday,
                item.notes,
                item.avatar,
                item.favorite ? 1 : 0,
                item.photo || null,
                userId,
                item.updated_at,
                item.deleted ? 1 : 0
              ]
            );
          }
        }
      }

      // Process notes changes
      if (changes?.notes && Array.isArray(changes.notes)) {
        for (const item of changes.notes) {
          const existing = await dbGet('SELECT updated_at, user_id FROM notes WHERE id = ?', [item.id]);
          if (!existing || (existing.user_id === userId && item.updated_at > existing.updated_at)) {
            await dbRun(
              `INSERT INTO notes (id, title, content, color, favorite, photo, checklist, tags, user_id, updated_at, deleted)
               VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
               ON CONFLICT(id) DO UPDATE SET
                 title=excluded.title,
                 content=excluded.content,
                 color=excluded.color,
                 favorite=excluded.favorite,
                 photo=excluded.photo,
                 checklist=excluded.checklist,
                 tags=excluded.tags,
                 user_id=excluded.user_id,
                 updated_at=excluded.updated_at,
                 deleted=excluded.deleted`,
              [
                item.id,
                item.title,
                item.content,
                item.color,
                item.favorite ? 1 : 0,
                item.photo,
                item.checklist,
                item.tags,
                userId,
                item.updated_at,
                item.deleted ? 1 : 0
              ]
            );
          }
        }
      }

      // 2. Fetch server changes since clientSyncTime scoped to userId
      const serverEvents = await dbAll(
        'SELECT * FROM events WHERE updated_at > ? AND updated_at <= ? AND user_id = ?',
        [clientSyncTime, serverTime, userId]
      );
      const serverCalendars = await dbAll(
        'SELECT * FROM calendars WHERE updated_at > ? AND updated_at <= ? AND user_id = ?',
        [clientSyncTime, serverTime, userId]
      );
      const serverContacts = await dbAll(
        'SELECT * FROM contacts WHERE updated_at > ? AND updated_at <= ? AND user_id = ?',
        [clientSyncTime, serverTime, userId]
      );
      const serverNotes = await dbAll(
        'SELECT * FROM notes WHERE updated_at > ? AND updated_at <= ? AND user_id = ?',
        [clientSyncTime, serverTime, userId]
      );

      // Return server changes to the client
      res.json({
        serverTimestamp: serverTime,
        changes: {
          calendar: serverEvents.map(e => ({ ...e, all_day: e.all_day === 1, deleted: e.deleted === 1 })),
          calendars: serverCalendars.map(c => ({ ...c, deleted: c.deleted === 1 })),
          contacts: serverContacts.map(c => ({ ...c, favorite: c.favorite === 1, deleted: c.deleted === 1 })),
          notes: serverNotes.map(n => ({ ...n, favorite: n.favorite === 1, deleted: n.deleted === 1 }))
        }
      });
    });
  } catch (error) {
    console.error('Sync error:', error);
    res.status(500).json({ error: 'Internal server error during sync' });
  }
});

// Import/Export Endpoints (scoped to user)
app.get('/api/export', authMiddleware, async (req, res) => {
  const userId = req.userId;
  try {
    const events = await dbAll('SELECT * FROM events WHERE user_id = ?', [userId]);
    const contacts = await dbAll('SELECT * FROM contacts WHERE user_id = ?', [userId]);
    const notes = await dbAll('SELECT * FROM notes WHERE user_id = ?', [userId]);
    const calendars = await dbAll('SELECT * FROM calendars WHERE user_id = ?', [userId]);
    res.json({
      exportedAt: Date.now(),
      data: {
        calendar: events,
        contacts,
        notes,
        calendars
      }
    });
  } catch (err) {
    res.status(500).json({ error: 'Failed to export data' });
  }
});

app.post('/api/reset', authMiddleware, async (req, res) => {
  const userId = req.userId;
  try {
    console.log(`Clearing server database tables for user: ${userId}...`);
    await dbRun('DELETE FROM events WHERE user_id = ?', [userId]);
    await dbRun('DELETE FROM contacts WHERE user_id = ?', [userId]);
    await dbRun('DELETE FROM notes WHERE user_id = ?', [userId]);
    await dbRun('DELETE FROM calendars WHERE user_id = ?', [userId]);
    console.log('Server database tables for user cleared.');
    res.json({ message: 'Server database reset successfully' });
  } catch (err) {
    console.error('Failed to reset server database:', err);
    res.status(500).json({ error: 'Failed to reset server database: ' + err.message });
  }
});

app.post('/api/import', authMiddleware, async (req, res) => {
  const { data } = req.body;
  const userId = req.userId;
  if (!data) return res.status(400).json({ error: 'Missing import data' });

  try {
    db.serialize(async () => {
      // Clear and import calendar events
      if (data.calendar) {
        await dbRun('DELETE FROM events WHERE user_id = ?', [userId]);
        for (const item of data.calendar) {
          await dbRun(
            'INSERT INTO events (id, title, description, start_time, end_time, location, all_day, calendar_id, user_id, updated_at, deleted) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)',
            [item.id, item.title, item.description, item.start_time, item.end_time, item.location, item.all_day ? 1 : 0, item.calendar_id || null, userId, item.updated_at || Date.now(), item.deleted ? 1 : 0]
          );
        }
      }

      // Clear and import calendars
      if (data.calendars) {
        await dbRun('DELETE FROM calendars WHERE user_id = ?', [userId]);
        for (const item of data.calendars) {
          await dbRun(
            'INSERT INTO calendars (id, name, color, user_id, updated_at, deleted) VALUES (?, ?, ?, ?, ?, ?)',
            [item.id, item.name, item.color, userId, item.updated_at || Date.now(), item.deleted ? 1 : 0]
          );
        }
      }

      // Clear and import contacts
      if (data.contacts) {
        await dbRun('DELETE FROM contacts WHERE user_id = ?', [userId]);
        for (const item of data.contacts) {
          await dbRun(
            'INSERT INTO contacts (id, first_name, last_name, email, phone, phone_2, website, address, birthday, notes, avatar, favorite, photo, user_id, updated_at, deleted) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)',
            [
              item.id,
              item.first_name,
              item.last_name,
              item.email,
              item.phone,
              item.phone_2,
              item.website,
              item.address,
              item.birthday,
              item.notes,
              item.avatar,
              item.favorite ? 1 : 0,
              item.photo || null,
              userId,
              item.updated_at || Date.now(),
              item.deleted ? 1 : 0
            ]
          );
        }
      }

      // Clear and import notes
      if (data.notes) {
        await dbRun('DELETE FROM notes WHERE user_id = ?', [userId]);
        for (const item of data.notes) {
          await dbRun(
            'INSERT INTO notes (id, title, content, color, favorite, photo, checklist, tags, user_id, updated_at, deleted) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)',
            [item.id, item.title, item.content, item.color, item.favorite ? 1 : 0, item.photo, item.checklist, item.tags || null, userId, item.updated_at || Date.now(), item.deleted ? 1 : 0]
          );
        }
      }

      res.json({ message: 'Data imported successfully' });
    });
  } catch (err) {
    res.status(500).json({ error: 'Import failed: ' + err.message });
  }
});

// WebDAV Endpoint for user syncing
app.all('/:username/webdav/:filename?', express.text({ type: '*/*' }), async (req, res) => {
  const { username, filename } = req.params;
  const method = req.method.toUpperCase();

  // Basic HTTP Auth check
  const user = await authenticateBasic(req, res);
  if (!user) return; // Response is handled inside authenticateBasic

  if (method === 'OPTIONS') {
    res.setHeader('Allow', 'OPTIONS, PROPFIND, GET, PUT, DELETE');
    res.setHeader('DAV', '1');
    return res.status(200).send();
  }

  if (method === 'PROPFIND') {
    res.setHeader('Content-Type', 'application/xml; charset="utf-8"');
    const hrefBase = `/${username}/webdav`;
    let responseXml = '';

    if (!filename) {
      // Directory listing requested
      responseXml = `<?xml version="1.0" encoding="utf-8" ?>
<d:multistatus xmlns:d="DAV:">
  <d:response>
    <d:href>${hrefBase}/</d:href>
    <d:propstat>
      <d:prop>
        <d:resourcetype><d:collection/></d:resourcetype>
        <d:displayname>webdav</d:displayname>
      </d:prop>
      <d:status>HTTP/1.1 200 OK</d:status>
    </d:propstat>
  </d:response>
  <d:response>
    <d:href>${hrefBase}/calendar.ics</d:href>
    <d:propstat>
      <d:prop>
        <d:resourcetype/>
        <d:getcontenttype>text/calendar</d:getcontenttype>
        <d:displayname>calendar.ics</d:displayname>
      </d:prop>
      <d:status>HTTP/1.1 200 OK</d:status>
    </d:propstat>
  </d:response>
  <d:response>
    <d:href>${hrefBase}/contacts.vcf</d:href>
    <d:propstat>
      <d:prop>
        <d:resourcetype/>
        <d:getcontenttype>text/vcard</d:getcontenttype>
        <d:displayname>contacts.vcf</d:displayname>
      </d:prop>
      <d:status>HTTP/1.1 200 OK</d:status>
    </d:propstat>
  </d:response>
</d:multistatus>`;
    } else if (filename === 'calendar.ics') {
      responseXml = `<?xml version="1.0" encoding="utf-8" ?>
<d:multistatus xmlns:d="DAV:">
  <d:response>
    <d:href>${hrefBase}/calendar.ics</d:href>
    <d:propstat>
      <d:prop>
        <d:resourcetype/>
        <d:getcontenttype>text/calendar</d:getcontenttype>
        <d:displayname>calendar.ics</d:displayname>
      </d:prop>
      <d:status>HTTP/1.1 200 OK</d:status>
    </d:propstat>
  </d:response>
</d:multistatus>`;
    } else if (filename === 'contacts.vcf') {
      responseXml = `<?xml version="1.0" encoding="utf-8" ?>
<d:multistatus xmlns:d="DAV:">
  <d:response>
    <d:href>${hrefBase}/contacts.vcf</d:href>
    <d:propstat>
      <d:prop>
        <d:resourcetype/>
        <d:getcontenttype>text/vcard</d:getcontenttype>
        <d:displayname>contacts.vcf</d:displayname>
      </d:prop>
      <d:status>HTTP/1.1 200 OK</d:status>
    </d:propstat>
  </d:response>
</d:multistatus>`;
    } else {
      return res.status(404).send('Not Found');
    }
    return res.status(207).send(responseXml);
  }

  if (method === 'GET') {
    if (filename === 'calendar.ics') {
      try {
        const events = await dbAll('SELECT * FROM events WHERE user_id = ? AND deleted = 0', [user.id]);
        const ics = serializeToIcs(events);
        res.setHeader('Content-Type', 'text/calendar; charset="utf-8"');
        return res.status(200).send(ics);
      } catch (err) {
        return res.status(500).send('Failed to generate calendar ICS');
      }
    } else if (filename === 'contacts.vcf') {
      try {
        const contacts = await dbAll('SELECT * FROM contacts WHERE user_id = ? AND deleted = 0', [user.id]);
        const vcf = serializeToVcf(contacts);
        res.setHeader('Content-Type', 'text/vcard; charset="utf-8"');
        return res.status(200).send(vcf);
      } catch (err) {
        return res.status(500).send('Failed to generate contacts VCF');
      }
    } else {
      return res.status(404).send('File Not Found');
    }
  }

  if (method === 'PUT') {
    const rawData = req.body || '';
    if (filename === 'calendar.ics') {
      try {
        const events = parseIcs(rawData);
        await dbRun('DELETE FROM events WHERE user_id = ?', [user.id]);
        const defaultCal = await dbGet('SELECT id FROM calendars WHERE user_id = ? LIMIT 1', [user.id]);
        let calendarId = defaultCal ? defaultCal.id : null;
        if (!calendarId) {
          calendarId = crypto.randomUUID();
          await dbRun('INSERT INTO calendars (id, name, color, user_id, updated_at) VALUES (?, ?, ?, ?, ?)',
            [calendarId, 'Personal', '#6750A4', user.id, Date.now()]);
        }

        for (const ev of events) {
          await dbRun(
            'INSERT INTO events (id, title, description, start_time, end_time, location, all_day, calendar_id, user_id, updated_at, deleted) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)',
            [ev.id || crypto.randomUUID(), ev.title, ev.description || '', ev.start_time, ev.end_time || ev.start_time, ev.location || '', ev.all_day ? 1 : 0, calendarId, user.id, Date.now(), 0]
          );
        }
        return res.status(200).send('Calendar updated successfully via WebDAV');
      } catch (err) {
        return res.status(500).send('Failed to save calendar data: ' + err.message);
      }
    } else if (filename === 'contacts.vcf') {
      try {
        const contacts = parseVcf(rawData);
        await dbRun('DELETE FROM contacts WHERE user_id = ?', [user.id]);
        for (const c of contacts) {
          await dbRun(
            'INSERT INTO contacts (id, first_name, last_name, email, phone, phone_2, website, address, birthday, notes, avatar, favorite, photo, user_id, updated_at, deleted) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)',
            [crypto.randomUUID(), c.first_name, c.last_name, c.email, c.phone, '', c.website || '', c.address || '', c.birthday || '', c.notes || '', '', 0, null, user.id, Date.now(), 0]
          );
        }
        return res.status(200).send('Contacts updated successfully via WebDAV');
      } catch (err) {
        return res.status(500).send('Failed to save contacts data: ' + err.message);
      }
    } else {
      return res.status(404).send('Write location not supported');
    }
  }

  if (method === 'DELETE') {
    if (filename === 'calendar.ics') {
      await dbRun('DELETE FROM events WHERE user_id = ?', [user.id]);
      return res.status(200).send('Calendar deleted');
    } else if (filename === 'contacts.vcf') {
      await dbRun('DELETE FROM contacts WHERE user_id = ?', [user.id]);
      return res.status(200).send('Contacts deleted');
    }
    return res.status(404).send('Target not found');
  }

  res.status(405).send('Method Not Allowed');
});

// Serve frontend static assets in production
const frontendBuildPath = join(__dirname, 'frontend', 'dist');
if (fs.existsSync(frontendBuildPath)) {
  app.use(express.static(frontendBuildPath));
  app.get('*', (req, res) => {
    res.sendFile(join(frontendBuildPath, 'index.html'));
  });
} else {
  app.get('/', (req, res) => {
    res.send('Sync server is running. Frontend build not found. Run dev server for development.');
  });
}

// Start Server
app.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);
});
