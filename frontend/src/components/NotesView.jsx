import React, { useState, useEffect } from 'react';
import { syncEngine } from '../utils/syncEngine';

function CodeSnippet({ code, lang }) {
  const [copied, setCopied] = useState(false);

  const handleCopy = async (e) => {
    e.preventDefault();
    e.stopPropagation();
    try {
      if (navigator.clipboard && navigator.clipboard.writeText) {
        await navigator.clipboard.writeText(code);
      } else {
        const textarea = document.createElement('textarea');
        textarea.value = code;
        textarea.style.position = 'fixed';
        document.body.appendChild(textarea);
        textarea.select();
        document.execCommand('copy');
        document.body.removeChild(textarea);
      }
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (err) {
      console.error('Failed to copy text: ', err);
    }
  };

  return (
    <div style={{
      position: 'relative',
      margin: '12px 0',
      borderRadius: '12px',
      backgroundColor: '#1e1e1e',
      border: '1px solid var(--color-outline-variant)',
      overflow: 'hidden',
      color: '#d4d4d4',
      fontFamily: 'monospace',
      textAlign: 'left'
    }}>
      <div style={{
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        padding: '6px 12px',
        backgroundColor: 'rgba(0, 0, 0, 0.4)',
        borderBottom: '1px solid rgba(255, 255, 255, 0.1)',
        fontSize: '0.75rem',
        textTransform: 'uppercase',
        letterSpacing: '0.5px',
        opacity: 0.8
      }}>
        <span>{lang || 'code'}</span>
        <button
          type="button"
          onClick={handleCopy}
          style={{
            background: 'rgba(255, 255, 255, 0.15)',
            border: '1px solid rgba(255, 255, 255, 0.2)',
            borderRadius: '6px',
            padding: '4px 8px',
            color: '#ffffff',
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            gap: '4px',
            fontSize: '0.7rem',
            transition: 'background-color 0.2s'
          }}
        >
          <span className="material-symbols-outlined" style={{ fontSize: '0.9rem' }}>
            {copied ? 'check' : 'content_copy'}
          </span>
          {copied ? 'Copied' : 'Copy'}
        </button>
      </div>
      <pre style={{
        margin: 0,
        padding: '12px',
        overflowX: 'auto',
        fontSize: '0.9rem',
        lineHeight: '1.5',
        whiteSpace: 'pre'
      }}>
        <code>{code}</code>
      </pre>
    </div>
  );
}

function renderNoteContent(text) {
  if (!text) return null;
  const parts = text.split(/(```[\s\S]*?```)/g);
  return parts.map((part, index) => {
    if (part.startsWith('```') && part.endsWith('```')) {
      const match = part.match(/^```(\w*)\n?([\s\S]*?)```$/);
      const lang = match ? match[1] : '';
      const code = match ? match[2] : part.slice(3, -3);
      return (
        <CodeSnippet key={index} code={code} lang={lang} />
      );
    }
    return (
      <span key={index} style={{ whiteSpace: 'pre-wrap' }}>
        {part}
      </span>
    );
  });
}

function cleanPreviewText(text) {
  if (!text) return '';
  return text.replace(/```\w*\n?/g, '');
}

function NoteCard({
  note,
  isGridView,
  openEdit,
  getStyleForColor,
  parseChecklist,
  parseTags,
  setFullscreenImage
}) {
  const colorScheme = getStyleForColor(note.color);
  const checklistItems = parseChecklist(note.checklist);
  const [isExpanded, setIsExpanded] = useState(false);

  const rawText = cleanPreviewText(note.content);
  const lineCount = rawText.split('\n').length;
  const hasMoreText = lineCount > 4 || rawText.length > (isGridView ? 100 : 250);
  const hasMoreChecklist = checklistItems.length > 4;

  const handleMoreClick = (e) => {
    e.stopPropagation();
    setIsExpanded(!isExpanded);
  };

  return (
    <div
      onClick={() => openEdit(note)}
      className={`m3-card note-card ${isGridView ? 'grid-mode' : 'list-mode'}`}
      style={{
        backgroundColor: colorScheme.bg,
        color: colorScheme.text,
        borderColor: colorScheme.border,
        height: isExpanded ? 'auto' : undefined,
        minHeight: isExpanded ? 'auto' : undefined
      }}
    >
      {/* Title Row */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '6px', width: '100%', flexShrink: 0 }}>
        <h4 style={{
          fontWeight: '600',
          fontSize: '1.05rem',
          margin: 0,
          flex: 1,
          paddingRight: '8px',
          lineHeight: '1.2',
          wordBreak: 'break-word'
        }}>
          {note.title || 'Untitled'}
        </h4>
        {!!note.favorite && (
          <span className="material-symbols-outlined" style={{ color: 'var(--color-primary)', fontSize: '1.2rem', flexShrink: 0 }}>star</span>
        )}
      </div>

      {/* Tags Row - Underneath Title */}
      {note.tags && (
        <div style={{
          display: 'flex',
          gap: '4px',
          flexWrap: 'wrap',
          marginBottom: '8px',
          width: '100%',
          flexShrink: 0
        }}>
          {parseTags(note.tags).map(tag => (
            <span key={tag} style={{
              fontSize: '0.65rem',
              padding: '2px 6px',
              borderRadius: '8px',
              backgroundColor: 'rgba(0,0,0,0.06)',
              color: 'inherit',
              opacity: 0.8,
              textTransform: 'capitalize'
            }}>
              {tag}
            </span>
          ))}
        </div>
      )}

      {/* Picture Preview - Underneath Tags */}
      {note.photo && (
        <img
          src={note.photo}
          alt={note.title}
          style={{
            width: '100%',
            aspectRatio: '19 / 9',
            objectFit: 'cover',
            borderRadius: '8px',
            marginBottom: '8px',
            cursor: 'zoom-in',
            flexShrink: 0
          }}
          onClick={(e) => {
            e.stopPropagation();
            setFullscreenImage(note.photo);
          }}
        />
      )}

      {/* Checklist Preview or Content - Underneath Image */}
      {checklistItems.length > 0 ? (
        <div style={{ fontSize: '0.85rem', display: 'flex', flexDirection: 'column', gap: '4px', marginTop: '2px', overflow: 'hidden' }}>
          {(isExpanded ? checklistItems : checklistItems.slice(0, 4)).map((item, idx) => (
            <div key={idx} style={{ display: 'flex', alignItems: 'center', gap: '6px', opacity: item.done ? 0.6 : 1, textDecoration: item.done ? 'line-through' : 'none' }}>
              <span className="material-symbols-outlined" style={{ fontSize: '0.95rem', color: 'var(--color-primary)', fontVariationSettings: '"FILL" 1' }}>
                {item.done ? 'check_box' : 'check_box_outline_blank'}
              </span>
              <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{item.text || 'Item'}</span>
            </div>
          ))}
          {hasMoreChecklist && (
            <button
              onClick={handleMoreClick}
              style={{
                background: 'none',
                border: 'none',
                padding: 0,
                color: 'var(--color-primary)',
                fontSize: '0.75rem',
                fontStyle: 'italic',
                fontWeight: '500',
                cursor: 'pointer',
                textAlign: 'left',
                marginTop: '4px',
                display: 'block'
              }}
            >
              {isExpanded ? 'show less' : `+ ${checklistItems.length - 4} more items...`}
            </button>
          )}
        </div>
      ) : (
        <>
          <p style={{
            fontSize: '0.9rem',
            opacity: 0.85,
            overflow: 'hidden',
            display: isExpanded ? 'block' : '-webkit-box',
            WebkitLineClamp: isExpanded ? 'unset' : 4,
            WebkitBoxOrient: 'vertical',
            lineHeight: '1.4',
            whiteSpace: 'pre-wrap',
            margin: 0
          }}>
            {rawText}
          </p>
          {hasMoreText && (
            <button
              onClick={handleMoreClick}
              style={{
                background: 'none',
                border: 'none',
                padding: 0,
                color: 'var(--color-primary)',
                fontSize: '0.75rem',
                fontStyle: 'italic',
                fontWeight: '500',
                cursor: 'pointer',
                textAlign: 'left',
                marginTop: '4px',
                display: 'block'
              }}
            >
              {isExpanded ? 'show less' : 'more...'}
            </button>
          )}
        </>
      )}

      {/* Edit Icon */}
      <span className="material-symbols-outlined" style={{
        position: 'absolute',
        right: '12px',
        bottom: '12px',
        fontSize: '1rem',
        opacity: 0.5
      }}>edit</span>
    </div>
  );
}

export default function NotesView({ initialNote }) {
  const [notes, setNotes] = useState([]);
  const [search, setSearch] = useState('');
  const [isGridView, setIsGridView] = useState(true);
  const [isEditing, setIsEditing] = useState(false);
  const [selectedNote, setSelectedNote] = useState(null);
  const [previewMode, setPreviewMode] = useState(false);
  const [fullscreenImage, setFullscreenImage] = useState(null);

  useEffect(() => {
    if (initialNote) {
      openEdit(initialNote);
    }
  }, [initialNote]);

  // Form State
  const [title, setTitle] = useState('');
  const [content, setContent] = useState('');
  const [color, setColor] = useState('default');
  const [favorite, setFavorite] = useState(false);
  const [photo, setPhoto] = useState('');
  const [checklist, setChecklist] = useState([]);
  const [isChecklistMode, setIsChecklistMode] = useState(false);
  const [noteTags, setNoteTags] = useState([]);
  const [newTagInput, setNewTagInput] = useState('');
  const [activeFilterTag, setActiveFilterTag] = useState('');

  const noteColors = [
    { name: 'default', bg: 'var(--color-surface-container)', text: 'var(--color-on-surface)', border: 'var(--color-outline-variant)' },
    { name: 'red', bg: '#f28b82', text: '#202124', border: '#f28b82' },
    { name: 'orange', bg: '#fbbc04', text: '#202124', border: '#fbbc04' },
    { name: 'yellow', bg: '#fff475', text: '#202124', border: '#fff475' },
    { name: 'green', bg: '#ccff90', text: '#202124', border: '#ccff90' },
    { name: 'teal', bg: '#a7ffeb', text: '#202124', border: '#a7ffeb' },
    { name: 'blue', bg: '#cbf0f8', text: '#202124', border: '#cbf0f8' },
    { name: 'purple', bg: '#d7aefb', text: '#202124', border: '#d7aefb' },
    { name: 'pink', bg: '#fdcfe8', text: '#202124', border: '#fdcfe8' }
  ];

  // Load notes
  const loadNotes = () => {
    setNotes(syncEngine.getItems('notes'));
  };

  useEffect(() => {
    loadNotes();
    return syncEngine.subscribe(loadNotes);
  }, []);

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

  const parseTags = (tagsStr) => {
    if (!tagsStr) return [];
    return tagsStr.split(',').map(t => t.trim()).filter(Boolean);
  };

  const openEdit = (note = null) => {
    if (note) {
      setSelectedNote(note);
      setTitle(note.title || '');
      setContent(note.content || '');
      setColor(note.color || 'default');
      setFavorite(!!note.favorite);
      setPhoto(note.photo || '');
      const list = parseChecklist(note.checklist);
      setChecklist(list);
      setIsChecklistMode(list.length > 0);
      setNoteTags(parseTags(note.tags));
      setNewTagInput('');
      setPreviewMode(!!(note.content && note.content.includes('```')));
    } else {
      setSelectedNote(null);
      setTitle('');
      setContent('');
      setColor('default');
      setFavorite(false);
      setPhoto('');
      setChecklist([]);
      setIsChecklistMode(false);
      setNoteTags([]);
      setNewTagInput('');
      setPreviewMode(false);
    }
    setIsEditing(true);
  };

  const handleSave = (e) => {
    e.preventDefault();
    
    // Auto-commit any trailing tag text in the input
    let finalTags = [...noteTags];
    const cleanedTrailing = newTagInput.trim().toLowerCase();
    if (cleanedTrailing && !finalTags.includes(cleanedTrailing)) {
      finalTags.push(cleanedTrailing);
    }

    if (!title.trim() && !content.trim() && photo === '' && checklist.length === 0 && finalTags.length === 0) return;

    syncEngine.saveItem('notes', {
      id: selectedNote?.id,
      title: title || 'Untitled',
      content: isChecklistMode ? '' : content,
      color,
      favorite: favorite ? 1 : 0,
      photo,
      checklist: isChecklistMode ? JSON.stringify(checklist.filter(item => item.text.trim() !== '')) : null,
      tags: finalTags.join(',')
    });

    setIsEditing(false);
  };

  const handleDelete = (id) => {
    if (confirm('Delete this note?')) {
      syncEngine.deleteItem('notes', id);
      setIsEditing(false);
      setSelectedNote(null);
    }
  };

  const handlePhotoChange = (e) => {
    const file = e.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (event) => {
      const img = new Image();
      img.onload = () => {
        const canvas = document.createElement('canvas');
        const MAX_WIDTH = 1200;
        const MAX_HEIGHT = 1200;
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

        // Compress to JPEG with 0.7 quality
        const compressedBase64 = canvas.toDataURL('image/jpeg', 0.7);
        setPhoto(compressedBase64);
      };
      img.src = event.target.result;
    };
    reader.readAsDataURL(file);
  };

  const handleChecklistItemChange = (index, field, value) => {
    const newList = [...checklist];
    newList[index][field] = value;
    setChecklist(newList);
  };

  const addChecklistItem = () => {
    setChecklist([...checklist, { text: '', done: false }]);
  };

  const removeChecklistItem = (index) => {
    setChecklist(checklist.filter((_, idx) => idx !== index));
  };

  const toggleChecklistMode = () => {
    if (!isChecklistMode) {
      // Converting text lines to checklist items
      const lines = content.split('\n').filter(line => line.trim() !== '');
      const parsedItems = lines.map(line => {
        const isDone = line.startsWith('[x]') || line.startsWith('[X]');
        const text = line.replace(/^\[[ xX]\]\s*/, '');
        return { text, done: isDone };
      });
      setChecklist(parsedItems.length > 0 ? parsedItems : [{ text: '', done: false }]);
      setIsChecklistMode(true);
    } else {
      // Converting checklist items back to standard text
      const text = checklist
        .filter(item => item.text.trim() !== '')
        .map(item => `${item.done ? '[x]' : '[ ]'} ${item.text}`)
        .join('\n');
      setContent(text);
      setIsChecklistMode(false);
    }
  };

  // Dynamically compute unique tags from all active notes
  const allUniqueTags = Array.from(
    new Set(notes.flatMap(n => parseTags(n.tags)))
  ).sort();

  const filteredNotes = notes.filter(n => {
    const q = search.toLowerCase();
    const hasMatchInChecklist = parseChecklist(n.checklist).some(item =>
      item.text.toLowerCase().includes(q)
    );
    const matchesSearch = (n.title || '').toLowerCase().includes(q) ||
                          (n.content || '').toLowerCase().includes(q) ||
                          hasMatchInChecklist;
                          
    const matchesTag = activeFilterTag === '' || 
                       parseTags(n.tags).some(t => t.toLowerCase() === activeFilterTag.toLowerCase());

    return matchesSearch && matchesTag;
  }).sort((a, b) => {
    const favA = a.favorite ? 1 : 0;
    const favB = b.favorite ? 1 : 0;
    if (favA !== favB) return favB - favA; // Favorites on top
    return b.updated_at - a.updated_at;
  });

  const getStyleForColor = (colorName) => {
    return noteColors.find(c => c.name === colorName) || noteColors[0];
  };

  return (
    <div className="view-container notes-view-container" style={{ height: '100%', display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
      <div className="view-header" style={{ flexShrink: 0 }}>
        <h2>Notes</h2>
      </div>

      {/* Search and Filters */}
      <div style={{ display: 'flex', gap: '8px', alignItems: 'center', marginBottom: '1rem', flexShrink: 0 }}>
        <div style={{ flex: 1, display: 'flex', alignItems: 'center', backgroundColor: 'var(--color-surface-container)', padding: '4px 12px', borderRadius: '28px', border: '1px solid var(--color-outline-variant)' }}>
          <span className="material-symbols-outlined" style={{ color: 'var(--color-outline)' }}>search</span>
          <input
            type="text"
            placeholder="Search notes..."
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
        <button
          onClick={() => setIsGridView(!isGridView)}
          style={{
            width: '46px', /* matches height of search bar container */
            height: '46px',
            borderRadius: '50%',
            backgroundColor: 'var(--color-surface-container)',
            border: '1px solid var(--color-outline-variant)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            cursor: 'pointer',
            color: 'var(--color-on-surface-variant)',
            flexShrink: 0
          }}
          title={isGridView ? "View List" : "View Grid"}
        >
          <span className="material-symbols-outlined">{isGridView ? 'view_list' : 'grid_view'}</span>
        </button>
      </div>

      {/* Tag Filters Bar */}
      {allUniqueTags.length > 0 && (
        <div className="no-scrollbar" style={{ display: 'flex', gap: '8px', overflowX: 'auto', padding: '4px 0 12px 0', scrollbarWidth: 'none', flexShrink: 0, marginBottom: '0.5rem' }}>
          <button
            onClick={() => setActiveFilterTag('')}
            className={`m3-btn ${activeFilterTag === '' ? 'm3-btn-filled' : 'm3-btn-tonal'}`}
            style={{ height: '32px', padding: '0 12px', fontSize: '0.85rem', flexShrink: 0 }}
          >
            All
          </button>
          {allUniqueTags.map(tag => (
            <button
              key={tag}
              onClick={() => setActiveFilterTag(tag)}
              className={`m3-btn ${activeFilterTag === tag ? 'm3-btn-filled' : 'm3-btn-tonal'}`}
              style={{ height: '32px', padding: '0 12px', fontSize: '0.85rem', flexShrink: 0, textTransform: 'capitalize' }}
            >
              {tag}
            </button>
          ))}
        </div>
      )}

      {/* Listing Content */}
      {filteredNotes.length === 0 ? (
        <p style={{ color: 'var(--color-outline)', fontStyle: 'italic', padding: '32px 0', textAlign: 'center' }}>No notes found.</p>
      ) : (
        <div className={`notes-grid ${isGridView ? 'grid-layout' : 'list-layout'}`}>
          {filteredNotes.map(note => (
            <NoteCard
              key={note.id}
              note={note}
              isGridView={isGridView}
              openEdit={openEdit}
              getStyleForColor={getStyleForColor}
              parseChecklist={parseChecklist}
              parseTags={parseTags}
              setFullscreenImage={setFullscreenImage}
            />
          ))}
        </div>
      )}

      {/* FAB to add note */}
      <button className="fab" onClick={() => openEdit()}>
        <span className="material-symbols-outlined">add</span>
      </button>

      {/* Edit Note Modal Screen */}
      {isEditing && (
        <div className="backdrop" onClick={() => setIsEditing(false)}>
          <form className="bottom-sheet" onClick={(e) => e.stopPropagation()} onSubmit={handleSave} style={{
            height: '85vh',
            maxWidth: '650px',
            backgroundColor: getStyleForColor(color).bg,
            color: getStyleForColor(color).text,
            transition: 'background-color var(--motion-duration-medium) ease',
            display: 'flex',
            flexDirection: 'column'
          }}>
            {/* Header: Title and Actions */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
              <h3 style={{ fontFamily: 'var(--font-title)' }}>{selectedNote ? 'Edit Note' : 'New Note'}</h3>
              <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                {/* Favorite star toggle */}
                <button
                  type="button"
                  className="m3-btn m3-btn-text"
                  onClick={() => setFavorite(!favorite)}
                  style={{ width: '40px', height: '40px', padding: 0, borderRadius: '50%', minWidth: 'unset', color: 'inherit' }}
                >
                  <span className="material-symbols-outlined" style={{
                    fontVariationSettings: favorite ? '"FILL" 1' : 'none',
                    color: favorite ? 'var(--color-primary)' : 'inherit'
                  }}>
                    {favorite ? 'star' : 'star_border'}
                  </span>
                </button>

                {/* Checklist Mode toggle */}
                <button
                  type="button"
                  className="m3-btn m3-btn-text"
                  onClick={toggleChecklistMode}
                  title={isChecklistMode ? 'Switch to Text Mode' : 'Switch to Checklist Mode'}
                  style={{ width: '40px', height: '40px', padding: 0, borderRadius: '50%', minWidth: 'unset', color: 'inherit' }}
                >
                  <span className="material-symbols-outlined" style={{
                    color: isChecklistMode ? 'var(--color-primary)' : 'inherit'
                  }}>
                    {isChecklistMode ? 'text_fields' : 'playlist_add_check'}
                  </span>
                </button>

                {/* Preview Mode toggle */}
                {!isChecklistMode && (
                  <button
                    type="button"
                    className="m3-btn m3-btn-text"
                    onClick={() => setPreviewMode(!previewMode)}
                    title={previewMode ? 'Edit Note' : 'Preview Note'}
                    style={{ width: '40px', height: '40px', padding: 0, borderRadius: '50%', minWidth: 'unset', color: 'inherit' }}
                  >
                    <span className="material-symbols-outlined" style={{
                      color: previewMode ? 'var(--color-primary)' : 'inherit'
                    }}>
                      {previewMode ? 'edit' : 'visibility'}
                    </span>
                  </button>
                )}

                {/* Picture upload button */}
                <label className="m3-btn m3-btn-text" style={{ width: '40px', height: '40px', padding: 0, borderRadius: '50%', minWidth: 'unset', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', margin: 0, color: 'inherit' }}>
                  <span className="material-symbols-outlined">image</span>
                  <input type="file" accept="image/*" onChange={handlePhotoChange} style={{ display: 'none' }} />
                </label>

                {/* Close editor */}
                <button type="button" className="m3-btn m3-btn-text" style={{ width: '40px', height: '40px', padding: 0, borderRadius: '50%', minWidth: 'unset', color: 'inherit' }} onClick={() => setIsEditing(false)}>
                  <span className="material-symbols-outlined">close</span>
                </button>
              </div>
            </div>

            {/* Note Editor Area */}
            <div style={{ flex: 1, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '8px', paddingBottom: '16px' }}>
              {/* Photo Display */}
              {photo && (
                <div style={{ position: 'relative', width: '100%', borderRadius: '12px', overflow: 'hidden', margin: '4px 0 12px 0', border: '1px solid rgba(0,0,0,0.1)' }}>
                  <img
                    src={photo}
                    alt="Note Attachment"
                    style={{ width: '100%', maxHeight: '200px', objectFit: 'cover', cursor: 'zoom-in' }}
                    onClick={() => setFullscreenImage(photo)}
                  />
                  <button
                    type="button"
                    className="m3-btn m3-btn-text"
                    style={{ position: 'absolute', top: '8px', right: '8px', backgroundColor: 'rgba(255, 255, 255, 0.9)', borderRadius: '50%', width: '36px', height: '36px', padding: 0, minWidth: 'unset', boxShadow: 'var(--elevation-1)' }}
                    onClick={() => setPhoto('')}
                  >
                    <span className="material-symbols-outlined" style={{ color: 'var(--color-error)' }}>delete</span>
                  </button>
                </div>
              )}

              {/* Note Title */}
              <input
                type="text"
                placeholder="Title"
                value={title}
                onChange={e => setTitle(e.target.value)}
                style={{
                  fontFamily: 'var(--font-title)',
                  fontSize: '1.4rem',
                  fontWeight: '500',
                  background: 'transparent',
                  border: 'none',
                  outline: 'none',
                  color: 'inherit',
                  marginBottom: '8px',
                  width: '100%'
                }}
              />

              {/* Tags Editor */}
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px', alignItems: 'center', marginBottom: '12px', borderBottom: '1px dashed var(--color-outline-variant)', paddingBottom: '8px' }}>
                <span className="material-symbols-outlined" style={{ fontSize: '1.1rem', opacity: 0.6 }}>sell</span>
                {noteTags.map((tag, idx) => (
                  <span key={idx} style={{
                    fontSize: '0.75rem',
                    padding: '3px 8px',
                    borderRadius: '8px',
                    backgroundColor: 'rgba(0,0,0,0.06)',
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '4px',
                    textTransform: 'capitalize'
                  }}>
                    {tag}
                    <button type="button" onClick={() => setNoteTags(noteTags.filter((_, i) => i !== idx))} style={{ background: 'none', border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', padding: 0 }}>
                      <span className="material-symbols-outlined" style={{ fontSize: '0.9rem', opacity: 0.6 }}>close</span>
                    </button>
                  </span>
                ))}
                <input
                  type="text"
                  placeholder="Add tag..."
                  value={newTagInput}
                  onChange={e => setNewTagInput(e.target.value)}
                  onKeyDown={e => {
                    if (e.key === 'Enter' || e.key === ',') {
                      e.preventDefault();
                      const cleaned = newTagInput.trim().toLowerCase();
                      if (cleaned && !noteTags.includes(cleaned)) {
                        setNoteTags([...noteTags, cleaned]);
                      }
                      setNewTagInput('');
                    }
                  }}
                  style={{
                    fontSize: '0.8rem',
                    border: 'none',
                    outline: 'none',
                    background: 'transparent',
                    color: 'inherit',
                    padding: '2px 0',
                    minWidth: '70px',
                    flex: '1'
                  }}
                />
              </div>

              {/* Editor body: Checklist Editor OR Text Area */}
              {isChecklistMode ? (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', marginTop: '4px' }}>
                  {checklist.map((item, idx) => (
                    <div key={idx} style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                      <input
                        type="checkbox"
                        checked={item.done}
                        onChange={e => handleChecklistItemChange(idx, 'done', e.target.checked)}
                        style={{ cursor: 'pointer', width: '18px', height: '18px' }}
                      />
                      <input
                        type="text"
                        value={item.text}
                        onChange={e => handleChecklistItemChange(idx, 'text', e.target.value)}
                        placeholder="List item..."
                        style={{
                          flex: 1,
                          background: 'transparent',
                          border: 'none',
                          borderBottom: '1px dashed rgba(0,0,0,0.15)',
                          outline: 'none',
                          color: 'inherit',
                          fontSize: '1rem',
                          padding: '4px 0',
                          textDecoration: item.done ? 'line-through' : 'none',
                          opacity: item.done ? 0.6 : 1
                        }}
                      />
                      <button
                        type="button"
                        className="m3-btn m3-btn-text"
                        onClick={() => removeChecklistItem(idx)}
                        style={{ padding: 0, width: '32px', height: '32px', borderRadius: '50%', minWidth: 'unset', color: 'inherit' }}
                      >
                        <span className="material-symbols-outlined" style={{ fontSize: '1.2rem' }}>delete</span>
                      </button>
                    </div>
                  ))}
                  <button
                    type="button"
                    className="m3-btn m3-btn-tonal"
                    onClick={addChecklistItem}
                    style={{ height: '36px', padding: '0 12px', fontSize: '0.85rem', alignSelf: 'flex-start', marginTop: '8px', color: 'inherit', borderColor: 'rgba(0,0,0,0.1)' }}
                  >
                    <span className="material-symbols-outlined" style={{ fontSize: '1.1rem' }}>add</span> Add Item
                  </button>
                </div>
              ) : previewMode ? (
                <div style={{
                  fontFamily: 'var(--font-sans)',
                  fontSize: '1rem',
                  color: 'inherit',
                  lineHeight: '1.6',
                  minHeight: '200px',
                  overflowY: 'auto',
                  flex: 1,
                  textAlign: 'left',
                  width: '100%'
                }}>
                  {renderNoteContent(content)}
                </div>
              ) : (
                <textarea
                  placeholder="Start typing..."
                  value={content}
                  onChange={e => setContent(e.target.value)}
                  style={{
                    fontFamily: 'var(--font-sans)',
                    fontSize: '1rem',
                    background: 'transparent',
                    border: 'none',
                    outline: 'none',
                    color: 'inherit',
                    resize: 'none',
                    flex: 1,
                    width: '100%',
                    lineHeight: '1.6',
                    minHeight: '200px'
                  }}
                />
              )}
            </div>

            {/* Bottom Color Palette selector */}
            <div style={{
              display: 'flex',
              gap: '6px',
              overflowX: 'auto',
              padding: '12px 0',
              borderTop: '1px solid rgba(0,0,0,0.1)',
              marginBottom: '1rem',
              flexShrink: 0
            }}>
              {noteColors.map(c => (
                <button
                  key={c.name}
                  type="button"
                  onClick={() => setColor(c.name)}
                  style={{
                    width: '32px',
                    height: '32px',
                    borderRadius: '50%',
                    backgroundColor: c.bg,
                    border: color === c.name ? '3px solid var(--color-primary)' : '1px solid rgba(0,0,0,0.15)',
                    cursor: 'pointer',
                    flexShrink: 0
                  }}
                />
              ))}
            </div>

            {/* Footer Actions */}
            <div style={{ display: 'flex', gap: '8px', justifyContent: 'flex-end', flexShrink: 0 }}>
              {selectedNote && (
                <button type="button" className="m3-btn m3-btn-text" style={{ color: 'var(--color-error)' }} onClick={() => handleDelete(selectedNote.id)}>
                  Delete Note
                </button>
              )}
              <button type="submit" className="m3-btn m3-btn-filled">
                Save
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Fullscreen Image Preview Overlay */}
      {fullscreenImage && (
        <div 
          style={{
            position: 'fixed',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            backgroundColor: 'rgba(0, 0, 0, 0.9)',
            zIndex: 100000,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            flexDirection: 'column',
            gap: '16px',
            animation: 'fadeIn 0.25s ease'
          }}
          onClick={() => setFullscreenImage(null)}
        >
          {/* Controls */}
          <div 
            style={{
              position: 'absolute',
              top: '24px',
              right: '24px',
              display: 'flex',
              gap: '12px',
              zIndex: 100001
            }}
            onClick={e => e.stopPropagation()}
          >
            {/* Download button */}
            <a 
              href={fullscreenImage}
              download={title ? `${title.replace(/\s+/g, '_')}_attachment.png` : 'image_attachment.png'}
              className="m3-btn"
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '8px',
                textDecoration: 'none',
                height: '40px',
                padding: '0 16px',
                backgroundColor: 'rgba(255, 255, 255, 0.25)',
                color: '#ffffff',
                border: '1px solid rgba(255,255,255,0.4)',
                borderRadius: '20px',
                fontSize: '0.85rem',
                cursor: 'pointer',
                transition: 'background-color 0.2s',
                lineHeight: '40px'
              }}
            >
              <span className="material-symbols-outlined" style={{ verticalAlign: 'middle', fontSize: '1.2rem' }}>download</span>
              Download
            </a>
            
            {/* Close button */}
            <button
              type="button"
              className="m3-btn"
              onClick={() => setFullscreenImage(null)}
              style={{
                width: '40px',
                height: '40px',
                borderRadius: '50%',
                backgroundColor: 'rgba(255, 255, 255, 0.25)',
                color: '#ffffff',
                border: '1px solid rgba(255,255,255,0.4)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                cursor: 'pointer',
                padding: 0,
                minWidth: 'unset'
              }}
            >
              <span className="material-symbols-outlined" style={{ fontSize: '1.2rem' }}>close</span>
            </button>
          </div>

          {/* Image */}
          <img 
            src={fullscreenImage} 
            alt="Fullscreen preview" 
            style={{
              maxWidth: '90vw',
              maxHeight: '80vh',
              objectFit: 'contain',
              borderRadius: '8px',
              boxShadow: 'var(--elevation-4)',
              cursor: 'default'
            }}
            onClick={e => e.stopPropagation()}
          />
        </div>
      )}
    </div>
  );
}
