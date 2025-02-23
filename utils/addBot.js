const { pool } = require("../db/db");

const checkAndCreateBot = async () => {
  try {
    // Check if bot exists in users table
    const botCheck = await pool.query(
      "SELECT user_id FROM users WHERE name = 'Bot'"
    );
    
    if (botCheck.rows.length === 0) {
      // Create bot user if it doesn't exist
      await pool.query(
        "INSERT INTO users (name, status, email, user_id) VALUES ('Bot', 'online', 'bot@system.local', 'bot_007')"
      );
    }
    
    return botCheck.rows[0]?.user_id || (await pool.query("SELECT user_id FROM users WHERE name = 'Bot'")).rows[0].user_id;
  } catch (err) {
    console.error("Error checking/creating bot:", err);
    throw err;
  }
};

// 2. Modified addBot function
const addBot = async (userId) => {
  try {
    // Get or create bot user_id
    const botId = await checkAndCreateBot();
    
    // Check if relation exists
    const checkRelation = await pool.query(
      "SELECT * FROM relation WHERE (user1 = $1 AND user2 = $2) OR (user1 = $2 AND user2 = $1)",
      [userId, botId]
    );

    if (checkRelation.rows.length === 0) {
      // Create relation if it doesn't exist
      await pool.query(
        "INSERT INTO relation (user1, user2, relation) VALUES ($1, $2, 'friends')",
        [userId, botId]
      );
    }
  } catch (err) {
    console.error("Error adding bot relation:", err);
    throw err;
  }
};


module.exports = { addBot };
