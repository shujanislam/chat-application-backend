const { GoogleGenerativeAI } = require("@google/generative-ai");
require("dotenv").config();

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY); // Set this in your .env file

const chatWithBot = async (message) => {
  try {
    const model = genAI.getGenerativeModel({ model: "gemini-pro" });

    const result = await model.generateContent([message]);
    const response = result.response.text();

    return response;
  } catch (error) {
    console.error("Error in Gemini API:", error.message);
    return "Sorry, I am having trouble responding right now.";
  }
};

module.exports = { chatWithBot };
