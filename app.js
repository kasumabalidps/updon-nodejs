const express = require('express');
const multer = require('multer');
const session = require('express-session');
const cookieParser = require('cookie-parser');
const bcrypt = require('bcrypt');
const fs = require('fs');
const path = require('path');

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
  secret: 'rahasiaKu',
  resave: false,
  saveUninitialized: true,
}));

app.set('view engine', 'ejs');

// Simulasi database sederhana dengan file JSON
const dbFilePath = 'db.json';

// Membaca data dari file JSON
function readDB() {
  if (!fs.existsSync(dbFilePath)) {
    return { users: [] };
  }
  const rawdata = fs.readFileSync(dbFilePath);
  return JSON.parse(rawdata);
}

// Menulis data ke file JSON
function writeDB(data) {
  const dataString = JSON.stringify(data, null, 2);
  fs.writeFileSync(dbFilePath, dataString);
}

// Rute untuk halaman utama
app.get('/', (req, res) => {
  fs.readdir('uploads/', (err, files) => {
    if (err) {
      console.log(err);
      return res.sendStatus(500);
    }
    res.render('index', { files: files });
  });
});

// Rute untuk upload file
app.post('/upload', upload.single('file'), (req, res) => {
  res.redirect('/');
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

// Rute untuk login
app.get('/login', (req, res) => {
  res.render('login');
});

app.post('/login', (req, res) => {
  const db = readDB();
  const user = db.users.find(u => u.email === req.body.email);
  if (user && bcrypt.compareSync(req.body.password, user.password)) {
    req.session.userId = user.id;
    res.redirect('/');
  } else {
    res.redirect('/login');
  }
});

// Rute untuk register
app.get('/register', (req, res) => {
  res.render('register');
});

app.post('/register', (req, res) => {
  const db = readDB();
  const hashedPassword = bcrypt.hashSync(req.body.password, 10);
  const newUser = {
    id: Date.now(),
    email: req.body.email,
    password: hashedPassword
  };
  db.users.push(newUser);
  writeDB(db);
  res.redirect('/login');
});

app.listen(port, () => {
  console.log(`Server berjalan di http://localhost:${port}`);
});