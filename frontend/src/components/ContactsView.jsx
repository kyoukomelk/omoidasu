import React, { useState, useEffect } from 'react';
import { syncEngine } from '../utils/syncEngine';

export default function ContactsView({ initialContact }) {
  const [contacts, setContacts] = useState([]);
  const [search, setSearch] = useState('');
  const [selectedContact, setSelectedContact] = useState(initialContact || null);
  const [isEditing, setIsEditing] = useState(false);
  const [editingContact, setEditingContact] = useState(null);

  useEffect(() => {
    if (initialContact) {
      setSelectedContact(initialContact);
    }
  }, [initialContact]);

  // Form State
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [phones, setPhones] = useState(['']);
  const [emails, setEmails] = useState(['']);
  const [website, setWebsite] = useState('');
  const [address, setAddress] = useState('');
  const [birthday, setBirthday] = useState('');
  const [notes, setNotes] = useState('');
  const [favorite, setFavorite] = useState(false);
  const [photo, setPhoto] = useState('');

  // Load contacts
  const loadContacts = () => {
    setContacts(syncEngine.getItems('contacts'));
  };

  useEffect(() => {
    loadContacts();
    return syncEngine.subscribe(loadContacts);
  }, []);

  const parseMultiple = (value) => {
    if (!value) return [];
    if (value.startsWith('[') && value.endsWith(']')) {
      try {
        return JSON.parse(value);
      } catch (e) {
        // Fallback if not valid JSON
      }
    }
    return [value];
  };

  const handleSave = (e) => {
    e.preventDefault();
    if (!firstName.trim() && !lastName.trim()) return;

    // Filter out empty strings
    const activePhones = phones.map(p => p.trim()).filter(Boolean);
    const activeEmails = emails.map(em => em.trim()).filter(Boolean);

    const saved = syncEngine.saveItem('contacts', {
      id: editingContact?.id,
      first_name: firstName,
      last_name: lastName,
      phone: JSON.stringify(activePhones),
      phone_2: '', // Cleared in database schema to map only phone text column
      email: JSON.stringify(activeEmails),
      website,
      address,
      birthday,
      notes,
      favorite,
      photo,
      avatar: editingContact?.avatar || getRandomAvatarColor()
    });

    setIsEditing(false);
    setSelectedContact(saved);
  };

  const openEdit = (contact = null) => {
    if (contact) {
      setEditingContact(contact);
      setFirstName(contact.first_name || '');
      setLastName(contact.last_name || '');
      
      const parsedPhones = parseMultiple(contact.phone);
      setPhones(parsedPhones.length > 0 ? parsedPhones : ['']);
      
      const parsedEmails = parseMultiple(contact.email);
      setEmails(parsedEmails.length > 0 ? parsedEmails : ['']);
      
      setWebsite(contact.website || '');
      setAddress(contact.address || '');
      setBirthday(contact.birthday || '');
      setNotes(contact.notes || '');
      setFavorite(!!contact.favorite);
      setPhoto(contact.photo || '');
    } else {
      setEditingContact(null);
      setFirstName('');
      setLastName('');
      setPhones(['']);
      setEmails(['']);
      setWebsite('');
      setAddress('');
      setBirthday('');
      setNotes('');
      setFavorite(false);
      setPhoto('');
    }
    setIsEditing(true);
  };

  const handleDelete = (id) => {
    if (confirm('Delete this contact?')) {
      syncEngine.deleteItem('contacts', id);
      setIsEditing(false);
      setSelectedContact(null);
    }
  };

  const handlePhotoChange = (e) => {
    const file = e.target.files[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onloadend = () => {
      setPhoto(reader.result);
    };
    reader.readAsDataURL(file);
  };

  const getRandomAvatarColor = () => {
    const colors = ['#f44336', '#e91e63', '#9c27b0', '#673ab7', '#3f51b5', '#2196f3', '#009688', '#4caf50', '#ff9800'];
    return colors[Math.floor(Math.random() * colors.length)];
  };

  // Filter contacts
  const filteredContacts = contacts
    .filter(c => {
      const q = search.toLowerCase();
      const fullName = `${c.first_name || ''} ${c.last_name || ''}`.toLowerCase();
      
      const matchesPhone = parseMultiple(c.phone).some(p => p.toLowerCase().includes(q));
      const matchesEmail = parseMultiple(c.email).some(e => e.toLowerCase().includes(q));

      return fullName.includes(q) || matchesPhone || matchesEmail;
    })
    .sort((a, b) => {
      const nameA = `${a.first_name || ''} ${a.last_name || ''}`.trim();
      const nameB = `${b.first_name || ''} ${b.last_name || ''}`.trim();
      return nameA.localeCompare(nameB);
    });

  // Extract favorites
  const favoriteContacts = filteredContacts.filter(c => !!c.favorite);

  const getDisplayPhone = (contact) => {
    const list = parseMultiple(contact.phone);
    return list[0] || '';
  };

  const getDisplayEmail = (contact) => {
    const list = parseMultiple(contact.email);
    return list[0] || '';
  };

  return (
    <div className="view-container" style={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
      <div className="view-header" style={{ flexShrink: 0 }}>
        <h2>Contacts</h2>
      </div>

      {/* Search Field */}
      <div style={{ display: 'flex', alignItems: 'center', backgroundColor: 'var(--color-surface-container)', padding: '4px 12px', borderRadius: '28px', marginBottom: '1rem', border: '1px solid var(--color-outline-variant)' }}>
        <span className="material-symbols-outlined" style={{ color: 'var(--color-outline)' }}>search</span>
        <input
          type="text"
          placeholder="Search contacts..."
          value={search}
          onChange={e => setSearch(e.target.value)}
          style={{
            flex: 1,
            border: 'none',
            outline: 'none',
            background: 'transparent',
            padding: '8px',
            fontSize: '1rem',
            color: 'var(--color-on-surface)',
            fontFamily: 'var(--font-sans)'
          }}
        />
        {search && (
          <button onClick={() => setSearch('')} style={{ background: 'none', border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center' }}>
            <span className="material-symbols-outlined" style={{ fontSize: '1.2rem', color: 'var(--color-outline)' }}>close</span>
          </button>
        )}
      </div>

      {/* Responsive Content Grid */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: selectedContact ? '1fr' : '1fr',
        gap: '16px',
        flex: 1,
        overflow: 'hidden',
        height: '100%'
      }} className="responsive-contacts-grid">
        {/* CSS styles injected dynamically for dual-pane on desktop */}
        <style>{`
          @media (min-width: 768px) {
            .responsive-contacts-grid {
              grid-template-columns: 350px 1fr !important;
            }
            .list-pane {
              display: block !important;
            }
            .detail-pane {
              display: block !important;
            }
            .detail-back-btn {
              display: none !important;
            }
          }
        `}</style>

        {/* LIST PANE */}
        <div
          className="list-pane"
          style={{
            overflowY: 'auto',
            height: '100%',
            display: selectedContact ? 'none' : 'block'
          }}
        >
          {/* Favorites Horizontal List Section */}
          {favoriteContacts.length > 0 && (
            <div style={{ marginBottom: '1.25rem', borderBottom: '1px solid var(--color-outline-variant)', paddingBottom: '1rem' }}>
              <h3 style={{ fontSize: '0.85rem', color: 'var(--color-outline)', fontWeight: '600', marginBottom: '8px', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Favorites</h3>
              <div style={{ display: 'flex', gap: '16px', overflowX: 'auto', padding: '4px 0', scrollbarWidth: 'none' }} className="favorites-row">
                <style>{`
                  .favorites-row::-webkit-scrollbar { display: none; }
                `}</style>
                {favoriteContacts.map(contact => {
                  const fullName = `${contact.first_name || ''} ${contact.last_name || ''}`.trim() || 'Unnamed';
                  const initials = fullName[0].toUpperCase();
                  
                  return (
                    <div
                      key={contact.id}
                      onClick={() => setSelectedContact(contact)}
                      style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', cursor: 'pointer', gap: '6px', minWidth: '64px' }}
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
                          {initials}
                        </div>
                      )}
                      <span style={{ fontSize: '0.75rem', fontWeight: '500', maxWidth: '64px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', textAlign: 'center' }}>
                        {contact.first_name || 'Unnamed'}
                      </span>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {filteredContacts.length === 0 ? (
            <p style={{ color: 'var(--color-outline)', fontStyle: 'italic', padding: '16px', textAlign: 'center' }}>No contacts found.</p>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
              {filteredContacts.map(contact => {
                const fullName = `${contact.first_name || ''} ${contact.last_name || ''}`.trim() || 'Unnamed';
                const initial = fullName[0].toUpperCase();
                const active = selectedContact?.id === contact.id;

                return (
                  <div
                    key={contact.id}
                    onClick={() => setSelectedContact(contact)}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      padding: '12px',
                      borderRadius: '16px',
                      cursor: 'pointer',
                      backgroundColor: active ? 'var(--color-secondary-container)' : 'transparent',
                      transition: 'background-color var(--motion-duration-short) ease'
                    }}
                  >
                    {contact.photo ? (
                      <img src={contact.photo} alt={fullName} style={{ width: '40px', height: '40px', borderRadius: '50%', objectFit: 'cover', marginRight: '12px' }} />
                    ) : (
                      <div style={{
                        width: '40px',
                        height: '40px',
                        borderRadius: '50%',
                        backgroundColor: contact.avatar || 'var(--color-primary)',
                        color: '#ffffff',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        fontWeight: 'bold',
                        fontSize: '1.1rem',
                        marginRight: '12px',
                        fontFamily: 'var(--font-title)'
                      }}>
                        {initial}
                      </div>
                    )}
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <h4 style={{ fontWeight: '500', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', display: 'flex', alignItems: 'center', gap: '6px' }}>
                        {fullName}
                        {!!contact.favorite && (
                          <span className="material-symbols-outlined" style={{ fontSize: '1rem', color: 'var(--color-primary)' }}>star</span>
                        )}
                      </h4>
                      <p style={{ fontSize: '0.85rem', color: 'var(--color-on-surface-variant)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', marginTop: '2px' }}>
                        {getDisplayPhone(contact) || getDisplayEmail(contact) || 'No phone/email'}
                      </p>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* DETAIL PANE */}
        {selectedContact && (
          <div
            className="detail-pane"
            style={{
              backgroundColor: 'var(--color-surface-container-low)',
              borderRadius: '24px',
              padding: '1.5rem',
              display: 'flex',
              flexDirection: 'column',
              gap: '1.5rem',
              height: '100%',
              overflowY: 'auto',
              border: '1px solid var(--color-outline-variant)'
            }}
          >
            {/* Header / Back Action */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <button
                className="m3-btn m3-btn-text detail-back-btn"
                style={{ padding: 0, width: '40px', height: '40px', borderRadius: '50%' }}
                onClick={() => setSelectedContact(null)}
              >
                <span className="material-symbols-outlined">arrow_back</span>
              </button>
              <div style={{ display: 'flex', gap: '8px', marginLeft: 'auto' }}>
                <button className="m3-btn m3-btn-tonal" onClick={() => openEdit(selectedContact)}>
                  <span className="material-symbols-outlined" style={{ fontSize: '1.2rem' }}>edit</span> Edit
                </button>
              </div>
            </div>

            {/* Profile Header */}
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', textAlign: 'center', gap: '12px' }}>
              {selectedContact.photo ? (
                <img src={selectedContact.photo} alt={selectedContact.first_name} style={{ width: '96px', height: '96px', borderRadius: '50%', objectFit: 'cover', boxShadow: 'var(--elevation-2)' }} />
              ) : (
                <div style={{
                  width: '96px',
                  height: '96px',
                  borderRadius: '50%',
                  backgroundColor: selectedContact.avatar || 'var(--color-primary)',
                  color: '#ffffff',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontWeight: 'bold',
                  fontSize: '2.5rem',
                  boxShadow: 'var(--elevation-2)',
                  fontFamily: 'var(--font-title)'
                }}>
                  {(`${selectedContact.first_name || ''} ${selectedContact.last_name || ''}`.trim() || '?')[0].toUpperCase()}
                </div>
              )}
              <h2 style={{ fontFamily: 'var(--font-title)', fontSize: '1.8rem', fontWeight: '500', display: 'flex', alignItems: 'center', gap: '8px' }}>
                {`${selectedContact.first_name || ''} ${selectedContact.last_name || ''}`.trim() || 'Unnamed'}
                {!!selectedContact.favorite && (
                  <span className="material-symbols-outlined" style={{ color: 'var(--color-primary)' }}>star</span>
                )}
              </h2>
            </div>

            {/* Fields list */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
              {parseMultiple(selectedContact.phone).map((phone, idx) => (
                <div key={`phone-${idx}`} style={{ display: 'flex', alignItems: 'center', gap: '16px', padding: '8px 0' }}>
                  <span className="material-symbols-outlined" style={{ color: 'var(--color-primary)' }}>call</span>
                  <div>
                    <p style={{ fontSize: '0.8rem', color: 'var(--color-outline)' }}>Phone {idx + 1}</p>
                    <a href={`tel:${phone}`} style={{ color: 'var(--color-on-surface)', textDecoration: 'none', fontSize: '1.1rem' }}>{phone}</a>
                  </div>
                </div>
              ))}

              {parseMultiple(selectedContact.email).map((email, idx) => (
                <div key={`email-${idx}`} style={{ display: 'flex', alignItems: 'center', gap: '16px', padding: '8px 0' }}>
                  <span className="material-symbols-outlined" style={{ color: 'var(--color-primary)' }}>mail</span>
                  <div>
                    <p style={{ fontSize: '0.8rem', color: 'var(--color-outline)' }}>Email {idx + 1}</p>
                    <a href={`mailto:${email}`} style={{ color: 'var(--color-primary)', textDecoration: 'underline', fontSize: '1.1rem' }}>{email}</a>
                  </div>
                </div>
              ))}

              {selectedContact.website && (
                <div style={{ display: 'flex', alignItems: 'center', gap: '16px', padding: '8px 0' }}>
                  <span className="material-symbols-outlined" style={{ color: 'var(--color-primary)' }}>public</span>
                  <div>
                    <p style={{ fontSize: '0.8rem', color: 'var(--color-outline)' }}>Website</p>
                    <a href={selectedContact.website.startsWith('http') ? selectedContact.website : `https://${selectedContact.website}`} target="_blank" rel="noopener noreferrer" style={{ color: 'var(--color-primary)', textDecoration: 'none', fontSize: '1.1rem' }}>{selectedContact.website}</a>
                  </div>
                </div>
              )}

              {selectedContact.address && (
                <div style={{ display: 'flex', alignItems: 'center', gap: '16px', padding: '8px 0' }}>
                  <span className="material-symbols-outlined" style={{ color: 'var(--color-primary)' }}>home</span>
                  <div>
                    <p style={{ fontSize: '0.8rem', color: 'var(--color-outline)' }}>Address</p>
                    <a
                      href={`https://www.openstreetmap.org/search?query=${encodeURIComponent(selectedContact.address)}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      style={{ color: 'var(--color-primary)', textDecoration: 'underline', fontSize: '1.1rem' }}
                    >
                      {selectedContact.address}
                    </a>
                  </div>
                </div>
              )}

              {selectedContact.birthday && (
                <div style={{ display: 'flex', alignItems: 'center', gap: '16px', padding: '8px 0' }}>
                  <span className="material-symbols-outlined" style={{ color: 'var(--color-primary)' }}>cake</span>
                  <div>
                    <p style={{ fontSize: '0.8rem', color: 'var(--color-outline)' }}>Birthday</p>
                    <p style={{ fontSize: '1.1rem' }}>{selectedContact.birthday}</p>
                  </div>
                </div>
              )}

              {selectedContact.notes && (
                <div style={{ display: 'flex', gap: '16px', padding: '8px 0', borderTop: '1px solid var(--color-outline-variant)', paddingTop: '16px' }}>
                  <span className="material-symbols-outlined" style={{ color: 'var(--color-primary)' }}>description</span>
                  <div style={{ flex: 1 }}>
                    <p style={{ fontSize: '0.8rem', color: 'var(--color-outline)', marginBottom: '4px' }}>Notes</p>
                    <p style={{ fontSize: '1rem', whiteSpace: 'pre-wrap', lineHeight: '1.5' }}>{selectedContact.notes}</p>
                  </div>
                </div>
              )}
            </div>
          </div>
        )}
      </div>

      {/* FAB to add contact */}
      <button className="fab" onClick={() => openEdit()}>
        <span className="material-symbols-outlined">add</span>
      </button>

      {/* Add/Edit Modal Sheet */}
      {isEditing && (
        <div className="backdrop" onClick={() => setIsEditing(false)}>
          <form className="bottom-sheet" onClick={(e) => e.stopPropagation()} onSubmit={handleSave}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
              <h3 style={{ fontFamily: 'var(--font-title)' }}>{editingContact ? 'Edit Contact' : 'New Contact'}</h3>
              <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                <button
                  type="button"
                  className="m3-btn m3-btn-text"
                  onClick={() => setFavorite(!favorite)}
                  style={{ width: '40px', height: '40px', padding: 0, borderRadius: '50%', minWidth: 'unset' }}
                >
                  <span className="material-symbols-outlined" style={{
                    color: favorite ? 'var(--color-primary)' : 'var(--color-outline)',
                    fontVariationSettings: favorite ? '"FILL" 1' : 'none'
                  }}>
                    {favorite ? 'star' : 'star_border'}
                  </span>
                </button>
                <button type="button" className="m3-btn m3-btn-text" onClick={() => setIsEditing(false)} style={{ width: '40px', height: '40px', padding: 0, borderRadius: '50%', minWidth: 'unset' }}>
                  <span className="material-symbols-outlined">close</span>
                </button>
              </div>
            </div>

            {/* Custom Photo Upload Section */}
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', marginBottom: '1.25rem', gap: '8px' }}>
              {photo ? (
                <img src={photo} alt="Avatar" style={{ width: '80px', height: '80px', borderRadius: '50%', objectFit: 'cover', border: '2px solid var(--color-primary)' }} />
              ) : (
                <div style={{ width: '80px', height: '80px', borderRadius: '50%', backgroundColor: 'var(--color-surface-container-high)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <span className="material-symbols-outlined" style={{ fontSize: '2.2rem', color: 'var(--color-outline)' }}>person</span>
                </div>
              )}
              <div style={{ display: 'flex', gap: '8px' }}>
                <label className="m3-btn m3-btn-tonal" style={{ height: '32px', padding: '0 12px', fontSize: '0.8rem', cursor: 'pointer' }}>
                  Change Photo
                  <input type="file" accept="image/*" onChange={handlePhotoChange} style={{ display: 'none' }} />
                </label>
                {photo && (
                  <button type="button" className="m3-btn m3-btn-text" style={{ height: '32px', padding: '0 8px', fontSize: '0.8rem', color: 'var(--color-error)' }} onClick={() => setPhoto('')}>
                    Remove
                  </button>
                )}
              </div>
            </div>

            <div className="m3-field-row">
              <div className="m3-text-field" style={{ flex: 1 }}>
                <input type="text" value={firstName} onChange={e => setFirstName(e.target.value)} placeholder=" " required />
                <label>First Name</label>
              </div>
              <div className="m3-text-field" style={{ flex: 1 }}>
                <input type="text" value={lastName} onChange={e => setLastName(e.target.value)} placeholder=" " />
                <label>Last Name</label>
              </div>
            </div>

            {/* Dynamic Phone Numbers */}
            <div style={{ marginBottom: '1.25rem' }}>
              <label style={{ fontSize: '0.8rem', color: 'var(--color-primary)', display: 'block', marginBottom: '8px', fontWeight: '500' }}>Phone Numbers</label>
              {phones.map((phone, idx) => (
                <div key={idx} style={{ display: 'flex', gap: '8px', alignItems: 'center', marginBottom: '8px' }}>
                  <div className="m3-text-field" style={{ flex: 1, marginBottom: 0 }}>
                    <input
                      type="tel"
                      value={phone}
                      onChange={e => {
                        const newPhones = [...phones];
                        newPhones[idx] = e.target.value;
                        setPhones(newPhones);
                      }}
                      placeholder=" "
                    />
                    <label>Phone {idx + 1}</label>
                  </div>
                  {phones.length > 1 && (
                    <button
                      type="button"
                      className="m3-btn m3-btn-text"
                      onClick={() => setPhones(phones.filter((_, i) => i !== idx))}
                      style={{ padding: 0, width: '40px', height: '40px', borderRadius: '50%', minWidth: 'unset', color: 'var(--color-error)' }}
                    >
                      <span className="material-symbols-outlined">delete</span>
                    </button>
                  )}
                </div>
              ))}
              <button
                type="button"
                className="m3-btn m3-btn-tonal"
                onClick={() => setPhones([...phones, ''])}
                style={{ height: '36px', padding: '0 12px', fontSize: '0.8rem', marginTop: '4px' }}
              >
                <span className="material-symbols-outlined" style={{ fontSize: '1.1rem' }}>add</span> Add Phone
              </button>
            </div>

            {/* Dynamic Email Addresses */}
            <div style={{ marginBottom: '1.25rem' }}>
              <label style={{ fontSize: '0.8rem', color: 'var(--color-primary)', display: 'block', marginBottom: '8px', fontWeight: '500' }}>Email Addresses</label>
              {emails.map((email, idx) => (
                <div key={idx} style={{ display: 'flex', gap: '8px', alignItems: 'center', marginBottom: '8px' }}>
                  <div className="m3-text-field" style={{ flex: 1, marginBottom: 0 }}>
                    <input
                      type="email"
                      value={email}
                      onChange={e => {
                        const newEmails = [...emails];
                        newEmails[idx] = e.target.value;
                        setEmails(newEmails);
                      }}
                      placeholder=" "
                    />
                    <label>Email {idx + 1}</label>
                  </div>
                  {emails.length > 1 && (
                    <button
                      type="button"
                      className="m3-btn m3-btn-text"
                      onClick={() => setEmails(emails.filter((_, i) => i !== idx))}
                      style={{ padding: 0, width: '40px', height: '40px', borderRadius: '50%', minWidth: 'unset', color: 'var(--color-error)' }}
                    >
                      <span className="material-symbols-outlined">delete</span>
                    </button>
                  )}
                </div>
              ))}
              <button
                type="button"
                className="m3-btn m3-btn-tonal"
                onClick={() => setEmails([...emails, ''])}
                style={{ height: '36px', padding: '0 12px', fontSize: '0.8rem', marginTop: '4px' }}
              >
                <span className="material-symbols-outlined" style={{ fontSize: '1.1rem' }}>add</span> Add Email
              </button>
            </div>

            <div className="m3-text-field">
              <input type="text" value={website} onChange={e => setWebsite(e.target.value)} placeholder=" " />
              <label>Website</label>
            </div>

            <div className="m3-text-field">
              <input type="text" value={address} onChange={e => setAddress(e.target.value)} placeholder=" " />
              <label>Address</label>
            </div>

            <div className="m3-text-field">
              <input type="date" value={birthday} onChange={e => setBirthday(e.target.value)} placeholder=" " />
              <label>Birthday</label>
            </div>

            <div className="m3-text-field">
              <textarea rows="3" value={notes} onChange={e => setNotes(e.target.value)} placeholder=" " />
              <label>Notes</label>
            </div>

            <div style={{ display: 'flex', gap: '8px', justifyContent: 'flex-end', marginTop: '1rem' }}>
              {editingContact && (
                <button type="button" className="m3-btn m3-btn-text" style={{ color: 'var(--color-error)' }} onClick={() => handleDelete(editingContact.id)}>
                  Delete Contact
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
