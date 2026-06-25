const sqlite3 = require('sqlite3').verbose();
const path = require('path');

const dbPath = path.join(__dirname, '../../scratch/sync-app/data/omoidasu.db');
const db = new sqlite3.Database(dbPath, (err) => {
  if (err) {
    console.error('Error opening database:', err);
    process.exit(1);
  }
});

db.all('SELECT id, username, display_name, theme_hue, theme_mode, is_admin FROM users', [], (err, rows) => {
  if (err) {
    console.error('Error querying users:', err);
  } else {
    console.log('--- USER DATA ---');
    console.log(rows);
  }
  db.close();
});
