const passport = require('passport');
const GoogleStrategy = require('passport-google-oauth20').Strategy;
require('dotenv').config();
const { Pool } = require('pg');

const pool = new Pool({
    user: process.env.PG_USER,       // Your PostgreSQL username
    host: process.env.PG_HOST,      // Database host
    database: process.env.PG_DB,    // Database name
    password: process.env.PG_PASSWORD, // Your PostgreSQL password
    port: 5432,             // Default PostgreSQL port
});

passport.use(new GoogleStrategy({
    clientID: process.env.GOOGLE_CLIENT_ID,
    clientSecret: process.env.GOOGLE_CLIENT_SECRET,
    callbackURL: '/auth/google/callback'
}, async (accessToken, refreshToken, profile, done) => {
   try {
      let { displayName, emails } = profile;
      const email = emails?.[0]?.value;

      // Replace spaces with underscores and generate a random number
      const formattedName = displayName.toLowerCase().replace(/\s+/g, '_');
      const user_id = `${formattedName}_${Math.floor(Math.random() * 88888)}`;

      const checkUser = await pool.query(`SELECT * FROM users WHERE name = $1 AND email = $2`, [displayName, email]);

      let user;

      if (checkUser.rows.length > 0) {
        console.log('User Exists');
        user = checkUser.rows[0];
      } else {
        const addUser = await pool.query(
                        `INSERT INTO users (name, email, status, user_id) 
                         VALUES ($1, $2, $3, $4) 
                         RETURNING *`,
                        [displayName, email, 'online', user_id]
                    );

        user = addUser.rows[0];
      }

      return done(null, user);
    } 
    catch (err) {
      console.log(err.message);
    }
}));

passport.serializeUser((user, done) => {
    console.log('Serializing user:', user);
    done(null, user);
});

passport.deserializeUser((user, done) => {
    console.log('Deserializing user:', user);
    done(null, user);
});
