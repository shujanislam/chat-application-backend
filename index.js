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
    users[username] = { status: 'online', socketId: socket.id, lastActive: Date.now() };
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

app.get('/getfriends/:userFriend', async (req, res) => {
  const user = req.params.userFriend; // Get the username from params
  console.log(user);

  try {
    // Fetch the user ID from the users table
    const getUserId = await pool.query(`SELECT user_id FROM users WHERE name = $1`, [user]);

    if (getUserId.rows.length === 0) {
      return res.status(404).json({ success: false, message: 'User not found' });
    }

    const user_id = getUserId.rows[0].user_id;
    console.log('User ID:', user_id);

    // Query the `relation` table to get friends and their statuses
    const getFriends = await pool.query(
      `SELECT u.name, u.status 
       FROM users u
       JOIN relation r ON u.user_id = r.user1 OR u.user_id = r.user2
       WHERE (r.user1 = $1 OR r.user2 = $1) AND u.user_id != $1`,
      [user_id]
    );

    console.log('Got friends:', getFriends.rows);

    res.status(200).json({ success: true, data: getFriends.rows });
  } catch (err) {
    console.error('Error fetching friends:', err.message);
    res.status(500).json({ success: false, message: 'Error fetching friends' });
  }
});

app.post('/addfriend/:user', async (req, res) => {
  let user = req.params.user;
  let { friendId } = req.body;

  try {
    // Validate input
    if (!friendId) {
      return res.status(400).json({ success: false, message: "Friend ID is required" });
    }

    // Get user details
    let getUser = await pool.query(`SELECT * FROM users WHERE name = $1`, [user]);

    if (getUser.rows.length === 0) {
      return res.status(404).json({ success: false, message: "User not found" });
    }

    let userId = getUser.rows[0].user_id;

    // Check if friendship already exists
    let existingFriend = await pool.query(
      `SELECT * FROM relation WHERE (user1 = $1 AND user2 = $2) OR (user1 = $2 AND user2 = $1)`,
      [userId, friendId]
    );

    if (existingFriend.rows.length > 0) {
      return res.status(400).json({ success: false, message: "Already friends!" });
    }

    // Insert into relation table
    let result = await pool.query(
      `INSERT INTO relation (user1, user2, relation) VALUES ($1, $2, $3) RETURNING *`,
      [userId, friendId, 'friends']
    );

    res.status(200).json({ success: true, message: "Friend added successfully!" });
  } catch (err) {
    console.error("Error:", err.message);
    res.status(500).json({ success: false, message: "Server error" });
  }
});


// Use server.listen instead of app.listen for Socket.IO
server.listen(process.env.PORT || 8000, () => {
    console.log(`Server running on port ${process.env.PORT || 8000}`);
});

