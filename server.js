require('dotenv').config();
const crypto = require('crypto');
const path = require('path');
const express = require('express');
const session = require('express-session');
const bcrypt = require('bcryptjs');
const db = require('./db');

const app = express();
app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));
app.use(express.static(path.join(__dirname, 'public'))); // file statis (gambar/ikon)
app.use(express.urlencoded({ extended: false }));
app.use(session({
  secret: process.env.SESSION_SECRET || 'dev-secret-ubah-di-produksi',
  resave: false,
  saveUninitialized: false,
  cookie: { httpOnly: true, sameSite: 'lax', maxAge: 1000 * 60 * 60 * 8 }
}));

// ---------- Middleware global: user, flash message, token CSRF ----------
app.use((req, res, next) => {
  if (!req.session.csrf) req.session.csrf = crypto.randomBytes(24).toString('hex');
  res.locals.csrf = req.session.csrf;
  res.locals.user = req.session.user || null;
  res.locals.flash = req.session.flash || null;
  res.locals.rupiah = (n) => 'Rp ' + Number(n).toLocaleString('id-ID');
  delete req.session.flash;
  // Tolak request POST tanpa token CSRF yang valid
  if (req.method === 'POST' && req.body._csrf !== req.session.csrf) {
    return res.status(403).send('Token keamanan tidak valid. Muat ulang halaman.');
  }
  next();
});

const flash = (req, type, msg) => { req.session.flash = { type, msg }; };
const requireLogin = (req, res, next) => (req.session.user ? next() : res.redirect('/login'));
// RBAC: hanya admin yang boleh mengubah data
const requireAdmin = (req, res, next) => {
  if (req.session.user && req.session.user.role === 'admin') return next();
  flash(req, 'error', 'Akses ditolak: khusus Admin.');
  res.redirect('/dashboard');
};

// ---------- Autentikasi ----------
app.get('/', (req, res) => res.redirect(req.session.user ? '/dashboard' : '/login'));

app.get('/register', (req, res) => res.render('register', { title: 'Daftar' }));
app.post('/register', (req, res) => {
  const name = (req.body.name || '').trim();
  const email = (req.body.email || '').trim().toLowerCase();
  const password = req.body.password || '';
  if (!name || !/^\S+@\S+\.\S+$/.test(email) || password.length < 8) {
    flash(req, 'error', 'Isi semua data dengan benar. Password minimal 8 karakter.');
    return res.redirect('/register');
  }
  if (db.prepare('SELECT id FROM users WHERE email=?').get(email)) {
    flash(req, 'error', 'Email sudah terdaftar.');
    return res.redirect('/register');
  }
  // Pendaftaran publik selalu berperan "user"; admin hanya dari seed
  db.prepare('INSERT INTO users (name,email,password,role) VALUES (?,?,?,?)')
    .run(name, email, bcrypt.hashSync(password, 10), 'user');
  flash(req, 'success', 'Registrasi berhasil. Silakan login.');
  res.redirect('/login');
});

app.get('/login', (req, res) => res.render('login', { title: 'Login' }));
app.post('/login', (req, res) => {
  const email = (req.body.email || '').trim().toLowerCase();
  const u = db.prepare('SELECT * FROM users WHERE email=?').get(email);
  if (!u || !bcrypt.compareSync(req.body.password || '', u.password)) {
    flash(req, 'error', 'Email atau password salah.');
    return res.redirect('/login');
  }
  // Regenerasi session untuk mencegah session fixation
  req.session.regenerate(() => {
    req.session.csrf = crypto.randomBytes(24).toString('hex');
    req.session.user = { id: u.id, name: u.name, role: u.role };
    res.redirect('/dashboard');
  });
});
app.post('/logout', (req, res) => req.session.destroy(() => res.redirect('/login')));

// ---------- Dashboard ----------
app.get('/dashboard', requireLogin, (req, res) => {
  const stats = db.prepare(`SELECT COUNT(*) products, COALESCE(SUM(stock),0) stock,
    COALESCE(SUM(price*stock),0) value FROM products`).get();
  stats.categories = db.prepare('SELECT COUNT(*) c FROM categories').get().c;
  stats.users = db.prepare('SELECT COUNT(*) c FROM users').get().c;
  const perCategory = db.prepare(`SELECT c.name, COUNT(p.id) total FROM categories c
    LEFT JOIN products p ON p.category_id=c.id GROUP BY c.id ORDER BY total DESC`).all();
  const lowStock = db.prepare(`SELECT p.name, p.stock, c.name category FROM products p
    JOIN categories c ON c.id=p.category_id WHERE p.stock <= 5 ORDER BY p.stock LIMIT 5`).all();
  res.render('dashboard', { title: 'Dashboard', stats, perCategory, lowStock });
});

// ---------- CRUD Kategori ----------
app.get('/categories', requireLogin, (req, res) => {
  const items = db.prepare(`SELECT c.*, COUNT(p.id) total FROM categories c
    LEFT JOIN products p ON p.category_id=c.id GROUP BY c.id ORDER BY c.name`).all();
  res.render('categories', { title: 'Kategori', items, editing: null });
});
app.get('/categories/:id/edit', requireAdmin, (req, res) => {
  const editing = db.prepare('SELECT * FROM categories WHERE id=?').get(req.params.id);
  if (!editing) return res.redirect('/categories');
  const items = db.prepare(`SELECT c.*, COUNT(p.id) total FROM categories c
    LEFT JOIN products p ON p.category_id=c.id GROUP BY c.id ORDER BY c.name`).all();
  res.render('categories', { title: 'Edit Kategori', items, editing });
});
app.post('/categories', requireAdmin, (req, res) => {
  const name = (req.body.name || '').trim();
  if (!name) { flash(req, 'error', 'Nama kategori wajib diisi.'); return res.redirect('/categories'); }
  try {
    db.prepare('INSERT INTO categories (name,description) VALUES (?,?)').run(name, req.body.description || '');
    flash(req, 'success', 'Kategori ditambahkan.');
  } catch { flash(req, 'error', 'Nama kategori sudah ada.'); }
  res.redirect('/categories');
});
app.post('/categories/:id', requireAdmin, (req, res) => {
  const name = (req.body.name || '').trim();
  try {
    db.prepare('UPDATE categories SET name=?, description=? WHERE id=?').run(name, req.body.description || '', req.params.id);
    flash(req, 'success', 'Kategori diperbarui.');
  } catch { flash(req, 'error', 'Gagal memperbarui (nama kosong/duplikat).'); }
  res.redirect('/categories');
});
app.post('/categories/:id/delete', requireAdmin, (req, res) => {
  try {
    db.prepare('DELETE FROM categories WHERE id=?').run(req.params.id);
    flash(req, 'success', 'Kategori dihapus.');
  } catch { flash(req, 'error', 'Kategori masih dipakai produk, tidak bisa dihapus.'); }
  res.redirect('/categories');
});

// ---------- CRUD Produk ----------
const listProducts = (q) => db.prepare(`SELECT p.*, c.name category FROM products p
  JOIN categories c ON c.id=p.category_id WHERE p.name LIKE ? ORDER BY p.id DESC`).all(`%${q}%`);
const allCategories = () => db.prepare('SELECT id,name FROM categories ORDER BY name').all();

app.get('/products', requireLogin, (req, res) => {
  const q = (req.query.q || '').trim();
  res.render('products', { title: 'Produk', items: listProducts(q), categories: allCategories(), editing: null, q });
});
app.get('/products/:id/edit', requireAdmin, (req, res) => {
  const editing = db.prepare('SELECT * FROM products WHERE id=?').get(req.params.id);
  if (!editing) return res.redirect('/products');
  res.render('products', { title: 'Edit Produk', items: listProducts(''), categories: allCategories(), editing, q: '' });
});
// Validasi input produk (dipakai oleh create & update)
const parseProduct = (b) => ({
  name: (b.name || '').trim(),
  price: parseInt(b.price, 10),
  stock: parseInt(b.stock, 10),
  category_id: parseInt(b.category_id, 10),
  description: b.description || ''
});
const validProduct = (p) => p.name && p.price >= 0 && p.stock >= 0 && p.category_id;

app.post('/products', requireAdmin, (req, res) => {
  const p = parseProduct(req.body);
  if (!validProduct(p)) { flash(req, 'error', 'Data produk tidak valid.'); return res.redirect('/products'); }
  db.prepare('INSERT INTO products (name,price,stock,description,category_id) VALUES (?,?,?,?,?)')
    .run(p.name, p.price, p.stock, p.description, p.category_id);
  flash(req, 'success', 'Produk ditambahkan.');
  res.redirect('/products');
});
app.post('/products/:id', requireAdmin, (req, res) => {
  const p = parseProduct(req.body);
  if (!validProduct(p)) { flash(req, 'error', 'Data produk tidak valid.'); return res.redirect('/products'); }
  db.prepare('UPDATE products SET name=?, price=?, stock=?, description=?, category_id=? WHERE id=?')
    .run(p.name, p.price, p.stock, p.description, p.category_id, req.params.id);
  flash(req, 'success', 'Produk diperbarui.');
  res.redirect('/products');
});
app.post('/products/:id/delete', requireAdmin, (req, res) => {
  db.prepare('DELETE FROM products WHERE id=?').run(req.params.id);
  flash(req, 'success', 'Produk dihapus.');
  res.redirect('/products');
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Server berjalan di http://localhost:${PORT}`));
