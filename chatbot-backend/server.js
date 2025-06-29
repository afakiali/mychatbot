// chatbot-backend/server.js

// 1. استيراد المكتبات الأساسية وتحميل متغيرات البيئة
require('dotenv').config(); // يجب أن يكون هذا السطر هو الأول لتحميل متغيرات البيئة
const express = require('express');
const cors = require('cors');
const fs = require('fs').promises; // لقراءة الملفات المحلية بشكل غير متزامن
const OpenAI = require('openai'); // مكتبة OpenAI

// 2. تهيئة التطبيق Express
const app = express();
const PORT = process.env.PORT || 5000;

// Middlewares (البرمجيات الوسيطة)
app.use(cors());
app.use(express.json()); // لتحليل طلبات JSON الواردة

// 3. تهيئة عميل OpenAI
const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

// متغير لتخزين أجزاء المعرفة وتضميناتها في الذاكرة
let knowledgeChunks = [];
let chunkEmbeddings = [];

// تحديد مسار ملف المعرفة الخاص بك
const KNOWLEDGE_FILE_PATH = './website_knowledge.txt'; // اضبط هذا إذا كان ملفك في مجلد فرعي

// 4. دالة مساعدة: تقسيم النص إلى أجزاء
// تقوم بتقسيم النص الكبير إلى أجزاء أصغر مناسبة للتضمينات
function chunkText(text, maxChars = 500, overlap = 100) {
    const chunks = [];
    const sentences = text.split(/(?<=[.!?])\s+/); // تقسيم حسب الجمل

    let currentChunk = "";
    for (const sentence of sentences) {
        if ((currentChunk + sentence).length <= maxChars) {
            currentChunk += (currentChunk ? " " : "") + sentence;
        } else {
            if (currentChunk) chunks.push(currentChunk.trim());
            currentChunk = sentence; // ابدأ جزءًا جديدًا
        }
    }
    if (currentChunk) chunks.push(currentChunk.trim());
    return chunks.filter(chunk => chunk.length > 0);
}

// 5. دالة لتحميل ومعالجة قاعدة المعرفة
async function loadKnowledgeBase() {
  try {
    console.log(`\n--- بدء تحميل قاعدة المعرفة ---`);
    console.log(`جارٍ قراءة ملف المعرفة من: ${KNOWLEDGE_FILE_PATH}`);
    const knowledgeText = await fs.readFile(KNOWLEDGE_FILE_PATH, 'utf-8');
    
    if (knowledgeText.trim().length === 0) {
        console.warn("ملف website_knowledge.txt فارغ. لن يتم استخدام معرفة محددة.");
        knowledgeChunks = [];
        chunkEmbeddings = [];
        return;
    }

    console.log('تمت قراءة ملف المعرفة بنجاح. جارٍ تقسيم النص وتوليد التضمينات...');

    knowledgeChunks = chunkText(knowledgeText, 700, 100);
    chunkEmbeddings = [];

    for (let i = 0; i < knowledgeChunks.length; i++) {
      const chunk = knowledgeChunks[i];
      try {
        const embeddingResponse = await openai.embeddings.create({
          model: "text-embedding-ada-002",
          input: chunk,
        });
        chunkEmbeddings.push(embeddingResponse.data[0].embedding);
      } catch (embedError) {
        console.error(`خطأ في تضمين الجزء ${i}:`, embedError.message);
      }
    }
    console.log(`تم تحميل ${knowledgeChunks.length} جزء من المعرفة وتوليد تضميناتها بنجاح.`);
    console.log(`--- انتهاء تحميل قاعدة المعرفة ---\n`);

  } catch (error) {
    console.error("خطأ حرج: فشل في تحميل أو معالجة قاعدة المعرفة المحلية.");
    console.error("تفاصيل الخطأ:", error.message);
    console.error(`الرجاء التأكد من وجود ملف ${KNOWLEDGE_FILE_PATH} وأن محتواه صالح.`);
    knowledgeChunks = [];
    chunkEmbeddings = [];
  }
}

// 6. دالة مساعدة: حساب التشابه (Cosine Similarity)
function cosineSimilarity(vecA, vecB) {
  let dotProduct = 0;
  let magnitudeA = 0;
  let magnitudeB = 0;
  for (let i = 0; i < vecA.length; i++) {
    dotProduct += vecA[i] * vecB[i];
    magnitudeA += vecA[i] * vecA[i];
    magnitudeB += vecB[i] * vecB[i];
  }
  magnitudeA = Math.sqrt(magnitudeA);
  magnitudeB = Math.sqrt(magnitudeB);
  if (magnitudeA === 0 || magnitudeB === 0) return 0;
  return dotProduct / (magnitudeA * magnitudeB);
}

// 7. نقطة نهاية API: الدردشة مع البوت (منطق RAG يدوي مع الذاكرة)
app.post('/chat', async (req, res) => {
  const { messages, language = 'auto' } = req.body;
  
  if (!messages || messages.length === 0) {
    return res.status(400).json({ error: 'الرسائل مطلوبة.' });
  }

  const currentMessage = messages[messages.length - 1].content;

  try {
    console.log(`\n--- بدء عملية الدردشة ---`);
    console.log("رسالة المستخدم الحالية المستلمة:", currentMessage);

    let context = "";
    if (knowledgeChunks.length > 0 && chunkEmbeddings.length > 0) {
      console.log("جارٍ توليد تضمين لاستعلام المستخدم الحالي...");
      const queryEmbeddingResponse = await openai.embeddings.create({
        model: "text-embedding-ada-002",
        input: currentMessage,
      });
      const queryEmbedding = queryEmbeddingResponse.data[0].embedding;
      console.log("تم توليد تضمين الاستعلام.");

      console.log("جارٍ البحث عن الأجزاء ذات الصلة في المعرفة المحلية...");
      const similarities = [];
      for (let i = 0; i < chunkEmbeddings.length; i++) {
        const similarity = cosineSimilarity(queryEmbedding, chunkEmbeddings[i]);
        similarities.push({ chunk: knowledgeChunks[i], score: similarity });
      }

      const relevantChunks = similarities
        .filter(item => item.score > 0.6)
        .sort((a, b) => b.score - a.score)
        .slice(0, 3)
        .map(item => item.chunk);

      if (relevantChunks.length > 0) {
        context = relevantChunks.join("\n\n");
        console.log("السياق المسترجع من المعرفة المحلية (تظهر الأجزاء): \n", context);
      } else {
        console.log("لم يتم العثور على سياق ذي صلة عالية في المعرفة المحلية (score < 0.6).");
      }
    } else {
      console.log("قاعدة المعرفة المحلية غير محملة أو فارغة عند الاستعلام. سيتم الاعتماد على المعرفة العامة فقط.");
    }

    // بناء المطالبة النهائية لـ OpenAI
    let systemPrompt = `أنت مساعد ذكاء اصطناعي متعدد اللغات، عالي الذكاء ومفيد.`;
    systemPrompt += ` هدفك هو تقديم إجابات شاملة ودقيقة لجميع أسئلة المستخدمين، بأي لغة يسألون بها، دون توجيههم أبدًا إلى الدعم.`;
    systemPrompt += ` لديك وصول إلى معرفة عامة بالإضافة إلى معلومات محددة مقدمة أدناه.`;
    systemPrompt += ` أعطِ الأولوية للمعلومات المحددة إذا كانت تجيب على السؤال مباشرة. إذا كانت المعلومات المحددة غير كافية، استخدم معرفتك العامة.`;
    systemPrompt += ` إذا سأل المستخدم بلغة معينة، أجب بنفس اللغة.`;
    systemPrompt += ` لا تذكر أنك تستخدم قاعدة معرفة. أجب مباشرة فقط.`;
    systemPrompt += ` كن شاملاً ومفصلاً في إجاباتك قدر الإمكان، ولا تقل "لا أعرف" إلا إذا كنت متأكدًا تمامًا من عدم وجود معلومات ذات صلة.`;
    systemPrompt += ` في ردودك، استخدم التنسيق المرقم (1., 2., 3., إلخ) للخطوات أو القوائم، وفصل كل نقطة بسطر جديد.`;
    systemPrompt += ` حافظ على اتجاه النص العربي من اليمين لليسار بشكل طبيعي، واعرض الكلمات الأجنبية والأرقام بطريقة صحيحة ضمن النص العربي دون قلبها.`;


    // إضافة سياق المعرفة إلى الـ systemPrompt
    const finalSystemPrompt = context ? `${systemPrompt}\n\nمعرفة محددة من الموقع:\n${context}` : systemPrompt;

    // بناء مصفوفة الرسائل النهائية التي ستُرسل إلى OpenAI
    // نرسل سجل المحادثة بالكامل هنا. يمكن هنا تطبيق نافذة ذاكرة (Sliding Window) للتحكم في طول المحادثة
    // على سبيل المثال، إرسال آخر 5 رسائل فقط: messages.slice(-5)
    const messagesToSend = [
      { role: "system", content: finalSystemPrompt },
      ...messages // نمرر سجل المحادثة بالكامل هنا
    ];

    console.log("الرسائل النهائية المرسلة إلى OpenAI (للتشخيص فقط):", JSON.stringify(messagesToSend, null, 2));

    console.log("جارٍ استدعاء OpenAI Chat Completions API...");
    const completion = await openai.chat.completions.create({
      model: "gpt-4o",
      messages: messagesToSend, // نمرر مصفوفة الرسائل هنا
      temperature: 0.7,
      max_tokens: 1000,
    });

    // 5. استخلاص الاستجابة
    const botResponse = completion.choices[0].message.content;
    console.log("الاستجابة الخام من OpenAI (للتشخيص فقط):", JSON.stringify(completion, null, 2));
    console.log("الاستجابة المستخلصة للبوت (content):", botResponse);
    console.log(`--- انتهاء عملية الدردشة ---\n`);

    res.json({ response: botResponse });

  } catch (error) {
    console.error("خطأ في نقطة النهاية /chat:", error.message);
    if (error.response) {
      console.error("OpenAI API Error Status:", error.response.status);
      console.error("OpenAI API Error Data:", error.response.data);
    }
    res.status(500).json({ error: 'فشل في الحصول على استجابة من البوت.' });
  }
});

// 8. بدء تشغيل الخادم وتحميل قاعدة المعرفة
app.listen(PORT, async () => {
  console.log(`الخادم يعمل على المنفذ ${PORT}`);
  await loadKnowledgeBase();
});
const path = require('path');

// استخدم ملفات الواجهة من build
app.use(express.static(path.join(__dirname, '../frontend/build')));

app.get('*', (req, res) => {
    res.sendFile(path.join(__dirname, '../frontend/build', 'index.html'));
});
