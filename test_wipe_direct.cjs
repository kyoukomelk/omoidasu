import sqlite3 from 'sqlite3';
import crypto from 'crypto';
import http from 'http';

function hashPassword(password) {
  const salt = crypto.randomBytes(16).toString('hex');
  const hash = crypto.pbkdf2Sync(password, salt, 1000, 64, 'sha512').toString('hex');
  return salt + ':' + hash;
}

const db = new sqlite3.Database('/home/kyouko/.gemini/antigravity/scratch/sync-app/data/sync.db');
const dbRun = (sql, params = []) => new Promise((res, rej) => db.run(sql, params, err => err ? rej(err) : res()));

async function run() {
  const newHash = hashPassword('password123');
  await dbRun('UPDATE users SET password_hash = ? WHERE username = ?', [newHash, 'kyoukomelk']);
  console.log('Updated kyoukomelk password to password123 in database.');

  const loginData = JSON.stringify({ username: 'kyoukomelk', password: 'password123' });
  const req = http.request('http://localhost:8080/api/auth/login', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Content-Length': Buffer.byteLength(loginData)
    }
  }, (res) => {
    let body = '';
    res.on('data', chunk => body += chunk);
    res.on('end', async () => {
      const parsed = JSON.parse(body);
      const token = parsed.token;
      console.log('Login successful, token acquired.');

      const wipeReq = http.request('http://localhost:8080/api/system/wipe-users', {
        method: 'POST',
        headers: {
          'Authorization': 'Bearer ' + token
        }
      }, (wipeRes) => {
        let wipeBody = '';
        wipeRes.on('data', chunk => wipeBody += chunk);
        wipeRes.on('end', () => {
          console.log('Wipe Response Status:', wipeRes.statusCode);
          console.log('Wipe Response Body:', wipeBody);
          db.close();
        });
      });
      wipeReq.end();
    });
  });
  req.write(loginData);
  req.end();
}

run().catch(console.error);
