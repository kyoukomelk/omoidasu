import React, { useState, useEffect } from 'react';
import { syncEngine } from '../utils/syncEngine';

const M3_PALETTE_COLORS = [
  '#6750A4', // Purple
  '#0061A4', // Blue
  '#386A20', // Green
  '#A63E2B', // Red
  '#8C4F00', // Orange
  '#006A6A', // Teal
  '#605D62', // Muted Gray
  '#D32F2F', // Deep Red
  '#1976D2', // Muted Blue
  '#388E3C', // Muted Green
  '#FBC02D'  // Amber Yellow
];

const mapHue = (hue) => {
  if (['sakura-pink', 'light-blue', 'monochrome', 'dark-orange', 'dark-purple'].includes(hue)) {
    return hue;
  }
  if (hue === '270') return 'dark-purple';
  if (hue === '170' || hue === '210') return 'light-blue';
  if (hue === '30' || hue === '0') return 'dark-orange';
  return 'sakura-pink';
};

export default function SettingsView({ userProfile, onUpdateProfile }) {
  const [syncStatus, setSyncStatus] = useState(syncEngine.getSyncStatus());
  const [themeMode, setThemeMode] = useState(document.documentElement.getAttribute('data-theme-mode') || 'light');
  const [themeHue, setThemeHue] = useState(() => {
    const user = syncEngine.getActiveUser();
    const hue = user ? (user.themeHue || 'sakura-pink') : (localStorage.getItem('theme_hue') || 'sakura-pink');
    return mapHue(hue);
  });
  const [activeTab, setActiveTab] = useState('user'); // 'user' | 'sync' | 'backup' | 'system'

  // Profile Editor States
  const [profileName, setProfileName] = useState(userProfile?.name || '');
  const [profileBirthday, setProfileBirthday] = useState(userProfile?.birthday || '');
  const [profileLocation, setProfileLocation] = useState(userProfile?.location || '');
  const [profilePicture, setProfilePicture] = useState(userProfile?.profilePicture || '');

  // Admin settings state
  const [adminRegDisabled, setAdminRegDisabled] = useState(false);
  const [wipeConfirm, setWipeConfirm] = useState(false);
  const [systemUsers, setSystemUsers] = useState([]);

  const handleImageUpload = (e) => {
    const file = e.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (event) => {
      const img = new Image();
      img.onload = () => {
        const canvas = document.createElement('canvas');
        const MAX_WIDTH = 150;
        const MAX_HEIGHT = 150;
        let width = img.width;
        let height = img.height;

        if (width > height) {
          if (width > MAX_WIDTH) {
            height *= MAX_WIDTH / width;
            width = MAX_WIDTH;
          }
        } else {
          if (height > MAX_HEIGHT) {
            width *= MAX_HEIGHT / height;
            height = MAX_HEIGHT;
          }
        }
        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext('2d');
        ctx.drawImage(img, 0, 0, width, height);
        const dataUrl = canvas.toDataURL('image/jpeg', 0.85);
        setProfilePicture(dataUrl);
      };
      img.src = event.target.result;
    };
    reader.readAsDataURL(file);
  };
  
  // Inline confirmation & feedback states
  const [showRerunConfirm, setShowRerunConfirm] = useState(false);
  const [showResetConfirm, setShowResetConfirm] = useState(false);
  const [resetFeedback, setResetFeedback] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);

  // Dynamic counts and calendars
  const [contactsCount, setContactsCount] = useState(0);
  const [eventsCount, setEventsCount] = useState(0);
  const [calendars, setCalendars] = useState([]);
  const [showColorPickerFor, setShowColorPickerFor] = useState(null);

  const loadData = () => {
    setContactsCount(syncEngine.getItems('contacts').length);
    setEventsCount(syncEngine.getItems('calendar').length);
    setCalendars(syncEngine.getItems('calendars'));
  };

  useEffect(() => {
    loadData();
    const handleSyncChange = () => {
      setSyncStatus(syncEngine.getSyncStatus());
      loadData();
      const user = syncEngine.getActiveUser();
      if (user) {
        setThemeHue(mapHue(user.themeHue || 'sakura-pink'));
        setThemeMode(user.themeMode || 'dark');
      }
    };
    return syncEngine.subscribe(handleSyncChange);
  }, []);

  // Sync profile edits & Admin Settings
  useEffect(() => {
    if (userProfile) {
      setProfileName(userProfile.name || '');
      setProfileBirthday(userProfile.birthday || '');
      setProfileLocation(userProfile.location || '');
      setProfilePicture(userProfile.profilePicture || '');

      if (userProfile.isAdmin) {
        const loadAdminSettings = async () => {
          try {
            const settings = await syncEngine.getSystemSettings();
            setAdminRegDisabled(settings.registrationDisabled);
          } catch (e) {
            console.error('Failed to load admin settings:', e);
          }
        };
        loadAdminSettings();
      }
    }
  }, [userProfile]);

  const loadSystemUsers = async () => {
    try {
      const users = await syncEngine.getAllUsers();
      setSystemUsers(users);
    } catch (e) {
      console.error('Failed to load system users:', e);
    }
  };

  useEffect(() => {
    if (activeTab === 'system' && userProfile?.isAdmin) {
      loadSystemUsers();
    }
  }, [activeTab, userProfile]);

  const handleToggleUserAdmin = async (targetUserId, currentIsAdmin) => {
    try {
      await syncEngine.toggleUserAdmin(targetUserId, !currentIsAdmin);
      await loadSystemUsers();
    } catch (err) {
      alert('Failed to update admin privilege: ' + err.message);
    }
  };

  const handleToggleRegistration = async (e) => {
    const newVal = e.target.checked;
    setAdminRegDisabled(newVal);
    try {
      await syncEngine.updateSystemSettings(newVal);
    } catch (err) {
      alert('Failed to update system settings: ' + err.message);
      setAdminRegDisabled(!newVal); // revert
    }
  };

  const handleSaveProfile = async (e) => {
    e.preventDefault();
    try {
      await syncEngine.updateProfile({
        displayName: profileName.trim(),
        birthday: profileBirthday,
        location: profileLocation.trim(),
        profilePicture: profilePicture
      });
      onUpdateProfile({
        ...userProfile,
        name: profileName.trim() || 'Guest',
        birthday: profileBirthday,
        location: profileLocation.trim(),
        profilePicture: profilePicture
      });
      alert('Profile updated successfully!');
    } catch (err) {
      alert('Failed to save profile: ' + err.message);
    }
  };

  // Theme Toggles
  const handleThemeModeChange = async (mode) => {
    setThemeMode(mode);
    document.documentElement.setAttribute('data-theme-mode', mode);
    localStorage.setItem('theme_mode', mode);
    try {
      await syncEngine.updateProfile({ themeMode: mode });
    } catch (e) {
      console.error('Failed to update theme mode on server:', e);
    }
  };

  const handleHueChange = async (hue) => {
    setThemeHue(hue);
    document.documentElement.setAttribute('data-theme-color', hue);
    localStorage.setItem('theme_hue', hue);
    try {
      await syncEngine.updateProfile({ themeHue: hue });
    } catch (e) {
      console.error('Failed to update theme hue on server:', e);
    }
  };

  // Sync Logic
  const handleForceSync = () => {
    syncEngine.sync();
  };

  // Export Data
  const handleExport = async () => {
    try {
      const stateData = localStorage.getItem('sync_app_data');
      if (!stateData) {
        alert('No local data to export.');
        return;
      }
      const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(stateData);
      const downloadAnchor = document.createElement('a');
      downloadAnchor.setAttribute("href", dataStr);
      downloadAnchor.setAttribute("download", `m3-sync-backup-${new Date().toISOString().split('T')[0]}.json`);
      document.body.appendChild(downloadAnchor);
      downloadAnchor.click();
      downloadAnchor.remove();
    } catch (e) {
      alert('Failed to export data: ' + e.message);
    }
  };

  // Import Data
  const handleImport = (e) => {
    const fileReader = new FileReader();
    const file = e.target.files[0];
    if (!file) return;

    fileReader.onload = event => {
      try {
        const parsed = JSON.parse(event.target.result);
        if (parsed && (parsed.calendar || parsed.contacts || parsed.notes)) {
          syncEngine.importState(parsed);
          alert('Data imported successfully!');
          syncEngine.sync();
        } else {
          alert('Invalid backup file structure.');
        }
      } catch (err) {
        alert('Failed to import JSON: ' + err.message);
      }
      e.target.value = '';
    };
    fileReader.readAsText(file);
  };

  const parseIcsDate = (value) => {
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
  };


  const handleIcsImport = (e) => {
    const files = Array.from(e.target.files);
    if (files.length === 0) return;

    let totalImported = 0;
    let filesProcessed = 0;

    files.forEach(file => {
      const fileReader = new FileReader();
      fileReader.onload = event => {
        try {
          const text = event.target.result;
          const unfolded = text.replace(/\r?\n[ \t]/g, '');
          const lines = unfolded.split(/\r?\n/);
          
          const importedEvents = [];
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
                importedEvents.push(currentEvent);
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

          if (importedEvents.length > 0) {
            const calendarName = file.name.replace(/\.ics$/i, '') || 'Imported Calendar';
            const currentCals = syncEngine.getItems('calendars');
            let targetCal = currentCals.find(c => c.name.toLowerCase() === calendarName.toLowerCase());
            if (!targetCal) {
              const randomColor = M3_PALETTE_COLORS[Math.floor(Math.random() * M3_PALETTE_COLORS.length)];
              targetCal = syncEngine.saveItem('calendars', {
                name: calendarName,
                color: randomColor
              });
            }

            importedEvents.forEach(evt => {
              if (!evt.end_time && evt.start_time) {
                evt.end_time = evt.start_time;
              }
              evt.calendar_id = targetCal.id;
              syncEngine.saveItem('calendar', evt);
            });
            totalImported += importedEvents.length;
          }
        } catch (err) {
          console.error('Failed to parse ICS file:', file.name, err.message);
        }

        filesProcessed++;
        if (filesProcessed === files.length) {
          if (totalImported > 0) {
            alert(`Successfully imported ${totalImported} calendar events from ${files.length} file(s)!`);
            syncEngine.sync();
          } else {
            alert('No valid events found in the selected ICS file(s).');
          }
          e.target.value = '';
        }
      };
      fileReader.readAsText(file);
    });
  };

  const handleVcfImport = (e) => {
    const files = Array.from(e.target.files);
    if (files.length === 0) return;

    let totalImported = 0;
    let filesProcessed = 0;

    files.forEach(file => {
      const fileReader = new FileReader();
      fileReader.onload = event => {
        try {
          const text = event.target.result;
          const unfolded = text.replace(/\r?\n[ \t]/g, '');
          const lines = unfolded.split(/\r?\n/);
          
          const importedContacts = [];
          let currentContact = null;
          let inContact = false;

          for (const line of lines) {
            const trimmed = line.trim();
            if (!trimmed) continue;

            if (trimmed === 'BEGIN:VCARD') {
              currentContact = {};
              inContact = true;
              continue;
            }

            if (trimmed === 'END:VCARD') {
              if (currentContact && (currentContact.first_name || currentContact.last_name)) {
                currentContact.phone = JSON.stringify(currentContact.phone || []);
                currentContact.email = JSON.stringify(currentContact.email || []);
                importedContacts.push(currentContact);
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
                if (!currentContact.phone) {
                  currentContact.phone = [];
                }
                currentContact.phone.push(cleanValue);
              } else if (name === 'EMAIL') {
                if (!currentContact.email) {
                  currentContact.email = [];
                }
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

          if (importedContacts.length > 0) {
            importedContacts.forEach(c => {
              syncEngine.saveItem('contacts', c);
            });
            totalImported += importedContacts.length;
          }
        } catch (err) {
          console.error('Failed to parse VCF file:', file.name, err.message);
        }

        filesProcessed++;
        if (filesProcessed === files.length) {
          if (totalImported > 0) {
            alert(`Successfully imported ${totalImported} contacts from ${files.length} file(s)!`);
            syncEngine.sync();
          } else {
            alert('No valid contacts found in the selected VCF file(s).');
          }
          e.target.value = '';
        }
      };
      fileReader.readAsText(file);
    });
  };

  const hues = [
    { name: 'Sakura Pink', value: 'sakura-pink', color: '#f5a9b8' },
    { name: 'Light Blue', value: 'light-blue', color: '#5bcefa' },
    { name: 'Monochrome', value: 'monochrome', color: '#888888' },
    { name: 'Dark Orange', value: 'dark-orange', color: '#d62e02' },
    { name: 'Dark Purple', value: 'dark-purple', color: '#a20160' }
  ];

  return (
    <div className="view-container" style={{ height: '100%', maxWidth: '600px', margin: '0 auto', width: '100%', gap: '1.5rem', overflowY: 'auto', paddingBottom: '80px' }}>
      <div className="view-header">
        <h2>Settings</h2>
      </div>

      {/* Settings Segmented Tabs */}
      <div className="settings-tabs" style={{
        display: 'flex',
        background: 'var(--color-surface-container-high)',
        borderRadius: '16px',
        padding: '4px',
        width: '100%',
        boxSizing: 'border-box',
        marginBottom: '1rem',
        border: '1px solid var(--color-outline-variant)'
      }}>
        {[
          { id: 'user', label: 'User', icon: 'person' },
          { id: 'sync', label: 'Sync & Calendars', icon: 'sync' },
          { id: 'backup', label: 'Backup & Imports', icon: 'backup' },
          { id: 'system', label: 'System', icon: 'settings' }
        ].map(tab => (
          <button
            key={tab.id}
            type="button"
            className="settings-tab-btn"
            onClick={() => setActiveTab(tab.id)}
            style={{
              flex: 1,
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '4px',
              padding: '8px 4px',
              border: 'none',
              background: activeTab === tab.id ? 'var(--color-primary-container)' : 'transparent',
              color: activeTab === tab.id ? 'var(--color-on-primary-container)' : 'var(--color-on-surface-variant)',
              borderRadius: '12px',
              cursor: 'pointer',
              transition: 'background-color 0.2s, color 0.2s',
              minWidth: 0
            }}
          >
            <span className="material-symbols-outlined" style={{ fontSize: '1.25rem' }}>{tab.icon}</span>
            <span style={{ fontSize: '0.75rem', fontWeight: activeTab === tab.id ? '600' : 'normal', whiteSpace: 'nowrap', textOverflow: 'ellipsis', overflow: 'hidden', width: '100%', textAlign: 'center' }}>
              {tab.label}
            </span>
          </button>
        ))}
      </div>

      {/* System Settings (Admin Only) */}
      {activeTab === 'system' && userProfile?.isAdmin && (
        <div className="m3-card" style={{ display: 'flex', flexDirection: 'column', gap: '12px', border: '1.5px dashed var(--color-primary)' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <span className="material-symbols-outlined" style={{ color: 'var(--color-primary)' }}>admin_panel_settings</span>
            <h3 style={{ fontSize: '1.1rem', fontWeight: '600', margin: 0 }}>System Administrator Panel</h3>
          </div>
          <p style={{ fontSize: '0.85rem', color: 'var(--color-outline)', margin: '4px 0 8px 0' }}>
            You are the admin (first user created). Use these controls to restrict access.
          </p>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '12px 16px', background: 'var(--color-surface-container-low)', borderRadius: '16px', border: '1px solid var(--color-outline-variant)' }}>
            <div>
              <span style={{ fontSize: '0.95rem', fontWeight: 600, color: 'var(--color-on-surface)' }}>Disable "Create User" Button</span>
              <p style={{ fontSize: '0.8rem', color: 'var(--color-outline)', margin: '2px 0 0 0' }}>
                Prevents new user registrations on the logon page.
              </p>
            </div>
            <div 
              onClick={() => handleToggleRegistration({ target: { checked: !adminRegDisabled } })}
              style={{
                position: 'relative',
                display: 'inline-block',
                width: '52px',
                height: '32px',
                backgroundColor: adminRegDisabled ? 'var(--color-primary)' : 'var(--color-surface-container-highest)',
                borderRadius: '32px',
                border: '2px solid var(--color-outline)',
                cursor: 'pointer',
                transition: '.3s',
                boxSizing: 'border-box'
              }}
            >
              <div style={{
                position: 'absolute',
                height: '20px',
                width: '20px',
                left: adminRegDisabled ? '26px' : '4px',
                bottom: '4px',
                backgroundColor: adminRegDisabled ? 'var(--color-on-primary)' : 'var(--color-outline)',
                transition: '.3s',
                borderRadius: '50%'
              }} />
            </div>
          </div>

          {/* User Privileges List */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', marginTop: '4px', marginBottom: '4px' }}>
            <span style={{ fontSize: '0.95rem', fontWeight: 600, color: 'var(--color-on-surface)', paddingLeft: '4px' }}>User Privileges</span>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
              {systemUsers.map(user => {
                const isCurrentUser = user.id === syncEngine.getActiveUser()?.userId;
                return (
                  <div key={user.id} style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    padding: '10px 14px',
                    background: 'var(--color-surface-container-low)',
                    borderRadius: '16px',
                    border: '1px solid var(--color-outline-variant)'
                  }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                      <div style={{
                        width: '36px',
                        height: '36px',
                        borderRadius: '50%',
                        backgroundColor: 'var(--color-primary-container)',
                        color: 'var(--color-on-primary-container)',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        overflow: 'hidden',
                        border: '1px solid var(--color-outline-variant)'
                      }}>
                        {user.profilePicture ? (
                          <img src={user.profilePicture} alt={user.displayName} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                        ) : (
                          <span className="material-symbols-outlined" style={{ fontSize: '1.4rem' }}>person</span>
                        )}
                      </div>
                      <div style={{ display: 'flex', flexDirection: 'column' }}>
                        <span style={{ fontSize: '0.9rem', fontWeight: 600, color: 'var(--color-on-surface)' }}>
                          {user.displayName} {isCurrentUser && <span style={{ fontStyle: 'italic', fontWeight: 'normal', color: 'var(--color-outline)', fontSize: '0.8rem' }}>(You)</span>}
                        </span>
                        <span style={{ fontSize: '0.75rem', color: 'var(--color-outline)' }}>@{user.username}</span>
                      </div>
                    </div>
                    
                    <div style={{ display: 'flex', alignItems: 'center' }}>
                      {user.isPrimaryAdmin ? (
                        <span style={{
                          fontSize: '0.75rem',
                          fontWeight: '600',
                          color: 'var(--color-primary)',
                          backgroundColor: 'var(--color-primary-container)',
                          padding: '4px 8px',
                          borderRadius: '8px'
                        }}>Primary Admin</span>
                      ) : (
                        <div
                          onClick={() => handleToggleUserAdmin(user.id, user.isAdmin)}
                          style={{
                            position: 'relative',
                            display: 'inline-block',
                            width: '52px',
                            height: '32px',
                            backgroundColor: user.isAdmin ? 'var(--color-primary)' : 'var(--color-surface-container-highest)',
                            borderRadius: '32px',
                            border: '2px solid var(--color-outline)',
                            cursor: 'pointer',
                            transition: '.3s',
                            boxSizing: 'border-box'
                          }}
                        >
                          <div style={{
                            position: 'absolute',
                            height: '20px',
                            width: '20px',
                            left: user.isAdmin ? '26px' : '4px',
                            bottom: '4px',
                            backgroundColor: user.isAdmin ? 'var(--color-on-primary)' : 'var(--color-outline)',
                            transition: '.3s',
                            borderRadius: '50%'
                          }} />
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '12px 16px', background: 'var(--color-surface-container-low)', borderRadius: '16px', border: '1px solid var(--color-outline-variant)', marginTop: '8px' }}>
            <div>
              <span style={{ fontSize: '0.95rem', fontWeight: 600, color: 'var(--color-error)' }}>Delete All Users</span>
              <p style={{ fontSize: '0.8rem', color: 'var(--color-outline)', margin: '2px 0 0 0' }}>
                Wipes all users, settings, and synchronized databases.
              </p>
            </div>
            <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
              {wipeConfirm && (
                <button
                  type="button"
                  className="m3-btn m3-btn-text"
                  onClick={() => setWipeConfirm(false)}
                  style={{ color: 'var(--color-outline)' }}
                >
                  Cancel
                </button>
              )}
              <button 
                type="button" 
                className="m3-btn m3-btn-filled" 
                style={{ backgroundColor: 'var(--color-error)', color: 'white' }}
                onClick={async () => {
                  if (!wipeConfirm) {
                    setWipeConfirm(true);
                  } else {
                    try {
                      await syncEngine.wipeAllUsers();
                      window.location.reload();
                    } catch (err) {
                      alert('Wipe failed: ' + err.message);
                      setWipeConfirm(false);
                    }
                  }
                }}
              >
                {wipeConfirm ? 'Confirm Wipe' : 'Wipe Users'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* User Profile Editor Section */}
      {activeTab === 'user' && (
      <form onSubmit={handleSaveProfile} className="m3-card" style={{ display: 'flex', flexDirection: 'column', gap: '12px', alignItems: 'center' }}>
        <h3 style={{ fontSize: '1.1rem', fontWeight: '600', alignSelf: 'flex-start', margin: 0 }}>User Profile</h3>
        
        <div style={{ position: 'relative', width: '90px', height: '90px', marginBottom: '8px' }}>
          <div style={{
            width: '90px',
            height: '90px',
            borderRadius: '50%',
            backgroundColor: 'var(--color-primary-container)',
            color: 'var(--color-on-primary-container)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            overflow: 'hidden',
            border: '2px solid var(--color-primary)',
            boxShadow: 'var(--elevation-2)'
          }}>
            {profilePicture ? (
              <img src={profilePicture} alt="Profile" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
            ) : (
              <span className="material-symbols-outlined" style={{ fontSize: '3rem' }}>person</span>
            )}
          </div>
          <label style={{
            position: 'absolute',
            bottom: 0,
            right: 0,
            backgroundColor: 'var(--color-primary)',
            color: 'var(--color-on-primary)',
            width: '28px',
            height: '28px',
            borderRadius: '50%',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            cursor: 'pointer',
            boxShadow: 'var(--elevation-2)'
          }} title="Upload Photo">
            <span className="material-symbols-outlined" style={{ fontSize: '1.1rem' }}>photo_camera</span>
            <input type="file" accept="image/*" onChange={handleImageUpload} style={{ display: 'none' }} />
          </label>
        </div>

        <div className="m3-text-field" style={{ marginBottom: '8px', width: '100%' }}>
          <input type="text" value={profileName} onChange={e => setProfileName(e.target.value)} placeholder=" " required />
          <label>Display Name</label>
        </div>
        <div className="m3-text-field" style={{ marginBottom: '8px', width: '100%' }}>
          <input type="date" value={profileBirthday} onChange={e => setProfileBirthday(e.target.value)} placeholder=" " />
          <label>Your Birthday</label>
        </div>
        <div className="m3-text-field" style={{ marginBottom: '8px', width: '100%' }}>
          <input type="text" value={profileLocation} onChange={e => setProfileLocation(e.target.value)} placeholder=" " />
          <label>Weather Location (e.g. London, UK)</label>
        </div>
        <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: '4px', width: '100%' }}>
          <button type="submit" className="m3-btn m3-btn-filled">
            Save Profile
          </button>
        </div>
      </form>
      )}

      {/* Sync Status Section */}
      {activeTab === 'sync' && (
      <div className="m3-card" style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
        <h3 style={{ fontSize: '1.1rem', fontWeight: '600' }}>Synchronization</h3>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div>
            <p style={{ fontSize: '0.9rem', color: 'var(--color-outline)' }}>Connection Status</p>
            <p style={{ textTransform: 'capitalize', fontWeight: '500', marginTop: '2px', display: 'flex', alignItems: 'center', gap: '6px' }}>
              <span className={`material-symbols-outlined`} style={{
                color: syncStatus === 'synced' ? 'var(--color-primary)' : syncStatus === 'syncing' ? 'var(--color-secondary)' : 'var(--color-error)'
              }}>
                {syncStatus === 'synced' ? 'check_circle' : syncStatus === 'syncing' ? 'sync' : 'cloud_off'}
              </span>
              {syncStatus}
            </p>
          </div>
          <button className="m3-btn m3-btn-filled" onClick={handleForceSync} disabled={syncStatus === 'syncing'}>
            Sync Now
          </button>
        </div>
      </div>
      )}

      {/* Theme Options */}
      {activeTab === 'user' && (
      <div className="m3-card" style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
        <h3 style={{ fontSize: '1.1rem', fontWeight: '600' }}>Appearance</h3>
        
        {/* Light/Dark Toggle */}
        <div>
          <p style={{ fontSize: '0.9rem', color: 'var(--color-outline)', marginBottom: '8px' }}>Theme Mode</p>
          <div style={{ display: 'flex', gap: '8px' }}>
            <button
              className={`m3-btn ${themeMode === 'light' ? 'm3-btn-filled' : 'm3-btn-tonal'}`}
              onClick={() => handleThemeModeChange('light')}
              style={{ flex: 1 }}
            >
              <span className="material-symbols-outlined">light_mode</span> Light
            </button>
            <button
              className={`m3-btn ${themeMode === 'dark' ? 'm3-btn-filled' : 'm3-btn-tonal'}`}
              onClick={() => handleThemeModeChange('dark')}
              style={{ flex: 1 }}
            >
              <span className="material-symbols-outlined">dark_mode</span> Dark
            </button>
          </div>
        </div>

        {/* Dynamic Color Palette */}
        <div>
          <p style={{ fontSize: '0.9rem', color: 'var(--color-outline)', marginBottom: '8px' }}>Dynamic Color Accent</p>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '8px' }}>
            {hues.map(h => (
              <button
                key={h.value}
                onClick={() => handleHueChange(h.value)}
                className="m3-btn m3-btn-tonal"
                style={{
                  border: themeHue === h.value ? '2px solid var(--color-primary)' : 'none',
                  position: 'relative',
                  overflow: 'hidden'
                }}
              >
                <span style={{
                  display: 'inline-block',
                  width: '12px',
                  height: '12px',
                  borderRadius: '50%',
                  backgroundColor: h.color,
                  marginRight: '6px'
                }} />
                {h.name}
              </button>
            ))}
          </div>
        </div>
      </div>
      )}

      {/* JSON Import/Export Card */}
      {activeTab === 'backup' && (
      <div className="m3-card" style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
        <h3 style={{ fontSize: '1.1rem', fontWeight: '600' }}>JSON Import & Export</h3>
        <p style={{ fontSize: '0.85rem', color: 'var(--color-outline)' }}>
          Export the entire database backup (events, calendars, contacts, and notes) to a single JSON file, or restore a previous JSON backup.
        </p>
        <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
          <button className="m3-btn m3-btn-tonal" onClick={handleExport} style={{ flex: '1 1 100%' }}>
            <span className="material-symbols-outlined">download</span> Export JSON Backup
          </button>
          
          <label className="m3-btn m3-btn-tonal" style={{ flex: '1 1 100%', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer' }}>
            <span className="material-symbols-outlined">upload</span> Import JSON
            <input type="file" accept=".json" onChange={handleImport} style={{ display: 'none' }} />
          </label>
        </div>
      </div>
      )}

      {/* Calendar ICS Import Card */}
      {activeTab === 'backup' && (
      <div className="m3-card" style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
        <h3 style={{ fontSize: '1.1rem', fontWeight: '600' }}>Calendar ICS Import</h3>
        <p style={{ fontSize: '0.9rem', color: 'var(--color-outline)', margin: 0 }}>
          You currently have <strong>{eventsCount}</strong> calendar event(s).
        </p>
        
        <label className="m3-btn m3-btn-tonal" style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', width: '100%', boxSizing: 'border-box' }}>
          <span className="material-symbols-outlined">calendar_today</span> Import ICS Calendar (.ics)
          <input type="file" accept=".ics" onChange={handleIcsImport} style={{ display: 'none' }} multiple />
        </label>
      </div>
      )}

      {/* Calendar Settings Card */}
      {activeTab === 'sync' && (
      <div className="m3-card" style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
          <h3 style={{ fontSize: '1.1rem', fontWeight: '600', margin: 0 }}>Calendar Settings</h3>
          <button
            type="button"
            className="m3-btn m3-btn-text"
            style={{ fontSize: '0.8rem', padding: '0 8px', height: '28px', minWidth: 'unset' }}
            onClick={() => {
              const name = prompt("Enter new calendar name:");
              if (name && name.trim()) {
                const randomColor = M3_PALETTE_COLORS[Math.floor(Math.random() * M3_PALETTE_COLORS.length)];
                syncEngine.saveItem('calendars', {
                  name: name.trim(),
                  color: randomColor
                });
              }
            }}
          >
            + Create Calendar
          </button>
        </div>
        
        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
          {calendars.map(cal => (
            <div key={cal.id} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '6px', minWidth: 0 }}>
                <span style={{ fontSize: '0.9rem', color: 'var(--color-on-surface)', textOverflow: 'ellipsis', overflow: 'hidden', whiteSpace: 'nowrap' }}>{cal.name}</span>
                <button
                  type="button"
                  onClick={() => {
                    const newName = prompt("Rename Calendar:", cal.name);
                    if (newName && newName.trim()) {
                      syncEngine.saveItem('calendars', { ...cal, name: newName.trim() });
                    }
                  }}
                  style={{
                    background: 'none',
                    border: 'none',
                    color: 'var(--color-outline)',
                    cursor: 'pointer',
                    padding: '2px',
                    display: 'inline-flex',
                    alignItems: 'center'
                  }}
                  title="Rename"
                >
                  <span className="material-symbols-outlined" style={{ fontSize: '0.95rem' }}>edit</span>
                </button>
              </div>
              
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', position: 'relative' }}>
                <button
                  type="button"
                  onClick={() => setShowColorPickerFor(showColorPickerFor === cal.id ? null : cal.id)}
                  style={{
                    width: '18px',
                    height: '18px',
                    borderRadius: '50%',
                    backgroundColor: cal.color,
                    border: '2px solid var(--color-outline-variant)',
                    cursor: 'pointer',
                    padding: 0
                  }}
                  title="Change Color"
                />

                {showColorPickerFor === cal.id && (
                  <div style={{
                    position: 'absolute',
                    right: '0',
                    top: '24px',
                    zIndex: 10,
                    backgroundColor: 'var(--color-surface-container-high)',
                    border: '1px solid var(--color-outline-variant)',
                    borderRadius: '8px',
                    padding: '6px',
                    display: 'grid',
                    gridTemplateColumns: 'repeat(4, 1fr)',
                    gap: '6px',
                    boxShadow: 'var(--elevation-2)'
                  }}>
                    {M3_PALETTE_COLORS.map(c => (
                      <button
                        key={c}
                        type="button"
                        onClick={() => {
                          syncEngine.saveItem('calendars', { ...cal, color: c });
                          setShowColorPickerFor(null);
                        }}
                        style={{
                          width: '16px',
                          height: '16px',
                          borderRadius: '50%',
                          backgroundColor: c,
                          border: 'none',
                          cursor: 'pointer',
                          padding: 0
                        }}
                      />
                    ))}
                  </div>
                )}

                {calendars.length > 1 && (
                  <button
                    type="button"
                    onClick={() => {
                      if (confirm(`Delete calendar "${cal.name}" and all its events?`)) {
                        const allEvents = syncEngine.getItems('calendar');
                        allEvents.forEach(evt => {
                          if (evt.calendar_id === cal.id) {
                            syncEngine.deleteItem('calendar', evt.id);
                          }
                        });
                        syncEngine.deleteItem('calendars', cal.id);
                      }
                    }}
                    style={{
                      background: 'none',
                      border: 'none',
                      cursor: 'pointer',
                      padding: 0,
                      color: 'var(--color-error)',
                      opacity: 0.7,
                      display: 'flex',
                      alignItems: 'center'
                    }}
                  >
                    <span className="material-symbols-outlined" style={{ fontSize: '1.1rem' }}>delete</span>
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>
      </div>
      )}

      {/* Contacts Settings & VCF Import Card */}
      {activeTab === 'backup' && (
      <div className="m3-card" style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
        <h3 style={{ fontSize: '1.1rem', fontWeight: '600' }}>Contacts Import</h3>
        <p style={{ fontSize: '0.9rem', color: 'var(--color-outline)', margin: 0 }}>
          You currently have <strong>{contactsCount}</strong> contact(s) stored in your sync database.
        </p>
        
        <label className="m3-btn m3-btn-tonal" style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', width: '100%', boxSizing: 'border-box' }}>
          <span className="material-symbols-outlined">contacts</span> Import VCF Contacts (.vcf)
          <input type="file" accept=".vcf" onChange={handleVcfImport} style={{ display: 'none' }} multiple />
        </label>
      </div>
      )}

      {/* Accounts & Session Card */}
      {activeTab === 'user' && (
      <div className="m3-card" style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
        <h3 style={{ fontSize: '1.1rem', fontWeight: '600' }}>Accounts & Session</h3>
        <p style={{ fontSize: '0.85rem', color: 'var(--color-outline)', margin: 0 }}>
          Logged in as <strong>{userProfile?.name || 'Guest'}</strong> (username: @{syncEngine.getActiveUser()?.username}).
        </p>

        {syncEngine.getActiveUser() && (
          <div style={{
            display: 'flex',
            flexDirection: 'column',
            gap: '6px',
            backgroundColor: 'var(--color-surface-container-high)',
            padding: '12px',
            borderRadius: '16px',
            marginTop: '4px',
            boxSizing: 'border-box'
          }}>
            <span style={{ fontSize: '0.8rem', fontWeight: '600', color: 'var(--color-on-surface-variant)' }}>WebDAV Connection Link</span>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <input
                type="text"
                readOnly
                value={`${window.location.protocol}//${window.location.hostname}:8080/${syncEngine.getActiveUser()?.username}/webdav`}
                style={{
                  flex: 1,
                  padding: '8px 12px',
                  borderRadius: '8px',
                  border: '1px solid var(--color-outline-variant)',
                  backgroundColor: 'var(--color-surface)',
                  color: 'var(--color-on-surface)',
                  fontSize: '0.8rem',
                  outline: 'none'
                }}
              />
              <button
                type="button"
                className="m3-btn m3-btn-tonal"
                style={{ padding: '0 12px', height: '32px', minWidth: 'unset', borderRadius: '8px', fontSize: '0.85rem' }}
                onClick={(e) => {
                  const url = `${window.location.protocol}//${window.location.hostname}:8080/${syncEngine.getActiveUser()?.username}/webdav`;
                  navigator.clipboard.writeText(url);
                  const prevText = e.currentTarget.innerText;
                  e.currentTarget.innerText = 'Copied!';
                  setTimeout(() => {
                    e.currentTarget.innerText = prevText;
                  }, 2000);
                }}
              >
                Copy
              </button>
            </div>
            <p style={{ fontSize: '0.75rem', color: 'var(--color-outline)', margin: 0 }}>
              Use this address in external apps to sync your calendars and contacts.
            </p>
          </div>
        )}

        {syncEngine.getSavedAccounts().length > 1 && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', marginTop: '4px' }}>
            <p style={{ fontSize: '0.85rem', fontWeight: '500', color: 'var(--color-on-surface-variant)', margin: 0 }}>Switch saved account:</p>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
              {syncEngine.getSavedAccounts().filter(acc => acc.userId !== syncEngine.getActiveUser()?.userId).map(acc => (
                <button
                  key={acc.userId}
                  type="button"
                  onClick={() => {
                    syncEngine.switchAccount(acc.userId);
                    window.location.reload();
                  }}
                  className="m3-btn m3-btn-tonal"
                  style={{ justifyContent: 'flex-start', padding: '8px 16px', borderRadius: '12px', width: '100%' }}
                >
                  <span className="material-symbols-outlined" style={{ marginRight: '8px' }}>account_circle</span>
                  {acc.displayName || acc.username}
                </button>
              ))}
            </div>
          </div>
        )}

        <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: '4px' }}>
          <button
            type="button"
            onClick={() => {
              syncEngine.logout();
              window.location.reload();
            }}
            className="m3-btn m3-btn-filled"
            style={{ backgroundColor: 'var(--color-error)', color: 'var(--color-on-error)' }}
          >
            <span className="material-symbols-outlined" style={{ marginRight: '8px' }}>logout</span> Log Out / Switch Account
          </button>
        </div>
      </div>
      )}

      {/* Reset Settings */}
      {activeTab === 'system' && (
      <div className="m3-card" style={{ display: 'flex', flexDirection: 'column', gap: '16px', borderColor: 'var(--color-error)' }}>
        <h3 style={{ fontSize: '1.1rem', fontWeight: '600', color: 'var(--color-error)' }}>Reset Settings</h3>
        
        {/* Rerun Onboarding Action */}
        <div style={{ borderBottom: '1px solid var(--color-outline-variant)', paddingBottom: '12px' }}>
          {showRerunConfirm ? (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', padding: '12px', backgroundColor: 'var(--color-surface-container)', borderRadius: '16px', boxSizing: 'border-box' }}>
              <p style={{ fontSize: '0.85rem', color: 'var(--color-on-surface-variant)', margin: 0 }}>Start onboarding again? Current details will be preserved.</p>
              <div style={{ display: 'flex', gap: '8px', justifyContent: 'flex-end' }}>
                <button type="button" className="m3-btn m3-btn-text" onClick={() => setShowRerunConfirm(false)}>
                  Cancel
                </button>
                <button type="button" className="m3-btn m3-btn-filled" onClick={() => {
                  onUpdateProfile({ ...userProfile, onboarded: false });
                  setShowRerunConfirm(false);
                }}>
                  Yes, Start
                </button>
              </div>
            </div>
          ) : (
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div>
                <p style={{ fontSize: '0.9rem', color: 'var(--color-outline)' }}>Rerun Onboarding Wizard</p>
                <p style={{ fontSize: '0.8rem', color: 'var(--color-outline)', marginTop: '2px' }}>Restart the first-time setup walkthrough.</p>
              </div>
              <button type="button" className="m3-btn m3-btn-tonal" onClick={() => setShowRerunConfirm(true)}>
                Rerun Onboarding
              </button>
            </div>
          )}
        </div>

        {/* Reset Database Action */}
        <div style={{ borderBottom: '1px solid var(--color-outline-variant)', paddingBottom: '12px' }}>
          {resetFeedback ? (
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '12px', backgroundColor: 'var(--color-primary-container)', color: 'var(--color-on-primary-container)', borderRadius: '16px', boxSizing: 'border-box' }}>
              <span className="material-symbols-outlined">check_circle</span>
              <span style={{ fontSize: '0.9rem', fontWeight: '500' }}>Local and server databases have been cleared!</span>
            </div>
          ) : showResetConfirm ? (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', padding: '12px', backgroundColor: 'rgba(186, 26, 26, 0.08)', borderRadius: '16px', boxSizing: 'border-box' }}>
              <p style={{ fontSize: '0.85rem', color: 'var(--color-error)', fontWeight: 'bold', margin: 0 }}>
                Are you absolutely sure? This will delete all calendar events, contacts, and notes stored locally and on the server.
              </p>
              <div style={{ display: 'flex', gap: '8px', justifyContent: 'flex-end' }}>
                <button type="button" className="m3-btn m3-btn-text" onClick={() => setShowResetConfirm(false)}>
                  Cancel
                </button>
                <button type="button" className="m3-btn m3-btn-filled" style={{ backgroundColor: 'var(--color-error)', color: 'white' }} onClick={() => {
                  syncEngine.resetLocalState();
                  setShowResetConfirm(false);
                  setResetFeedback(true);
                  setTimeout(() => setResetFeedback(false), 4000);
                }}>
                  Yes, Delete Everything
                </button>
              </div>
            </div>
          ) : (
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div>
                <p style={{ fontSize: '0.9rem', color: 'var(--color-outline)' }}>Reset Sync Hub Database</p>
                <p style={{ fontSize: '0.8rem', color: 'var(--color-error)', marginTop: '2px' }}>Delete all notes, calendar items, and contacts.</p>
              </div>
              <button className="m3-btn m3-btn-filled" style={{ backgroundColor: 'var(--color-error)', color: 'white' }} onClick={() => setShowResetConfirm(true)}>
                Reset Database
              </button>
            </div>
          )}
        </div>

        {/* Delete Account Action */}
        <div>
          {showDeleteConfirm ? (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', padding: '12px', backgroundColor: 'rgba(186, 26, 26, 0.12)', borderRadius: '16px', boxSizing: 'border-box' }}>
              <p style={{ fontSize: '0.85rem', color: 'var(--color-error)', fontWeight: 'bold', margin: 0 }}>
                WARNING: This will permanently delete your account (@{syncEngine.getActiveUser()?.username}) and ALL your data from the server. This action cannot be undone.
              </p>
              <div style={{ display: 'flex', gap: '8px', justifyContent: 'flex-end' }}>
                <button type="button" className="m3-btn m3-btn-text" onClick={() => setShowDeleteConfirm(false)}>
                  Cancel
                </button>
                <button type="button" className="m3-btn m3-btn-filled" style={{ backgroundColor: 'var(--color-error)', color: 'white' }} onClick={async () => {
                  try {
                    await syncEngine.deleteAccount();
                    window.location.reload();
                  } catch (err) {
                    alert('Failed to delete account: ' + err.message);
                  }
                }}>
                  Yes, Delete My Account
                </button>
              </div>
            </div>
          ) : (
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div>
                <p style={{ fontSize: '0.9rem', color: 'var(--color-error)' }}>Delete User Account</p>
                <p style={{ fontSize: '0.8rem', color: 'var(--color-outline)', marginTop: '2px' }}>Scrub user credentials and all synced data completely.</p>
              </div>
              <button className="m3-btn m3-btn-filled" style={{ backgroundColor: 'var(--color-error)', color: 'white' }} onClick={() => setShowDeleteConfirm(true)}>
                Delete Account
              </button>
            </div>
          )}
        </div>
      </div>
      )}
    </div>
  );
}
