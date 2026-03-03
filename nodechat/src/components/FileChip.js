import React from 'react';

const FileChip = ({ filename, mimetype, size, onDelete }) => {
    const getIcon = () => {
        if (mimetype.includes('pdf')) return '📄';
        if (mimetype.includes('word')) return '📝';
        return '📁';
    };

    const formatSize = (bytes) => {
        if (bytes === 0) return '0 B';
        const k = 1024;
        const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
        const i = Math.floor(Math.log(bytes) / Math.log(k));
        return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
    };

    return (
        <div className="flex items-center bg-gray-100 rounded-full px-3 py-1 mr-2 mb-2 border border-gray-200 shadow-sm">
            <span className="mr-2 text-lg">{getIcon()}</span>
            <div className="flex flex-col">
                <span className="text-xs font-semibold text-gray-700 truncate max-w-[150px]" title={filename}>
                    {filename}
                </span>
                <span className="text-[10px] text-gray-500">{formatSize(size)}</span>
            </div>
            {onDelete && (
                <button
                    onClick={onDelete}
                    className="ml-2 text-gray-400 hover:text-red-500 focus:outline-none"
                >
                    ✕
                </button>
            )}
        </div>
    );
};

export default FileChip;
