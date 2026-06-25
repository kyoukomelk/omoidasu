import React, { useState } from 'react';
import { syncEngine } from '../utils/syncEngine';

export default function OnboardingWizard({ userProfile, onComplete }) {
  const activeUser = syncEngine.getActiveUser();
  const userId = activeUser ? activeUser.userId : 'guest';

  const [step, setStep] = useState(() => {
    const val = localStorage.getItem(`omoidasu_onboarding_step_${userId}`);
    return val ? parseInt(val, 10) : 1;
  });
  const [name, setName] = useState(() => {
    return localStorage.getItem(`omoidasu_onboarding_name_${userId}`) || userProfile?.name || '';
  });
  const [birthday, setBirthday] = useState(() => {
    return localStorage.getItem(`omoidasu_onboarding_birthday_${userId}`) || userProfile?.birthday || '';
  });
  const [profilePicture, setProfilePicture] = useState(() => {
    return localStorage.getItem(`omoidasu_onboarding_profilePicture_${userId}`) || userProfile?.profilePicture || '';
  });
  const [location, setLocation] = useState(() => {
    return localStorage.getItem(`omoidasu_onboarding_location_${userId}`) || userProfile?.location || '';
  });

  // Persist states to localStorage so that they survive any unmount/remount
  React.useEffect(() => {
    localStorage.setItem(`omoidasu_onboarding_name_${userId}`, name);
  }, [name, userId]);

  React.useEffect(() => {
    localStorage.setItem(`omoidasu_onboarding_birthday_${userId}`, birthday);
  }, [birthday, userId]);

  React.useEffect(() => {
    localStorage.setItem(`omoidasu_onboarding_profilePicture_${userId}`, profilePicture);
  }, [profilePicture, userId]);

  React.useEffect(() => {
    localStorage.setItem(`omoidasu_onboarding_location_${userId}`, location);
  }, [location, userId]);

  React.useEffect(() => {
    localStorage.setItem(`omoidasu_onboarding_step_${userId}`, step.toString());
  }, [step, userId]);
  const [themeHue, setThemeHue] = useState(() => {
    const raw = localStorage.getItem('theme_hue') || 'sakura-pink';
    if (['sakura-pink', 'light-blue', 'monochrome', 'dark-orange', 'dark-purple'].includes(raw)) {
      return raw;
    }
    if (raw === '270') return 'dark-purple';
    if (raw === '170' || raw === '210') return 'light-blue';
    if (raw === '30' || raw === '0') return 'dark-orange';
    return 'sakura-pink';
  });
  const [themeMode, setThemeMode] = useState(localStorage.getItem('theme_mode') || 'dark');
  const [searchResults, setSearchResults] = useState([]);

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

  const hues = [
    { name: 'Sakura Pink', value: 'sakura-pink', color: '#f5a9b8' },
    { name: 'Light Blue', value: 'light-blue', color: '#5bcefa' },
    { name: 'Monochrome', value: 'monochrome', color: '#888888' },
    { name: 'Dark Orange', value: 'dark-orange', color: '#d62e02' },
    { name: 'Dark Purple', value: 'dark-purple', color: '#a20160' }
  ];

  // Import feedback states
  const [importedEventsCount, setImportedEventsCount] = useState(0);
  const [importedContactsCount, setImportedContactsCount] = useState(0);

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
              const namePart = keyPart.split(';')[0].toUpperCase();

              const cleanValue = value
                .replace(/\\,/g, ',')
                .replace(/\\;/g, ';')
                .replace(/\\n/g, '\n')
                .replace(/\\N/g, '\n')
                .replace(/\\\\/g, '\\');

              if (namePart === 'SUMMARY') {
                currentEvent.title = cleanValue;
              } else if (namePart === 'DESCRIPTION') {
                currentEvent.description = cleanValue;
              } else if (namePart === 'LOCATION') {
                currentEvent.location = cleanValue;
              } else if (namePart === 'DTSTART') {
                const parsed = parseIcsDate(value);
                if (parsed.date) {
                  currentEvent.start_time = parsed.date;
                  currentEvent.all_day = parsed.allDay;
                }
              } else if (namePart === 'DTEND') {
                const parsed = parseIcsDate(value);
                if (parsed.date) {
                  currentEvent.end_time = parsed.date;
                }
              } else if (namePart === 'UID') {
                currentEvent.id = value;
              }
            }
          }

          if (importedEvents.length > 0) {
            const calendarName = file.name.replace(/\.ics$/i, '') || 'Imported Calendar';
            const calendars = syncEngine.getItems('calendars');
            let targetCal = calendars.find(c => c.name.toLowerCase() === calendarName.toLowerCase());
            if (!targetCal) {
              const m3Colors = ['#6750A4', '#0061A4', '#386A20', '#A63E2B', '#8C4F00', '#B3261E', '#006A6A', '#605D62'];
              const randomColor = m3Colors[Math.floor(Math.random() * m3Colors.length)];
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
          setImportedEventsCount(prev => prev + totalImported);
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
              const namePart = keyPart.split(';')[0].toUpperCase();

              const cleanValue = value
                .replace(/\\,/g, ',')
                .replace(/\\;/g, ';')
                .replace(/\\n/g, '\n')
                .replace(/\\N/g, '\n')
                .replace(/\\\\/g, '\\');

              if (namePart === 'N') {
                const parts = cleanValue.split(';');
                currentContact.last_name = parts[0]?.trim() || '';
                currentContact.first_name = parts[1]?.trim() || '';
              } else if (namePart === 'FN') {
                if (!currentContact.first_name && !currentContact.last_name) {
                  const parts = cleanValue.split(' ');
                  currentContact.first_name = parts[0]?.trim() || '';
                  currentContact.last_name = parts.slice(1).join(' ')?.trim() || '';
                }
              } else if (namePart === 'TEL') {
                if (!currentContact.phone) {
                  currentContact.phone = [];
                }
                currentContact.phone.push(cleanValue);
              } else if (namePart === 'EMAIL') {
                if (!currentContact.email) {
                  currentContact.email = [];
                }
                currentContact.email.push(cleanValue);
              } else if (namePart === 'URL') {
                currentContact.website = cleanValue;
              } else if (namePart === 'ADR') {
                const parts = cleanValue.split(';').map(p => p.trim()).filter(Boolean);
                currentContact.address = parts.join(', ');
              } else if (namePart === 'BDAY') {
                let bday = cleanValue.trim();
                if (bday.length === 8 && /^\d+$/.test(bday)) {
                  bday = `${bday.slice(0, 4)}-${bday.slice(4, 6)}-${bday.slice(6, 8)}`;
                }
                currentContact.birthday = bday;
              } else if (namePart === 'NOTE') {
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
          setImportedContactsCount(prev => prev + totalImported);
          e.target.value = '';
        }
      };
      fileReader.readAsText(file);
    });
  };

  const handleLocationChange = async (val) => {
    setLocation(val);
    if (val.trim().length < 2) {
      setSearchResults([]);
      return;
    }
    try {
      const res = await fetch(`https://geocoding-api.open-meteo.com/v1/search?name=${encodeURIComponent(val)}&count=5`);
      if (res.ok) {
        const data = await res.json();
        setSearchResults(data.results || []);
      }
    } catch (e) {
      console.warn('Geocoding search failed:', e.message);
    }
  };

  const handleFinish = () => {
    localStorage.removeItem(`omoidasu_onboarding_name_${userId}`);
    localStorage.removeItem(`omoidasu_onboarding_birthday_${userId}`);
    localStorage.removeItem(`omoidasu_onboarding_profilePicture_${userId}`);
    localStorage.removeItem(`omoidasu_onboarding_location_${userId}`);
    localStorage.removeItem(`omoidasu_onboarding_step_${userId}`);
    onComplete({
      name: name.trim() || 'Guest',
      birthday,
      location: location.trim(),
      profilePicture,
      themeHue,
      themeMode,
      onboarded: true
    });
  };

  return (
    <div style={{
      position: 'fixed',
      top: 0,
      left: 0,
      right: 0,
      bottom: 0,
      backgroundColor: 'var(--color-background)',
      backgroundImage: 'radial-gradient(circle at 10% 20%, var(--color-surface-container-high) 0%, var(--color-background) 80%)',
      zIndex: 9999,
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      padding: '1.5rem',
      overflowY: 'auto'
    }}>
      <style>{`
        @keyframes slideInRight {
          from { transform: translateX(40px); opacity: 0; }
          to { transform: translateX(0); opacity: 1; }
        }
        @keyframes popOn {
          0% { transform: scale(0); opacity: 0; }
          70% { transform: scale(1.15); opacity: 1; }
          100% { transform: scale(1); }
        }
        @keyframes float {
          0% { transform: translateY(0px); }
          50% { transform: translateY(-8px); }
          100% { transform: translateY(0px); }
        }
        .step-container {
          animation: slideInRight 0.55s cubic-bezier(0.25, 1, 0.5, 1) forwards;
          display: flex;
          flex-direction: column;
          gap: 1rem;
        }
        .floating-icon {
          animation: popOn 0.55s cubic-bezier(0.34, 1.56, 0.64, 1) forwards, float 3s ease-in-out infinite 0.55s;
          display: inline-block;
          transform-origin: center;
        }
        .dropdown-item-hover:hover {
          background-color: var(--color-surface-variant);
        }
      `}</style>
      <div className="m3-card" style={{
        maxWidth: '560px',
        width: '100%',
        backgroundColor: 'var(--color-surface)',
        borderRadius: '32px',
        padding: '2.5rem',
        boxShadow: 'var(--elevation-4)',
        display: 'flex',
        flexDirection: 'column',
        gap: '2rem',
        border: '1px solid var(--color-outline-variant)',
        animation: 'scaleUp var(--motion-duration-long) var(--motion-easing-standard)',
        cursor: 'default',
        transform: 'none'
      }} onClick={e => e.stopPropagation()}>
        
        {/* Progress Bar indicator */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <h2 style={{ fontFamily: 'var(--font-title)', fontSize: '1.8rem', color: 'var(--color-primary)', fontWeight: '600' }}>
              Welcome to Omoidasu
            </h2>
            <span style={{ fontSize: '0.85rem', color: 'var(--color-outline)', fontWeight: 'bold' }}>
              Step {step} of 5
            </span>
          </div>
          <div style={{ width: '100%', height: '4px', backgroundColor: 'var(--color-surface-container-high)', borderRadius: '2px', overflow: 'hidden' }}>
            <div style={{ width: `${(step / 5) * 100}%`, height: '100%', backgroundColor: 'var(--color-primary)', transition: 'width var(--motion-duration-medium) var(--motion-easing-standard)' }} />
          </div>
        </div>

        {/* Dynamic Step Views */}
        {step === 1 && (
          <div className="step-container" style={{ alignItems: 'center' }}>
            <div style={{ position: 'relative', width: '100px', height: '100px', marginBottom: '12px' }}>
              <div style={{
                width: '100px',
                height: '100px',
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
                  <span className="material-symbols-outlined" style={{ fontSize: '3.5rem' }}>person</span>
                )}
              </div>
              <label style={{
                position: 'absolute',
                bottom: 0,
                right: 0,
                backgroundColor: 'var(--color-primary)',
                color: 'var(--color-on-primary)',
                width: '32px',
                height: '32px',
                borderRadius: '50%',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                cursor: 'pointer',
                boxShadow: 'var(--elevation-2)'
              }} title="Upload Photo">
                <span className="material-symbols-outlined" style={{ fontSize: '1.2rem' }}>photo_camera</span>
                <input type="file" accept="image/*" onChange={handleImageUpload} style={{ display: 'none' }} />
              </label>
            </div>

            <p style={{ fontSize: '0.95rem', color: 'var(--color-on-surface-variant)', textAlign: 'center', width: '100%', margin: '0 0 8px 0' }}>
              Let's customize your experience. First, set a profile picture and tell us your name!
            </p>
            <div className="m3-text-field" style={{ width: '100%' }}>
              <input type="text" value={name} onChange={e => setName(e.target.value)} placeholder=" " required />
              <label>Your Name</label>
            </div>
            <div className="m3-text-field" style={{ width: '100%' }}>
              <input type="date" value={birthday} onChange={e => setBirthday(e.target.value)} placeholder=" " />
              <label>Your Birthday (Optional)</label>
            </div>
          </div>
        )}

        {step === 2 && (
          <div className="step-container">
            <div style={{ display: 'flex', justifyContent: 'center', marginBottom: '8px' }}>
              <span className="material-symbols-outlined floating-icon" style={{ fontSize: '4.5rem', color: 'var(--color-primary)' }}>palette</span>
            </div>
            <p style={{ fontSize: '0.95rem', color: 'var(--color-on-surface-variant)', textAlign: 'center' }}>
              Select a color theme for your personal workspace view.
            </p>
            
            {/* Theme Mode Toggle (Light/Dark) */}
            <div style={{ display: 'flex', gap: '8px', marginBottom: '16px' }}>
              <button
                type="button"
                className={`m3-btn ${themeMode === 'light' ? 'm3-btn-filled' : 'm3-btn-outlined'}`}
                style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px' }}
                onClick={() => {
                  setThemeMode('light');
                  document.documentElement.setAttribute('data-theme-mode', 'light');
                  localStorage.setItem('theme_mode', 'light');
                }}
              >
                <span className="material-symbols-outlined">light_mode</span> Light
              </button>
              <button
                type="button"
                className={`m3-btn ${themeMode === 'dark' ? 'm3-btn-filled' : 'm3-btn-outlined'}`}
                style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px' }}
                onClick={() => {
                  setThemeMode('dark');
                  document.documentElement.setAttribute('data-theme-mode', 'dark');
                  localStorage.setItem('theme_mode', 'dark');
                }}
              >
                <span className="material-symbols-outlined">dark_mode</span> Dark
              </button>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '10px' }}>
              {hues.map(hue => (
                <button
                  key={hue.name}
                  type="button"
                  className={`m3-btn ${themeHue === hue.value ? 'm3-btn-filled' : 'm3-btn-outlined'}`}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: '6px',
                    height: '40px',
                    padding: '0 8px',
                    borderColor: themeHue === hue.value ? 'var(--color-primary)' : 'var(--color-outline-variant)'
                  }}
                  onClick={() => {
                    setThemeHue(hue.value);
                    document.documentElement.setAttribute('data-theme-color', hue.value);
                    document.documentElement.style.setProperty('--theme-hue', hue.value);
                    localStorage.setItem('theme_hue', hue.value);
                  }}
                >
                  <span style={{ width: '12px', height: '12px', borderRadius: '50%', backgroundColor: hue.color }} />
                  <span style={{ fontSize: '0.85rem' }}>{hue.name}</span>
                </button>
              ))}
            </div>
          </div>
        )}

        {step === 3 && (
          <div className="step-container" style={{ position: 'relative' }}>
            <div style={{ display: 'flex', justifyContent: 'center', marginBottom: '8px' }}>
              <span className="material-symbols-outlined floating-icon" style={{ fontSize: '4.5rem', color: 'var(--color-primary)' }}>partly_cloudy_day</span>
            </div>
            <p style={{ fontSize: '0.95rem', color: 'var(--color-on-surface-variant)', textAlign: 'center', margin: 0 }}>
              Enter your city to get local weather information displayed directly on your Homescreen dashboard.
            </p>
            
            <div style={{ position: 'relative', width: '100%' }}>
              <div className="m3-text-field" style={{ margin: 0 }}>
                <input
                  type="text"
                  value={location}
                  onChange={e => handleLocationChange(e.target.value)}
                  placeholder=" "
                />
                <label>City/Location (e.g. Paris, FR)</label>
              </div>

              {/* Autocomplete Dropdown */}
              {searchResults.length > 0 && (
                <div className="m3-card" style={{
                  position: 'absolute',
                  top: '100%',
                  left: 0,
                  right: 0,
                  backgroundColor: 'var(--color-surface-container-high)',
                  border: '1px solid var(--color-outline-variant)',
                  borderRadius: '16px',
                  zIndex: 100,
                  boxShadow: 'var(--elevation-2)',
                  marginTop: '4px',
                  maxHeight: '180px',
                  overflowY: 'auto',
                  padding: '4px',
                  boxSizing: 'border-box'
                }}>
                  {searchResults.map((item) => (
                    <div
                      key={item.id}
                      style={{
                        padding: '10px 12px',
                        cursor: 'pointer',
                        borderRadius: '8px',
                        fontSize: '0.85rem',
                        color: 'var(--color-on-surface)',
                        transition: 'background-color 0.2s',
                        display: 'flex',
                        flexDirection: 'column',
                        gap: '2px'
                      }}
                      className="dropdown-item-hover"
                      onClick={() => {
                        const formatted = `${item.name}${item.admin1 ? `, ${item.admin1}` : ''} (${item.country_code.toUpperCase()})`;
                        setLocation(formatted);
                        setSearchResults([]);
                      }}
                    >
                      <strong style={{ color: 'var(--color-on-surface)' }}>{item.name}</strong>
                      <span style={{ fontSize: '0.75rem', color: 'var(--color-outline)' }}>
                        {item.admin1 ? `${item.admin1}, ` : ''}{item.country}
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Weather Provider Credit */}
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '4px', marginTop: '12px', opacity: 0.65 }}>
              <span style={{ fontSize: '0.75rem' }}>Weather data provided by </span>
              <a href="https://open-meteo.com/" target="_blank" rel="noopener noreferrer" style={{ fontSize: '0.75rem', color: 'var(--color-primary)', textDecoration: 'none', fontWeight: 'bold' }}>Open-Meteo</a>
            </div>
          </div>
        )}

        {step === 4 && (
          <div className="step-container">
            <div style={{ display: 'flex', justifyContent: 'center', marginBottom: '8px' }}>
              <span className="material-symbols-outlined floating-icon" style={{ fontSize: '4.5rem', color: 'var(--color-primary)' }}>cloud_upload</span>
            </div>
            <p style={{ fontSize: '0.95rem', color: 'var(--color-on-surface-variant)', textAlign: 'center' }}>
              Got existing calendar events or contacts? Import them quickly here. You can select multiple files.
            </p>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', marginTop: '8px' }}>
              <label className="m3-btn m3-btn-tonal" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', gap: '8px', transition: 'all 0.2s' }}>
                <span className="material-symbols-outlined">calendar_today</span>
                Import Calendar (.ics)
                <input type="file" accept=".ics" onChange={handleIcsImport} style={{ display: 'none' }} multiple />
              </label>
              {importedEventsCount > 0 && (
                <span style={{ fontSize: '0.85rem', color: 'var(--color-primary)', textAlign: 'center', fontWeight: 'bold', animation: 'scaleUp 0.3s' }}>
                  ✓ {importedEventsCount} event(s) queued for import!
                </span>
              )}

              <label className="m3-btn m3-btn-tonal" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', gap: '8px', transition: 'all 0.2s' }}>
                <span className="material-symbols-outlined">contacts</span>
                Import Contacts (.vcf)
                <input type="file" accept=".vcf" onChange={handleVcfImport} style={{ display: 'none' }} multiple />
              </label>
              {importedContactsCount > 0 && (
                <span style={{ fontSize: '0.85rem', color: 'var(--color-primary)', textAlign: 'center', fontWeight: 'bold', animation: 'scaleUp 0.3s' }}>
                  ✓ {importedContactsCount} contact(s) queued for import!
                </span>
              )}
            </div>
          </div>
        )}

        {step === 5 && (
          <div className="step-container">
            <div style={{ display: 'flex', justifyContent: 'center', marginBottom: '8px' }}>
              <span className="material-symbols-outlined floating-icon" style={{ fontSize: '4.5rem', color: 'var(--color-primary)' }}>task_alt</span>
            </div>
            <p style={{ fontSize: '0.95rem', color: 'var(--color-on-surface-variant)', textAlign: 'center' }}>
              You're all set! Here is a summary of your profile (you can edit these anytime in Settings):
            </p>
            <div className="m3-card" style={{ backgroundColor: 'var(--color-surface-container-low)', padding: '16px', display: 'flex', flexDirection: 'column', gap: '8px', animation: 'scaleUp 0.3s' }}>
              <div><strong>Name:</strong> {name.trim() || 'Guest'}</div>
              {birthday && <div><strong>Birthday:</strong> {birthday}</div>}
              {location.trim() && <div><strong>Location:</strong> {location.trim()}</div>}
              <div><strong>Accent Color:</strong> {hues.find(h => h.value === themeHue)?.name || 'Sakura Pink'}</div>
              {(importedEventsCount > 0 || importedContactsCount > 0) && (
                <div style={{ borderTop: '1px solid var(--color-outline-variant)', paddingTop: '8px', marginTop: '4px' }}>
                  <strong>Imported:</strong> {importedEventsCount} event(s), {importedContactsCount} contact(s)
                </div>
              )}
            </div>
          </div>
        )}

        {/* Action Buttons */}
        <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: '1rem', gap: '8px' }}>
          {step > 1 ? (
            <button className="m3-btn m3-btn-text" onClick={() => setStep(step - 1)}>
              Back
            </button>
          ) : (
            <div />
          )}

          {step < 5 ? (
            <button className="m3-btn m3-btn-filled" onClick={() => setStep(step + 1)} disabled={step === 1 && !name.trim()}>
              Next
            </button>
          ) : (
            <button className="m3-btn m3-btn-filled" onClick={handleFinish}>
              Get Started
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
