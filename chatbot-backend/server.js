// mychatbot/chatbot-backend/server.js

// 1. استيراد المكتبات الضرورية
const express = require('express');
const cors = require('cors'); // إذا كنت تستخدم CORS (مهم للتشغيل المحلي أو من نطاقات مختلفة)
const path = require('path'); // لإدارة مسارات الملفات
const OpenAI = require('openai'); // مكتبة OpenAI

const app = express();

// 2. تهيئة Express Middleware
app.use(express.json()); // لتمكين قراءة JSON من جسم الطلب

// CORS (Cross-Origin Resource Sharing):
// السماح بجميع المصادر مؤقتاً. في الإنتاج الفعلي، يجب تحديد مصدر الواجهة الأمامية.
// بما أننا سنقدم الواجهة الأمامية والخلفية من نفس السيرفر، قد لا تحتاج CORS بشكل صريح إذا كانت الطلبات نسبية.
// ولكن من الأفضل تركه إذا كنت تختبر محلياً من منفذ مختلف.
app.use(cors());

// 3. تهيئة عميل OpenAI باستخدام مفتاح API من متغيرات البيئة
const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY, // سيتم إعداد هذا في Railway
});

// 4. نقطة نهاية API للدردشة
// هذا هو المسار الذي ستستدعيه الواجهة الأمامية (مثلاً: /chat)
app.post('/chat', async (req, res) => {
  try {
    const { messages } = req.body; // استقبال مصفوفة الرسائل من الواجهة الأمامية

    if (!messages || !Array.isArray(messages) || messages.length === 0) {
      return res.status(400).json({ error: 'Messages array is required and cannot be empty.' });
    }

    console.log("Received messages from frontend:", messages);

    // استدعاء OpenAI API
    const completion = await openai.chat.completions.create({
      model: "gpt-3.5-turbo", // يمكنك تغيير هذا النموذج إذا كنت تستخدم غيره
      messages: messages, // إرسال مصفوفة الرسائل كاملة إلى OpenAI
      temperature: 0.7,
      max_tokens: 1000,
    });

    const botResponse = completion.choices[0].message.content;
    console.log("OpenAI response:", botResponse);

    res.json({ response: botResponse }); // إرسال الاستجابة كـ JSON

  } catch (error) {
    console.error("Error calling OpenAI API:", error);
    if (error instanceof OpenAI.APIError) {
      res.status(error.status || 500).json({ error: error.message || 'OpenAI API Error' });
    } else {
      res.status(500).json({ error: "An unexpected server error occurred." });
    }
  }
});


// 5. تقديم ملفات الواجهة الأمامية (React) الثابتة
// __dirname يشير إلى المسار الحالي لملف server.js
// '..' يعود مجلدًا واحدًا للأعلى (إلى مجلد 'mychatbot')
// 'chatbot-frontend', 'build' يشيران إلى مجلد البناء لتطبيق React
app.use(express.static(path.join(__dirname, '..', 'chatbot-frontend', 'build')));

// 6. التعامل مع أي مسارات أخرى (خاصة بتطبيقات SPA مثل React)
// لأي مسار لا يتطابق مع API، ارجع ملف index.html الخاص بـ React
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, '..', 'chatbot-frontend', 'build', 'index.html'));
});

// 7. بدء تشغيل الخادم
// استخدام process.env.PORT للمنفذ الذي يوفره Railway
const port = process.env.PORT || 5000; // 5000 هو منفذ احتياطي للتشغيل المحلي
app.listen(port, () => {
  console.log(`Server listening on port ${port}`);
});