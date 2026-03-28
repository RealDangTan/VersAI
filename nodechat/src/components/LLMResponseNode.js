import React, { memo, useRef, useEffect, useState, useCallback } from 'react';
import { Handle, Position, useReactFlow, NodeResizer } from '@xyflow/react';
import ReactMarkdown from 'react-markdown';
import { Prism as SyntaxHighlighter } from 'react-syntax-highlighter';
import { oneDark } from 'react-syntax-highlighter/dist/esm/styles/prism';
import remarkGfm from 'remark-gfm';

const LLMResponseNode = (props) => {
  const [isEditing, setIsEditing] = useState(false);
  const [text, setText] = useState(props.data.text);
  const { setNodes, deleteElements } = useReactFlow();
  const textareaRef = useRef(null);
  const [nodeWidth, setNodeWidth] = useState(props.data.width || 480);

  useEffect(() => {
    if (props.data.text !== text) {
      setText(props.data.text);
    }
  }, [props.data.text]);

  const onTextChange = useCallback((evt) => {
    setText(evt.target.value);
  }, []);

  const onTextBlur = useCallback(() => {
    setIsEditing(false);
    setNodes((nodes) =>
      nodes.map((node) => {
        if (node.id === props.id) {
          node.data = { ...node.data, text };
        }
        return node;
      })
    );
  }, [props, setNodes, text]);

  const handleDoubleClick = useCallback(() => {
    setIsEditing(true);
    setTimeout(() => {
      if (textareaRef.current) {
        textareaRef.current.focus();
      }
    }, 50);
  }, []);

  const handleDelete = useCallback(() => {
    deleteElements({ nodes: [{ id: props.id }] });
  }, [props.id, deleteElements]);

  const onResize = useCallback((event, params) => {
    setNodeWidth(params.width);
  }, []);

  return (
    <div className="group relative h-full" style={{ minWidth: '20rem', width: nodeWidth }}>
      <NodeResizer
        minWidth={280}
        minHeight={100}
        isVisible={props.selected}
        onResize={onResize}
        lineStyle={{ borderColor: '#a855f7', borderWidth: 1 }}
        handleStyle={{ backgroundColor: '#a855f7', width: 8, height: 8, borderRadius: 2 }}
      />
      <Handle
        type="target"
        position={Position.Top}
        className="!w-4 !h-4 !bg-gray-400 !border-2 !border-white transition-all hover:!bg-purple-500"
        style={{ top: -8 }}
      />

      <div
        className={`bg-white rounded-2xl shadow-sm border transition-all duration-200 overflow-hidden h-full flex flex-col
            ${props.selected ? 'ring-2 ring-purple-500 border-transparent shadow-md' : 'border-gray-200 hover:shadow-md'}
        `}
      >
        {/* Header */}
        <div className="bg-purple-50 px-4 py-3 border-b border-purple-100 flex justify-between items-center shrink-0">
          <div className="flex items-center gap-2">
            <h3 className="font-bold text-purple-800 text-sm">Assistant</h3>
            {props.data.ragUsed && (
              <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-teal-100 text-teal-700 text-xs rounded-full" title={`Used knowledge from: ${props.data.ragFiles?.join(', ')}`}>
                <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                </svg>
                RAG
              </span>
            )}
          </div>
          <div className="flex items-center gap-2">
            <span className="text-[10px] text-purple-400 opacity-0 group-hover:opacity-100 transition-opacity">
              Backspace để xóa
            </span>
            <button
              onClick={handleDelete}
              className="w-6 h-6 flex items-center justify-center rounded-md text-purple-400 hover:text-red-500 hover:bg-red-50 transition-colors"
              title="Xóa node này"
            >
              ✕
            </button>
          </div>
        </div>

        {/* Content */}
        <div className="p-4 flex-grow overflow-auto llm-content-area" onDoubleClick={handleDoubleClick}>
          {isEditing ? (
            <textarea
              ref={textareaRef}
              className="w-full h-full text-gray-700 text-sm leading-normal outline-none resize-none bg-transparent"
              value={text}
              onChange={onTextChange}
              onBlur={onTextBlur}
              placeholder="Generating response..."
            />
          ) : (
            <div className="llm-markdown-output">
              <ReactMarkdown
                className="markdown"
                remarkPlugins={[remarkGfm]}
                components={{
                  code({ node, inline, className, children, ...codeProps }) {
                    const match = /language-(\w+)/.exec(className || '');
                    return !inline && match ? (
                      <div className="rounded-lg overflow-hidden my-3">
                        <div className="bg-gray-800 text-gray-300 text-xs px-3 py-1.5 flex justify-between items-center">
                          <span>{match[1]}</span>
                          <button
                            className="text-gray-400 hover:text-white transition-colors text-xs"
                            onClick={() => {
                              navigator.clipboard.writeText(String(children).replace(/\n$/, ''));
                            }}
                          >
                            Copy
                          </button>
                        </div>
                        <SyntaxHighlighter
                          style={oneDark}
                          language={match[1]}
                          PreTag="div"
                          customStyle={{ margin: 0, borderRadius: '0 0 8px 8px', fontSize: '12px' }}
                          {...codeProps}
                        >
                          {String(children).replace(/\n$/, '')}
                        </SyntaxHighlighter>
                      </div>
                    ) : (
                      <code className={`${className || ''} bg-purple-50 text-purple-700 rounded px-1.5 py-0.5 text-xs font-mono`} {...codeProps}>
                        {children}
                      </code>
                    );
                  },
                  p({ children }) {
                    return <p className="mb-3 leading-relaxed text-sm text-gray-700">{children}</p>;
                  },
                  h1({ children }) {
                    return <h1 className="text-xl font-bold mb-3 mt-4 text-gray-900">{children}</h1>;
                  },
                  h2({ children }) {
                    return <h2 className="text-lg font-bold mb-2 mt-3 text-gray-900">{children}</h2>;
                  },
                  h3({ children }) {
                    return <h3 className="text-base font-semibold mb-2 mt-3 text-gray-800">{children}</h3>;
                  },
                  ul({ children }) {
                    return <ul className="list-disc pl-5 mb-3 space-y-1 text-sm text-gray-700">{children}</ul>;
                  },
                  ol({ children }) {
                    return <ol className="list-decimal pl-5 mb-3 space-y-1 text-sm text-gray-700">{children}</ol>;
                  },
                  li({ children }) {
                    return <li className="leading-relaxed">{children}</li>;
                  },
                  blockquote({ children }) {
                    return (
                      <blockquote className="border-l-4 border-purple-300 pl-4 my-3 text-gray-600 italic">
                        {children}
                      </blockquote>
                    );
                  },
                  table({ children }) {
                    return (
                      <div className="overflow-x-auto my-3">
                        <table className="min-w-full border border-gray-200 rounded-lg text-sm">
                          {children}
                        </table>
                      </div>
                    );
                  },
                  th({ children }) {
                    return <th className="bg-gray-50 px-3 py-2 text-left font-semibold border-b border-gray-200">{children}</th>;
                  },
                  td({ children }) {
                    return <td className="px-3 py-2 border-b border-gray-100">{children}</td>;
                  },
                  a({ href, children }) {
                    return <a href={href} target="_blank" rel="noopener noreferrer" className="text-purple-600 hover:text-purple-800 underline">{children}</a>;
                  },
                  hr() {
                    return <hr className="my-4 border-gray-200" />;
                  },
                  strong({ children }) {
                    return <strong className="font-semibold text-gray-900">{children}</strong>;
                  },
                  em({ children }) {
                    return <em className="italic text-gray-600">{children}</em>;
                  },
                }}
              >
                {text || ''}
              </ReactMarkdown>
              {!text && (
                <span className="text-gray-400 italic text-sm">Double click to edit...</span>
              )}
            </div>
          )}
        </div>
      </div>

      <Handle
        type="source"
        position={Position.Bottom}
        className="!w-4 !h-4 !bg-gray-400 !border-2 !border-white transition-all hover:!bg-purple-500"
        style={{ bottom: -8 }}
      />
    </div>
  );
};

export default memo(LLMResponseNode);
