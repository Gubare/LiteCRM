// resources/js/voice-input.js
export function startVoiceInput(onResult, onError) {
    if (!('webkitSpeechRecognition' in window)) {
        onError('Браузер не поддерживает распознавание речи');
        return;
    }
    
    const recognition = new webkitSpeechRecognition();
    recognition.lang = 'ru-RU';
    recognition.continuous = false;
    recognition.interimResults = true;
    
    recognition.onresult = (event) => {
        const transcript = Array.from(event.results)
            .map(result => result[0].transcript)
            .join('');
        onResult(transcript);
    };
    
    recognition.onerror = (event) => onError(event.error);
    recognition.start();
    
    return () => recognition.stop(); // функция для остановки
}

// Проверка доступности голосового ввода
function checkVoiceSupport() {
    const supports = 'webkitSpeechRecognition' in window || 'SpeechRecognition' in window;
    console.log('Voice recognition supported:', supports);
    
    if (!supports) {
        return {
            supported: false,
            message: 'Ваш WebView не поддерживает распознавание речи. Попробуйте обновить Neutralino или использовать ручной ввод.'
        };
    }
    
    return { supported: true };
}

// Вызов при загрузке страницы
document.addEventListener('DOMContentLoaded', () => {
    const voice = checkVoiceSupport();
    const btn = document.getElementById('voiceBtn');
    
    if (btn) {
        btn.disabled = !voice.supported;
        btn.title = voice.supported ? 'Голосовой ввод' : voice.message;
    }
});