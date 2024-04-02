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

app.use(express.static('public'));
app.use('/uploads', express.static(path.join(__dirname, 'uploads'))); // fix
app.use(express.urlencoded({ extended: true }));
app.use(cookieParser());
app.use(session({
  store: new FileStore({
    path: path.join(__dirname, 'sessions'),
  }),
  secret: 'rahasiaKu',
  resave: false,
  saveUninitialized: true,
}));

app.set('view engine', 'ejs');

const dbFilePath = 'db.json';
const usersDb = 'users.json';
const uploadsDb = 'uploads.json'; 

function readDb(filePath) {
  if (!fs.existsSync(filePath)) {
    return [];
  }
  const rawData = fs.readFileSync(filePath, 'utf8');
  try {
    return JSON.parse(rawData);
  } catch (error) {
    console.error("Error parsing JSON from file:", filePath, error);
    return [];
  }
}

function addUpload(uploadData) {
  const uploads = readDb(uploadsDb);
  uploads.push(uploadData);
  writeDb(uploadsDb, uploads);
}

function writeDb(filePath, data) {
  fs.writeFileSync(filePath, JSON.stringify(data, null, 2), 'utf8');
}


app.get('/', (req, res) => {
  fs.readdir('uploads/', (err, files) => {
    if (err) {
      console.log(err);
      return res.sendStatus(500);
    }

    const uploads = readDb(uploadsDb);
    const userUploads = uploads.filter(upload => upload.userId === req.session.userId);
  
    const users = readDb(usersDb);
    const user = users.find(u => u.id === req.session.userId);
  
    res.render('index', {
      files: userUploads.map(upload => upload.fileName),
      user: user
    });
  });
});

app.post('/upload', isAuthenticated, upload.single('file'), (req, res) => {
  if (!req.session.userId) {
    return res.redirect('/login');
  }

  const uploads = readDb(uploadsDb);
  uploads.push({ userId: req.session.userId, fileName: req.file.filename });
  writeDb(uploadsDb, uploads);

  res.redirect('/files');
});

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
    return res.redirect('/login');
  }

  const uploads = readDb(uploadsDb);
  const userUploads = uploads.filter(upload => upload.userId === req.session.userId);

  const users = readDb(usersDb);
  const user = users.find(u => u.id === req.session.userId);

  res.render('files', {
    files: userUploads.map(upload => upload.fileName),
    user: user
  });
});

function isAuthenticated(req, res, next) {
  if (req.session.userId) {
    next();
  } else {
    res.redirect('/login');
  }
}

function redirectIfAuthenticated(req, res, next) {
  if (req.session.userId) {
    res.redirect('/');
  } else {
    next();
  }
}

app.get('/logout', (req, res) => {
  req.session.destroy(err => {
    if (err) {
      console.error('Error during session destruction:', err);
    }
    res.redirect('/login');
  });
});

app.get('/login', redirectIfAuthenticated, (req, res) => {
  const uploads = readDb(uploadsDb);
  const userUploads = uploads.filter(upload => upload.userId === req.session.userId);

  const users = readDb(usersDb);
  const user = users.find(u => u.id === req.session.userId);

  res.render('login', {
    files: userUploads.map(upload => upload.fileName),
    user: null
  });
});

app.get('/register', redirectIfAuthenticated, (req, res) => {
  const uploads = readDb(uploadsDb);
  const userUploads = uploads.filter(upload => upload.userId === req.session.userId);

  const users = readDb(usersDb);
  const user = users.find(u => u.id === req.session.userId);

  res.render('register', {
    files: userUploads.map(upload => upload.fileName),
    user: user,
  });
});

app.post('/login', (req, res) => {
  const db = readDb();
  const { email, password } = req.body;
  const users = readDb(usersDb);
  const user = users.find(u => u.email === email);

  if (bcrypt.compareSync(password, user.password)) {
    req.session.userId = user.id;
    res.redirect('/files');
  } else {
    res.render('login', { error: 'Invalid email or password.', user: null });
  }
});

app.post('/register', (req, res) => {
  const { email, password, confirmPassword } = req.body;
  const users = readDb(usersDb);
  const hashedPassword = bcrypt.hashSync(password, 10);
  const newUser = { id: Date.now(), email, password: hashedPassword };

  if (password !== confirmPassword) {
    return res.render('register', { error: 'Passwords do not match.', user: null });
  }

  users.push(newUser);
  writeDb(usersDb, users);
  res.redirect('/files');
});

app.listen(port, () => {
  console.log(`Server berjalan di http://localhost:${port}`);
});