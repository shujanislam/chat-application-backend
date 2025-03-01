const express = require('express');

const router = express.Router();

const { summarizeAI } = require('../utils/bot'); 

router.post('/summarize-text', async (req, res) => {
  try {
    const { message } = req.body;

    if (!message) {
      return res.status(400).json({ success: false, error: "Message is required" });
    }

    const summarizedText = await summarizeAI(message); // Await the function since it's async

    console.log("Summarized Text:", summarizedText);
    
    res.status(200).json({ success: true, summary: summarizedText });
  } catch (error) {
    console.error("Summarization Error:", error.message);
    res.status(500).json({ success: false, error: "Failed to summarize text" });
  }
});

module.exports = router;
