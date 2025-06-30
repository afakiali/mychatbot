// mychatbot/chatbot-frontend/src/components/ChatWidget.js

import React, { useState, useEffect, useRef } from 'react';
import './ChatWidget.css';

function ChatWidget() {
    const [isOpen, setIsOpen] = useState(false);
    const [message, setMessage] = useState('');
    const [conversation, setConversation] = useState([]);
    const [isLoading, setIsLoading] = useState(false);
    const [isDarkMode, setIsDarkMode] = useState(false);
    const [selectedFile, setSelectedFile] = useState(null);

    const conversationEndRef = useRef(null);

    useEffect(() => {
        if (conversationEndRef.current) {
            conversationEndRef.current.scrollIntoView({ behavior: "smooth" });
        }
    }, [conversation]);

    useEffect(() => {
        document.body.classList.toggle('dark-mode', isDarkMode);
    }, [isDarkMode]);

    const toggleChat = () => {
        setIsOpen(!isOpen);
    };

    const toggleDarkMode = () => {
        setIsDarkMode(!isDarkMode);
    };

    const handleFileChange = (event) => {
        const file = event.target.files && event.target.files.length > 0 ? event.target.files[0] : null;
        if (file) {
            setSelectedFile(file);
            console.log("تم اختيار الملف:", file.name);
        }
    };

    const sendMessage = async (e) => {
        e.preventDefault();

        if (!message.trim() && !selectedFile) return;

        const userMessage = { text: message.trim(), sender: 'user', file: selectedFile ? selectedFile.name : null };
        const newConversation = [...conversation, userMessage];
        setConversation(newConversation);

        setIsLoading(true);

        try {
            let currentPayloadMessages = newConversation.map(msg => ({
                role: msg.sender === 'user' ? 'user' : 'assistant',
                content: msg.text
            }));

            if (selectedFile) {
                currentPayloadMessages[currentPayloadMessages.length - 1].content += ` (ملف مرفق: ${selectedFile.name})`;
            }

            // ***** التعديل هنا: استخدام مسار نسبي للاتصال بنفس الخادم *****
            // لا نحتاج لمتغيرات بيئة خاصة بالـ URL هنا لأن الخادم يقدم كل شيء
            const API_ENDPOINT = '/chat'; // المسار إلى API الخاص بالدردشة على خادمك Node.js

            const response = await fetch(API_ENDPOINT, { // <-- تم التعديل هنا
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({ messages: currentPayloadMessages }),
            });

            if (!response.ok) {
                const errorData = await response.json();
                throw new Error(errorData.error || `خطأ HTTP! الحالة: ${response.status}`);
            }

            const data = await response.json();
            const botResponse = { text: data.response, sender: 'bot' };
            setConversation((prevConv) => [...prevConv, botResponse]);

        } catch (error) {
            console.error('خطأ في إرسال الرسالة:', error);
            const errorMessage = { text: `حدث خطأ: ${error.message}. يرجى المحاولة مرة أخرى.`, sender: 'bot-error' };
            setConversation((prevConv) => [...prevConv, errorMessage]);
        } finally {
            setIsLoading(false);
            setMessage('');
            setSelectedFile(null);
        }
    };

    const renderMessageContent = (text, sender) => {
        const lines = text.split('\n');
        return (
            <div className={sender === 'user' ? 'rtl-text user-message-content' : 'rtl-text bot-message-content'}>
                {lines.map((line, index) => {
                    const parts = line.split(/(\d+\.\s+)/);
                    return (
                        <p key={index} style={{ margin: '5px 0' }}>
                            {parts.map((part, partIndex) => {
                                if (part.match(/^\d+\.\s+/)) {
                                    return <span key={partIndex} className="numbered-item">{part}</span>;
                                } else {
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
            {!isOpen && (
                <button className="chat-toggle-button closed" onClick={toggleChat} title="افتح الدردشة">
                    <span role="img" aria-label="chat-icon">💬</span>
                </button>
            )}
            <div className={`chat-widget ${isOpen ? 'open' : 'closed'} ${isDarkMode ? 'dark-mode' : ''}`}>
                <div className="chat-header">
                    <span className="bot-name">
                        GPT PRO
                        <div className="status-indicator online" title="متصل"></div>
                    </span>
                    <div className="header-icons">
                        <button className="icon-button" onClick={toggleDarkMode} title="تبديل الوضع الليلي">
                            {isDarkMode ? '☀️' : '🌙'}
                        </button>
                        <button className="icon-button close-button" onClick={toggleChat} title="إغلاق الدردشة">
                            &times;
                        </button>
                    </div>
                </div>
                <div className="chat-conversation-area">
                    {conversation.map((msg, index) => (
                        <div key={index} className={`message-bubble ${msg.sender}`}>
                            {renderMessageContent(msg.text, msg.sender)}
                            {msg.file && <div className="attachment-info">📄 {msg.file}</div>}
                        </div>
                    ))}
                    {isLoading && (
                        <div className="message-bubble bot loading">
                            جارٍ التفكير...
                        </div>
                    )}
                    <div ref={conversationEndRef} />
                </div>
                <form onSubmit={sendMessage} className="chat-input-area">
                    <label htmlFor="file-upload" className="upload-button" title="إرفاق ملف">
                        📎
                        <input
                            id="file-upload"
                            type="file"
                            onChange={handleFileChange}
                            style={{ display: 'none' }}
                            disabled={isLoading}
                        />
                    </label>
                    <input
                        type="text"
                        value={message}
                        onChange={(e) => setMessage(e.target.value)}
                        placeholder={selectedFile ? selectedFile.name : "اكتب رسالتك هنا..."}
                        disabled={isLoading}
                        readOnly={!!selectedFile}
                    />
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