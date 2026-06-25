import React, { useState, useEffect } from 'react';
import { syncEngine } from '../utils/syncEngine';

export default function LoginView({ onLoginSuccess }) {
  const [accounts, setAccounts] = useState([]);
  const [mode, setMode] = useState(() => {
    try {
      const data = localStorage.getItem('omoidasu_active_sessions');
      if (data) {
        const parsed = JSON.parse(data);
        if (parsed && Array.isArray(parsed.sessions) && parsed.sessions.length > 0) {
          return 'select-account';
        }
      }
    } catch (e) {}
    return 'register';
  });
  const [selectedAccount, setSelectedAccount] = useState(null);
  
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  
  const [error, setError] = useState(null);
  const [loading, setLoading] = useState(false);
  const [registrationDisabled, setRegistrationDisabled] = useState(false);

  useEffect(() => {
    let active = true;
    const loadSettingsAndAccounts = async () => {
      try {
        const settings = await syncEngine.getSystemSettings();
        if (active) setRegistrationDisabled(settings.registrationDisabled);
      } catch (err) {
        console.error('Failed to load system settings:', err);
      }
      
      try {
        const dbUsers = await syncEngine.getAllUsers();
        if (active) {
          setAccounts(dbUsers);
          if (dbUsers.length > 0) {
            setMode('select-account');
          } else {
            setMode('register');
          }
        }
      } catch (err) {
        console.error('Failed to load database users, using local sessions:', err);
        const localAccounts = syncEngine.getSavedAccounts();
        if (active) {
          setAccounts(localAccounts);
          if (localAccounts.length > 0) {
            setMode('select-account');
          } else {
            setMode('register');
          }
        }
      }
    };
    loadSettingsAndAccounts();
    return () => {
      active = false;
    };
  }, []);

  const handleLogin = async (e) => {
    e.preventDefault();
    if (!username.trim() || !password.trim()) {
      setError('Please fill in all fields');
      return;
    }
    setError(null);
    setLoading(true);
    try {
      const user = await syncEngine.login(username, password);
      if (onLoginSuccess) onLoginSuccess(user);
    } catch (err) {
      setError(err.message || 'Login failed');
    } finally {
      setLoading(false);
    }
  };

  const handleRegister = async (e) => {
    e.preventDefault();
    if (!username.trim() || !password.trim()) {
      setError('Username and password are required');
      return;
    }
    setError(null);
    setLoading(true);
    try {
      const user = await syncEngine.register(username, password);
      if (onLoginSuccess) onLoginSuccess(user);
    } catch (err) {
      setError(err.message || 'Registration failed');
    } finally {
      setLoading(false);
    }
  };

  const handleSelectAccount = (acc) => {
    setSelectedAccount(acc);
    setUsername(acc.username);
    setMode('enter-password');
    setPassword('');
    setError(null);
  };

  const handleRemoveSaved = (e, userId) => {
    e.stopPropagation();
    // Remove the session from storage
    const sessions = localStorage.getItem('omoidasu_active_sessions');
    if (sessions) {
      try {
        const data = JSON.parse(sessions);
        data.sessions = data.sessions.filter(s => s.userId !== userId);
        if (data.activeSessionUserId === userId) {
          data.activeSessionUserId = data.sessions.length > 0 ? data.sessions[0].userId : null;
        }
        localStorage.setItem('omoidasu_active_sessions', JSON.stringify(data));
        const updated = syncEngine.getSavedAccounts();
        setAccounts(updated);
        if (updated.length === 0) {
          setMode('register');
          setSelectedAccount(null);
        } else if (selectedAccount && selectedAccount.userId === userId) {
          setMode('select-account');
          setSelectedAccount(null);
        }
        setError(null);
      } catch (err) {
        console.error(err);
      }
    }
  };

  return (
    <div className="login-container">
      <style>{`
        .login-container {
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: center;
          min-height: 100vh;
          padding: 24px;
          background-color: var(--color-background);
          font-family: var(--font-sans);
          overflow-y: auto;
        }
        .login-card {
          background: var(--color-surface-container);
          border-radius: 28px;
          padding: 32px;
          width: 100%;
          max-width: 450px;
          box-shadow: var(--elevation-3);
          border: 1px solid var(--color-outline-variant);
          backdrop-filter: blur(10px);
          transition: transform 0.3s ease;
        }
        .login-header {
          text-align: center;
          margin-bottom: 24px;
        }
        .login-logo {
          font-size: 3rem;
          color: var(--color-primary);
          margin-bottom: 8px;
        }
        .login-title {
          font-family: var(--font-title);
          font-size: 2rem;
          font-weight: 600;
          color: var(--color-on-surface);
        }
        .login-subtitle {
          font-size: 0.9rem;
          color: var(--color-on-surface-variant);
        }
        .login-form {
          display: flex;
          flex-direction: column;
          gap: 16px;
        }
        .form-group {
          display: flex;
          flex-direction: column;
          gap: 6px;
        }
        .form-label {
          font-size: 0.85rem;
          font-weight: 500;
          color: var(--color-on-surface-variant);
        }
        .form-input {
          padding: 14px 16px;
          border-radius: 12px;
          border: 1px solid var(--color-outline);
          background: var(--color-surface);
          color: var(--color-on-surface);
          font-size: 1rem;
          outline: none;
          transition: border-color 0.2s ease, box-shadow 0.2s ease;
        }
        .form-input:focus {
          border-color: var(--color-primary);
          box-shadow: 0 0 0 3px var(--color-primary-container);
        }
        .form-btn {
          margin-top: 12px;
          padding: 14px;
          border-radius: 100px;
          border: none;
          background: var(--color-primary);
          color: var(--color-on-primary);
          font-weight: 600;
          font-size: 1rem;
          cursor: pointer;
          transition: opacity 0.2s ease, transform 0.1s ease;
          display: flex;
          align-items: center;
          justify-content: center;
          gap: 8px;
        }
        .form-btn:hover {
          opacity: 0.9;
        }
        .form-btn:active {
          transform: scale(0.98);
        }
        .form-btn:disabled {
          background: var(--color-outline-variant);
          color: var(--color-on-surface-variant);
          cursor: not-allowed;
        }
        .error-banner {
          background-color: var(--color-error-container);
          color: var(--color-on-error-container);
          padding: 12px 16px;
          border-radius: 12px;
          font-size: 0.85rem;
          display: flex;
          align-items: center;
          gap: 8px;
          margin-bottom: 16px;
          border: 1px solid var(--color-error);
        }
        .mode-toggle {
          text-align: center;
          margin-top: 20px;
          font-size: 0.9rem;
          color: var(--color-on-surface-variant);
        }
        .mode-toggle-link {
          color: var(--color-primary);
          text-decoration: none;
          font-weight: 600;
          cursor: pointer;
          margin-left: 4px;
        }
        .mode-toggle-link:hover {
          text-decoration: underline;
        }
        .saved-accounts-section {
          margin-top: 24px;
          border-top: 1px solid var(--color-outline-variant);
          padding-top: 20px;
        }
        .saved-accounts-title {
          font-family: var(--font-title);
          font-size: 1.1rem;
          font-weight: 600;
          color: var(--color-on-surface);
          margin-bottom: 12px;
          display: flex;
          align-items: center;
          gap: 8px;
        }
        .account-list {
          display: grid;
          grid-template-columns: repeat(auto-fit, minmax(110px, 120px));
          justify-content: center;
          gap: 12px;
        }
        .account-item {
          position: relative;
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: center;
          padding: 16px 8px;
          background: var(--color-surface-container-low);
          border: 1px solid var(--color-outline-variant);
          border-radius: 16px;
          cursor: pointer;
          transition: background-color 0.2s ease, border-color 0.2s ease, transform 0.2s ease;
          text-align: center;
        }
        .account-item:hover {
          background: var(--color-surface-container-high);
          border-color: var(--color-primary);
          transform: translateY(-2px);
        }
        .account-info {
          display: flex;
          flex-direction: column;
          align-items: center;
          gap: 8px;
          width: 100%;
        }
        .account-avatar {
          width: 48px;
          height: 48px;
          border-radius: 50%;
          background: var(--color-primary-container);
          color: var(--color-on-primary-container);
          display: flex;
          align-items: center;
          justify-content: center;
          font-weight: 600;
          font-size: 1.4rem;
          box-shadow: var(--elevation-1);
        }
        .account-details {
          display: flex;
          flex-direction: column;
          align-items: center;
          width: 100%;
          overflow: hidden;
        }
        .account-name {
          font-size: 0.9rem;
          font-weight: 600;
          color: var(--color-on-surface);
          max-width: 100%;
          overflow: hidden;
          text-overflow: ellipsis;
          white-space: nowrap;
        }
        .account-username {
          font-size: 0.75rem;
          color: var(--color-on-surface-variant);
          max-width: 100%;
          overflow: hidden;
          text-overflow: ellipsis;
          white-space: nowrap;
        }
        .remove-account-btn {
          position: absolute;
          top: 6px;
          right: 6px;
          background: var(--color-surface-container-high);
          border: 1px solid var(--color-outline-variant);
          color: var(--color-on-surface-variant);
          cursor: pointer;
          padding: 4px;
          border-radius: 50%;
          display: flex;
          align-items: center;
          justify-content: center;
          transition: background-color 0.2s, color 0.2s, opacity 0.2s;
          opacity: 0.5;
          box-shadow: var(--elevation-1);
        }
        .account-item:hover .remove-account-btn {
          opacity: 1;
        }
        .remove-account-btn:hover {
          background-color: var(--color-error-container);
          color: var(--color-error);
          opacity: 1 !important;
        }
      `}</style>

      <div className="login-card">
        <div className="login-header">
          <span className="material-symbols-outlined login-logo">cloud_sync</span>
          <h2 className="login-title">Omoidasu</h2>
          <p className="login-subtitle">Secure Multi-Account Sync Dashboard</p>
        </div>

        {error && (
          <div className="error-banner">
            <span className="material-symbols-outlined">error</span>
            <span>{error}</span>
          </div>
        )}

        {mode === 'select-account' && (
          <div className="select-account-section">
            <h3 className="saved-accounts-title" style={{ fontSize: '1.2rem', justifyContent: 'center', marginBottom: '20px', display: 'flex', flexDirection: 'column', gap: '4px', alignItems: 'center' }}>
              <span style={{ fontWeight: 600, color: 'var(--color-on-surface)' }}>Choose an account</span>
              <span style={{ fontSize: '0.85rem', color: 'var(--color-on-surface-variant)', fontWeight: 'normal' }}>Select a profile to continue</span>
            </h3>
            <div className="account-list" style={{ marginBottom: '24px' }}>
              {accounts.map((acc) => (
                <div key={acc.id || acc.userId} className="account-item" onClick={() => handleSelectAccount(acc)}>
                  <div className="account-info">
                    <div className="account-avatar" style={{ overflow: 'hidden' }}>
                      {acc.profilePicture ? (
                        <img src={acc.profilePicture} alt={acc.displayName} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                      ) : (
                        acc.displayName ? acc.displayName.charAt(0).toUpperCase() : acc.username.charAt(0).toUpperCase()
                      )}
                    </div>
                    <div className="account-details">
                      <span className="account-name">{acc.displayName || acc.username}</span>
                      <span className="account-username">@{acc.username}</span>
                    </div>
                  </div>
                </div>
              ))}
            </div>
            {!registrationDisabled && (
              <button 
                className="form-btn" 
                style={{ background: 'var(--color-surface-container-high)', color: 'var(--color-primary)', border: '1px solid var(--color-outline-variant)' }} 
                onClick={() => { setMode('register'); setUsername(''); setPassword(''); setError(null); }}
              >
                <span className="material-symbols-outlined">person_add</span>
                <span>Create User</span>
              </button>
            )}
          </div>
        )}

        {mode === 'enter-password' && selectedAccount && (
          <form className="login-form" onSubmit={handleLogin}>
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '8px', marginBottom: '16px' }}>
              <div className="account-avatar" style={{ width: '64px', height: '64px', fontSize: '1.8rem', overflow: 'hidden' }}>
                {selectedAccount.profilePicture ? (
                  <img src={selectedAccount.profilePicture} alt={selectedAccount.displayName} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                ) : (
                  selectedAccount.displayName ? selectedAccount.displayName.charAt(0).toUpperCase() : selectedAccount.username.charAt(0).toUpperCase()
                )}
              </div>
              <div style={{ textAlign: 'center' }}>
                <h4 style={{ margin: 0, fontSize: '1.1rem', fontWeight: 600, color: 'var(--color-on-surface)' }}>
                  {selectedAccount.displayName || selectedAccount.username}
                </h4>
                <span style={{ fontSize: '0.85rem', color: 'var(--color-on-surface-variant)' }}>
                  @{selectedAccount.username}
                </span>
              </div>
            </div>
            
            <div className="form-group">
              <label className="form-label" htmlFor="login-password">Password</label>
              <input
                id="login-password"
                className="form-input"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Enter password"
                required
                autoFocus
              />
            </div>
            
            <button className="form-btn" type="submit" disabled={loading}>
              {loading ? (
                <span className="material-symbols-outlined" style={{ animation: 'spin 1s linear infinite' }}>sync</span>
              ) : (
                <>
                  <span className="material-symbols-outlined">login</span>
                  <span>Sign In</span>
                </>
              )}
            </button>

            <button 
              type="button"
              className="form-btn" 
              style={{ background: 'none', color: 'var(--color-primary)', border: 'none', boxShadow: 'none', marginTop: '4px', padding: '8px' }} 
              onClick={() => { setMode('select-account'); setPassword(''); setError(null); }}
            >
              <span className="material-symbols-outlined">arrow_back</span>
              <span>Back to accounts</span>
            </button>
          </form>
        )}

        {mode === 'login' && (
          <form className="login-form" onSubmit={handleLogin}>
            <div className="form-group">
              <label className="form-label" htmlFor="login-username">Username</label>
              <input
                id="login-username"
                className="form-input"
                type="text"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                placeholder="Enter username"
                required
              />
            </div>
            <div className="form-group">
              <label className="form-label" htmlFor="login-password">Password</label>
              <input
                id="login-password"
                className="form-input"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Enter password"
                required
              />
            </div>
            <button className="form-btn" type="submit" disabled={loading}>
              {loading ? (
                <span className="material-symbols-outlined" style={{ animation: 'spin 1s linear infinite' }}>sync</span>
              ) : (
                <>
                  <span className="material-symbols-outlined">login</span>
                  <span>Sign In</span>
                </>
              )}
            </button>
          </form>
        )}

        {mode === 'register' && (
          <form className="login-form" onSubmit={handleRegister}>
            <div className="form-group">
              <label className="form-label" htmlFor="reg-username">Username</label>
              <input
                id="reg-username"
                className="form-input"
                type="text"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                placeholder="Username (unique)"
                required
              />
            </div>
            <div className="form-group">
              <label className="form-label" htmlFor="reg-password">Password</label>
              <input
                id="reg-password"
                className="form-input"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Password"
                required
              />
            </div>

            <button className="form-btn" type="submit" disabled={loading}>
              {loading ? (
                <span className="material-symbols-outlined" style={{ animation: 'spin 1s linear infinite' }}>sync</span>
              ) : (
                <>
                  <span className="material-symbols-outlined">person_add</span>
                  <span>Create Account</span>
                </>
              )}
            </button>
          </form>
        )}

        {(mode === 'login' || mode === 'register') && (
          <div className="mode-toggle">
            {mode === 'login' ? (
              !registrationDisabled ? (
                <>
                  Don't have an account?
                  <span className="mode-toggle-link" onClick={() => { setMode('register'); setError(null); }}>Register</span>
                </>
              ) : (
                <span style={{ fontSize: '0.85rem', color: 'var(--color-outline)' }}>New user registration is disabled by the administrator</span>
              )
            ) : (
              accounts.length > 0 && (
                <>
                  Already have an account?
                  <span className="mode-toggle-link" onClick={() => { setMode('login'); setError(null); }}>Sign In</span>
                </>
              )
            )}
            {accounts.length > 0 && (
              <div style={{ marginTop: '12px' }}>
                <span className="mode-toggle-link" onClick={() => { setMode('select-account'); setError(null); }}>
                  Back to saved accounts
                </span>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
