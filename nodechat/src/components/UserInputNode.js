import React, { memo, useState, useCallback, useRef, useEffect } from 'react';
import { Handle, Position, useReactFlow, getOutgoers } from '@xyflow/react';
import { getConversationHistory, sendConversationRequest, findAllDescendants } from './Utility';
import FileChip from './FileChip';
import { API_BASE_URL } from '../config';
// const API_BASE_URL = "https://api.mangmaytinh.qzz.io";

const UserInputNode = (props) => {
  const [isEditing, setIsEditing] = useState(false);
  const [text, setText] = useState(props.data.text);
  const [files, setFiles] = useState(props.data.files || []);
  const reactFlow = useReactFlow();
  const textareaRef = useRef(null);
  const fileInputRef = useRef(null);

  useEffect(() => {
    if (props.data.text !== text) {
      setText(props.data.text);
    }
    // Sync files from props if they change externally (though unlikely for local state)
    if (JSON.stringify(props.data.files) !== JSON.stringify(files)) {
      setFiles(props.data.files || []);
    }
  }, [props.data.text, props.data.files]);

  const updateNodeData = useCallback((newText, newFiles) => {
    reactFlow.setNodes((nodes) =>
      nodes.map((node) => {
        if (node.id === props.id) {
          return { ...node, data: { ...node.data, text: newText, files: newFiles } };
        }
        return node;
      })
    );
  }, [props.id, reactFlow]);

  const onChunkReceived = useCallback((content, nodeId) => {
    reactFlow.setNodes((nds) =>
      nds.map((n) => {
        if (n.id === nodeId) {
          // Functional update to avoid stale closure issues if streaming is fast
          const currentText = n.data.text || '';
          return {
            ...n,
            data: { ...n.data, text: currentText + content }
          };
        }
        return n;
      })
    );
  }, [reactFlow]);

  const onRagMetadata = useCallback((ragData, nodeId) => {
    console.log('[RAG] Used:', ragData.used, 'Files:', ragData.files);
    reactFlow.setNodes((nds) =>
      nds.map((n) => {
        if (n.id === nodeId) {
          return {
            ...n,
            data: {
              ...n.data,
              ragUsed: ragData.used,
              ragFiles: ragData.files || []
            }
          };
        }
        return n;
      })
    );
  }, [reactFlow]);

  const regenerateNode = useCallback(async (node) => {
    const nodes = reactFlow.getNodes();
    const edges = reactFlow.getEdges();
    // Ensure the current node data is up to date in the nodes array before generating history
    // (React Flow nodes state might not be immediately updated if we just called setNodes)
    // However, getConversationHistory reads from 'nodes' passed to it.
    // We should make sure 'nodes' contains our latest text/files.
    // Since we update via setNodes onBlur/TextChange, it should be fine mostly.

    // Better: Helper to get fresh nodes
    const freshNodes = reactFlow.getNodes();
    const history = getConversationHistory(node, freshNodes, edges);
    const fileContexts = history.flatMap(h => h.files || []);

    try {
      await sendConversationRequest('generate', history, fileContexts, (content) => onChunkReceived(content, node.id), null, (ragData) => onRagMetadata(ragData, node.id));
    } catch (error) {
      console.error('Failed to generate response:', error);
    }
  }, [reactFlow, onChunkReceived, onRagMetadata]);

  const onRegenerate = useCallback(async () => {
    const nodes = reactFlow.getNodes();
    const edges = reactFlow.getEdges();
    const userNode = reactFlow.getNode(props.id);
    const outgoers = getOutgoers(userNode, nodes, edges);

    // If no LLM response node, create one
    if (outgoers.length === 0) {
      const llmNode = {
        id: `llmResponse-${Date.now()}`,
        type: 'llmResponse',
        data: { text: '' },
        position: { x: userNode.position.x, y: userNode.position.y + 200 }, // Moved down a bit to accommodate larger node
      };

      reactFlow.addNodes(llmNode);
      const edgeId = `e${userNode.id}-${llmNode.id}`;
      reactFlow.addEdges({
        id: edgeId,
        source: userNode.id,
        target: llmNode.id,
        data: { onEdgeClick: () => reactFlow.deleteElements({ edges: [{ id: edgeId }] }) },
        type: 'custom',
      });

      // Wait for React to update the state
      await new Promise(resolve => setTimeout(resolve, 50));
      await regenerateNode(llmNode);
      return;
    }

    // Regenerate all descendants
    const descendants = findAllDescendants(userNode.id, nodes, edges);
    for (const descendantId of descendants) {
      const descendantNode = nodes.find(n => n.id === descendantId);
      if (descendantNode && descendantNode.type === 'llmResponse') {
        // Clear text
        reactFlow.setNodes(nds => nds.map(n => n.id === descendantId ? { ...n, data: { ...n.data, text: '' } } : n));

        // Small delay to ensure clear propagates? 
        // Actually regenerateNode fetches nodes again, so we need to wait or pass updated node.
        await new Promise(r => setTimeout(r, 10));
        // Fetch fresh reference
        const freshNode = reactFlow.getNode(descendantId);
        await regenerateNode(freshNode);
      }
    }
  }, [props.id, reactFlow, regenerateNode]);

  const onTextChange = useCallback((evt) => {
    setText(evt.target.value);
    // Live update node data so other nodes see it immediately?
    // Maybe debatably expensive, but safer for RAG context.
    updateNodeData(evt.target.value, files);
  }, [files, updateNodeData]);

  const onFileChange = async (e) => {
    const selectedFiles = Array.from(e.target.files);
    if (selectedFiles.length === 0) return;

    const newFiles = [...files];

    for (const file of selectedFiles) {
      const formData = new FormData();
      formData.append('file', file);

      try {
        const res = await fetch(`${API_BASE_URL}/upload`, {
          method: 'POST',
          body: formData
        });
        const data = await res.json();
        newFiles.push(data);
      } catch (error) {
        console.error("Upload failed", error);
      }
    }

    setFiles(newFiles);
    updateNodeData(text, newFiles);
  };

  const removeFile = (index) => {
    const newFiles = files.filter((_, i) => i !== index);
    setFiles(newFiles);
    updateNodeData(text, newFiles);
  };

  const handleDoubleClick = useCallback(() => {
    setIsEditing(true);
    setTimeout(() => {
      if (textareaRef.current) {
        textareaRef.current.focus();
      }
    }, 100);
  }, []);

  const onBlur = () => {
    setIsEditing(false);
  }

  return (
    <div className="group relative w-[24rem]">
      <Handle
        type="target"
        position={Position.Top}
        className="!w-4 !h-4 !bg-gray-400 !border-2 !border-white transition-all hover:!bg-blue-500"
        style={{ top: -8 }}
      />

      <div
        className={`bg-white rounded-2xl shadow-sm border transition-all duration-200 overflow-hidden
            ${props.selected ? 'ring-2 ring-blue-500 border-transparent shadow-md' : 'border-gray-200 hover:shadow-md'}
        `}
      >
        {/* Header */}
        <div className="bg-gray-50 px-4 py-3 border-b border-gray-100 flex justify-between items-center">
          <h3 className="font-bold text-gray-800 text-sm">User Input</h3>
        </div>

        {/* Content */}
        <div className="p-4" onDoubleClick={handleDoubleClick}>
          {/* Files Area */}
          {files.length > 0 && (
            <div className="flex flex-wrap mb-3">
              {files.map((file, i) => (
                <FileChip
                  key={i}
                  filename={file.filename}
                  mimetype={file.mimetype}
                  size={file.size}
                  onDelete={isEditing ? () => removeFile(i) : undefined}
                />
              ))}
            </div>
          )}

          {/* Text Area */}
          {isEditing ? (
            <textarea
              ref={textareaRef}
              className="w-full text-gray-700 text-sm leading-relaxed outline-none resize-none bg-transparent"
              value={text}
              onChange={onTextChange}
              onBlur={onBlur}
              placeholder="Type your message..."
              rows={Math.max(3, text.split('\n').length)}
            />
          ) : (
            <div className="text-gray-700 text-sm leading-relaxed whitespace-pre-wrap min-h-[3rem]">
              {text || <span className="text-gray-400 italic">Double click to edit...</span>}
            </div>
          )}

          {/* Action bar (visible on edit or hover) */}
          <div className={`mt-3 flex justify-between items-center pt-2 border-t border-gray-50 opacity-0 group-hover:opacity-100 transition-opacity ${isEditing ? 'opacity-100' : ''}`}>
            <div className="flex gap-2">
              <label className="cursor-pointer p-1.5 rounded-md hover:bg-gray-100 text-gray-500 transition-colors" title="Upload File">
                <input
                  type="file"
                  multiple
                  className="hidden"
                  ref={fileInputRef}
                  onChange={onFileChange}
                  accept=".txt"
                />
                📎
              </label>
            </div>
            <button
              onClick={onRegenerate}
              className="p-1.5 rounded-md bg-blue-50 text-blue-600 hover:bg-blue-100 transition-colors"
              title="Generate Response"
            >
              ✨
            </button>
          </div>
        </div>
      </div>

      <Handle
        type="source"
        position={Position.Bottom}
        className="!w-4 !h-4 !bg-gray-400 !border-2 !border-white transition-all hover:!bg-blue-500"
        style={{ bottom: -8 }}
      />
    </div>
  );
};

export default memo(UserInputNode);


