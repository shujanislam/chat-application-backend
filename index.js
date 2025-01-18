const express = require('express');
const passport = require('passport');
const session = require('express-session');
const cors = require('cors');
const { Pool } = require('pg');
const http = require('http');
const { Server } = require('socket.io');

const user = require('./routes/getUser');

require('dotenv').config();
require('./middleware/auth');

const app = express();
const server = http.createServer(app);

app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Initialize Socket.IO after creating the server
const io = new Server(server, {
  cors: {
    origin: 'http://localhost:5173',
    methods: ['GET', 'POST'],
    credentials: true
  },
});

let users = {};

// Socket.IO connection handling
io.on('connection', (socket) => {
  console.log('User connected:', socket.id);

  socket.on('join', (username) => {
    socket.username = username;
    users[username] = { status: 'online', socketId: socket.id, lastActive: Date.now() };
    console.log(users);
    console.log(`${username} joined the chat`);
  });

  socket.on('private_message', ({ sender, recipient, message }) => {
    // Find recipient's socket and emit the message
    const recipientSocket = Array.from(io.sockets.sockets.values())
      .find(s => s.username === recipient);
    
    if (recipientSocket) {
      recipientSocket.emit('receive_message', { sender, message });
    }
  });

  socket.on('disconnect', () => {
    for (const [username, details] of Object.entries(users)) {
      if (details.socketId === socket.id) {
        delete users[username];
        console.log(`${username} has disconnected.`);
        break;
      }
    }    
    console.log('User disconnected:', socket.id);
  });
});

app.use(cors({
    origin: 'http://localhost:5173',
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
    credentials: true,
}));

app.use(session({
    secret: process.env.SESSION_SECRET || 'justafuckintoken',
    resave: false,
    saveUninitialized: false,
    cookie: { 
        maxAge: 24 * 60 * 60 * 1000,
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'lax'
    }
}));

app.use(passport.initialize());
app.use(passport.session());
app.use('/', user(io, users));

const pool = new Pool({
    user: process.env.PG_USER,
    host: process.env.PG_HOST,
    database: process.env.PG_DB,
    password: process.env.PG_PASSWORD,
    port: process.env.PG_PORT || 5432,
});

// Google OAuth routes
app.get('/auth/google',
    passport.authenticate('google', { scope: ['profile', 'email'] })
);

app.get('/auth/google/callback',
    passport.authenticate('google', { failureRedirect: '/' }),
    (req, res) => {
        res.redirect('http://localhost:5173/dashboard');
    }
);

// Route to check if user is authenticated
app.get('/auth/user', (req, res) => {
    if (req.isAuthenticated()) {
        res.status(200).json(req.user);
    } else {
        res.status(401).send('Not authenticated');
    }
});

// Logout route
app.get('/auth/logout', (req, res) => {
    req.logout(() => {
        res.redirect('/');
    });
});

// Use server.listen instead of app.listen for Socket.IO
server.listen(process.env.PORT || 8000, () => {
    console.log(`Server running on port ${process.env.PORT || 8000}`);
});

