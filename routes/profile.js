const express = require('express');

const router = express.Router();

const { pool } = require('../db/db');

router.get(`/user/:userId`, async (req, res) => {
  let userId = req.params.userId;

  try {
    let checkUser = await pool.query(`SELECT * FROM users WHERE user_id = $1`, [userId]);

    if (checkUser.rows.length > 0) {
      res.status(200).json({ success: true, name: checkUser.rows[0].name });
    } else {
      console.log("User not found");
      res.status(404).json({ success: false, message: "User not found" });
    }
  } catch (err) {
    console.log("Database error:", err.message);
    res.status(500).json({ success: false, message: "Internal server error" });
  }
});


router.get(`/fetch-profile-data/:user`, async(req, res) => {
  let user = req.params.user;

  try{
    let checkUser = await pool.query(`SELECT * FROM users WHERE name = $1`, [user]);

    let name = checkUser.rows[0].name;

    if(name){
      res.status(200).json({success: true, name: name, user_id: checkUser.rows[0].user_id, status: checkUser.rows[0].status});
      console.log('user found' + name);
    }
    else{
      console.log('No user found');
    }
  }
  catch(err){
    console.log(err.message);
  }
})


module.exports = router;
