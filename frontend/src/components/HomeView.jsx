import React, { useState, useEffect } from 'react';
import { syncEngine } from '../utils/syncEngine';

export default function HomeView({ userProfile, onNavigateToContact, onNavigateToNote, onNavigateToTab }) {
  const [events, setEvents] = useState([]);
  const [contacts, setContacts] = useState([]);
  const [notes, setNotes] = useState([]);
  const [calendars, setCalendars] = useState([]);

  // Homescreen preferences
  const [showWeather, setShowWeather] = useState(() => {
    const val = localStorage.getItem('home_show_weather');
    return val !== null ? val === 'true' : true;
  });
  const [showCalendar, setShowCalendar] = useState(() => {
    const val = localStorage.getItem('home_show_calendar');
    return val !== null ? val === 'true' : true;
  });
  const [showContacts, setShowContacts] = useState(() => {
    const val = localStorage.getItem('home_show_contacts');
    return val !== null ? val === 'true' : true;
  });
  const [showNotes, setShowNotes] = useState(() => {
    const val = localStorage.getItem('home_show_notes');
    return val !== null ? val === 'true' : true;
  });
  const [customWelcomeText, setCustomWelcomeText] = useState(() => {
    return localStorage.getItem('home_welcome_text_custom') || "Welcome back! Let's see what is on your agenda today.";
  });
  const [isEditingPreferences, setIsEditingPreferences] = useState(false);
  const [tempWelcomeText, setTempWelcomeText] = useState('');
  const [sectionsOrder, setSectionsOrder] = useState(() => {
    const val = localStorage.getItem('home_sections_order');
    return val ? JSON.parse(val) : ['calendar', 'contacts', 'notes'];
  });
  const [draggedIndex, setDraggedIndex] = useState(null);

  const handleDragStart = (e, index) => {
    setDraggedIndex(index);
    e.dataTransfer.effectAllowed = 'move';
    e.dataTransfer.setData('text/plain', index);
  };

  const handleDragOver = (e, index) => {
    e.preventDefault();
    if (draggedIndex === null || draggedIndex === index) return;
    
    const newOrder = [...sectionsOrder];
    const draggedItem = newOrder[draggedIndex];
    newOrder.splice(draggedIndex, 1);
    newOrder.splice(index, 0, draggedItem);
    setDraggedIndex(index);
    setSectionsOrder(newOrder);
    localStorage.setItem('home_sections_order', JSON.stringify(newOrder));
  };

  const handleDragEnd = () => {
    setDraggedIndex(null);
  };

  // Weather States
  const [weather, setWeather] = useState(null);
  const [weatherLoading, setWeatherLoading] = useState(false);
  const [weatherError, setWeatherError] = useState('');

  const loadData = () => {
    setEvents(syncEngine.getItems('calendar'));
    setContacts(syncEngine.getItems('contacts'));
    setNotes(syncEngine.getItems('notes'));
    setCalendars(syncEngine.getItems('calendars'));
  };

  const getCalendarForEvent = (event) => {
    if (!event.calendar_id) {
      return calendars[0] || { name: 'Primary', color: '#6750A4' };
    }
    return calendars.find(c => c.id === event.calendar_id) || calendars[0] || { name: 'Primary', color: '#6750A4' };
  };

  const formatEventTime = (event) => {
    if (event.all_day) return 'All day';
    const startStr = event.start_time || '';
    const endStr = event.end_time || '';
    const startPart = startStr.includes('T') ? startStr.split('T')[1].slice(0, 5) : '00:00';
    const endPart = endStr.includes('T') ? endStr.split('T')[1].slice(0, 5) : startPart;
    return `${startPart} - ${endPart}`;
  };

  useEffect(() => {
    loadData();
    return syncEngine.subscribe(loadData);
  }, []);

  // Fetch weather when location changes
  useEffect(() => {
    if (!userProfile?.location) {
      setWeather(null);
      return;
    }

    const fetchWeather = async () => {
      setWeatherLoading(true);
      setWeatherError('');
      try {
        // Step 1: Geocoding
        let geoRes = await fetch(
          `https://geocoding-api.open-meteo.com/v1/search?name=${encodeURIComponent(userProfile.location)}&count=1`
        );
        if (!geoRes.ok) throw new Error('Geocoding search failed');
        let geoData = await geoRes.json();
        
        // Fallback: If no results found, split by space or comma and try the first segment
        if (!geoData.results || geoData.results.length === 0) {
          const firstSegment = userProfile.location.split(/[,\s]+/)[0];
          if (firstSegment && firstSegment !== userProfile.location) {
            console.log(`Retrying geocoding search for fallback segment: "${firstSegment}"`);
            geoRes = await fetch(
              `https://geocoding-api.open-meteo.com/v1/search?name=${encodeURIComponent(firstSegment)}&count=1`
            );
            if (geoRes.ok) {
              geoData = await geoRes.json();
            }
          }
        }

        if (!geoData.results || geoData.results.length === 0) {
          throw new Error('Location not found');
        }

        const { latitude, longitude, name: cityName, country } = geoData.results[0];

        // Step 2: Forecast
        const weatherRes = await fetch(
          `https://api.open-meteo.com/v1/forecast?latitude=${latitude}&longitude=${longitude}&current_weather=true`
        );
        if (!weatherRes.ok) throw new Error('Weather forecast fetch failed');
        const weatherData = await weatherRes.json();

        if (!weatherData.current_weather) {
          throw new Error('No weather data available');
        }

        const { temperature, weathercode } = weatherData.current_weather;
        setWeather({
          temp: Math.round(temperature),
          code: weathercode,
          city: `${cityName}, ${country || ''}`
        });
      } catch (err) {
        console.warn('Weather fetch failed:', err.message);
        setWeatherError(err.message);
      } finally {
        setWeatherLoading(false);
      }
    };

    fetchWeather();
  }, [userProfile?.location]);

  // WMO Weather interpretation codes
  const getWeatherCondition = (code) => {
    if (code === 0) return { label: 'Clear Sky', icon: 'wb_sunny', color: '#ffc107' };
    if (code >= 1 && code <= 3) return { label: 'Partly Cloudy', icon: 'filter_drama', color: '#90a4ae' };
    if (code === 45 || code === 48) return { label: 'Foggy', icon: 'foggy', color: '#b0bec5' };
    if (code >= 51 && code <= 55) return { label: 'Drizzle', icon: 'rainy', color: '#29b6f6' };
    if (code >= 61 && code <= 65) return { label: 'Rainy', icon: 'rainy', color: '#0288d1' };
    if (code >= 71 && code <= 75) return { label: 'Snowy', icon: 'ac_unit', color: '#e0f7fa' };
    if (code >= 80 && code <= 82) return { label: 'Rain Showers', icon: 'rainy', color: '#29b6f6' };
    if (code >= 95 && code <= 99) return { label: 'Thunderstorm', icon: 'thunderstorm', color: '#5e35b1' };
    return { label: 'Cloudy', icon: 'cloud', color: '#b0bec5' };
  };

  // Upcoming appointments (sorted ascending, start time >= current time)
  const now = new Date();
  const getEventSortTime = (e) => {
    if (!e.start_time) return 0;
    const cal = getCalendarForEvent(e);
    const isBirthday = 
      (cal.name && cal.name.toLowerCase().includes('birthday')) || 
      (e.title && (e.title.toLowerCase().includes('birthday') || e.title.toLowerCase().includes('jarig')));
      
    if (isBirthday) {
      const eventParts = String(e.start_time).split('T')[0].split('-');
      const bdayDate = new Date(now.getFullYear(), parseInt(eventParts[1]) - 1, parseInt(eventParts[2]), 0, 0, 0);
      return bdayDate.getTime();
    }
    return new Date(e.start_time).getTime();
  };

  const upcomingEvents = events
    .map(e => ({
      event: e,
      sortTime: getEventSortTime(e)
    }))
    .filter(item => {
      if (!item.event.start_time) return false;
      
      const cal = getCalendarForEvent(item.event);
      const isBirthday = 
        (cal.name && cal.name.toLowerCase().includes('birthday')) || 
        (item.event.title && (item.event.title.toLowerCase().includes('birthday') || item.event.title.toLowerCase().includes('jarig')));
        
      if (isBirthday) {
        const bdayEnd = new Date(item.sortTime);
        bdayEnd.setHours(23, 59, 59, 999);
        return bdayEnd >= now;
      }
      
      const endTime = item.event.end_time ? new Date(item.event.end_time) : new Date(item.event.start_time);
      return endTime >= now;
    })
    .sort((a, b) => a.sortTime - b.sortTime)
    .slice(0, 5)
    .map(item => item.event);

  // Favorite contacts
  const favoriteContacts = contacts.filter(c => !!c.favorite);

  // Favorite notes
  const favoriteNotes = notes.filter(n => !!n.favorite).slice(0, 4);

  const parseChecklist = (val) => {
    if (!val) return [];
    if (typeof val === 'string') {
      try {
        return JSON.parse(val);
      } catch (e) {
        return [];
      }
    }
    return val;
  };

  const formatEventDate = (dateStr) => {
    const d = new Date(dateStr);
    return d.toLocaleDateString(undefined, { month: 'short', day: 'numeric', weekday: 'short' });
  };

  const getGreeting = () => {
    const hrs = now.getHours();
    const displayName = userProfile?.name || 'Guest';
    if (hrs < 12) return `Good Morning, ${displayName}!`;
    if (hrs < 18) return `Good Afternoon, ${displayName}!`;
    return `Good Evening, ${displayName}!`;
  };

  const isBirthdayToday = () => {
    if (!userProfile?.birthday) return false;
    const bdayParts = userProfile.birthday.split('-');
    if (bdayParts.length < 3) return false;
    const todayM = String(now.getMonth() + 1).padStart(2, '0');
    const todayD = String(now.getDate()).padStart(2, '0');
    return bdayParts[1] === todayM && bdayParts[2] === todayD;
  };


  return (
    <div className="view-container" style={{ height: '100%', display: 'flex', flexDirection: 'column', gap: '1.5rem', overflowY: 'auto' }}>
      
      {/* Dynamic hides scrollbar injection for horizontal scroll list */}
      <style>{`
        .no-scrollbar::-webkit-scrollbar {
          display: none;
        }
        .no-scrollbar {
          -ms-overflow-style: none;
          scrollbar-width: none;
        }
        @media (max-width: 600px) {
          .home-header-banner {
            flex-direction: column !important;
            align-items: flex-start !important;
            gap: 12px !important;
          }
          .home-weather-widget {
            align-self: flex-start !important;
          }
        }
      `}</style>

      {/* Cheerful Gradient Greeting Header */}
      <div className="home-header-banner" style={{
        background: 'linear-gradient(135deg, var(--color-primary-container), var(--color-tertiary-container))',
        color: 'var(--color-on-primary-container)',
        padding: '1.5rem',
        borderRadius: '24px',
        display: 'flex',
        flexWrap: 'wrap',
        gap: '16px',
        alignItems: 'center',
        justifyContent: 'space-between',
        boxShadow: 'var(--elevation-2)',
        flexShrink: 0
      }}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', flex: 1 }}>
          <h2 style={{ fontSize: '1.6rem', fontFamily: 'var(--font-title)', fontWeight: '600', textShadow: '0 1px 2px rgba(0,0,0,0.05)' }}>
            {getGreeting()}
          </h2>
          <p style={{ fontSize: '0.9rem', opacity: 0.9 }}>
            {customWelcomeText}
          </p>
        </div>

        {/* Weather Widget inside header */}
        {showWeather && (
          userProfile?.location ? (
            <div className="glass-overlay home-weather-widget" style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '12px',
              padding: '8px 16px',
              backgroundColor: 'rgba(255, 255, 255, 0.15)',
              border: '1px solid rgba(255, 255, 255, 0.25)',
              borderRadius: '20px',
              backdropFilter: 'blur(10px)',
              color: 'inherit'
            }}>
              {weatherLoading ? (
                <span className="material-symbols-outlined" style={{ animation: 'spin 2s linear infinite', opacity: 0.7 }}>sync</span>
              ) : weatherError ? (
                <span className="material-symbols-outlined" style={{ fontSize: '1.2rem' }}>warning</span>
              ) : weather ? (
                <>
                  <span className="material-symbols-outlined" style={{ fontSize: '2.5rem', color: getWeatherCondition(weather.code).color, display: 'inline-flex', alignItems: 'center', justifyContent: 'center', lineHeight: '1' }}>
                    {getWeatherCondition(weather.code).icon}
                  </span>
                  <div style={{ display: 'flex', flexDirection: 'column' }}>
                    <span style={{ fontSize: '1.2rem', fontWeight: 'bold' }}>{weather.temp}°C</span>
                    <span style={{ fontSize: '0.75rem', opacity: 0.9, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', maxWidth: '90px' }} title={weather.city}>
                      {getWeatherCondition(weather.code).label}
                    </span>
                  </div>
                </>
              ) : null}
            </div>
          ) : (
            <div className="home-weather-widget" onClick={() => onNavigateToTab('settings')} style={{
              fontSize: '0.8rem',
              padding: '8px 12px',
              cursor: 'pointer',
              backgroundColor: 'rgba(255, 255, 255, 0.15)',
              border: '1px dashed rgba(255, 255, 255, 0.4)',
              borderRadius: '20px',
              color: 'inherit'
            }}>
              ☁️ Add weather city in Settings
            </div>
          )
        )}
      </div>

      {/* Birthday Celebration Banner */}
      {isBirthdayToday() && (
        <div className="m3-card" style={{
          background: 'linear-gradient(135deg, #ffe082, #ff8a80)',
          color: '#3e2723',
          padding: '16px',
          borderRadius: '16px',
          display: 'flex',
          alignItems: 'center',
          gap: '12px',
          boxShadow: 'var(--elevation-2)'
        }}>
          <span className="material-symbols-outlined" style={{ fontSize: '2.5rem', color: '#e65100' }}>cake</span>
          <div>
            <h4 style={{ fontWeight: 'bold', fontSize: '1rem', fontFamily: 'var(--font-title)' }}>Happy Birthday!</h4>
            <p style={{ fontSize: '0.85rem', opacity: 0.9 }}>Wishing you a wonderful day filled with joy and memories!</p>
          </div>
        </div>
      )}

      {/* Dynamic Movable Dashboard Sections */}
      {sectionsOrder.map((sectionKey) => {
        if (sectionKey === 'calendar') {
          return showCalendar && (
            <div key="calendar" style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <h3 style={{ fontSize: '1.1rem', fontFamily: 'var(--font-title)', fontWeight: '600', display: 'flex', alignItems: 'center', gap: '6px' }}>
                  <span className="material-symbols-outlined" style={{ color: 'var(--color-primary)' }}>event</span>
                  Upcoming Appointments
                </h3>
                <button className="m3-btn m3-btn-text" onClick={() => onNavigateToTab('calendar')} style={{ fontSize: '0.8rem', padding: '0 8px' }}>
                  View Calendar
                </button>
              </div>

              {upcomingEvents.length === 0 ? (
                <div className="m3-card" style={{ padding: '16px', textAlign: 'center', color: 'var(--color-outline)', fontStyle: 'italic' }}>
                  No upcoming appointments.
                </div>
              ) : (
                <div className="no-scrollbar" style={{
                  display: 'flex',
                  gap: '12px',
                  overflowX: 'auto',
                  padding: '8px 4px',
                  scrollSnapType: 'x mandatory',
                  WebkitOverflowScrolling: 'touch'
                }}>
                  {upcomingEvents.map(event => {
                    const calendar = getCalendarForEvent(event);
                    return (
                      <div
                        key={event.id}
                        className="m3-card"
                        onClick={() => onNavigateToTab('calendar')}
                        style={{
                          flex: '0 0 240px',
                          scrollSnapAlign: 'start',
                          display: 'flex',
                          flexDirection: 'column',
                          justifyContent: 'space-between',
                          padding: '12px',
                          height: '115px',
                          borderLeft: `4px solid ${calendar.color}`,
                          backgroundColor: 'var(--color-surface-container-high)'
                        }}
                      >
                        <div>
                          <span style={{ fontSize: '0.75rem', fontWeight: 'bold', color: calendar.color, display: 'block', marginBottom: '2px' }}>
                            {(() => {
                              const isBirthday = 
                                (calendar.name && calendar.name.toLowerCase().includes('birthday')) || 
                                (event.title && (event.title.toLowerCase().includes('birthday') || event.title.toLowerCase().includes('jarig')));
                              
                              let eventDate = new Date(event.start_time);
                              if (isBirthday && event.start_time) {
                                const eventParts = String(event.start_time).split('T')[0].split('-');
                                eventDate = new Date(now.getFullYear(), parseInt(eventParts[1]) - 1, parseInt(eventParts[2]), 0, 0, 0);
                              }
                              return formatEventDate(eventDate);
                            })()}
                          </span>
                          <h4 style={{ fontWeight: '600', fontSize: '0.9rem', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{event.title}</h4>
                        </div>
                        <p style={{ fontSize: '0.75rem', color: 'var(--color-on-surface-variant)', marginTop: '4px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                          {formatEventTime(event)}
                          {event.location && ` • 📍 ${event.location}`}
                        </p>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          );
        }

        if (sectionKey === 'contacts') {
          return showContacts && (
            <div key="contacts" style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <h3 style={{ fontSize: '1.1rem', fontFamily: 'var(--font-title)', fontWeight: '600', display: 'flex', alignItems: 'center', gap: '6px' }}>
                  <span className="material-symbols-outlined" style={{ color: 'var(--color-primary)' }}>star</span>
                  Favorite Contacts
                </h3>
                <button className="m3-btn m3-btn-text" onClick={() => onNavigateToTab('contacts')} style={{ fontSize: '0.8rem', padding: '0 8px' }}>
                  View All
                </button>
              </div>

              {favoriteContacts.length === 0 ? (
                <div className="m3-card" style={{ padding: '16px', textAlign: 'center', color: 'var(--color-outline)', fontStyle: 'italic' }}>
                  No starred contacts yet.
                </div>
              ) : (
                <div className="no-scrollbar" style={{
                  display: 'flex',
                  gap: '12px',
                  overflowX: 'auto',
                  padding: '8px 4px',
                  scrollSnapType: 'x mandatory',
                  WebkitOverflowScrolling: 'touch'
                }}>
                  {favoriteContacts.map(contact => {
                    const fullName = `${contact.first_name || ''} ${contact.last_name || ''}`.trim() || 'Unnamed';
                    const initial = fullName[0].toUpperCase();
                    return (
                      <div
                        key={contact.id}
                        onClick={() => onNavigateToContact(contact)}
                        style={{
                          display: 'flex',
                          flexDirection: 'column',
                          alignItems: 'center',
                          cursor: 'pointer',
                          gap: '6px',
                          minWidth: '64px',
                          scrollSnapAlign: 'start'
                        }}
                      >
                        {contact.photo ? (
                          <img src={contact.photo} alt={fullName} style={{ width: '56px', height: '56px', borderRadius: '50%', objectFit: 'cover', border: '2px solid var(--color-primary)' }} />
                        ) : (
                          <div style={{
                            width: '56px',
                            height: '56px',
                            borderRadius: '50%',
                            backgroundColor: contact.avatar || 'var(--color-primary)',
                            color: '#ffffff',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            fontWeight: 'bold',
                            fontSize: '1.3rem',
                            fontFamily: 'var(--font-title)',
                            border: '2px solid var(--color-primary)'
                          }}>
                            {initial}
                          </div>
                        )}
                        <span style={{ fontSize: '0.75rem', fontWeight: '500', maxWidth: '64px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', textAlign: 'center' }}>
                          {contact.first_name || 'Unnamed'}
                        </span>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          );
        }

        if (sectionKey === 'notes') {
          return showNotes && (
            <div key="notes" style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <h3 style={{ fontSize: '1.1rem', fontFamily: 'var(--font-title)', fontWeight: '600', display: 'flex', alignItems: 'center', gap: '6px' }}>
                  <span className="material-symbols-outlined" style={{ color: 'var(--color-primary)' }}>note_alt</span>
                  Favorite Notes
                </h3>
                <button className="m3-btn m3-btn-text" onClick={() => onNavigateToTab('notes')} style={{ fontSize: '0.8rem', padding: '0 8px' }}>
                  View All
                </button>
              </div>

              {favoriteNotes.length === 0 ? (
                <div className="m3-card" style={{ padding: '16px', textAlign: 'center', color: 'var(--color-outline)', fontStyle: 'italic' }}>
                  No starred notes yet.
                </div>
              ) : (
                <div style={{
                  display: 'grid',
                  gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))',
                  gap: '12px'
                }}>
                  {favoriteNotes.map(note => {
                    const checklistItems = parseChecklist(note.checklist);
                    return (
                      <div
                        key={note.id}
                        onClick={() => onNavigateToNote(note)}
                        className="m3-card"
                        style={{
                          backgroundColor: 'var(--color-surface-container)',
                          borderRadius: '12px',
                          padding: '12px',
                          display: 'flex',
                          flexDirection: 'column',
                          minHeight: '120px',
                          maxHeight: '240px',
                          position: 'relative',
                          overflow: 'hidden'
                        }}
                      >
                        <span className="material-symbols-outlined" style={{ position: 'absolute', top: '8px', right: '8px', color: 'var(--color-primary)', fontSize: '1rem' }}>star</span>
                        
                        {note.photo && (
                          <img src={note.photo} alt={note.title} style={{ width: '100%', height: '60px', objectFit: 'cover', borderRadius: '6px', marginBottom: '6px' }} />
                        )}

                        <h4 style={{ fontWeight: '600', marginBottom: '6px', fontSize: '0.95rem', paddingRight: '14px', textOverflow: 'ellipsis', overflow: 'hidden', whiteSpace: 'nowrap' }}>
                          {note.title}
                        </h4>

                        {checklistItems.length > 0 ? (
                          <div style={{ fontSize: '0.8rem', display: 'flex', flexDirection: 'column', gap: '4px', overflow: 'hidden' }}>
                            {checklistItems.slice(0, 3).map((item, idx) => (
                              <div key={idx} style={{ display: 'flex', alignItems: 'center', gap: '4px', opacity: item.done ? 0.6 : 1, textDecoration: item.done ? 'line-through' : 'none' }}>
                                <span className="material-symbols-outlined" style={{ fontSize: '0.85rem', color: 'var(--color-primary)' }}>
                                  {item.done ? 'check_box' : 'check_box_outline_blank'}
                                </span>
                                <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{item.text}</span>
                              </div>
                            ))}
                          </div>
                        ) : (
                          <p style={{
                            fontSize: '0.85rem',
                            opacity: 0.85,
                            overflow: 'hidden',
                            display: '-webkit-box',
                            WebkitLineClamp: note.photo ? 3 : 5,
                            WebkitBoxOrient: 'vertical',
                            lineHeight: '1.35',
                            whiteSpace: 'pre-wrap'
                          }}>
                            {note.content}
                          </p>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          );
        }

        return null;
      })}

      {/* Customize Dashboard Button */}
      <div style={{ display: 'flex', justifyContent: 'center', marginTop: '1.5rem', marginBottom: '2.5rem', flexShrink: 0 }}>
        <button 
          type="button" 
          className="m3-btn m3-btn-outlined" 
          onClick={() => {
            setTempWelcomeText(customWelcomeText);
            setIsEditingPreferences(true);
          }}
          style={{ display: 'flex', alignItems: 'center', gap: '8px' }}
        >
          <span className="material-symbols-outlined">tune</span>
          Customize Dashboard
        </button>
      </div>

      {/* Customize Homescreen Preferences Modal */}
      {isEditingPreferences && (
        <div className="backdrop" onClick={() => setIsEditingPreferences(false)}>
          <div className="bottom-sheet" onClick={e => e.stopPropagation()} style={{
            maxWidth: '500px',
            backgroundColor: 'var(--color-surface)',
            color: 'var(--color-on-surface)',
            padding: '2rem',
            display: 'flex',
            flexDirection: 'column',
            gap: '1.5rem',
            borderRadius: '28px 28px 0 0'
          }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <h3 style={{ fontFamily: 'var(--font-title)', fontSize: '1.25rem', fontWeight: '600' }}>Customize Homescreen</h3>
              <button 
                type="button" 
                className="m3-btn m3-btn-text" 
                style={{ width: '40px', height: '40px', padding: 0, borderRadius: '50%', minWidth: 'unset', color: 'inherit' }}
                onClick={() => setIsEditingPreferences(false)}
              >
                <span className="material-symbols-outlined">close</span>
              </button>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem', overflowY: 'auto', flex: 1 }}>
              {/* Custom Welcome text */}
              <div className="m3-text-field">
                <input 
                  type="text" 
                  value={tempWelcomeText} 
                  onChange={e => setTempWelcomeText(e.target.value)} 
                  placeholder=" " 
                />
                <label>Custom Welcome Subtext Message</label>
                <span style={{ fontSize: '0.75rem', color: 'var(--color-outline)', marginTop: '4px', display: 'block' }}>
                  Leave empty to revert to default: "Welcome back! Let's see what is on your agenda today."
                </span>
              </div>

              {/* Weather Widget Toggle */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', marginBottom: '8px' }}>
                <label style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', cursor: 'pointer', padding: '8px 12px', backgroundColor: 'var(--color-surface-container-low)', borderRadius: '12px', border: '1px solid var(--color-outline-variant)' }}>
                  <span style={{ fontSize: '0.9rem', display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <span className="material-symbols-outlined" style={{ opacity: 0.8 }}>partly_cloudy_day</span>
                    Show Weather Widget in Header
                  </span>
                  <input 
                    type="checkbox" 
                    checked={showWeather} 
                    onChange={e => {
                      setShowWeather(e.target.checked);
                      localStorage.setItem('home_show_weather', e.target.checked);
                    }}
                    style={{ width: '18px', height: '18px', cursor: 'pointer' }}
                  />
                </label>
              </div>

              {/* Draggable Dashboard Sections List */}
              <h4 style={{ fontFamily: 'var(--font-title)', fontSize: '0.95rem', fontWeight: '600', color: 'var(--color-primary)', marginTop: '8px' }}>
                Dashboard Sections (Drag to Reorder)
              </h4>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                {sectionsOrder.map((sec, idx) => {
                  const label = sec === 'calendar' ? 'Upcoming Appointments' : sec === 'contacts' ? 'Favorite Contacts' : 'Favorite Notes';
                  const icon = sec === 'calendar' ? 'event' : sec === 'contacts' ? 'group' : 'note_alt';
                  const isVisible = sec === 'calendar' ? showCalendar : sec === 'contacts' ? showContacts : showNotes;
                  const setVisible = sec === 'calendar' ? setShowCalendar : sec === 'contacts' ? setShowContacts : setShowNotes;
                  const storageKey = sec === 'calendar' ? 'home_show_calendar' : sec === 'contacts' ? 'home_show_contacts' : 'home_show_notes';

                  return (
                    <div 
                      key={sec} 
                      draggable
                      onDragStart={(e) => handleDragStart(e, idx)}
                      onDragOver={(e) => handleDragOver(e, idx)}
                      onDragEnd={handleDragEnd}
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        backgroundColor: draggedIndex === idx ? 'var(--color-surface-container-highest)' : 'var(--color-surface-container-high)',
                        padding: '10px 12px',
                        borderRadius: '12px',
                        border: '1px solid var(--color-outline-variant)',
                        cursor: 'grab',
                        opacity: draggedIndex === idx ? 0.5 : 1,
                        transition: 'background-color 0.2s, opacity 0.2s',
                        userSelect: 'none'
                      }}
                    >
                      <span style={{ fontSize: '0.9rem', display: 'flex', alignItems: 'center', gap: '10px' }}>
                        <span className="material-symbols-outlined" style={{ color: 'var(--color-outline)', cursor: 'grab' }}>drag_indicator</span>
                        <span className="material-symbols-outlined" style={{ opacity: 0.8 }}>{icon}</span>
                        {label}
                      </span>
                      <input 
                        type="checkbox" 
                        checked={isVisible} 
                        onChange={e => {
                          setVisible(e.target.checked);
                          localStorage.setItem(storageKey, e.target.checked);
                        }}
                        onClick={e => e.stopPropagation()}
                        style={{ width: '18px', height: '18px', cursor: 'pointer' }}
                      />
                    </div>
                  );
                })}
              </div>
            </div>

            <div style={{ display: 'flex', gap: '8px', justifyContent: 'flex-end', marginTop: '8px' }}>
              <button 
                type="button" 
                className="m3-btn m3-btn-filled" 
                onClick={() => {
                  const val = tempWelcomeText.trim() || "Welcome back! Let's see what is on your agenda today.";
                  setCustomWelcomeText(val);
                  localStorage.setItem('home_welcome_text_custom', val);
                  setIsEditingPreferences(false);
                }}
              >
                Apply Changes
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
