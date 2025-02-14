let express = require('express');

let router = express.Router();

let { pool } = require('../db/db');

// Update status API
router.post("/update-status", async (req, res) => {
  const { user, status } = req.body;

  try {
    await pool.query("UPDATE users SET status = $1 WHERE name = $2", [status, user]);
    res.status(200).json({ success: true, message: "Status updated successfully" });

    console.log("Status updated successfully");
  } catch (err) {
    console.error(err.message);
  }
});

module.exports = router;
