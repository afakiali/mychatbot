// chatbot-frontend/src/App.js

import React from 'react';
import ChatWidget from './components/ChatWidget'; // استيراد مكون ChatWidget الجديد
import './App.css'; // للحفاظ على أي أنماط عامة للجسم إذا كانت موجودة

function App() {
  return (
    <div className="App">
      <ChatWidget />
    </div>
  );
}

export default App;