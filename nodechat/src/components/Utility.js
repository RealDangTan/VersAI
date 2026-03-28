import { getOutgoers, getIncomers } from '@xyflow/react';
import { API_BASE_URL } from '../config';

export async function sendConversationRequest(endpoint, conversation, fileContexts, onChunkReceived, aiSettings = null, onRagMetadata = null) {
  try {
    // Strip internal fields to match OpenAI message format
    const formattedHistory = conversation.map(({ role, content }) => ({ role, content }));

    console.log(`[DEBUG] API_BASE_URL is: ${API_BASE_URL}`);
    console.log(`[DEBUG] Timestamp: ${Date.now()}`);
    if (aiSettings) {
      console.log(`[DEBUG] AI Provider: ${aiSettings.provider}`);
    }

    const body = {
      history: formattedHistory,
      fileContexts,
      useRag: aiSettings?.useRag !== false, // Default to true
    };

    // Pass AI settings to the backend
    if (aiSettings) {
      body.provider = aiSettings.provider || 'ollama';
      if (aiSettings.provider === 'openai') {
        body.openaiApiKey = aiSettings.openaiApiKey;
        body.openaiModel = aiSettings.openaiModel || 'gpt-4o';
        body.openaiEmbeddingModel = aiSettings.openaiEmbeddingModel || 'text-embedding-3-small';
      } else {
        body.ollamaUrl = aiSettings.ollamaUrl;
        body.ollamaModel = aiSettings.ollamaModel || 'qwen3:8b';
        body.ollamaEmbeddingModel = aiSettings.ollamaEmbeddingModel || 'qwen3-embedding';
      }
    }

    // Make the POST request and handle streaming response
    const response = await fetch(`${API_BASE_URL}/${endpoint}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(body),
    });

    if (!response.ok) {
      throw new Error('Failed to start conversation');
    }

    const reader = response.body.getReader();
    const decoder = new TextDecoder();
    let done = false;
    let buffer = '';

    while (!done) {
      const { value, done: readerDone } = await reader.read();
      done = readerDone;

      buffer += decoder.decode(value, { stream: true });

      let boundary = buffer.indexOf('\n\n');
      while (boundary !== -1) {
        const chunk = buffer.slice(0, boundary);
        buffer = buffer.slice(boundary + 2);

        if (chunk.startsWith('data: ')) {
          const data = JSON.parse(chunk.slice(6));

          // Handle RAG metadata
          if (data.type === 'rag') {
            if (onRagMetadata) {
              onRagMetadata(data);
            }
            continue;
          }

          if (data.content === '[DONE]') {
            return;
          } else {
            onChunkReceived(data.content);
          }
        }

        boundary = buffer.indexOf('\n\n');
      }
    }
  } catch (error) {
    console.error('Failed to send conversation request:', error);
    throw error;
  }
}

export function findAllDescendants(nodeId, nodes, edges) {
  const outgoers = getOutgoers({ id: nodeId }, nodes, edges);
  let descendants = [...outgoers.map(o => o.id)];

  outgoers.forEach((outgoer) => {
    descendants = descendants.concat(findAllDescendants(outgoer.id, nodes, edges));
  });

  return descendants;
}

export function findAllPrecedents(nodeId, nodes, edges) {
  const incomers = getIncomers({ id: nodeId }, nodes, edges);
  let precedents = [...incomers.map(i => i.id)];

  incomers.forEach((incomer) => {
    precedents = precedents.concat(findAllPrecedents(incomer.id, nodes, edges));
  });

  return precedents;
}

export function getConversationHistory(node, nodes, edges) {
  const history = [];
  const nodeMap = new Map(nodes.map(n => [n.id, n]));
  const visited = new Set(); // Prevent cycles and duplicates

  function processNode(currentNode) {
    if (!currentNode || visited.has(currentNode.id)) return;
    visited.add(currentNode.id);

    const nodeHistory = {
      id: currentNode.id,
      role: currentNode.type === 'userInput' ? 'user' : 'assistant',
      parent: [],
      content: currentNode.data.text,
      files: currentNode.data.files || [],
      children: []
    };

    // Find parent nodes
    const incomers = getIncomers({ id: currentNode.id }, nodes, edges);
    nodeHistory.parent = incomers.map(incomer => incomer.id);

    if (node.id !== currentNode.id) {
      // Find child nodes
      const outgoers = getOutgoers({ id: currentNode.id }, nodes, edges);
      nodeHistory.children = outgoers.map(outgoer => outgoer.id);
    }
    history.unshift(nodeHistory);

    // Process parent nodes recursively
    incomers.forEach(incomer => processNode(nodeMap.get(incomer.id)));
  }

  // Start processing from the given node
  processNode(node);
  return history;
}
