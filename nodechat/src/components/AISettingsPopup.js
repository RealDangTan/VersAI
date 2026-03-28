import React, { useState, useEffect, useCallback } from 'react';

const DEFAULT_OLLAMA_URL = 'https://research.neu.edu.vn/ollama/v1/chat/completions';
const DEFAULT_OLLAMA_MODEL = 'qwen3:8b';
const DEFAULT_OLLAMA_EMBEDDING_MODEL = 'qwen3-embedding';

const AISettingsPopup = ({ isOpen, onClose, onSave }) => {
    const [activeTab, setActiveTab] = useState('ollama'); // 'openai' or 'ollama'
    const [openaiApiKey, setOpenaiApiKey] = useState('');
    const [openaiModel, setOpenaiModel] = useState('gpt-4o');
    const [openaiEmbeddingModel, setOpenaiEmbeddingModel] = useState('text-embedding-3-small');
    const [ollamaUrl, setOllamaUrl] = useState(DEFAULT_OLLAMA_URL);
    const [ollamaModel, setOllamaModel] = useState(DEFAULT_OLLAMA_MODEL);
    const [ollamaEmbeddingModel, setOllamaEmbeddingModel] = useState(DEFAULT_OLLAMA_EMBEDDING_MODEL);
    const [useRag, setUseRag] = useState(true);
    const [showKey, setShowKey] = useState(false);

    // Load saved settings from localStorage
    useEffect(() => {
        if (isOpen) {
            const saved = localStorage.getItem('versai_ai_settings');
            if (saved) {
                try {
                    const settings = JSON.parse(saved);
                    setActiveTab(settings.provider || 'ollama');
                    setOpenaiApiKey(settings.openaiApiKey || '');
                    setOpenaiModel(settings.openaiModel || 'gpt-4o');
                    setOpenaiEmbeddingModel(settings.openaiEmbeddingModel || 'text-embedding-3-small');
                    setOllamaUrl(settings.ollamaUrl || DEFAULT_OLLAMA_URL);
                    setOllamaModel(settings.ollamaModel || DEFAULT_OLLAMA_MODEL);
                    setOllamaEmbeddingModel(settings.ollamaEmbeddingModel || DEFAULT_OLLAMA_EMBEDDING_MODEL);
                    setUseRag(settings.useRag !== false); // Default to true
                } catch (e) {
                    console.error('Failed to parse saved AI settings', e);
                }
            }
        }
    }, [isOpen]);

    const handleSave = useCallback(() => {
        const settings = {
            provider: activeTab,
            openaiApiKey,
            openaiModel,
            openaiEmbeddingModel,
            ollamaUrl,
            ollamaModel,
            ollamaEmbeddingModel,
            useRag,
        };
        localStorage.setItem('versai_ai_settings', JSON.stringify(settings));
        if (onSave) onSave(settings);
        onClose();
    }, [activeTab, openaiApiKey, openaiModel, openaiEmbeddingModel, ollamaUrl, ollamaModel, ollamaEmbeddingModel, useRag, onSave, onClose]);

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 z-[9999] flex items-center justify-center">
            {/* Backdrop */}
            <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={onClose} />

            {/* Popup */}
            <div className="relative bg-white rounded-2xl shadow-2xl w-[520px] max-h-[90vh] flex flex-col animate-popup-in">
                {/* Header - fixed */}
                <div className="bg-gradient-to-r from-purple-600 to-indigo-600 px-6 py-3 flex justify-between items-center rounded-t-2xl shrink-0">
                    <div>
                        <h2 className="text-white font-bold text-base">⚙️ AI Engine Settings</h2>
                        <p className="text-purple-200 text-xs">Chọn provider và cấu hình API</p>
                    </div>
                    <button
                        onClick={onClose}
                        className="text-white/70 hover:text-white transition-colors text-xl font-bold w-8 h-8 flex items-center justify-center rounded-lg hover:bg-white/10"
                    >
                        ✕
                    </button>
                </div>

                {/* Tabs - fixed */}
                <div className="flex border-b border-gray-200 shrink-0">
                    <button
                        className={`flex-1 px-4 py-2.5 text-sm font-medium transition-all ${activeTab === 'ollama'
                            ? 'text-purple-600 border-b-2 border-purple-600 bg-purple-50/50'
                            : 'text-gray-500 hover:text-gray-700 hover:bg-gray-50'
                            }`}
                        onClick={() => setActiveTab('ollama')}
                    >
                        🏠 Local (Ollama)
                    </button>
                    <button
                        className={`flex-1 px-4 py-2.5 text-sm font-medium transition-all ${activeTab === 'openai'
                            ? 'text-purple-600 border-b-2 border-purple-600 bg-purple-50/50'
                            : 'text-gray-500 hover:text-gray-700 hover:bg-gray-50'
                            }`}
                        onClick={() => setActiveTab('openai')}
                    >
                        🤖 OpenAI
                    </button>
                </div>

                {/* Content - scrollable */}
                <div className="p-5 overflow-y-auto flex-1">
                    {activeTab === 'openai' ? (
                        <div className="space-y-3">
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">API Key</label>
                                <div className="relative">
                                    <input
                                        type={showKey ? 'text' : 'password'}
                                        value={openaiApiKey}
                                        onChange={(e) => setOpenaiApiKey(e.target.value)}
                                        className="w-full px-3 py-2 rounded-lg border border-gray-300 text-sm focus:ring-2 focus:ring-purple-500 focus:border-transparent outline-none transition-all pr-16"
                                        placeholder="sk-proj-..."
                                    />
                                    <button
                                        onClick={() => setShowKey(!showKey)}
                                        className="absolute right-2 top-1/2 -translate-y-1/2 text-xs text-gray-500 hover:text-gray-700 px-2 py-1 rounded bg-gray-100 hover:bg-gray-200 transition-colors"
                                    >
                                        {showKey ? 'Hide' : 'Show'}
                                    </button>
                                </div>
                                <p className="text-xs text-gray-400 mt-1">API Key từ OpenAI platform</p>
                            </div>

                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">Model</label>
                                <select
                                    value={openaiModel}
                                    onChange={(e) => setOpenaiModel(e.target.value)}
                                    className="w-full px-3 py-2 rounded-lg border border-gray-300 text-sm focus:ring-2 focus:ring-purple-500 focus:border-transparent outline-none transition-all bg-white"
                                >
                                    <option value="gpt-4o">GPT-4o</option>
                                    <option value="gpt-4o-mini">GPT-4o Mini</option>
                                    <option value="gpt-4-turbo">GPT-4 Turbo</option>
                                    <option value="gpt-3.5-turbo">GPT-3.5 Turbo</option>
                                </select>
                            </div>

                            <div className="bg-blue-50 rounded-lg p-2.5 border border-blue-100">
                                <p className="text-xs text-blue-700">
                                    💡 API key được lưu trong localStorage trình duyệt.
                                </p>
                            </div>
                        </div>
                    ) : (
                        <div className="space-y-3">
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">Ollama API URL</label>
                                <input
                                    type="text"
                                    value={ollamaUrl}
                                    onChange={(e) => setOllamaUrl(e.target.value)}
                                    className="w-full px-3 py-2 rounded-lg border border-gray-300 text-sm focus:ring-2 focus:ring-purple-500 focus:border-transparent outline-none transition-all"
                                    placeholder="https://research.neu.edu.vn/ollama/v1/chat/completions"
                                />
                            </div>

                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">Model</label>
                                <input
                                    type="text"
                                    value={ollamaModel}
                                    onChange={(e) => setOllamaModel(e.target.value)}
                                    className="w-full px-3 py-2 rounded-lg border border-gray-300 text-sm focus:ring-2 focus:ring-purple-500 focus:border-transparent outline-none transition-all"
                                    placeholder="qwen3:8b"
                                />
                            </div>
                        </div>
                    )}
                </div>

                {/* Footer - fixed */}
                <div className="px-5 py-3 bg-gray-50 border-t border-gray-200 flex justify-between items-center rounded-b-2xl shrink-0">
                    <div className="flex items-center gap-2">
                        <div className={`w-2 h-2 rounded-full ${activeTab === 'ollama' ? 'bg-green-500' : 'bg-blue-500'}`} />
                        <span className="text-xs text-gray-500">
                            {activeTab === 'ollama' ? `Ollama (${ollamaModel})` : `OpenAI (${openaiModel})`}
                        </span>
                    </div>
                    <div className="flex gap-2">
                        <button
                            onClick={onClose}
                            className="px-3 py-1.5 text-sm text-gray-600 hover:text-gray-800 rounded-lg hover:bg-gray-200 transition-colors"
                        >
                            Hủy
                        </button>
                        <button
                            onClick={handleSave}
                            className="px-4 py-1.5 text-sm font-medium text-white bg-purple-600 hover:bg-purple-700 rounded-lg shadow-sm transition-colors"
                        >
                            💾 Lưu
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default AISettingsPopup;
