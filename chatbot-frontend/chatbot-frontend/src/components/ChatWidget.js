// chatbot-frontend/src/components/ChatWidget.js

import React, { useState, useEffect, useRef } from 'react';
import './ChatWidget.css'; // تأكد من استيراد ملف CSS هذا

function ChatWidget() {
    const [isOpen, setIsOpen] = useState(false);
    const [message, setMessage] = useState('');
    const [conversation, setConversation] = useState([]);
    const [isLoading, setIsLoading] = useState(false);
    const [isDarkMode, setIsDarkMode] = useState(false);
    const [selectedFile, setSelectedFile] = useState(null);

    const conversationEndRef = useRef(null); // مرجع للتمرير إلى أسفل المحادثة

    // التمرير التلقائي إلى أسفل المحادثة عند إضافة رسالة جديدة
    useEffect(() => {
        if (conversationEndRef.current) {
            conversationEndRef.current.scrollIntoView({ behavior: "smooth" });
        }
    }, [conversation]);

    // تبديل فئة 'dark-mode' على عنصر <body> للتحكم في الوضع الليلي
    useEffect(() => {
        document.body.classList.toggle('dark-mode', isDarkMode);
    }, [isDarkMode]);

    // وظيفة لتبديل فتح/إغلاق نافذة الدردشة
    const toggleChat = () => {
        setIsOpen(!isOpen);
    };

    // وظيفة لتبديل الوضع الليلي/النهاري
    const toggleDarkMode = () => {
        setIsDarkMode(!isDarkMode);
    };

    // وظيفة للتعامل مع تغيير الملف المختار (لتحميل الصور/الملفات)
    const handleFileChange = (event) => {
        const file = event.target.files && event.target.files.length > 0 ? event.target.files[0] : null;
        if (file) {
            setSelectedFile(file);
            console.log("تم اختيار الملف:", file.name);
            // ملاحظة: معالجة الملفات (مثل إرسالها إلى الخلفية) تتطلب منطقًا إضافيًا
        }
    };

    // وظيفة لإرسال الرسالة إلى الخادم الخلفي
    const sendMessage = async (e) => {
        e.preventDefault(); // منع إعادة تحميل الصفحة الافتراضية للنموذج

        if (!message.trim() && !selectedFile) return; // لا ترسل إذا كانت الرسالة فارغة ولا يوجد ملف

        // أضف رسالة المستخدم إلى المحادثة للعرض الفوري
        const userMessage = { text: message.trim(), sender: 'user', file: selectedFile ? selectedFile.name : null };
        // سجل المحادثة الجديد الذي سيُرسل إلى الخلفية
        const newConversation = [...conversation, userMessage];
        setConversation(newConversation); // تحديث حالة المحادثة في الواجهة الأمامية

        setIsLoading(true); // ابدأ مؤشر التحميل

        try {
            // تحويل سجل المحادثة إلى تنسيق OpenAI (دور ومحتوى)
            // هذا الجزء هو الحل لمشكلة "الرسائل مطلوبة" ولتشغيل الذاكرة
            let currentPayloadMessages = newConversation.map(msg => ({
                role: msg.sender === 'user' ? 'user' : 'assistant', // 'user' أو 'assistant'
                content: msg.text // محتوى الرسالة
            }));

            // إذا كان هناك ملف، أضف اسمه إلى الرسالة الأخيرة في الـ payload
            if (selectedFile) {
                // نعدل آخر رسالة في سجل المحادثة (التي هي رسالة المستخدم الحالية)
                currentPayloadMessages[currentPayloadMessages.length - 1].content += ` (ملف مرفق: ${selectedFile.name})`;
            }

            // إرسال سجل المحادثة الكامل إلى نقطة نهاية /chat في الخادم الخلفي
            const response = await fetch('http://localhost:5000/chat', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({ messages: currentPayloadMessages }), // نرسل مصفوفة الرسائل كاملة
            });

            if (!response.ok) {
                // التعامل مع الأخطاء من الخادم (مثل 500 Internal Server Error)
                const errorData = await response.json();
                throw new Error(errorData.error || `خطأ HTTP! الحالة: ${response.status}`);
            }

            // استلام رد البوت وإضافته إلى المحادثة
            const data = await response.json();
            const botResponse = { text: data.response, sender: 'bot' };
            setConversation((prevConv) => [...prevConv, botResponse]);

        } catch (error) {
            console.error('خطأ في إرسال الرسالة:', error);
            const errorMessage = { text: `حدث خطأ: ${error.message}. يرجى المحاولة مرة أخرى.`, sender: 'bot-error' };
            setConversation((prevConv) => [...prevConv, errorMessage]); // عرض رسالة خطأ للمستخدم
        } finally {
            setIsLoading(false); // إخفاء مؤشر التحميل
            setMessage(''); // مسح مربع الإدخال
            setSelectedFile(null); // مسح الملف المختار
        }
    };

    // دالة مساعدة لعرض محتوى الرسالة، مع تنسيق الأسطر والأرقام
    // هذه الدالة هي التي تحتوي على الحل لعدم قلب الكتابة الأجنبية الذي يعمل لديك
    const renderMessageContent = (text, sender) => {
        // تقسيم النص إلى أسطر
        const lines = text.split('\n');

        return (
            // تعيين اتجاه النص بناءً على المرسل
            <div className={sender === 'user' ? 'rtl-text user-message-content' : 'rtl-text bot-message-content'}>
                {lines.map((line, index) => {
                    // تقسيم كل سطر للبحث عن العناصر المرقمة (مثل "1. ", "2. ")
                    // regex: (\d+\.\s+) يلتقط رقمًا متبوعًا بنقطة ومسافة
                    const parts = line.split(/(\d+\.\s+)/);
                    return (
                        // كل سطر في فقرة خاصة به لضمان تنظيم الأسطر
                        <p key={index} style={{ margin: '5px 0' }}>
                            {parts.map((part, partIndex) => {
                                // إذا كان الجزء يطابق نمط الرقم، أعطه فئة خاصة (لتلوينه)
                                if (part.match(/^\d+\.\s+/)) { // يجب أن يبدأ الجزء برقم
                                    return <span key={partIndex} className="numbered-item">{part}</span>;
                                } else {
                                    // إذا لم يكن رقمًا، حاول تحديد اتجاهه
                                    // هذا الجزء يساعد في معالجة الكلمات الأجنبية داخل النص العربي
                                    const isLikelyEnglish = /[a-zA-Z]/.test(part) && !/[\u0600-\u06FF]/.test(part);
                                    return (
                                        <span key={partIndex} className={isLikelyEnglish ? 'ltr-inline' : ''}>
                                            {part}
                                        </span>
                                    );
                                }
                            })}
                        </p>
                    );
                })}
            </div>
        );
    };

    return (
        <>
            {/* زر التبديل العائم (الشعار) - يظهر عندما تكون نافذة الدردشة مغلقة */}
            {!isOpen && (
                <button className="chat-toggle-button closed" onClick={toggleChat} title="افتح الدردشة">
                    <span role="img" aria-label="chat-icon">💬</span>
                </button>
            )}

            {/* حاوية ودجت الدردشة الرئيسية - تظهر عندما تكون مفتوحة */}
            <div className={`chat-widget ${isOpen ? 'open' : 'closed'} ${isDarkMode ? 'dark-mode' : ''}`}>
                <div className="chat-header">
                    <span className="bot-name">
                        GPT PRO
                        {/* زر الحالة المتصل - يظهر بجانب اسم البوت */}
                        <div className="status-indicator online" title="متصل"></div>
                    </span>
                    <div className="header-icons">
                        {/* زر تبديل الوضع الليلي/النهاري */}
                        <button className="icon-button" onClick={toggleDarkMode} title="تبديل الوضع الليلي">
                            {isDarkMode ? '☀️' : '🌙'}
                        </button>
                        {/* زر إغلاق نافذة الدردشة */}
                        <button className="icon-button close-button" onClick={toggleChat} title="إغلاق الدردشة">
                            &times;
                        </button>
                    </div>
                </div>

                {/* منطقة عرض المحادثة */}
                <div className="chat-conversation-area">
                    {conversation.map((msg, index) => (
                        <div key={index} className={`message-bubble ${msg.sender}`}>
                            {/* استخدام دالة renderMessageContent لتنسيق الرسائل */}
                            {renderMessageContent(msg.text, msg.sender)}
                            {msg.file && <div className="attachment-info">📄 {msg.file}</div>}
                        </div>
                    ))}
                    {isLoading && (
                        <div className="message-bubble bot loading">
                            جارٍ التفكير...
                        </div>
                    )}
                    <div ref={conversationEndRef} /> {/* عنصر فارغ للتمرير التلقائي */}
                </div>

                {/* منطقة إدخال الرسائل والأزرار */}
                <form onSubmit={sendMessage} className="chat-input-area">
                    {/* زر تحميل الملفات */}
                    <label htmlFor="file-upload" className="upload-button" title="إرفاق ملف">
                        📎
                        <input
                            id="file-upload"
                            type="file"
                            onChange={handleFileChange}
                            style={{ display: 'none' }} // إخفاء زر الإدخال الأصلي للملفات
                            disabled={isLoading}
                        />
                    </label>
                    {/* مربع إدخال النص */}
                    <input
                        type="text"
                        value={message}
                        onChange={(e) => setMessage(e.target.value)}
                        placeholder={selectedFile ? selectedFile.name : "اكتب رسالتك هنا..."}
                        disabled={isLoading}
                        readOnly={!!selectedFile} // جعل للقراءة فقط إذا تم اختيار ملف
                    />
                    {/* زر إرسال الرسالة */}
                    <button type="submit" disabled={isLoading}>
                        إرسال
                    </button>
                </form>
                {selectedFile && (
                    <div className="file-preview">
                        <span>{selectedFile.name}</span>
                        <button onClick={() => setSelectedFile(null)} className="clear-file-button">&times;</button>
                    </div>
                )}
            </div>
        </>
    );
}

export default ChatWidget;