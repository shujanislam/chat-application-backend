const express = require('express');
const cors = require('cors'); // Import CORS
const { pool } = require('../db/db');

const router = express.Router();

// Use CORS middleware (allows all origins)
router.use(cors());

// OR, if you want to allow specific origins
// router.use(cors({ origin: 'http://your-frontend-domain.com' }));

router.get('/getfriends/:userFriend', async (req, res) => {
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

router.post('/addfriend/:user', async (req, res) => {
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

module.exports = router;

