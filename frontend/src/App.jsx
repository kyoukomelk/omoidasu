import React, { useState, useEffect } from 'react';
import HomeView from './components/HomeView';
import CalendarView from './components/CalendarView';
import ContactsView from './components/ContactsView';
import NotesView from './components/NotesView';
import SettingsView from './components/SettingsView';
import OnboardingWizard from './components/OnboardingWizard';
import { syncEngine } from './utils/syncEngine';
import LoginView from './components/LoginView';

class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error) {
    return { hasError: true, error };
  }

  componentDidCatch(error, errorInfo) {
    console.error("ErrorBoundary caught error:", error, errorInfo);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div style={{
          padding: '24px',
          margin: '24px',
          backgroundColor: '#ffdad9',
          color: '#410002',
          borderRadius: '28px',
          border: '1px solid #ba1a1a',
          fontFamily: 'sans-serif',
          maxWidth: '600px',
          boxSizing: 'border-box'
        }}>
          <h3 style={{ margin: '0 0 12px 0' }}>Component Render Error</h3>
          <p style={{ fontSize: '0.9rem', margin: '0 0 16px 0' }}>A crash occurred while displaying this page view.</p>
          <pre style={{
            backgroundColor: 'rgba(0,0,0,0.05)',
            padding: '12px',
            borderRadius: '12px',
            fontFamily: 'monospace',
            fontSize: '0.85rem',
            whiteSpace: 'pre-wrap',
            overflowX: 'auto',
            margin: 0
          }}>
            {this.state.error ? this.state.error.stack || this.state.error.message : 'Unknown error'}
          </pre>
          <button
            className="m3-btn m3-btn-filled"
            style={{ marginTop: '16px', backgroundColor: '#ba1a1a', color: 'white' }}
            onClick={() => this.setState({ hasError: false, error: null })}
          >
            Reset view
          </button>
        </div>
      );
    }
    return this.props.children;
  }
}

export default function App() {
  const [activeTab, setActiveTab] = useState('home'); // 'home' | 'calendar' | 'contacts' | 'notes' | 'settings'
  const [syncStatus, setSyncStatus] = useState(syncEngine.getSyncStatus());
  const [globalError, setGlobalError] = useState(null);

  // Detailed selected items for quick focusing when navigating from Home
  const [focusedContact, setFocusedContact] = useState(null);
  const [focusedNote, setFocusedNote] = useState(null);

  const [activeUser, setActiveUser] = useState(() => syncEngine.getActiveUser());

  // User Profile configuration
  const [userProfile, setUserProfile] = useState(() => {
    const user = syncEngine.getActiveUser();
    if (user) {
      const hasOnboardedData = !!user.birthday || 
                               !!user.location || 
                               (user.displayName || '').toLowerCase() !== (user.username || '').toLowerCase();
      if (hasOnboardedData) {
        localStorage.setItem(`omoidasu_onboarded_${user.id}`, 'true');
      }
      const onboarded = localStorage.getItem(`omoidasu_onboarded_${user.id}`) === 'true';
      return {
        name: user.displayName || user.username,
        birthday: user.birthday || '',
        location: user.location || '',
        profilePicture: user.profilePicture || '',
        isAdmin: user.isAdmin || false,
        onboarded: onboarded
      };
    }
    return { name: '', birthday: '', location: '', profilePicture: '', isAdmin: false, onboarded: false };
  });

  // Initialize theme mode and hue from storage on mount
  useEffect(() => {
    const user = syncEngine.getActiveUser();
    const savedMode = user ? (user.themeMode || 'dark') : (localStorage.getItem('theme_mode') || 'dark');
    const savedHue = user ? (user.themeHue || 'sakura-pink') : (localStorage.getItem('theme_hue') || 'sakura-pink');

    const mapHue = (hue) => {
      if (['sakura-pink', 'light-blue', 'monochrome', 'dark-orange', 'dark-purple'].includes(hue)) {
        return hue;
      }
      if (hue === '270') return 'dark-purple';
      if (hue === '170' || hue === '210') return 'light-blue';
      if (hue === '30' || hue === '0') return 'dark-orange';
      return 'sakura-pink';
    };

    const finalHue = mapHue(savedHue);
    document.documentElement.setAttribute('data-theme-mode', savedMode);
    document.documentElement.setAttribute('data-theme-color', finalHue);
    document.documentElement.style.setProperty('--theme-hue', finalHue);

    const errorHandler = (event) => {
      setGlobalError(event.error ? event.error.stack || event.error.message : event.message);
    };
    window.addEventListener('error', errorHandler);

    // Initial sync on mount
    syncEngine.sync();

    // Subscribe to sync engine updates
    const unsubscribe = syncEngine.subscribe(() => {
      setSyncStatus(syncEngine.getSyncStatus());
      const user = syncEngine.getActiveUser();
      setActiveUser(user);
      if (user) {
        const userHue = mapHue(user.themeHue || 'sakura-pink');
        document.documentElement.setAttribute('data-theme-mode', user.themeMode || 'dark');
        document.documentElement.setAttribute('data-theme-color', userHue);
        document.documentElement.style.setProperty('--theme-hue', userHue);
        const onboarded = localStorage.getItem(`omoidasu_onboarded_${user.id}`) === 'true';
        setUserProfile({
          name: user.displayName || user.username,
          birthday: user.birthday || '',
          location: user.location || '',
          profilePicture: user.profilePicture || '',
          isAdmin: user.isAdmin || false,
          onboarded: onboarded
        });
      } else {
        setUserProfile({ name: '', birthday: '', location: '', profilePicture: '', isAdmin: false, onboarded: false });
      }
    });
    return () => {
      window.removeEventListener('error', errorHandler);
      unsubscribe();
    };
  }, []);

  // Recalculate userProfile whenever activeUser session changes
  useEffect(() => {
    if (activeUser) {
      const mapHue = (hue) => {
        if (['sakura-pink', 'light-blue', 'monochrome', 'dark-orange', 'dark-purple'].includes(hue)) {
          return hue;
        }
        if (hue === '270') return 'dark-purple';
        if (hue === '170' || hue === '210') return 'light-blue';
        if (hue === '30' || hue === '0') return 'dark-orange';
        return 'sakura-pink';
      };
      const userHue = mapHue(activeUser.themeHue || 'sakura-pink');
      document.documentElement.setAttribute('data-theme-mode', activeUser.themeMode || 'dark');
      document.documentElement.setAttribute('data-theme-color', userHue);
      document.documentElement.style.setProperty('--theme-hue', userHue);
      const hasOnboardedData = !!activeUser.birthday || 
                               !!activeUser.location || 
                               (activeUser.displayName || '').toLowerCase() !== (activeUser.username || '').toLowerCase();
      if (hasOnboardedData) {
        localStorage.setItem(`omoidasu_onboarded_${activeUser.id}`, 'true');
      }
      const onboarded = localStorage.getItem(`omoidasu_onboarded_${activeUser.id}`) === 'true';
      setUserProfile({
        name: activeUser.displayName || activeUser.username,
        birthday: activeUser.birthday || '',
        location: activeUser.location || '',
        profilePicture: activeUser.profilePicture || '',
        isAdmin: activeUser.isAdmin || false,
        onboarded: onboarded
      });
    } else {
      setUserProfile({ name: '', birthday: '', location: '', profilePicture: '', isAdmin: false, onboarded: false });
    }
  }, [activeUser]);

  const handleNavigateToContact = (contact) => {
    setFocusedContact(contact);
    setActiveTab('contacts');
  };

  const handleNavigateToNote = (note) => {
    setFocusedNote(note);
    setActiveTab('notes');
  };

  const handleTabChange = (tabName) => {
    // Clear focused items on manual tab changes
    setFocusedContact(null);
    setFocusedNote(null);
    setActiveTab(tabName);
  };

  const renderActiveView = () => {
    switch (activeTab) {
      case 'home':
        return (
          <HomeView
            userProfile={userProfile}
            onNavigateToContact={handleNavigateToContact}
            onNavigateToNote={handleNavigateToNote}
            onNavigateToTab={handleTabChange}
          />
        );
      case 'calendar':
        return <ErrorBoundary><CalendarView /></ErrorBoundary>;
      case 'contacts':
        return <ErrorBoundary><ContactsView initialContact={focusedContact} /></ErrorBoundary>;
      case 'notes':
        return <ErrorBoundary><NotesView initialNote={focusedNote} /></ErrorBoundary>;
      case 'settings':
        return (
          <ErrorBoundary>
            <SettingsView
              userProfile={userProfile}
              onUpdateProfile={(updated) => {
                if (updated.onboarded === false && activeUser) {
                  localStorage.removeItem(`omoidasu_onboarded_${activeUser.id}`);
                }
                setUserProfile(prev => ({ ...prev, ...updated }));
              }}
            />
          </ErrorBoundary>
        );
      default:
        return (
          <HomeView
            userProfile={userProfile}
            onNavigateToContact={handleNavigateToContact}
            onNavigateToNote={handleNavigateToNote}
            onNavigateToTab={handleTabChange}
          />
        );
    }
  };

  const getSyncIcon = () => {
    switch (syncStatus) {
      case 'syncing':
        return <span className="material-symbols-outlined" style={{ animation: 'spin 2s linear infinite', color: 'var(--color-primary)' }}>sync</span>;
      case 'offline':
        return <span className="material-symbols-outlined" style={{ color: 'var(--color-outline)' }}>cloud_off</span>;
      case 'error':
        return <span className="material-symbols-outlined" style={{ color: 'var(--color-error)' }}>error</span>;
      case 'synced':
      default:
        return <span className="material-symbols-outlined" style={{ color: 'var(--color-primary)' }}>check_circle</span>;
    }
  };

  if (!activeUser) {
    return (
      <>
        <LoginView onLoginSuccess={(user) => setActiveUser(user)} />
        {globalError && (
          <div style={{
            position: 'fixed',
            bottom: 0,
            left: 0,
            right: 0,
            backgroundColor: '#ffdad9',
            color: '#410002',
            padding: '16px',
            zIndex: 99999,
            fontSize: '0.9rem',
            fontFamily: 'monospace',
            whiteSpace: 'pre-wrap',
            borderTop: '2px solid #ba1a1a',
            maxHeight: '40vh',
            overflowY: 'auto'
          }}>
            <strong>Application Error:</strong>
            <pre style={{ margin: '8px 0 0 0', fontFamily: 'monospace' }}>{globalError}</pre>
            <button className="m3-btn m3-btn-filled" style={{ marginTop: '8px', backgroundColor: '#ba1a1a', color: 'white' }} onClick={() => setGlobalError(null)}>Dismiss</button>
          </div>
        )}
      </>
    );
  }

  return (
    <div className="app-shell">
      {/* Dynamic spinning animation injection */}
      <style>{`
        @keyframes spin {
          0% { transform: rotate(0deg); }
          100% { transform: rotate(360deg); }
        }
      `}</style>

      {/* Nav Rail for Large Screens */}
      <nav className="nav-rail">
        <div className="nav-rail-destinations">
          <button
            onClick={() => handleTabChange('home')}
            className={`nav-rail-item ${activeTab === 'home' ? 'active' : ''}`}
          >
            <div className="icon-wrapper">
              <span className="material-symbols-outlined">home</span>
            </div>
            <span className="nav-rail-label">Home</span>
          </button>

          <button
            onClick={() => handleTabChange('calendar')}
            className={`nav-rail-item ${activeTab === 'calendar' ? 'active' : ''}`}
          >
            <div className="icon-wrapper">
              <span className="material-symbols-outlined">calendar_today</span>
            </div>
            <span className="nav-rail-label">Calendar</span>
          </button>

          <button
            onClick={() => handleTabChange('contacts')}
            className={`nav-rail-item ${activeTab === 'contacts' ? 'active' : ''}`}
          >
            <div className="icon-wrapper">
              <span className="material-symbols-outlined">contacts</span>
            </div>
            <span className="nav-rail-label">Contacts</span>
          </button>

          <button
            onClick={() => handleTabChange('notes')}
            className={`nav-rail-item ${activeTab === 'notes' ? 'active' : ''}`}
          >
            <div className="icon-wrapper">
              <span className="material-symbols-outlined">note_alt</span>
            </div>
            <span className="nav-rail-label">Notes</span>
          </button>

          <button
            onClick={() => handleTabChange('settings')}
            className={`nav-rail-item ${activeTab === 'settings' ? 'active' : ''}`}
          >
            <div className="icon-wrapper">
              <span className="material-symbols-outlined">settings</span>
            </div>
            <span className="nav-rail-label">Settings</span>
          </button>
        </div>
      </nav>

      {/* Main Content Area */}
      <div className="main-content">
        {/* Top App Bar */}
        <header className="top-app-bar">
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <span className="material-symbols-outlined" style={{ fontSize: '1.8rem', color: 'var(--color-primary)', display: 'inline-flex' }}>cloud_sync</span>
            <h1>Omoidasu</h1>
          </div>
          <div className="top-app-bar-actions">
            {/* Connection Status Icon */}
            <div style={{ display: 'flex', alignItems: 'center', padding: '8px', cursor: 'pointer' }} onClick={() => syncEngine.sync()} title="Sync Status">
              {getSyncIcon()}
            </div>
            {/* Quick Access Settings on Mobile */}
            <button
              onClick={() => handleTabChange('settings')}
              className="m3-btn m3-btn-text"
              style={{ width: '40px', height: '40px', padding: 0, borderRadius: '50%', minWidth: 'unset', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
            >
              <span className="material-symbols-outlined" style={{ color: activeTab === 'settings' ? 'var(--color-primary)' : 'var(--color-on-surface-variant)' }}>settings</span>
            </button>
          </div>
        </header>

        {/* Dynamic view screen container */}
        <div style={{ flex: 1, overflow: 'hidden', position: 'relative' }}>
          {renderActiveView()}
        </div>
      </div>

      {/* Bottom Nav Bar for Small Screens */}
      <nav className="bottom-nav">
        <button
          onClick={() => handleTabChange('home')}
          className={`bottom-nav-item ${activeTab === 'home' ? 'active' : ''}`}
        >
          <div className="icon-wrapper">
            <span className="material-symbols-outlined">home</span>
          </div>
          <span className="bottom-nav-label">Home</span>
        </button>

        <button
          onClick={() => handleTabChange('calendar')}
          className={`bottom-nav-item ${activeTab === 'calendar' ? 'active' : ''}`}
        >
          <div className="icon-wrapper">
            <span className="material-symbols-outlined">calendar_today</span>
          </div>
          <span className="bottom-nav-label">Calendar</span>
        </button>

        <button
          onClick={() => handleTabChange('contacts')}
          className={`bottom-nav-item ${activeTab === 'contacts' ? 'active' : ''}`}
        >
          <div className="icon-wrapper">
            <span className="material-symbols-outlined">contacts</span>
          </div>
          <span className="bottom-nav-label">Contacts</span>
        </button>

        <button
          onClick={() => handleTabChange('notes')}
          className={`bottom-nav-item ${activeTab === 'notes' ? 'active' : ''}`}
        >
          <div className="icon-wrapper">
            <span className="material-symbols-outlined">note_alt</span>
          </div>
          <span className="bottom-nav-label">Notes</span>
        </button>
      </nav>

      {/* Onboarding Wizard Overlay */}
      {!userProfile.onboarded && (
        <OnboardingWizard
          userProfile={userProfile}
          onComplete={async (profile) => {
            const user = syncEngine.getActiveUser();
            if (user) {
              try {
                await syncEngine.updateProfile({
                  displayName: profile.name,
                  birthday: profile.birthday,
                  location: profile.location,
                  profilePicture: profile.profilePicture,
                  themeHue: profile.themeHue,
                  themeMode: profile.themeMode
                });
                localStorage.setItem(`omoidasu_onboarded_${user.id}`, 'true');
                setUserProfile({
                  name: profile.name,
                  birthday: profile.birthday,
                  location: profile.location,
                  profilePicture: profile.profilePicture,
                  isAdmin: user.isAdmin || false,
                  onboarded: true
                });
              } catch (err) {
                console.error('Failed to sync onboarding to server:', err);
                localStorage.setItem(`omoidasu_onboarded_${user.id}`, 'true');
                setUserProfile({ ...profile, isAdmin: user.isAdmin || false, onboarded: true });
              }
            }
          }}
        />
      )}

      {globalError && (
        <div style={{
          position: 'fixed',
          bottom: 0,
          left: 0,
          right: 0,
          backgroundColor: '#ffdad9',
          color: '#410002',
          padding: '16px',
          zIndex: 99999,
          fontSize: '0.9rem',
          fontFamily: 'monospace',
          whiteSpace: 'pre-wrap',
          borderTop: '2px solid #ba1a1a',
          maxHeight: '40vh',
          overflowY: 'auto'
        }}>
          <strong>Application Error:</strong>
          <pre style={{ margin: '8px 0 0 0', fontFamily: 'monospace' }}>{globalError}</pre>
          <button className="m3-btn m3-btn-filled" style={{ marginTop: '8px', backgroundColor: '#ba1a1a', color: 'white' }} onClick={() => setGlobalError(null)}>Dismiss</button>
        </div>
      )}
    </div>
  );
}
