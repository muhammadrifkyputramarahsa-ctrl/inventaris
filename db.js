// Inisialisasi database SQLite, skema tabel, dan akun admin awal.
const Database = require('better-sqlite3');
const bcrypt = require('bcryptjs');

const db = new Database('data.sqlite');
db.pragma('foreign_keys = ON'); // aktifkan relasi antar tabel

db.exec(`
CREATE TABLE IF NOT EXISTS users (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL,
  email TEXT NOT NULL UNIQUE,
  password TEXT NOT NULL,
  role TEXT NOT NULL DEFAULT 'user' CHECK (role IN ('admin','user'))
);
CREATE TABLE IF NOT EXISTS categories (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL UNIQUE,
  description TEXT
);
CREATE TABLE IF NOT EXISTS products (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL,
  price INTEGER NOT NULL CHECK (price >= 0),
  stock INTEGER NOT NULL DEFAULT 0 CHECK (stock >= 0),
  description TEXT,
  category_id INTEGER NOT NULL REFERENCES categories(id) ON DELETE RESTRICT
);
`);

// Buat admin pertama dari file .env bila tabel user masih kosong
if (db.prepare('SELECT COUNT(*) c FROM users').get().c === 0) {
  const { ADMIN_NAME = 'Administrator', ADMIN_EMAIL = 'admin@example.com', ADMIN_PASSWORD = 'admin12345' } = process.env;
  db.prepare('INSERT INTO users (name,email,password,role) VALUES (?,?,?,?)')
    .run(ADMIN_NAME, ADMIN_EMAIL.toLowerCase(), bcrypt.hashSync(ADMIN_PASSWORD, 10), 'admin');
}

module.exports = db;
