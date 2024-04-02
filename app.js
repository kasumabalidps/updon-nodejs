const express = require('express');
const multer = require('multer');
const session = require('express-session');
const cookieParser = require('cookie-parser');
const bcrypt = require('bcrypt');
const fs = require('fs');
const path = require('path');
const FileStore = require('session-file-store')(session);

const app = express();
const port = 3000;

// Konfigurasi penyimpanan Multer
const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    cb(null, 'uploads/')
  },
  filename: function (req, file, cb) {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    cb(null, file.fieldname + '-' + uniqueSuffix + path.extname(file.originalname));
  }
});

const upload = multer({ storage: storage });

// Middleware
app.use(express.static('public'));
app.use(express.urlencoded({ extended: true }));
app.use(cookieParser());
app.use(session({
  store: new FileStore(), // Use FileStore as the session store
  secret: 'rahasiaKu',
  resave: false,
  saveUninitialized: true,
  cookie: { secure: false } // Set to true if using HTTPS
}));

app.set('view engine', 'ejs');

// Simulasi database sederhana dengan file JSON
const dbFilePath = 'db.json';
const usersDb = 'users.json';
const uploadsDb = 'uploads.json'; 

// Membaca data dari file JSON
function readDb(filePath) {
  if (!fs.existsSync(filePath)) {
    return [];
  }
  const rawData = fs.readFileSync(filePath, 'utf8');
  try {
    return JSON.parse(rawData); // Mencoba mem-parsing data JSON
  } catch (error) {
    console.error("Error parsing JSON from file:", filePath, error);
    return []; // Mengembalikan array kosong jika terjadi error saat parsing
  }
  // return JSON.parse(fs.readFileSync(filePath, 'utf8'));
}

function addUpload(uploadData) {
  const uploads = readDb(uploadsDb);
  uploads.push(uploadData);
  writeDb(uploadsDb, uploads);
}
// Menulis data ke file JSON
function writeDb(filePath, data) {
  fs.writeFileSync(filePath, JSON.stringify(data, null, 2), 'utf8');
}

// Rute untuk halaman utama
app.get('/', (req, res) => {
  fs.readdir('uploads/', (err, files) => {
    if (err) {
      console.log(err);
      return res.sendStatus(500);
    }
    const user = req.session.userId ? { id: req.session.userId } : null;
    res.render('index', { files: files, user: user });
  });
});

// Rute untuk upload file
app.post('/upload', isAuthenticated, upload.single('file'), (req, res) => {
  if (!req.session.userId) {
    return res.redirect('/login'); // Pengguna harus login
  }

  const uploads = readDb(uploadsDb);
  uploads.push({ userId: req.session.userId, fileName: req.file.filename }); // Asosiasikan file dengan pengguna
  writeDb(uploadsDb, uploads);

  res.redirect('/files');
});

// Rute untuk menghapus file
app.delete('/delete/:name', (req, res) => {
  const fileName = req.params.name;
  const directoryPath = path.join(__dirname, 'uploads/');

  fs.unlink(path.join(directoryPath, fileName), (err) => {
    if (err) {
      console.log(err);
      return res.status(500).send({ message: "Could not delete the file. " + err });
    }
    res.status(200).send({ message: "File is deleted." });
  });
});

app.get('/files', (req, res) => {
  if (!req.session.userId) {
    return res.redirect('/login'); // Pengguna harus login
  }

  const uploads = readDb(uploadsDb);
  const userUploads = uploads.filter(upload => upload.userId === req.session.userId); // Filter file berdasarkan pengguna

  res.render('files', { files: userUploads.map(upload => upload.fileName) });
});

function isAuthenticated(req, res, next) {
  if (req.session.userId) {
    next(); // Pengguna terautentikasi, lanjutkan ke rute berikutnya
  } else {
    res.redirect('/login'); // Pengguna tidak terautentikasi, arahkan ke halaman login
  }
}

app.get('/login', (req, res) => {
  res.render('login');
});

app.get('/register', (req, res) => {
  res.render('register');
});

app.post('/login', (req, res) => {
  const db = readDb();
  const { email, password } = req.body;
  const users = readDb(usersDb);
  const user = users.find(u => u.email === email);

  if (user && bcrypt.compareSync(password, user.password)) {
    req.session.userId = user.id; // Simpan ID pengguna di session
    res.redirect('/files');
  } else {
    res.redirect('/login');
  }
});
// Rute untuk register
app.post('/register', (req, res) => {
  const { email, password } = req.body;
  const users = readDb(usersDb);
  const hashedPassword = bcrypt.hashSync(password, 10);
  const newUser = { id: Date.now(), email, password: hashedPassword };

  users.push(newUser);
  writeDb(usersDb, users);
  res.redirect('/login');
});

app.listen(port, () => {
  console.log(`Server berjalan di http://localhost:${port}`);
});