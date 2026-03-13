const OpenAI = require('openai');

class RagPipeline {
  constructor(chromaCollection, defaultOpenaiKey) {
    this.collection = chromaCollection;
    this.defaultOpenaiKey = defaultOpenaiKey;
  }

  // --- Utility: Generate Embeddings ---
  async generateEmbedding(text, provider, openaiApiKey, openaiModel, ollamaUrl, ollamaModel) {
    if (provider === 'openai') {
      const openai = new OpenAI({ apiKey: openaiApiKey || this.defaultOpenaiKey });
      const response = await openai.embeddings.create({
        model: openaiModel || 'text-embedding-3-small',
        input: text,
      });
      return response.data[0].embedding;
    } else {
      // Ollama
      // Convert /chat/completions to /api/embed if needed, or use a provided endpoint
      // Assuming ollamaUrl is the base API or /chat/completions endpoint
      let embedUrl = ollamaUrl;
      if (embedUrl.includes('/v1/chat/completions')) {
        embedUrl = embedUrl.replace('/v1/chat/completions', '/api/embed');
      } else if (!embedUrl.endsWith('/api/embed')) {
        const baseUrl = new URL(embedUrl).origin;
        embedUrl = `${baseUrl}/api/embed`;
      }

      const response = await fetch(embedUrl, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          model: ollamaModel || 'qwen3-embedding',
          input: text
        })
      });
      if (!response.ok) {
        throw new Error(`Ollama Embedding Error: ${response.statusText}`);
      }
      const data = await response.json();
      return data.embeddings ? data.embeddings[0] : (data.embedding || []);
    }
  }

  // --- Utility: Fast LLM Call for Pipeline Tasks ---
  async callLLM(prompt, provider, openaiApiKey, openaiModel, ollamaUrl, ollamaModel) {
    if (provider === 'openai') {
      const openai = new OpenAI({ apiKey: openaiApiKey || this.defaultOpenaiKey });
      const response = await openai.chat.completions.create({
        model: openaiModel || 'gpt-4o-mini',
        messages: [{ role: 'user', content: prompt }]
      });
      return response.choices[0].message.content;
    } else {
      const response = await fetch(ollamaUrl, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          model: ollamaModel,
          messages: [{ role: "user", content: prompt }],
          stream: false
        })
      });
      if (!response.ok) throw new Error(`Ollama Gen Error: ${response.statusText}`);
      const data = await response.json();
      return data.message?.content || "";
    }
  }

  // --- Step 1: Query Translation ---
  async translateQuery(query, provider, openaiApiKey, openaiModel, ollamaUrl, ollamaModel) {
    // Multi-query strategy for better retrieval
    const prompt = `You are an AI assistant. Your task is to generate 3 alternative versions of the following query to improve document retrieval in a vector database. Provide ONLY the alternative queries separated by newlines, with no prefix or numbers.

Original query: ${query}`;

    try {
      const altQueriesStr = await this.callLLM(prompt, provider, openaiApiKey, openaiModel, ollamaUrl, ollamaModel);
      const altQueries = altQueriesStr.split('\n').map(q => q.replace(/^[0-9.\-\s]+/, '').trim()).filter(q => q.length > 0);
      return [query, ...altQueries.slice(0, 3)];
    } catch (e) {
      console.error("Query Translation Failed, falling back to original query:", e);
      return [query];
    }
  }

  // --- Step 2: Routing ---
  async routeQuery(query, provider, openaiApiKey, openaiModel, ollamaUrl, ollamaModel) {
    // Determine if we need to search the vector DB
    const prompt = `Given the user query, does it require searching external knowledge documents/files to answer? Answer strictly with "YES" or "NO".
    
Query: ${query}`;
    
    try {
      const answer = await this.callLLM(prompt, provider, openaiApiKey, openaiModel, ollamaUrl, ollamaModel);
      return answer.trim().toUpperCase().includes("YES");
    } catch (e) {
      // Default to YES to be safe if there's documents available
      return true;
    }
  }

  // --- Step 3: Retrieval ---
  async retrieve(queries, topK, provider, openaiApiKey, openaiEmbeddingModel, ollamaUrl, ollamaEmbeddingModel) {
    if (!this.collection) return [];

    let allResults = [];
    for (const q of queries) {
      try {
        const queryEmbedding = await this.generateEmbedding(q, provider, openaiApiKey, openaiEmbeddingModel, ollamaUrl, ollamaEmbeddingModel);
        const results = await this.collection.query({
          queryEmbeddings: [queryEmbedding],
          nResults: topK,
        });

        if (results && results.documents && results.documents[0]) {
          for (let i = 0; i < results.documents[0].length; i++) {
            allResults.push({
              id: results.ids[0][i],
              document: results.documents[0][i],
              metadata: results.metadatas[0][i],
              distance: results.distances ? results.distances[0][i] : 0
            });
          }
        }
      } catch (e) {
        console.error(`Retrieval failed for query "${q}":`, e);
      }
    }

    return allResults;
  }

  // --- Step 4: Re-ranking / Refinement ---
  rankResults(results, maxResults = 5) {
    // Basic deduplication & ranking based on distance (Chroma returns L2 or cosine distance)
    const uniqueMap = new Map();
    for (const res of results) {
      if (!uniqueMap.has(res.id) || uniqueMap.get(res.id).distance > res.distance) {
        uniqueMap.set(res.id, res);
      }
    }

    // Sort by distance ascending (lower distance = higher similarity)
    const sorted = Array.from(uniqueMap.values()).sort((a, b) => a.distance - b.distance);
    return sorted.slice(0, maxResults);
  }

  // --- Step 5: Full Execution Pipeline ---
  async executePipeline(userQuery, aiSettings) {
    const { 
      provider = 'ollama', 
      openaiApiKey, 
      openaiModel, 
      ollamaUrl, 
      ollamaModel,
      openaiEmbeddingModel,
      ollamaEmbeddingModel
    } = aiSettings;

    console.log("[RAG] Step 1: Evaluating collection logic...");
    if (!this.collection) {
        console.log("[RAG] No Chroma collection initialized. Skipping pipeline.");
        return "";
    }

    try {
        const count = await this.collection.count();
        if (count === 0) {
            console.log("[RAG] Chroma collection is empty. Skipping pipeline.");
            return "";
        }
    } catch(e) {
        console.error("[RAG] Failed to ping Chroma collection:", e);
        return "";
    }

    console.log("[RAG] Step 2: Routing...");
    const needsRetrieval = await this.routeQuery(userQuery, provider, openaiApiKey, openaiModel, ollamaUrl, ollamaModel);
    if (!needsRetrieval) {
      console.log("[RAG] LLM routed strictly to internal knowledge (NO external docs). But we might still retrieve just in case it's wrong, but for now we skip.");
      // Typically, even if it says NO, if they uploaded files they might expect it, but let's follow the pipeline.
      // We'll proceed with retrieval anyway to be safe but with fewer queries.
    }

    console.log("[RAG] Step 3: Query Translation...");
    let queriesToRun = [userQuery];
    if (needsRetrieval) {
        queriesToRun = await this.translateQuery(userQuery, provider, openaiApiKey, openaiModel, ollamaUrl, ollamaModel);
    }
    console.log("[RAG]    Queries:", queriesToRun);

    console.log("[RAG] Step 4: Retrieval...");
    const rawResults = await this.retrieve(queriesToRun, 3, provider, openaiApiKey, openaiEmbeddingModel, ollamaUrl, ollamaEmbeddingModel);
    
    console.log("[RAG] Step 5: Re-ranking...");
    const finalResults = this.rankResults(rawResults, 5);

    console.log(`[RAG] Pipeline complete. Retrieved ${finalResults.length} chunks.`);

    // --- Format Context Assembly ---
    if (finalResults.length === 0) return "";

    let contextString = "\n\n=== RETRIEVED KNOWLEDGE CONTEXT ===\n";
    contextString += "Please use the following context to answer the user's question. If the context does not contain the answer, say so.\n\n";

    finalResults.forEach((res, index) => {
        contextString += `--- Document: ${res.metadata.filename || 'Unknown'} (Chunk ${index + 1}) ---\n`;
        contextString += `${res.document}\n\n`;
    });
    
    contextString += "====================================\n\n";
    return contextString;
  }
}

module.exports = RagPipeline;
