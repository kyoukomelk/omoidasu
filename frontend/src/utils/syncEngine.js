// Local-first synchronization engine

const getApiBase = () => {
  if (typeof window === 'undefined') {
    return 'http://localhost:8080/api';
  }
  const { protocol, hostname, port } = window.location;
  // If Vite dev server, assume backend is on port 8080
  if (port === '5173') {
    return `${protocol}//${hostname}:8080/api`;
  }
  // Otherwise, use the port the app was loaded from (e.g. Docker port mappings, reverse proxies)
  return `${protocol}//${hostname}${port ? ':' + port : ''}/api`;
};

const API_BASE = getApiBase();
const SYNC_URL = `${API_BASE}/sync`;

function generateUUID() {
  if (typeof window !== 'undefined' && window.crypto && window.crypto.randomUUID) {
    return window.crypto.randomUUID();
  }
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
    const r = Math.random() * 16 | 0;
    const v = c === 'x' ? r : (r & 0x3 | 0x8);
    return v.toString(16);
  });
}

// List of registered subscribers to update UI on changes
let subscribers = [];

// Helper to notify subscribers
function notify() {
  subscribers.forEach(cb => cb());
}

// Initial structure for empty database
const getInitialState = () => ({
  calendar: {},
  calendars: {}, // Keep calendar meta (names, colors)
  contacts: {},
  notes: {},
  lastSyncTimestamp: 0,
  syncStatus: 'synced' // 'synced' | 'syncing' | 'offline' | 'error'
});

// Active sessions storage helpers
function getActiveSessions() {
  try {
    const data = localStorage.getItem('omoidasu_active_sessions');
    if (!data) return { sessions: [], activeSessionUserId: null };
    const parsed = JSON.parse(data);
    if (!parsed || typeof parsed !== 'object' || !Array.isArray(parsed.sessions)) {
      return { sessions: [], activeSessionUserId: null };
    }
    return parsed;
  } catch (e) {
    return { sessions: [], activeSessionUserId: null };
  }
}

function saveActiveSessions(sessionsObj) {
  localStorage.setItem('omoidasu_active_sessions', JSON.stringify(sessionsObj));
}

function getActiveToken() {
  const data = getActiveSessions();
  const active = data.sessions.find(s => s.userId === data.activeSessionUserId);
  return active ? active.token : null;
}

// Load state from localStorage
function loadState() {
  const sessions = getActiveSessions();
  const userId = sessions.activeSessionUserId;
  if (!userId) {
    return getInitialState();
  }
  const key = `sync_app_data_${userId}`;
  const data = localStorage.getItem(key);
  if (!data) {
    const fresh = getInitialState();
    saveState(fresh);
    return fresh;
  }
  try {
    const parsed = JSON.parse(data);
    if (!parsed || typeof parsed !== 'object') {
      const fresh = getInitialState();
      saveState(fresh);
      return fresh;
    }
    return parsed;
  } catch (e) {
    console.error('Failed to parse local storage data, resetting', e);
    const fresh = getInitialState();
    saveState(fresh);
    return fresh;
  }
}

// Save state to localStorage
function saveState(state) {
  const sessions = getActiveSessions();
  const userId = sessions.activeSessionUserId;
  if (!userId) return;
  const key = `sync_app_data_${userId}`;
  try {
    localStorage.setItem(key, JSON.stringify(state));
  } catch (e) {
    if (e.name === 'QuotaExceededError' || e.name === 'NS_ERROR_DOM_QUOTA_REACHED' || e.code === 22) {
      alert('Local browser storage limit exceeded. The image file might be too large to save offline. Please select a smaller image or compress it.');
    } else {
      console.error('Failed to save state to localStorage:', e);
    }
  }
}

// Exported APIs for components
export const syncEngine = {
  // Subscribe to changes (returns unsubscribe function)
  subscribe(callback) {
    subscribers.push(callback);
    return () => {
      subscribers = subscribers.filter(cb => cb !== callback);
    };
  },

  // Get current sync status
  getSyncStatus() {
    return loadState().syncStatus || 'synced';
  },

  // Set sync status
  setSyncStatus(status) {
    const state = loadState();
    state.syncStatus = status;
    saveState(state);
    notify();
  },

  // Get active session user
  getActiveUser() {
    const data = getActiveSessions();
    return data.sessions.find(s => s.userId === data.activeSessionUserId) || null;
  },

  // Get list of saved accounts on device
  getSavedAccounts() {
    const data = getActiveSessions();
    return data.sessions.map(s => ({
      userId: s.userId,
      username: s.username,
      displayName: s.displayName,
      birthday: s.birthday,
      location: s.location,
      profilePicture: s.profilePicture || '',
      isAdmin: s.isAdmin || false,
      themeHue: s.themeHue,
      themeMode: s.themeMode
    }));
  },

  // Register
  async register(username, password, displayName, birthday, location, profilePicture) {
    const response = await fetch(`${API_BASE}/auth/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username, password, displayName, birthday, location, profilePicture })
    });
    if (!response.ok) {
      const err = await response.json();
      throw new Error(err.error || 'Registration failed');
    }
    const result = await response.json();
    const { token, user } = result;

    const data = getActiveSessions();
    data.sessions = data.sessions.filter(s => s.userId !== user.id);
    data.sessions.push({
      userId: user.id,
      username: user.username,
      displayName: user.displayName,
      birthday: user.birthday,
      location: user.location,
      profilePicture: user.profilePicture || '',
      isAdmin: user.isAdmin || false,
      themeHue: user.themeHue,
      themeMode: user.themeMode,
      token
    });
    data.activeSessionUserId = user.id;
    saveActiveSessions(data);
    
    // Set theme and dynamic variables
    localStorage.setItem('theme_mode', user.themeMode || 'light');
    localStorage.setItem('theme_hue', user.themeHue || '270');
    document.documentElement.setAttribute('data-theme-mode', user.themeMode || 'light');
    document.documentElement.style.setProperty('--theme-hue', user.themeHue || '270');

    notify();
    
    // Sync initial state
    await this.sync();
    return user;
  },

  // Get all registered users from server
  async getAllUsers() {
    const response = await fetch(`${API_BASE}/auth/users`);
    if (!response.ok) {
      throw new Error('Failed to fetch users from server');
    }
    return await response.json();
  },

  // Login
  async login(username, password) {
    const response = await fetch(`${API_BASE}/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username, password })
    });
    if (!response.ok) {
      const err = await response.json();
      throw new Error(err.error || 'Login failed');
    }
    const result = await response.json();
    const { token, user } = result;

    const data = getActiveSessions();
    data.sessions = data.sessions.filter(s => s.userId !== user.id);
    data.sessions.push({
      userId: user.id,
      username: user.username,
      displayName: user.displayName,
      birthday: user.birthday,
      location: user.location,
      profilePicture: user.profilePicture || '',
      isAdmin: user.isAdmin || false,
      themeHue: user.themeHue,
      themeMode: user.themeMode,
      token
    });
    data.activeSessionUserId = user.id;
    saveActiveSessions(data);

    // Set theme and dynamic variables
    localStorage.setItem('theme_mode', user.themeMode || 'light');
    localStorage.setItem('theme_hue', user.themeHue || '270');
    document.documentElement.setAttribute('data-theme-mode', user.themeMode || 'light');
    document.documentElement.style.setProperty('--theme-hue', user.themeHue || '270');

    notify();

    // Sync initial state
    await this.sync();
    return user;
  },

  // Switch to an already authenticated saved account
  switchAccount(userId) {
    const data = getActiveSessions();
    const target = data.sessions.find(s => s.userId === userId);
    if (!target) throw new Error('Account not found on device');
    data.activeSessionUserId = userId;
    saveActiveSessions(data);

    // Set theme and dynamic variables
    localStorage.setItem('theme_mode', target.themeMode || 'light');
    localStorage.setItem('theme_hue', target.themeHue || '270');
    document.documentElement.setAttribute('data-theme-mode', target.themeMode || 'light');
    document.documentElement.style.setProperty('--theme-hue', target.themeHue || '270');

    notify();
    this.sync();
  },

  // Logout current active account or remove session
  logout() {
    const data = getActiveSessions();
    const currentId = data.activeSessionUserId;
    if (currentId) {
      data.sessions = data.sessions.filter(s => s.userId !== currentId);
      data.activeSessionUserId = data.sessions.length > 0 ? data.sessions[0].userId : null;
      saveActiveSessions(data);

      const nextActive = data.sessions.find(s => s.userId === data.activeSessionUserId);
      if (nextActive) {
        localStorage.setItem('theme_mode', nextActive.themeMode || 'light');
        localStorage.setItem('theme_hue', nextActive.themeHue || '270');
        document.documentElement.setAttribute('data-theme-mode', nextActive.themeMode || 'light');
        document.documentElement.style.setProperty('--theme-hue', nextActive.themeHue || '270');
      } else {
        // Clear active settings
        localStorage.removeItem('theme_mode');
        localStorage.removeItem('theme_hue');
      }

      notify();
    }
  },

  // Delete account completely from server and local storage
  async deleteAccount() {
    const token = getActiveToken();
    if (!token) return;
    const response = await fetch(`${API_BASE}/auth/delete-account`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${token}`
      }
    });
    if (!response.ok) {
      const err = await response.json();
      throw new Error(err.error || 'Failed to delete account');
    }
    
    // Clear local storage partitions for this user
    const sessions = getActiveSessions();
    const currentId = sessions.activeSessionUserId;
    if (currentId) {
      localStorage.removeItem(`sync_app_data_${currentId}`);
      localStorage.removeItem(`omoidasu_onboarded_${currentId}`);
      
      // Remove session
      sessions.sessions = sessions.sessions.filter(s => s.userId !== currentId);
      sessions.activeSessionUserId = sessions.sessions.length > 0 ? sessions.sessions[0].userId : null;
      saveActiveSessions(sessions);
      
      const nextActive = sessions.sessions.find(s => s.userId === sessions.activeSessionUserId);
      if (nextActive) {
        localStorage.setItem('theme_mode', nextActive.themeMode || 'dark');
        localStorage.setItem('theme_hue', nextActive.themeHue || '270');
        document.documentElement.setAttribute('data-theme-mode', nextActive.themeMode || 'dark');
        document.documentElement.style.setProperty('--theme-hue', nextActive.themeHue || '270');
      } else {
        localStorage.removeItem('theme_mode');
        localStorage.removeItem('theme_hue');
      }
      notify();
    }
  },

  // Update profile
  async updateProfile(profile) {
    const token = getActiveToken();
    if (!token) return;

    const activeUser = this.getActiveUser();
    const currentDisplayName = activeUser ? (activeUser.displayName || activeUser.username) : '';
    const currentBirthday = activeUser ? (activeUser.birthday || '') : '';
    const currentLocation = activeUser ? (activeUser.location || '') : '';
    const currentProfilePicture = activeUser ? (activeUser.profilePicture || '') : '';

    // Update local active session metadata FIRST so it is persistent and responsive
    const data = getActiveSessions();
    const active = data.sessions.find(s => s.userId === data.activeSessionUserId);
    if (active) {
      if (profile.displayName !== undefined) active.displayName = profile.displayName;
      else if (profile.name !== undefined) active.displayName = profile.name;
      
      if (profile.birthday !== undefined) active.birthday = profile.birthday;
      if (profile.location !== undefined) active.location = profile.location;
      if (profile.profilePicture !== undefined) active.profilePicture = profile.profilePicture;
      if (profile.themeHue !== undefined) active.themeHue = profile.themeHue;
      if (profile.themeMode !== undefined) active.themeMode = profile.themeMode;
      saveActiveSessions(data);

      // Apply theme changes to browser styling instantly
      localStorage.setItem('theme_mode', active.themeMode);
      localStorage.setItem('theme_hue', active.themeHue);
      document.documentElement.setAttribute('data-theme-mode', active.themeMode);
      document.documentElement.style.setProperty('--theme-hue', active.themeHue);
    }
    notify();

    // Now try to update the server in the background
    try {
      const response = await fetch(`${API_BASE}/auth/update-profile`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          displayName: profile.displayName !== undefined ? profile.displayName : (profile.name !== undefined ? profile.name : currentDisplayName),
          birthday: profile.birthday !== undefined ? profile.birthday : currentBirthday,
          location: profile.location !== undefined ? profile.location : currentLocation,
          profilePicture: profile.profilePicture !== undefined ? profile.profilePicture : currentProfilePicture,
          themeHue: profile.themeHue !== undefined ? profile.themeHue : (localStorage.getItem('theme_hue') || '270'),
          themeMode: profile.themeMode !== undefined ? profile.themeMode : (localStorage.getItem('theme_mode') || 'light')
        })
      });
      if (!response.ok) {
        const err = await response.json();
        console.warn('Server profile update rejected:', err.error);
      }
    } catch (err) {
      console.warn('Server profile update failed (offline):', err.message);
    }
  },

  // Get system settings
  async getSystemSettings() {
    const response = await fetch(`${API_BASE}/system/settings`);
    if (!response.ok) throw new Error('Failed to load system settings');
    return await response.json();
  },

  // Update system settings (admin only)
  async updateSystemSettings(registrationDisabled) {
    const token = getActiveToken();
    if (!token) return;
    const response = await fetch(`${API_BASE}/system/settings`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`
      },
      body: JSON.stringify({ registrationDisabled })
    });
    if (!response.ok) {
      const err = await response.json();
      throw new Error(err.error || 'Failed to update system settings');
    }
    return await response.json();
  },

  // Wipe all users from system (admin only)
  async wipeAllUsers() {
    const token = getActiveToken();
    if (!token) return;
    const response = await fetch(`${API_BASE}/system/wipe-users`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${token}`
      }
    });
    if (!response.ok) {
      const err = await response.json();
      throw new Error(err.error || 'Failed to delete all users');
    }
    // Clear all local storage data to start completely fresh
    localStorage.clear();
    notify();
  },

  // Toggle user admin status (admin only)
  async toggleUserAdmin(targetUserId, makeAdmin) {
    const token = getActiveToken();
    if (!token) return;
    const response = await fetch(`${API_BASE}/system/toggle-admin`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`
      },
      body: JSON.stringify({ targetUserId, makeAdmin })
    });
    if (!response.ok) {
      const err = await response.json();
      throw new Error(err.error || 'Failed to update user privilege');
    }
    return await response.json();
  },

  // Get all active items of a given type
  getItems(type) {
    const state = loadState();
    const collection = state[type] || {};
    return Object.values(collection).filter(item => !item.deleted);
  },

  // Get a single item by id
  getItem(type, id) {
    const state = loadState();
    const item = state[type]?.[id];
    return item && !item.deleted ? item : null;
  },

  // Save/Update an item
  saveItem(type, item) {
    const state = loadState();
    if (!state[type]) state[type] = {};

    const now = Date.now();
    const id = item.id || generateUUID();

    const existing = state[type][id] || {};

    const updatedItem = {
      ...existing,
      ...item,
      id,
      updated_at: now,
      deleted: false
    };

    state[type][id] = updatedItem;
    saveState(state);
    notify();

    // Trigger background sync
    this.sync();
    return updatedItem;
  },

  // Mark an item as deleted
  deleteItem(type, id) {
    const state = loadState();
    if (!state[type] || !state[type][id]) return;

    state[type][id] = {
      ...state[type][id],
      deleted: true,
      updated_at: Date.now()
    };

    saveState(state);
    notify();

    // Trigger background sync
    this.sync();
  },

  // Trigger sync process
  async sync() {
    const token = getActiveToken();
    if (!token) return; // Silent return if not authenticated

    const state = loadState();
    
    // Avoid concurrent syncing
    if (state.syncStatus === 'syncing') return;

    this.setSyncStatus('syncing');

    const lastSyncTimestamp = state.lastSyncTimestamp || 0;

    // Gather local changes since last sync timestamp
    const changes = {
      calendar: [],
      calendars: [],
      contacts: [],
      notes: []
    };

    const types = ['calendar', 'calendars', 'contacts', 'notes'];
    types.forEach(type => {
      Object.values(state[type] || {}).forEach(item => {
        if (item.updated_at > lastSyncTimestamp) {
          changes[type].push(item);
        }
      });
    });

    try {
      const response = await fetch(SYNC_URL, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          lastSyncTimestamp,
          changes
        })
      });

      if (!response.ok) {
        throw new Error(`Server returned HTTP ${response.status}`);
      }

      const result = await response.json();
      const serverChanges = result.changes;
      const serverTimestamp = result.serverTimestamp;

      // Merge server changes back into local storage
      const newState = loadState();
      
      types.forEach(type => {
        if (serverChanges[type]) {
          serverChanges[type].forEach(srvItem => {
            const localItem = newState[type]?.[srvItem.id];
            // If item doesn't exist locally, or server version is newer, apply server changes
            if (!localItem || srvItem.updated_at > localItem.updated_at) {
              if (!newState[type]) newState[type] = {};
              newState[type][srvItem.id] = srvItem;
            }
          });
        }
      });

      newState.lastSyncTimestamp = serverTimestamp;
      newState.syncStatus = 'synced';
      saveState(newState);
      notify();
      console.log('Synchronization complete. New sync timestamp:', serverTimestamp);

    } catch (error) {
      console.warn('Sync failed, app is offline or server unreachable:', error.message);
      this.setSyncStatus('offline');
    }
  },

  importState(newData) {
    const state = loadState();
    
    const types = ['calendar', 'calendars', 'contacts', 'notes'];
    types.forEach(type => {
      state[type] = {};
      if (newData[type]) {
        newData[type].forEach(item => {
          state[type][item.id] = item;
        });
      }
    });

    state.lastSyncTimestamp = Date.now();
    state.syncStatus = 'synced';
    saveState(state);
    notify();
  },

  // Reset entire local state and remote database
  resetLocalState() {
    const token = getActiveToken();
    saveState(getInitialState());
    notify();
    
    if (token) {
      const resetUrl = SYNC_URL.replace('/sync', '/reset');
      fetch(resetUrl, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`
        }
      }).catch(e => {
        console.warn('Server reset request failed:', e.message);
      });
    }
  }
};

// Automatic online recovery listener
if (typeof window !== 'undefined') {
  window.addEventListener('online', () => {
    console.log('App is online. Triggering sync...');
    syncEngine.sync();
  });
}
