// mychatbot/chatbot-backend/api/chat.js

const OpenAI = require('openai');
const express = require('express');
const cors = require('cors');

const app = express();
app.use(express.json());
app.use(cors());

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY, // سيتم إعداد هذا في Vercel
});

module.exports = async (req, res) => {
  // التعامل مع طلبات OPTIONS لـ CORS (مهم)
  if (req.method === 'OPTIONS') {
    return res.status(200).send('OK');
  }

  // التأكد من أن الطلب هو POST
  if (req.method === 'POST') {
    try {
      // استقبال مصفوفة الرسائل من الواجهة الأمامية
      const { messages } = req.body;

      // التحقق من وجود messages وأنها مصفوفة
      if (!messages || !Array.isArray(messages) || messages.length === 0) {
        return res.status(400).json({ error: 'Messages array is required and cannot be empty.' });
      }

      console.log("Received messages from frontend:", messages);

      // استدعاء OpenAI API باستخدام مصفوفة الرسائل
      const completion = await openai.chat.completions.create({
        model: "gpt-3.5-turbo", // يمكنك تغيير هذا النموذج إذا كنت تستخدم غيره
        messages: messages, // إرسال مصفوفة الرسائل كاملة إلى OpenAI
        temperature: 0.7,
        max_tokens: 1000,
      });

      // استخراج الاستجابة من OpenAI
      const botResponse = completion.choices[0].message.content;
      console.log("OpenAI response:", botResponse);

      // إرسال الاستجابة كـ JSON
      res.json({ response: botResponse });

    } catch (error) {
      console.error("Error calling OpenAI API:", error);
      if (error instanceof OpenAI.APIError) {
        res.status(error.status || 500).json({ error: error.message || 'OpenAI API Error' });
      } else {
        res.status(500).json({ error: "An unexpected server error occurred." });
      }
    }
  } else {
    // إرسال خطأ إذا لم يكن الطلب POST
    res.status(405).json({ error: 'Method Not Allowed' });
  }
};