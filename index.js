const express = require('express');
const passport = require('passport');
const session = require('express-session');
const cors = require('cors');
const { pool } = require('./db/db');
const http = require('http');
const { Server } = require('socket.io');
const friends = require('./routes/friends');
const user = require('./routes/getUser');

require('dotenv').config();
require('./middleware/auth');

const app = express();
const server = http.createServer(app);

app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use('/', friends);
// Initialize Socket.IO after creating the server
const io = new Server(server, {
  cors: {
    origin: 'http://localhost:5173',
    methods: ['GET', 'POST'],
    credentials: true
  },
});

let users = {};

io.on('connection', (socket) => {
  console.log('User connected:', socket.id);
  
  const logIn = async () => {
    try {
      await pool.query('UPDATE users SET status = $1 WHERE name = $2', ['online', socket.username]);
    } catch (err) {
      console.error('Error updating login status:', err);
    }
  }

  const logOut = async () => {
    try {
      await pool.query('UPDATE users SET status = $1 WHERE name = $2', ['offline', socket.username]);
    } catch (err) {
      console.error('Error updating logout status:', err);
    }
  }

  socket.on('join', (username) => {
  socket.username = username;
  users[username] = { socketId: socket.id, status: 'online' }; // Store socket ID correctly
  logIn();
  console.log(`${username} joined the chat`);
});


  socket.on('private_message', ({ sender, recipient, message }) => {
    console.log('Message received:', { sender, recipient, message });
    
    // Emit to recipient
    const recipientSocket = Array.from(io.sockets.sockets.values())
      .find(s => s.username === recipient);
    
    if (recipientSocket) {
      // Send to recipient
      recipientSocket.emit('receive_message', { sender, recipient, message });
    }
    
    // Send back to sender
    socket.emit('receive_message', { sender, recipient, message });
  });

  socket.on("typing", ({ sender, recipient }) => {
  const recipientSocket = users[recipient]?.socketId;
  if (recipientSocket) {
    io.to(recipientSocket).emit("typing", { sender });
  }
});

socket.on("stop_typing", ({ sender, recipient }) => {
  const recipientSocket = users[recipient]?.socketId;
  if (recipientSocket) {
    io.to(recipientSocket).emit("stop_typing", { sender });
  }
});


  socket.on('disconnect', () => {
    for (const [username, details] of Object.entries(users)) {
      if (details.socketId === socket.id) {
        delete users[username];
        logOut();
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
app.get('/auth/user', async (req, res) => {
    if (req.isAuthenticated()) {
        try{  
          let checkUsername = await pool.query(`SELECT * FROM users WHERE name = $1`, [req.user.name]);
          let userId = checkUsername.rows[0].user_id;

          res.status(200).json({success: true, user_id: userId, user: req.user});
        }
        catch(err){
          console.log(err.message);
        }
    } else {
        res.status(401).send('Not authenticated');
    }
});

// Logout route
app.get('/auth/logout/:user', async (req, res) => {
  try {
    req.logout(async (err) => {
      if (err) {
        console.error('Logout error:', err);
        return res.status(500).json({ success: false, message: 'Error during logout' });
      }

      // Update the user's status to 'offline' in the database
      const currentUser = req.params.user; // Assuming `req.user` contains the current user's info
      await pool.query('UPDATE users SET status = $1 WHERE name = $2', ['offline', currentUser]);

      res.redirect('/');
    });
  } catch (err) {
    console.error('Error during logout process:', err);
    res.status(500).json({ success: false, message: 'Internal server error' });
  }
});

// Use server.listen instead of app.listen for Socket.IO
server.listen(process.env.PORT || 8000, () => {
    console.log(`Server running on port ${process.env.PORT || 8000}`);
});

