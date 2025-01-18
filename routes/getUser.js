const express = require('express');
const { Pool } = require('pg');

const pool = new Pool({
    user: 'shujan',
    host: 'localhost',
    database: 'chat-app',
    password: 'shujan@786',
    port: 5432,
});

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
      // Get all users except the current user
      const getUsers = await pool.query(
        'SELECT name FROM users WHERE name != $1',
        [currentUser]
      );

      if (getUsers.rows.length > 0) {
        const names = getUsers.rows.map(user => user.name);
        const statuses = users ? Object.values(users).map(user => user.status) : [];  // Ensure users object is properly available
        console.log(statuses);  // Display statuses
        res.status(200).json({ success: true, names, statuses });
      } else {
        res.status(200).json({ 
          success: true, 
          names: [], 
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


