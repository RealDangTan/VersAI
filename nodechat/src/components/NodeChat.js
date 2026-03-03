import React, { useCallback, useRef, useState } from 'react';
import {
  ReactFlow,
  MiniMap,
  Controls,
  Background,
  useNodesState,
  useEdgesState,
  useReactFlow,
  useStoreApi,
  SelectionMode,
} from '@xyflow/react';
import '@xyflow/react/dist/style.css';
import { Menu, Item, useContextMenu } from 'react-contexify';
import 'react-contexify/dist/ReactContexify.css';
import UserInputNode from './UserInputNode';
import LLMResponseNode from './LLMResponseNode';
import CustomEdge from './CustomEdge';
import AISettingsPopup from './AISettingsPopup';
import { sendConversationRequest, getConversationHistory } from './Utility';

const nodeTypes = {
  userInput: UserInputNode,
  llmResponse: LLMResponseNode,
};

const edgeTypes = {
  custom: CustomEdge,
};

const MENU_ID = 'node-context-menu';
let currentOverlapOffset = 0;
const OVERLAP_OFFSET = 10;

function getAISettings() {
  try {
    const saved = localStorage.getItem('versai_ai_settings');
    if (saved) return JSON.parse(saved);
  } catch (e) { }
  return {
    provider: 'ollama',
    openaiApiKey: '',
    openaiModel: 'gpt-4o',
    ollamaUrl: 'https://research.neu.edu.vn/ollama/v1/chat/completions',
    ollamaModel: 'qwen3:8b',
  };
}

function NodeChat() {
  const [nodes, setNodes, onNodesChange] = useNodesState([]);
  const [edges, setEdges, onEdgesChange] = useEdgesState([]);
  const reactFlowWrapper = useRef(null);
  const [message, setMessage] = useState('');
  const store = useStoreApi();
  const reactFlow = useReactFlow();
  const { show } = useContextMenu({
    id: MENU_ID,
  });
  const currentLlmNodeId = useRef(null);
  const [isAISettingsOpen, setIsAISettingsOpen] = useState(false);
  const [aiSettings, setAISettings] = useState(getAISettings);
  const [workspaces, setWorkspaces] = useState([{ id: 'default', name: 'Workspace 1', nodes: [], edges: [] }]);
  const [activeWorkspaceId, setActiveWorkspaceId] = useState('default');
  const [selectMode, setSelectMode] = useState(false);
  const [selectedForExport, setSelectedForExport] = useState(new Set());

  const onEdgeClick = useCallback((edgeId) => {
    setEdges((eds) => eds.filter((e) => e.id !== edgeId));
  }, [setEdges]);

  const onConnect = useCallback(
    (params) => setEdges((eds) => eds.concat({
      ...params,
      id: `e${params.source}-${params.target}-${Date.now()}`,
      data: { onEdgeClick },
      type: 'custom'
    })),
    [onEdgeClick, setEdges]
  );

  const addNode = useCallback((type, sourceNode = null, offset = { x: 0, y: 0 }, text = null, connectToSource = false) => {
    return new Promise((resolve) => {
      const {
        height,
        width,
        transform: [transformX, transformY, zoomLevel]
      } = store.getState();
      const zoomMultiplier = 1 / zoomLevel;
      const centerX = -transformX * zoomMultiplier + (width * zoomMultiplier) / 2;
      const centerY =
        -transformY * zoomMultiplier + (height * zoomMultiplier) / 2;

      let position;
      if (sourceNode) {
        position = {
          x: sourceNode.position.x + offset.x,
          y: sourceNode.position.y + offset.y,
        };
      } else {
        position = {
          x: centerX + currentOverlapOffset,
          y: centerY + currentOverlapOffset
        };
        currentOverlapOffset += OVERLAP_OFFSET;
      }

      position.x = Number(position.x) || 0;
      position.y = Number(position.y) || 0;

      const newNode = {
        id: `${type}-${Date.now()}`,
        type,
        data: { text: text || (type === 'userInput' ? 'New user input' : 'New LLM response') },
        position: position,
      };

      setNodes((nds) => {
        const updatedNodes = nds.concat(newNode);
        resolve(newNode);
        return updatedNodes;
      });

      if (sourceNode && connectToSource) {
        setEdges((eds) =>
          eds.concat({
            id: `e${sourceNode.id}-${newNode.id}`,
            source: sourceNode.id,
            target: newNode.id,
            data: { onEdgeClick },
            type: 'custom',
          })
        );
      }
    });
  }, [setNodes, setEdges, onEdgeClick, store]);

  const onNodeContextMenu = useCallback(
    (event, node) => {
      event.preventDefault();
      const pane = reactFlowWrapper.current.getBoundingClientRect();
      show({
        event,
        props: {
          node,
          position: reactFlow.screenToFlowPosition({
            x: event.clientX - pane.left,
            y: event.clientY - pane.top,
          }),
        },
      });
    },
    [show, reactFlow]
  );

  const handleCopyText = useCallback(({ props }) => {
    const { node } = props;
    const textToCopy = node.data?.text || '';
    navigator.clipboard.writeText(textToCopy).then(() => {
      // Brief visual feedback
      const el = document.querySelector(`[data-id="${node.id}"]`);
      if (el) {
        el.style.outline = '2px solid #22c55e';
        setTimeout(() => { el.style.outline = ''; }, 600);
      }
    }).catch(err => console.error('Copy failed:', err));
  }, []);

  const toggleSelectForExport = useCallback((nodeId) => {
    setSelectedForExport(prev => {
      const next = new Set(prev);
      if (next.has(nodeId)) next.delete(nodeId);
      else next.add(nodeId);
      return next;
    });
  }, []);

  const handleExportWord = useCallback(() => {
    const exportNodes = nodes.filter(n => selectedForExport.has(n.id));
    if (exportNodes.length === 0) {
      alert('Chưa chọn block nào để export. Hãy click vào các block bạn muốn export.');
      return;
    }
    // Sort by Y position (top to bottom)
    const sorted = [...exportNodes].sort((a, b) => a.position.y - b.position.y);

    let htmlContent = `
      <html xmlns:o='urn:schemas-microsoft-com:office:office' xmlns:w='urn:schemas-microsoft-com:office:word' xmlns='http://www.w3.org/TR/REC-html40'>
      <head><meta charset='utf-8'><title>VersAI Export</title>
      <style>
        body { font-family: Arial, sans-serif; padding: 20px; }
        .block { margin-bottom: 20px; padding: 12px 16px; border-radius: 8px; border: 1px solid #ddd; }
        .user-block { background-color: #f0f7ff; border-left: 4px solid #3b82f6; }
        .assistant-block { background-color: #faf5ff; border-left: 4px solid #a855f7; }
        .role { font-weight: bold; margin-bottom: 6px; font-size: 13px; }
        .content { white-space: pre-wrap; font-size: 14px; line-height: 1.6; }
        pre { background: #f3f4f6; padding: 10px; border-radius: 6px; overflow-x: auto; }
        code { font-family: Consolas, monospace; font-size: 13px; }
      </style></head><body>
      <h1 style="color: #6b21a8;">VersAI Export</h1>
      <p style="color: #888; font-size: 12px;">Exported on ${new Date().toLocaleString()}</p>
      <hr/>
    `;

    sorted.forEach(node => {
      const role = node.type === 'userInput' ? 'User' : 'Assistant';
      const blockClass = node.type === 'userInput' ? 'user-block' : 'assistant-block';
      const roleColor = node.type === 'userInput' ? '#3b82f6' : '#a855f7';
      const text = node.data.text || '';

      htmlContent += `<div class="block ${blockClass}">
        <div class="role" style="color: ${roleColor};">${role}</div>
        <div class="content">${text.replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/\n/g, '<br/>')}</div>
      </div>`;
    });

    htmlContent += '</body></html>';

    const blob = new Blob(['\ufeff', htmlContent], { type: 'application/msword' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `versai_export_${Date.now()}.doc`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);

    // Exit select mode after export
    setSelectMode(false);
    setSelectedForExport(new Set());
  }, [nodes, selectedForExport]);

  const handleNodeClick = useCallback((event, node) => {
    if (selectMode) {
      event.stopPropagation();
      toggleSelectForExport(node.id);
    }
  }, [selectMode, toggleSelectForExport]);

  const handleReplicate = useCallback(async ({ props }) => {
    const { node } = props;
    const newNode = await addNode(node.type, node, { x: 200 + (Math.random() - 0.5) * 100, y: (Math.random() - 0.5) * 10 }, node.data.text, false);

    edges.forEach((edge) => {
      if (edge.target === node.id) {
        setEdges((eds) =>
          eds.concat({
            id: `e${edge.source}-${newNode.id}`,
            source: edge.source,
            target: newNode.id,
            data: { onEdgeClick },
            type: 'custom',
          })
        );
      }
    });
  }, [addNode, edges, onEdgeClick, setEdges]);

  const handleCreateConnectedNode = useCallback(({ props }) => {
    const { node } = props;
    const newType = node.type === 'userInput' ? 'llmResponse' : 'userInput';
    const nodeElement = document.querySelector(`[data-id="${node.id}"]`);
    const nodeHeight = nodeElement ? nodeElement.offsetHeight : 0;
    addNode(newType, node, { x: (Math.random() - 0.5) * 100, y: 30 + nodeHeight }, null, true);
  }, [addNode]);

  const setSelectNode = useCallback((node) => {
    setNodes((nds) =>
      nds.map((n) => {
        n.selected = n.id === node.id;
        return n;
      })
    );
  }, [setNodes]);

  const getSelectedNode = useCallback(() => {
    return nodes.find(node => node.selected);
  }, [nodes]);

  const onChunkReceived = useCallback((content) => {
    setNodes((nds) =>
      nds.map((n) => {
        if (n.id === currentLlmNodeId.current) {
          return {
            ...n,
            data: {
              ...n.data,
              text: n.data.text + content
            }
          };
        }
        return n;
      })
    );
  }, [setNodes]);

  const handleSendMessage = useCallback(async () => {
    if (message.trim() === '') return;

    const currentSettings = getAISettings();

    let selectedNode = getSelectedNode();
    let sourceNode = selectedNode && selectedNode.type === 'llmResponse' ? selectedNode : null;

    let sourceNodeElement = null;
    if (!sourceNode) {
      const latestLLMResponseNode = nodes.filter(node => node.type === 'llmResponse').slice(-1)[0];
      sourceNode = latestLLMResponseNode || null;
    }
    if (sourceNode) {
      sourceNodeElement = document.querySelector(`[data-id="${sourceNode.id}"]`);
    }
    let sourceNodeHeight = sourceNodeElement ? sourceNodeElement.offsetHeight : 0;

    const userNode = await addNode('userInput', sourceNode, { x: (Math.random() - 0.5) * 50, y: sourceNodeHeight + 20 }, message, !!sourceNode);
    await new Promise(resolve => setTimeout(resolve, 0));
    const userNodeElement = document.querySelector(`[data-id="${userNode.id}"]`);
    const userNodeHeight = userNodeElement ? userNodeElement.offsetHeight : 0;

    const llmNode = await addNode('llmResponse', userNode, { x: 0, y: userNodeHeight + 20 }, '', true);
    currentLlmNodeId.current = llmNode.id;
    llmNode.data.text = '';
    setMessage('');
    setSelectNode(llmNode);
    await new Promise(resolve => setTimeout(resolve, 0));
    const updatedNodes = reactFlow.getNodes();
    let updatedEdges = reactFlow.getEdges();

    if (sourceNode) {
      const newEdgeId = `e${sourceNode.id}-${userNode.id}`;
      const edgeExists = updatedEdges.some(e => e.id === newEdgeId);
      if (!edgeExists) {
        updatedEdges = updatedEdges.concat({
          id: newEdgeId,
          source: sourceNode.id,
          target: userNode.id,
          type: 'custom'
        });
      }
    }

    let history = getConversationHistory(userNode, updatedNodes, updatedEdges);
    const fileContexts = history.flatMap(h => h.files || []);

    try {
      await sendConversationRequest('generate', history, fileContexts, onChunkReceived, currentSettings);
    } catch (error) {
      console.error('Failed to generate response:', error);
    }
  }, [message, getSelectedNode, addNode, setSelectNode, reactFlow, nodes, onChunkReceived]);

  // Save current workspace and switch to new/existing one
  const saveCurrentWorkspace = useCallback(() => {
    setWorkspaces((wss) =>
      wss.map((ws) =>
        ws.id === activeWorkspaceId
          ? { ...ws, nodes: reactFlow.getNodes(), edges: reactFlow.getEdges() }
          : ws
      )
    );
  }, [activeWorkspaceId, reactFlow]);

  const handleNewWorkspace = useCallback(() => {
    saveCurrentWorkspace();
    const newId = `ws-${Date.now()}`;
    const newWs = { id: newId, name: `Workspace ${workspaces.length + 1}`, nodes: [], edges: [] };
    setWorkspaces((wss) => [...wss, newWs]);
    setActiveWorkspaceId(newId);
    setNodes([]);
    setEdges([]);
    setMessage('');
  }, [saveCurrentWorkspace, workspaces.length, setNodes, setEdges]);

  const handleSwitchWorkspace = useCallback((wsId) => {
    if (wsId === activeWorkspaceId) return;
    saveCurrentWorkspace();
    const target = workspaces.find((ws) => ws.id === wsId);
    if (target) {
      setActiveWorkspaceId(wsId);
      setNodes(target.nodes || []);
      setEdges(target.edges || []);
      setMessage('');
    }
  }, [activeWorkspaceId, saveCurrentWorkspace, workspaces, setNodes, setEdges]);

  const handleNewProject = useCallback(() => {
    if (window.confirm("Are you sure you want to clear this workspace? All current changes will be lost.")) {
      setNodes([]);
      setEdges([]);
      setMessage('');
    }
  }, [setNodes, setEdges]);



  const handleAISettingsSave = useCallback((settings) => {
    setAISettings(settings);
  }, []);

  return (
    <div className="h-full relative" ref={reactFlowWrapper}>
      <ReactFlow
        nodes={nodes.map(n => ({
          ...n,
          style: {
            ...n.style,
            ...(selectMode && selectedForExport.has(n.id) ? { outline: '3px solid #22c55e', outlineOffset: '2px', borderRadius: '16px' } : {}),
            ...(selectMode ? { cursor: 'pointer' } : {}),
          },
        }))}
        edges={edges}
        onMove={() => {
          currentOverlapOffset = 0;
        }}
        onNodesChange={onNodesChange}
        onEdgesChange={onEdgesChange}
        onConnect={onConnect}
        nodeTypes={nodeTypes}
        edgeTypes={edgeTypes}
        onNodeContextMenu={onNodeContextMenu}
        onNodeClick={handleNodeClick}
        selectionMode={SelectionMode.Partial}
        panOnScroll
        selectionOnDrag={!selectMode}
        panOnDrag={selectMode ? [2] : [1, 2]}
        fitView
      >
        <Controls position='top-center' orientation='horizontal' />
        <MiniMap position='bottom-right' pannable zoomable />
        <Background variant="dots" gap={12} size={1} />
      </ReactFlow>

      {/* Top Left: System Controls */}
      <div className="absolute top-4 left-4 z-20 flex flex-col gap-2">
        {/* Workspace tabs */}
        <div className="flex items-center gap-1 flex-wrap">
          {workspaces.map((ws) => (
            <button
              key={ws.id}
              onClick={() => handleSwitchWorkspace(ws.id)}
              className={`px-3 py-1.5 text-xs font-medium rounded-lg shadow-sm transition-all ${ws.id === activeWorkspaceId
                ? 'bg-purple-600 text-white shadow-purple-200'
                : 'bg-white/90 text-gray-600 hover:bg-purple-50 hover:text-purple-600 border border-gray-200'
                }`}
            >
              {ws.name}
            </button>
          ))}
          <button
            onClick={handleNewWorkspace}
            className="px-3 py-1.5 text-xs font-medium rounded-lg shadow-sm bg-white/90 text-green-600 hover:bg-green-50 border border-green-200 hover:border-green-400 transition-all"
            title="Tạo workspace mới"
          >
            + New
          </button>
        </div>

        <div className="flex space-x-2">
          <button
            className="bg-red-500 text-white px-3 py-1.5 rounded-lg shadow hover:bg-red-600 transition-colors text-sm"
            onClick={handleNewProject}
          >
            Clear Canvas
          </button>
          <button
            className={`px-3 py-1.5 rounded-lg shadow transition-all text-sm font-medium ${selectMode
                ? 'bg-green-500 text-white hover:bg-green-600 ring-2 ring-green-300'
                : 'bg-orange-500 text-white hover:bg-orange-600'
              }`}
            onClick={() => {
              if (selectMode) {
                setSelectMode(false);
                setSelectedForExport(new Set());
              } else {
                setSelectMode(true);
              }
            }}
          >
            {selectMode ? `✓ Selected (${selectedForExport.size})` : '☐ Select'}
          </button>
          {selectMode && selectedForExport.size > 0 && (
            <button
              className="bg-purple-600 text-white px-3 py-1.5 rounded-lg shadow hover:bg-purple-700 transition-colors text-sm font-medium animate-pulse"
              onClick={handleExportWord}
            >
              📄 Export Word ({selectedForExport.size})
            </button>
          )}
        </div>
        {selectMode && (
          <div className="bg-green-50 border border-green-200 p-2 rounded-lg shadow text-xs text-green-700">
            <p><strong>📌 Select Mode</strong></p>
            <p>Click vào các block để chọn/bỏ chọn</p>
            <p>Bấm <strong>Export Word</strong> khi xong</p>
          </div>
        )}
        {!selectMode && (
          <div className="bg-white/80 p-2 rounded-lg shadow text-xs text-gray-600 backdrop-blur-sm">
            <p><strong>Guide:</strong></p>
            <p>Right-click: Copy / Replicate</p>
            <p>Backspace: Delete Node</p>
            <p>Double Click: Edit node</p>
          </div>
        )}
      </div>

      {/* Top Right: Node & AI Controls */}
      <div className="absolute top-4 right-4 z-20 flex flex-col items-end gap-2">
        <div className="flex space-x-2">
          <button
            className="bg-green-500 text-white px-4 py-2 rounded-lg shadow hover:bg-green-600 transition-colors text-sm"
            onClick={() => {
              addNode('userInput');
            }}
          >
            + User Input
          </button>
          <button
            className="bg-indigo-500 text-white px-4 py-2 rounded-lg shadow hover:bg-indigo-600 transition-colors text-sm flex items-center gap-1.5"
            onClick={() => setIsAISettingsOpen(true)}
          >
            ⚙️ AI Engine
          </button>
        </div>
        {/* Current AI indicator */}
        <div className="bg-white/90 backdrop-blur-sm rounded-lg px-3 py-1.5 shadow-sm border border-gray-200 flex items-center gap-2">
          <div className={`w-2 h-2 rounded-full ${aiSettings.provider === 'ollama' ? 'bg-green-500' : 'bg-blue-500'} animate-pulse`} />
          <span className="text-xs text-gray-600">
            {aiSettings.provider === 'ollama'
              ? `Ollama: ${aiSettings.ollamaModel || 'qwen3:8b'}`
              : `OpenAI: ${aiSettings.openaiModel || 'gpt-4o'}`}
          </span>
        </div>
      </div>

      <Menu id={MENU_ID}>
        <Item onClick={handleCopyText}>📋 Copy Text</Item>
        <Item onClick={handleReplicate}>📑 Replicate Node</Item>
        <Item onClick={handleCreateConnectedNode}>🔗 Create Connected Node</Item>
      </Menu>

      <div className="absolute bottom-0 left-0 right-0 p-4 bg-white border-t border-gray-200 z-50">
        <div className="flex items-center">
          <textarea
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                handleSendMessage();
              }
            }}
            className="flex-grow mr-2 p-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 outline-none transition-all"
            placeholder="Type your message here... (Enter to send, Shift+Enter for new line)"
            style={{ maxHeight: '5em', resize: 'none' }}
          />
          <button
            onClick={handleSendMessage}
            className="px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 shadow transition-colors"
          >
            Send
          </button>
        </div>
      </div>

      {/* AI Settings Popup */}
      <AISettingsPopup
        isOpen={isAISettingsOpen}
        onClose={() => setIsAISettingsOpen(false)}
        onSave={handleAISettingsSave}
      />
    </div>
  );
}

export default NodeChat;
