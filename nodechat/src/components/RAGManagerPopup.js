import React, { useState, useEffect, useRef } from 'react';
import { API_BASE_URL } from '../config';

const RAGManagerPopup = ({ isOpen, onClose }) => {
    const [files, setFiles] = useState([]);
    const [isUploading, setIsUploading] = useState(false);
    const [isLoading, setIsLoading] = useState(false);
    const fileInputRef = useRef(null);

    const fetchFiles = async () => {
        setIsLoading(true);
        try {
            const res = await fetch(`${API_BASE_URL}/rag/files`);
            if (res.ok) {
                const data = await res.json();
                setFiles(data.files || []);
            }
        } catch (error) {
            console.error('Failed to fetch RAG files', error);
        } finally {
            setIsLoading(false);
        }
    };

    useEffect(() => {
        if (isOpen) {
            fetchFiles();
        }
    }, [isOpen]);

    const handleUploadClick = () => {
        fileInputRef.current?.click();
    };

    const handleFileChange = async (e) => {
        const file = e.target.files?.[0];
        if (!file) return;

        // Reset input so the same file can be uploaded again if needed
        e.target.value = null;

        const formData = new FormData();
        formData.append('file', file);

        // Include current AI settings to determine embedding model
        const savedSettings = localStorage.getItem('versai_ai_settings');
        if (savedSettings) {
            formData.append('aiSettings', savedSettings);
        }

        setIsUploading(true);
        try {
            const res = await fetch(`${API_BASE_URL}/rag/upload`, {
                method: 'POST',
                body: formData,
            });

            if (!res.ok) {
                const err = await res.json();
                throw new Error(err.error || 'Upload failed');
            }

            await fetchFiles(); // Refresh list
        } catch (error) {
            console.error('Upload error:', error);
            alert('Lỗi upload file: ' + error.message);
        } finally {
            setIsUploading(false);
        }
    };

    const handleDelete = async (filename) => {
        if (!window.confirm(`Xóa file ${filename} khỏi Dữ liệu RAG?`)) return;

        try {
            const res = await fetch(`${API_BASE_URL}/rag/files/${encodeURIComponent(filename)}`, {
                method: 'DELETE',
            });
            if (res.ok) {
                await fetchFiles();
            } else {
                const err = await res.json();
                throw new Error(err.error || 'Delete failed');
            }
        } catch (error) {
            console.error('Delete error:', error);
            alert('Lỗi khi xóa file: ' + error.message);
        }
    };

    const handleClearAll = async () => {
        if (!window.confirm('CẢNH BÁO: Xóa toàn bộ dữ liệu RAG? Thao tác này không thể hoàn tác.')) return;

        try {
            const res = await fetch(`${API_BASE_URL}/rag/clear`, {
                method: 'DELETE',
            });
            if (res.ok) {
                setFiles([]);
            } else {
                throw new Error('Clear failed');
            }
        } catch (error) {
            console.error('Clear error:', error);
            alert('Lỗi khi xóa toàn bộ: ' + error.message);
        }
    };

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 z-[9999] flex items-center justify-center">
            {/* Backdrop */}
            <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={onClose} />

            {/* Popup */}
            <div className="relative bg-white rounded-2xl shadow-2xl w-[600px] max-h-[85vh] flex flex-col animate-popup-in">
                {/* Header */}
                <div className="bg-gradient-to-r from-teal-600 to-emerald-600 px-6 py-4 flex justify-between items-center rounded-t-2xl shrink-0">
                    <div>
                        <h2 className="text-white font-bold text-lg flex items-center gap-2">
                            📚 RAG Knowledge Manager
                        </h2>
                        <p className="text-teal-100 text-xs mt-1">Quản lý tài liệu context cho AI (Vector DB)</p>
                    </div>
                    <button
                        onClick={onClose}
                        className="text-white/70 hover:text-white transition-colors text-xl font-bold w-8 h-8 flex items-center justify-center rounded-lg hover:bg-white/10"
                    >
                        ✕
                    </button>
                </div>

                {/* Content */}
                <div className="p-5 overflow-y-auto flex-1 bg-gray-50">
                    <div className="flex justify-between items-center mb-4">
                        <h3 className="text-sm font-semibold text-gray-700">Tài liệu đã Index ({files.length})</h3>
                        <div className="flex gap-2">
                            {files.length > 0 && (
                                <button
                                    onClick={handleClearAll}
                                    className="px-3 py-1.5 text-xs font-medium text-red-600 bg-red-50 hover:bg-red-100 border border-red-200 rounded-lg transition-colors"
                                >
                                    🗑️ Clear All
                                </button>
                            )}
                            <button
                                onClick={handleUploadClick}
                                disabled={isUploading}
                                className="px-4 py-1.5 text-sm font-medium text-white bg-teal-600 hover:bg-teal-700 rounded-lg shadow-sm transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
                            >
                                {isUploading ? 'Đang nhúng...' : '➕ Upload File'}
                            </button>
                            <input
                                type="file"
                                ref={fileInputRef}
                                onChange={handleFileChange}
                                className="hidden"
                                accept=".txt,.pdf,.docx"
                            />
                        </div>
                    </div>

                    {isLoading ? (
                        <div className="text-center py-8 text-gray-500 text-sm">Đang tải danh sách...</div>
                    ) : files.length === 0 ? (
                        <div className="text-center py-12 bg-white rounded-xl border border-dashed border-gray-300">
                            <div className="text-4xl mb-3">📄</div>
                            <p className="text-gray-500 text-sm">Chưa có tài liệu nào trong Vector DB.</p>
                            <p className="text-gray-400 text-xs mt-1">Upload file để AI có thêm nguồn kiến thức.</p>
                        </div>
                    ) : (
                        <div className="space-y-2">
                            {files.map((file, idx) => (
                                <div key={idx} className="flex justify-between items-center bg-white p-3 rounded-xl border border-gray-200 shadow-sm hover:shadow transition-shadow">
                                    <div className="flex items-center gap-3 overflow-hidden">
                                        <div className="text-teal-500 text-xl shrink-0">📄</div>
                                        <div className="truncate">
                                            <p className="text-sm font-medium text-gray-800 truncate" title={file}>{file}</p>
                                        </div>
                                    </div>
                                    <button
                                        onClick={() => handleDelete(file)}
                                        className="text-gray-400 hover:text-red-500 p-1.5 rounded-md hover:bg-red-50 transition-colors shrink-0 m-1"
                                        title="Xóa tài liệu"
                                    >
                                        🗑️
                                    </button>
                                </div>
                            ))}
                        </div>
                    )}
                </div>

                {/* Footer */}
                <div className="px-5 py-4 bg-white border-t border-gray-200 flex justify-between items-center rounded-b-2xl shrink-0">
                    <p className="text-xs text-gray-500 flex items-center gap-1">
                        💡 Tài liệu sẽ được chia nhỏ (`chunks`) và nhúng (embedding) vào hệ thống.
                    </p>
                    <button
                        onClick={onClose}
                        className="px-5 py-2 text-sm font-medium text-gray-700 bg-gray-100 hover:bg-gray-200 rounded-lg transition-colors"
                    >
                        Đóng
                    </button>
                </div>
            </div>
        </div>
    );
};

export default RAGManagerPopup;
