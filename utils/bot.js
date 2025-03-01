const { GoogleGenerativeAI } = require("@google/generative-ai");
require("dotenv").config();

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY); // Set this in your .env file

const chatWithBot = async (message) => {
  try {
    const model = genAI.getGenerativeModel({ model: "models/gemini-1.5-pro-002" });

    const result = await model.generateContent([message]);
    const response = result.response.text();

    return response;
  } catch (error) {
    console.error("Error in Gemini API:", error.message);
    return "Sorry, I am having trouble responding right now.";
  }
};

const summarizeAI = async (message) => {
  try {
    const model = genAI.getGenerativeModel({ model: "models/gemini-1.5-pro-002" });

    const prompt = `Summarize the given text in a very consise manner: \n \n ${message}`;

    const result = await model.generateContent([prompt]);
    const response = result.response.text();

    return response;
  } catch (error) {
    console.error("Error in Gemini API:", error.message);
    return "Sorry, I am having trouble responding right now.";
  }
};

module.exports = { chatWithBot, summarizeAI };
