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

const formatDateLocal = (date) => {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
};

export default function CalendarView() {
  const [events, setEvents] = useState([]);
  const [calendars, setCalendars] = useState([]);
  const [selectedDate, setSelectedDate] = useState(new Date());
  const [isEditing, setIsEditing] = useState(false);
  const [currentEvent, setCurrentEvent] = useState(null);

  // Form State
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [date, setDate] = useState('');
  const [startTime, setStartTime] = useState('');
  const [endTime, setEndTime] = useState('');
  const [location, setLocation] = useState('');
  const [allDay, setAllDay] = useState(false);
  const [selectedCalendarId, setSelectedCalendarId] = useState('');

  // UI State for calendars
  const [visibleCalendars, setVisibleCalendars] = useState({});
  const [showColorPickerFor, setShowColorPickerFor] = useState(null);

  // Load events and calendars
  const loadData = () => {
    const rawEvents = syncEngine.getItems('calendar');
    let cals = syncEngine.getItems('calendars');
    
    // Auto-create a default primary calendar if none exist
    if (cals.length === 0) {
      const defaultCal = syncEngine.saveItem('calendars', {
        name: 'Primary',
        color: '#6750A4'
      });
      cals = [defaultCal];
    }
    
    setEvents(rawEvents);
    setCalendars(cals);

    // Initialize visibility mapping
    setVisibleCalendars(prev => {
      const updated = { ...prev };
      cals.forEach(cal => {
        if (updated[cal.id] === undefined) {
          updated[cal.id] = true;
        }
      });
      return updated;
    });
  };

  useEffect(() => {
    loadData();
    return syncEngine.subscribe(loadData);
  }, []);

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

  // Filter events by calendar visibility
  const visibleEvents = events.filter(e => {
    const cal = getCalendarForEvent(e);
    return visibleCalendars[cal.id] !== false;
  });

  const isEventMatchingDay = (event, day) => {
    if (!event.start_time) return false;
    const eventParts = String(event.start_time).split('T')[0].split('-');
    if (eventParts.length < 3) return false;
    
    const dayParts = formatDateLocal(day).split('-');
    
    const cal = getCalendarForEvent(event);
    const isBirthday = 
      (cal.name && cal.name.toLowerCase().includes('birthday')) || 
      (event.title && (event.title.toLowerCase().includes('birthday') || event.title.toLowerCase().includes('jarig')));
      
    if (isBirthday) {
      return eventParts[1] === dayParts[1] && eventParts[2] === dayParts[2];
    }
    
    return eventParts[0] === dayParts[0] && eventParts[1] === dayParts[1] && eventParts[2] === dayParts[2];
  };

  const getEventSortTime = (e, nowVal) => {
    if (!e.start_time) return 0;
    const cal = getCalendarForEvent(e);
    const isBirthday = 
      (cal.name && cal.name.toLowerCase().includes('birthday')) || 
      (e.title && (e.title.toLowerCase().includes('birthday') || e.title.toLowerCase().includes('jarig')));
      
    if (isBirthday) {
      const eventParts = String(e.start_time).split('T')[0].split('-');
      const bdayDate = new Date(nowVal.getFullYear(), parseInt(eventParts[1]) - 1, parseInt(eventParts[2]), 0, 0, 0);
      return bdayDate.getTime();
    }
    return new Date(e.start_time).getTime();
  };

  const selectedDateEvents = visibleEvents.filter(event => {
    return isEventMatchingDay(event, selectedDate);
  });

  // Form helper: open modal
  const openEdit = (event = null) => {
    if (event) {
      setCurrentEvent(event);
      setTitle(event.title || '');
      setDescription(event.description || '');
      const parts = (event.start_time || '').split('T');
      setDate(parts[0] || new Date().toISOString().split('T')[0]);
      setStartTime(parts[1]?.slice(0, 5) || '12:00');
      const endParts = (event.end_time || '').split('T');
      setEndTime(endParts[1]?.slice(0, 5) || '13:00');
      setLocation(event.location || '');
      setAllDay(!!event.all_day);
      setSelectedCalendarId(event.calendar_id || calendars[0]?.id || '');
    } else {
      setCurrentEvent(null);
      setTitle('');
      setDescription('');
      setDate(selectedDate.toISOString().split('T')[0]);
      setStartTime('12:00');
      setEndTime('13:00');
      setLocation('');
      setAllDay(false);
      setSelectedCalendarId(calendars[0]?.id || '');
    }
    setIsEditing(true);
  };

  const handleSave = (e) => {
    e.preventDefault();
    if (!title.trim()) return;

    const start_time = allDay ? `${date}T00:00:00` : `${date}T${startTime}:00`;
    const end_time = allDay ? `${date}T23:59:59` : `${date}T${endTime}:00`;

    syncEngine.saveItem('calendar', {
      id: currentEvent?.id,
      title,
      description,
      start_time,
      end_time,
      location,
      all_day: allDay,
      calendar_id: selectedCalendarId || calendars[0]?.id
    });

    setIsEditing(false);
  };

  const handleDelete = (id) => {
    if (confirm('Delete this event?')) {
      syncEngine.deleteItem('calendar', id);
      setIsEditing(false);
    }
  };

  // Calendar math
  const getDaysInMonth = (date) => {
    const year = date.getFullYear();
    const month = date.getMonth();
    const firstDay = new Date(year, month, 1).getDay();
    const daysCount = new Date(year, month + 1, 0).getDate();
    
    const days = [];
    // Leading days from previous month
    for (let i = firstDay - 1; i >= 0; i--) {
      days.push(new Date(year, month, -i));
    }
    // Current month days
    for (let i = 1; i <= daysCount; i++) {
      days.push(new Date(year, month, i));
    }
    // Trailing days from next month to fill exactly 42 slots (6 rows * 7 days)
    let nextMonthDay = 1;
    while (days.length < 42) {
      days.push(new Date(year, month + 1, nextMonthDay++));
    }
    return days;
  };

  const changeMonth = (offset) => {
    setSelectedDate(new Date(selectedDate.getFullYear(), selectedDate.getMonth() + offset, 1));
  };

  const monthDays = getDaysInMonth(selectedDate);

  return (
    <div className="view-container" style={{ height: '100%', maxWidth: '100%', margin: '0 auto', width: '100%', display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
      <style>{`
        .calendar-layout-container {
          display: flex;
          flex-direction: column;
          gap: 1.5rem;
          width: 100%;
          flex: 1;
          min-height: 0;
          overflow-y: auto;
        }
        .calendar-left-pane {
          flex: 1;
          display: flex;
          flex-direction: column;
        }
        .calendar-right-pane {
          flex: 1;
          display: flex;
          flex-direction: column;
          gap: 1.5rem;
          padding-bottom: 80px; /* Space for FAB */
        }
        .calendar-outer-container {
          background-color: var(--color-surface-container-low);
          border: 1px solid var(--color-outline-variant);
          border-radius: 24px;
          padding: 24px;
          display: flex;
          flex-direction: column;
          gap: 16px;
          width: 100%;
        }
        .calendar-header-controls {
          display: flex;
          justify-content: space-between;
          align-items: center;
          margin-bottom: 8px;
          width: 100%;
        }
        .calendar-month-title {
          font-size: 1.25rem;
          font-weight: 600;
          color: var(--color-on-surface);
          font-family: var(--font-title);
          text-align: center;
        }
        .calendar-nav-btn {
          width: 36px;
          height: 36px;
          border-radius: 50%;
          background-color: var(--color-surface-container-high);
          border: none;
          display: flex;
          align-items: center;
          justify-content: center;
          cursor: pointer;
          color: var(--color-on-surface);
          transition: background-color 0.2s ease;
        }
        .calendar-nav-btn:hover {
          background-color: var(--color-surface-variant);
        }
        .calendar-nav-btn span {
          font-size: 1.5rem;
        }
        .calendar-weekday-header {
          display: grid;
          grid-template-columns: repeat(7, 1fr);
          text-align: center;
          width: 100%;
        }
        .calendar-weekday-label {
          font-size: 0.85rem;
          font-weight: 600;
          color: var(--color-primary);
          text-transform: uppercase;
        }
        .calendar-grid-cells {
          display: grid;
          grid-template-columns: repeat(7, 1fr);
          gap: 4px;
          width: 100%;
        }
        .calendar-day-cell {
          background: none;
          border: none;
          padding: 0;
          display: flex;
          align-items: center;
          justify-content: center;
          cursor: pointer;
          min-height: 48px;
        }
        .calendar-day-inner {
          display: flex;
          align-items: center;
          justify-content: center;
          font-size: 0.95rem;
          width: 42px;
          height: 42px;
          border-radius: 50%;
          position: relative;
        }
        .calendar-day-cell:hover .calendar-day-inner:not(.active) {
          background-color: var(--color-surface-variant);
        }
        .calendar-day-inner.active {
          background-color: var(--color-primary);
          color: var(--color-on-primary) !important;
          font-weight: bold;
        }
        .calendar-day-inner.today:not(.active) {
          border: 2px solid var(--color-primary);
          font-weight: bold;
        }
        .calendar-day-inner.out-of-month {
          color: var(--color-outline);
          opacity: 0.5;
        }
        .calendar-day-inner.current-month {
          color: var(--color-on-surface);
        }
        .events-bottom-section {
          margin-top: 0px;
          padding-top: 0px;
          width: 100%;
        }
        .events-bottom-title {
          font-size: 1.15rem;
          font-weight: bold;
          color: var(--color-on-surface);
          margin-bottom: 12px;
          font-family: var(--font-title);
        }
        .events-empty-msg {
          color: var(--color-outline);
          font-size: 0.95rem;
          padding: 8px 0;
          font-style: italic;
        }
        @media (min-width: 768px) {
          .calendar-layout-container {
            flex-direction: row;
            align-items: flex-start;
          }
          .calendar-left-pane {
            flex: 1.4;
          }
          .calendar-right-pane {
            flex: 1;
            position: sticky;
            top: 0;
            max-height: calc(100vh - 120px);
            overflow-y: auto;
            padding-right: 8px;
            padding-bottom: 80px;
          }
          .calendar-outer-container {
            max-height: 60%;
            aspect-ratio: 1 / 1;
          }
          .calendar-grid-cells {
            flex: 1;
          }
          .calendar-day-inner {
            width: 100%;
            height: 100%;
            max-width: 56px;
            max-height: 56px;
            aspect-ratio: 1 / 1;
          }
          .calendar-day-cell {
            min-height: unset;
          }
        }
        @media (max-width: 480px) {
          .calendar-day-inner {
            width: 36px;
            height: 36px;
          }
        }
      `}</style>

      <div className="view-header" style={{ flexShrink: 0 }}>
        <h2>Server Calendar Viewer</h2>
      </div>

      <div className="calendar-layout-container">
        {/* Left column: Month selector and Grid */}
        <div className="calendar-left-pane">
          <div className="calendar-outer-container">
            {/* Month Navigation Control */}
            <div className="calendar-header-controls">
              <button type="button" className="calendar-nav-btn" onClick={() => changeMonth(-1)}>
                <span className="material-symbols-outlined">chevron_left</span>
              </button>
              <span className="calendar-month-title">
                {selectedDate.toLocaleString('default', { month: 'long', year: 'numeric' })}
              </span>
              <button type="button" className="calendar-nav-btn" onClick={() => changeMonth(1)}>
                <span className="material-symbols-outlined">chevron_right</span>
              </button>
            </div>

            {/* Days of week header */}
            <div className="calendar-weekday-header">
              {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map((day, idx) => (
                <div key={idx} className="calendar-weekday-label">{day}</div>
              ))}
            </div>

            {/* Days Grid */}
            <div className="calendar-grid-cells">
              {monthDays.map((day, idx) => {
                const active = formatDateLocal(day) === formatDateLocal(selectedDate);
                const isToday = formatDateLocal(day) === formatDateLocal(new Date());
                const isCurrentMonth = day.getMonth() === selectedDate.getMonth() && day.getFullYear() === selectedDate.getFullYear();

                const dayEvents = visibleEvents.filter(e => {
                  return isEventMatchingDay(e, day);
                });
                const uniqueCalColors = [...new Set(dayEvents.map(e => getCalendarForEvent(e).color))];

                return (
                  <button
                    key={idx}
                    className="calendar-day-cell"
                    onClick={() => setSelectedDate(day)}
                  >
                    <div className={`calendar-day-inner ${active ? 'active' : ''} ${isToday ? 'today' : ''} ${isCurrentMonth ? 'current-month' : 'out-of-month'}`}>
                      {day.getDate()}
                      <div style={{
                        position: 'absolute',
                        bottom: '4px',
                        left: '50%',
                        transform: 'translateX(-50%)',
                        display: 'flex',
                        gap: '2px',
                        justifyContent: 'center',
                        width: '100%',
                        pointerEvents: 'none'
                      }}>
                        {uniqueCalColors.slice(0, 3).map((col, cIdx) => (
                          <span
                            key={cIdx}
                            style={{
                              width: '5px',
                              height: '5px',
                              borderRadius: '50%',
                              backgroundColor: active ? 'var(--color-on-primary)' : col
                            }}
                          />
                        ))}
                      </div>
                    </div>
                  </button>
                );
              })}
            </div>
          </div>
        </div>

        {/* Right column: Calendars list, Selected Day Events, and Upcoming appointments */}
        <div className="calendar-right-pane">
          {/* Calendars Manager Section */}
          <div style={{
            backgroundColor: 'var(--color-surface-container-low)',
            padding: '16px',
            borderRadius: '24px',
            border: '1px solid var(--color-outline-variant)'
          }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
              <h3 className="events-bottom-title" style={{ margin: 0, fontSize: '1.05rem' }}>My Calendars</h3>
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
                + New
              </button>
            </div>
            
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
              {calendars.map(cal => (
                <div key={cal.id} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px', minWidth: 0 }}>
                    <input
                      type="checkbox"
                      checked={visibleCalendars[cal.id] !== false}
                      onChange={() => setVisibleCalendars(prev => ({ ...prev, [cal.id]: visibleCalendars[cal.id] === false }))}
                      style={{ cursor: 'pointer', flexShrink: 0 }}
                    />
                    <span style={{ fontSize: '0.9rem', color: 'var(--color-on-surface)', textOverflow: 'ellipsis', overflow: 'hidden', whiteSpace: 'nowrap' }}>
                      {cal.name}
                    </span>
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
                        alignItems: 'center',
                        flexShrink: 0
                      }}
                      title="Rename"
                    >
                      <span className="material-symbols-outlined" style={{ fontSize: '0.95rem' }}>edit</span>
                    </button>
                  </div>
                  
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px', position: 'relative', flexShrink: 0 }}>
                    {/* Color Circle Picker button */}
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
                            // Mark all events in this calendar as deleted
                            events.forEach(evt => {
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

          {/* Selected Day events */}
          <div className="events-bottom-section">
            <h3 className="events-bottom-title">Events for Today</h3>
            {selectedDateEvents.length === 0 ? (
              <p className="events-empty-msg">No events scheduled for this day.</p>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                {selectedDateEvents.map(event => (
                  <div
                    key={event.id}
                    className="m3-card"
                    onClick={() => openEdit(event)}
                    style={{
                      display: 'flex',
                      justifyContent: 'space-between',
                      alignItems: 'center',
                      cursor: 'pointer',
                      borderLeft: `4px solid ${getCalendarForEvent(event).color}`,
                      paddingLeft: '12px'
                    }}
                  >
                    <div>
                      <h4 style={{ fontWeight: '600' }}>{event.title}</h4>
                      <p style={{ fontSize: '0.85rem', color: 'var(--color-on-surface-variant)', marginTop: '4px' }}>
                        {formatEventTime(event)}
                        {event.location && (
                          <>
                            {' • '}
                            <a
                              href={`https://www.openstreetmap.org/search?query=${encodeURIComponent(event.location)}`}
                              target="_blank"
                              rel="noopener noreferrer"
                              onClick={(e) => e.stopPropagation()}
                              style={{ color: 'var(--color-primary)', textDecoration: 'underline' }}
                            >
                              📍 {event.location}
                            </a>
                          </>
                        )}
                      </p>
                      {event.description && <p style={{ fontSize: '0.85rem', marginTop: '6px', color: 'var(--color-outline)' }}>{event.description}</p>}
                    </div>
                    <span className="material-symbols-outlined" style={{ color: 'var(--color-primary)' }}>edit</span>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Upcoming appointments */}
          <div style={{ borderTop: '1px solid var(--color-outline-variant)', paddingTop: '1.5rem', width: '100%' }}>
            <h3 className="events-bottom-title" style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
              <span className="material-symbols-outlined" style={{ fontSize: '1.3rem', color: 'var(--color-primary)' }}>upcoming</span>
              Upcoming Appointments
            </h3>
            {(() => {
              const now = new Date();
              const upcomingEvents = visibleEvents
                .map(e => ({
                  event: e,
                  sortTime: getEventSortTime(e, now)
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
                .slice(0, 3)
                .map(item => item.event);

              if (upcomingEvents.length === 0) {
                return <p className="events-empty-msg">No upcoming appointments.</p>;
              }

              return (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                  {upcomingEvents.map(event => {
                    const cal = getCalendarForEvent(event);
                    const isBirthday = 
                      (cal.name && cal.name.toLowerCase().includes('birthday')) || 
                      (event.title && (event.title.toLowerCase().includes('birthday') || event.title.toLowerCase().includes('jarig')));
                    
                    let eventDate = new Date(event.start_time);
                    if (isBirthday && event.start_time) {
                      const eventParts = String(event.start_time).split('T')[0].split('-');
                      eventDate = new Date(now.getFullYear(), parseInt(eventParts[1]) - 1, parseInt(eventParts[2]), 0, 0, 0);
                    }
                    const formattedDate = eventDate.toLocaleDateString(undefined, { month: 'short', day: 'numeric', weekday: 'short' });
                    return (
                      <div
                        key={event.id}
                        className="m3-card"
                        onClick={() => openEdit(event)}
                        style={{
                          display: 'flex',
                          justifyContent: 'space-between',
                          alignItems: 'center',
                          padding: '10px 12px',
                          cursor: 'pointer',
                          borderLeft: `4px solid ${getCalendarForEvent(event).color}`,
                          paddingLeft: '12px'
                        }}
                      >
                        <div>
                          <span style={{ fontSize: '0.8rem', fontWeight: 'bold', color: 'var(--color-primary)', display: 'block', marginBottom: '2px' }}>
                            {formattedDate}
                          </span>
                          <h4 style={{ fontWeight: '600', fontSize: '0.95rem' }}>{event.title}</h4>
                          <p style={{ fontSize: '0.8rem', color: 'var(--color-on-surface-variant)', marginTop: '2px' }}>
                            {formatEventTime(event)}
                            {event.location && (
                              <>
                                {' • '}
                                <a
                                  href={`https://www.openstreetmap.org/search?query=${encodeURIComponent(event.location)}`}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  onClick={(e) => e.stopPropagation()}
                                  style={{ color: 'var(--color-primary)', textDecoration: 'underline' }}
                                >
                                  📍 {event.location}
                                </a>
                              </>
                            )}
                          </p>
                        </div>
                        <span className="material-symbols-outlined" style={{ color: 'var(--color-primary)', fontSize: '1.2rem' }}>edit</span>
                      </div>
                    );
                  })}
                </div>
              );
            })()}
          </div>
        </div>
      </div>

      {/* FAB to add events */}
      <button className="fab" onClick={() => openEdit()}>
        <span className="material-symbols-outlined">add</span>
      </button>

      {/* Add/Edit Bottom Sheet Dialog */}
      {isEditing && (
        <div className="backdrop" onClick={() => setIsEditing(false)}>
          <form className="bottom-sheet" onClick={(e) => e.stopPropagation()} onSubmit={handleSave}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem' }}>
              <h3 style={{ fontFamily: 'var(--font-title)' }}>{currentEvent ? 'Edit Event' : 'New Event'}</h3>
              <button type="button" className="m3-btn m3-btn-text" onClick={() => setIsEditing(false)}>
                <span className="material-symbols-outlined">close</span>
              </button>
            </div>

            <div className="m3-text-field">
              <input type="text" value={title} onChange={e => setTitle(e.target.value)} placeholder=" " required />
              <label>Event Title</label>
            </div>

            {/* Calendar Selector */}
            <div className="m3-text-field">
              <select
                value={selectedCalendarId}
                onChange={e => setSelectedCalendarId(e.target.value)}
                style={{
                  width: '100%',
                  border: 'none',
                  outline: 'none',
                  background: 'transparent',
                  color: 'var(--color-on-surface)',
                  fontFamily: 'var(--font-sans)',
                  fontSize: '1rem',
                  padding: '8px 0',
                  borderBottom: '1px solid var(--color-outline-variant)'
                }}
              >
                {calendars.map(cal => (
                  <option key={cal.id} value={cal.id} style={{ backgroundColor: 'var(--color-surface-container)', color: 'var(--color-on-surface)' }}>
                    {cal.name}
                  </option>
                ))}
              </select>
              <label style={{ transform: 'translateY(-1.25rem) scale(0.75)' }}>Calendar</label>
            </div>

            <div className="m3-text-field">
              <input type="text" value={location} onChange={e => setLocation(e.target.value)} placeholder=" " />
              <label>Location (Optional)</label>
            </div>

            <div className="m3-text-field">
              <textarea rows="3" value={description} onChange={e => setDescription(e.target.value)} placeholder=" " />
              <label>Description</label>
            </div>

            <div style={{ display: 'flex', gap: '8px' }}>
              <div className="m3-text-field" style={{ flex: 1 }}>
                <input type="date" value={date} onChange={e => setDate(e.target.value)} placeholder=" " required />
                <label>Date</label>
              </div>
            </div>

            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '1.25rem' }}>
              <input type="checkbox" id="allDay" checked={allDay} onChange={e => setAllDay(e.target.checked)} />
              <label htmlFor="allDay" style={{ cursor: 'pointer', userSelect: 'none' }}>All Day Event</label>
            </div>

            {!allDay && (
              <div style={{ display: 'flex', gap: '8px' }}>
                <div className="m3-text-field" style={{ flex: 1 }}>
                  <input type="time" value={startTime} onChange={e => setStartTime(e.target.value)} placeholder=" " required={!allDay} />
                  <label>Start Time</label>
                </div>
                <div className="m3-text-field" style={{ flex: 1 }}>
                  <input type="time" value={endTime} onChange={e => setEndTime(e.target.value)} placeholder=" " required={!allDay} />
                  <label>End Time</label>
                </div>
              </div>
            )}

            <div style={{ display: 'flex', gap: '8px', justifyContent: 'flex-end', marginTop: '1rem' }}>
              {currentEvent && (
                <button type="button" className="m3-btn m3-btn-text" style={{ color: 'var(--color-error)' }} onClick={() => handleDelete(currentEvent.id)}>
                  Delete
                </button>
              )}
              <button type="submit" className="m3-btn m3-btn-filled">
                Save
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
}
