import React, { useState, useEffect, useRef } from 'react';
import { Send, Mic, MicOff } from 'lucide-react';

interface InputAreaProps {
  onSendMessage: (text: string) => void;
  disabled: boolean;
  onVoiceStatusChange: (isRecording: boolean) => void;
}

export const InputArea: React.FC<InputAreaProps> = ({
  onSendMessage,
  disabled,
  onVoiceStatusChange,
}) => {
  const [input, setInput] = useState('');
  const [isRecording, setIsRecording] = useState(false);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const recognitionRef = useRef<any>(null);

  useEffect(() => {
    const SpeechRecognition =
      (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;

    if (SpeechRecognition) {
      const recognition = new SpeechRecognition();
      recognition.continuous = false;
      recognition.interimResults = true;
      recognition.lang = 'en-US';

      recognition.onresult = (event: any) => {
        const transcript = Array.from(event.results)
          .map((r: any) => r[0].transcript)
          .join('');
        setInput(transcript);
        adjustHeight();
      };

      recognition.onend = () => {
        setIsRecording(false);
        onVoiceStatusChange(false);
      };

      recognition.onerror = () => {
        setIsRecording(false);
        onVoiceStatusChange(false);
      };

      recognitionRef.current = recognition;
    }
  }, [onVoiceStatusChange]);

  const adjustHeight = () => {
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto';
      textareaRef.current.style.height = Math.min(textareaRef.current.scrollHeight, 160) + 'px';
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const handleSend = () => {
    const trimmed = input.trim();
    if (!trimmed || disabled) return;
    onSendMessage(trimmed);
    setInput('');
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto';
    }
  };

  const toggleVoice = () => {
    if (!recognitionRef.current) {
      alert('Speech recognition is not supported in this browser.');
      return;
    }

    if (isRecording) {
      recognitionRef.current.stop();
      setIsRecording(false);
      onVoiceStatusChange(false);
    } else {
      setInput('');
      recognitionRef.current.start();
      setIsRecording(true);
      onVoiceStatusChange(true);
    }
  };

  return (
    <div className="input-area">
      <div className="input-container">
        <textarea
          ref={textareaRef}
          className="chat-textarea"
          placeholder="Type your answer… or tap the microphone to speak"
          rows={1}
          value={input}
          onChange={(e) => {
            setInput(e.target.value);
            adjustHeight();
          }}
          onKeyDown={handleKeyDown}
          disabled={disabled}
        />
        <div className="input-bottom-bar">
          <span className="input-hint">
            {isRecording ? '🔴 Listening… speak your answer' : 'Enter to send · Shift+Enter for new line'}
          </span>
          <div className="input-actions">
            <button
              type="button"
              className={'voice-btn ' + (isRecording ? 'recording' : '')}
              onClick={toggleVoice}
              title={isRecording ? 'Stop listening' : 'Start voice input'}
              disabled={disabled}
            >
              {isRecording ? <MicOff size={18} /> : <Mic size={18} />}
            </button>
            <button
              type="button"
              className="send-btn"
              onClick={handleSend}
              disabled={disabled || !input.trim()}
              title="Send response"
            >
              <Send size={18} />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
