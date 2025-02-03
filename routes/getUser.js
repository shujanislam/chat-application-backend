const express = require('express');
const { pool } = require('../db/db');

module.exports = (io, users) => {
  const router = express.Router();

  router.post('/get-users', async (req, res) => {
    const { currentUser } = req.body;

    if (!currentUser) {
      return res.status(400).json({ 
        success: false, 
        message: 'Current user not provided' 
      });
    }

    try {
      // Fetch all users except the current user
      const getUsers = await pool.query(
        'SELECT name, status FROM users WHERE name != $1',
        [currentUser]
      );

      if (getUsers.rows.length > 0) {
        // Send the data array
        res.status(200).json({ success: true, data: getUsers.rows });
      } else {
        res.status(200).json({ 
          success: true, 
          data: [], 
          message: 'No other users found' 
        });
      }
    } catch (err) {
      console.error('Database error:', err);
      res.status(500).json({ 
        success: false, 
        message: 'Error fetching users from database' 
      });
    }
  });

  return router;
};

