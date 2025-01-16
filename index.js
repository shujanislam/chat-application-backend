const express = require('express');
const passport = require('passport');
const session = require('express-session');
const cors = require('cors');
const { Pool } = require('pg');

require('dotenv').config(); // Load environment variables

require('./middleware/auth')

const app = express();

// CORS middleware
app.use(cors({
    origin: 'http://localhost:5173',  // Adjust to your React frontend domain
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
    credentials: true,  // Allow credentials (cookies)
}));

// Express session middleware
app.use(session({
    secret: 'justafuckintoken',  // Secret key for signing sessions
    resave: false,
    saveUninitialized: true,
    cookie: { 
        maxAge: 24 * 60 * 60 * 1000, 
        httpOnly: true,  // Prevents JS access to cookies
        secure: false,   // Set to `true` in production
        sameSite: 'strict'  // Adjust for your environment
    }
}));

// Initialize Passport
app.use(passport.initialize());
app.use(passport.session());

const pool = new Pool({
    user: process.env.PG_USER,       // Your PostgreSQL username
    host: process.env.PG_HOST,      // Database host
    database: process.env.PG_DB,    // Database name
    password: process.env.PG_PASSWORD, // Your PostgreSQL password
    port: 5432,             // Default PostgreSQL port
});

pool.query('SELECT NOW()', (err, res) => {
    if (err) {
        console.error('Error connecting to the database', err);
    } else {
        console.log('Connected to PostgreSQL:', res.rows);
    }
});

// Google OAuth routes
app.get('/auth/google',
    passport.authenticate('google', { scope: ['profile', 'email'] })
);

app.get('/auth/google/callback',
    passport.authenticate('google', { failureRedirect: '/' }),
    (req, res) => {
        // No need to regenerate session here since Passport handles this
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

// Start the server
const PORT = 8000;
app.listen(process.env.PORT || PORT, () => console.log(`Server running on http://localhost:${PORT}`));

