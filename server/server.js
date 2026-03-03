const express = require('express');
const cors = require('cors');
const OpenAI = require('openai');
const fs = require('fs').promises;
const fsSync = require('fs');
const multer = require('multer');
const path = require('path');
const pdf = require('pdf-parse');
const mammoth = require('mammoth');
require('dotenv').config();

const app = express();
const port = 8000;

// Configure CORS
app.use(cors({
  origin: true, // Allow any origin for now to fix connection issues
  credentials: true
}));
app.use(express.json());

// Default OpenAI client (fallback)
const defaultOpenai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY || "" });

let systemPrompt;

async function loadSystemPrompt() {
  try {
    systemPrompt = await fs.readFile("llm-branched-conversation-prompt.md", "utf-8");
  } catch (error) {
    console.error("Error loading system prompt:", error);
    process.exit(1);
  }
}

// Configure Multer for file uploads
const uploadDir = 'uploads';
if (!fsSync.existsSync(uploadDir)) {
  fsSync.mkdirSync(uploadDir);
}

const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    cb(null, uploadDir)
  },
  filename: function (req, file, cb) {
    cb(null, Date.now() + '-' + file.originalname)
  }
});

const upload = multer({ storage: storage });

const { performOCR } = require('./ocr');

async function extractTextFromFile(filePath, mimeType) {
  try {
    const ext = path.extname(filePath).toLowerCase();
    let text = "";

    // ONLY allow .txt
    if (mimeType === 'text/plain' || ext === '.txt') {
      text = await fs.readFile(filePath, 'utf-8');
    } else {
      console.warn(`File type restriction: Skipped ${mimeType} / ${ext}`);
      return "[ERROR: Only .txt files are currently supported.]";
    }

    return text || "";
  } catch (error) {
    console.error("Error extracting text:", error);
    return "";
  }
}

app.post('/upload', upload.single('file'), async (req, res) => {
  if (!req.file) {
    return res.status(400).json({ error: 'No file uploaded' });
  }

  try {
    const textContent = await extractTextFromFile(req.file.path, req.file.mimetype);
    console.log(`Extracted ${textContent.length} characters from ${req.file.originalname}`);

    res.json({
      filename: req.file.originalname,
      path: req.file.path,
      mimetype: req.file.mimetype,
      size: req.file.size,
      textContent: textContent
    });
  } catch (error) {
    console.error("Error processing file upload:", error);
    res.status(500).json({ error: 'Failed to process file' });
  }
});

app.post("/generate", async (req, res) => {
  try {
    const {
      history,
      fileContexts,
      provider = 'ollama',
      openaiApiKey,
      openaiModel = 'gpt-4o',
      ollamaUrl = 'https://research.neu.edu.vn/ollama/v1/chat/completions',
      ollamaModel = 'qwen3:8b'
    } = req.body;

    // Prepare Context as System Prompt for both
    let contextString = "";
    if (fileContexts && fileContexts.length > 0) {
      console.log(`Received ${fileContexts.length} files in context.`);
      contextString = "\n\nRelevant Context from Uploaded Files:\n";
      fileContexts.forEach(file => {
        if (!file.textContent || file.textContent.trim().length === 0) {
          contextString += `--- BEGIN FILE: ${file.filename} ---\n[WARNING: Empty/Scanned]\n--- END FILE: ${file.filename} ---\n\n`;
        } else {
          contextString += `--- BEGIN FILE: ${file.filename} ---\n${file.textContent}\n--- END FILE: ${file.filename} ---\n\n`;
        }
      });
    }

    res.writeHead(200, {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      'Connection': 'keep-alive'
    });

    if (provider === 'ollama') {
      // --- OLLAMA IMPLEMENTATION ---
      console.log(`Using Provider: Ollama | URL: ${ollamaUrl} | Model: ${ollamaModel}`);

      const ollamaResponse = await fetch(ollamaUrl, {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          model: ollamaModel,
          messages: [
            { role: "system", content: systemPrompt + (contextString ? "\n" + contextString : "") },
            ...(Array.isArray(history) ? history : [{ role: "user", content: JSON.stringify(req.body) }])
          ],
          stream: true
        })
      });

      if (!ollamaResponse.ok) {
        const errorBody = await ollamaResponse.text().catch(() => 'unknown');
        throw new Error(`Ollama API Error: ${ollamaResponse.status} ${ollamaResponse.statusText} - ${errorBody}`);
      }

      if (!ollamaResponse.body) throw new Error('ReadableStream not supported by this environment.');

      const reader = ollamaResponse.body.getReader();
      const decoder = new TextDecoder("utf-8");
      let sseBuffer = '';

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        sseBuffer += decoder.decode(value, { stream: true });

        // Process complete SSE lines from the buffer
        let newlineIdx;
        while ((newlineIdx = sseBuffer.indexOf('\n')) !== -1) {
          const line = sseBuffer.slice(0, newlineIdx).trim();
          sseBuffer = sseBuffer.slice(newlineIdx + 1);

          if (!line) continue; // skip empty lines
          if (!line.startsWith('data: ')) continue;

          const dataStr = line.substring(6);
          if (dataStr === '[DONE]') continue;

          try {
            const data = JSON.parse(dataStr);
            const delta = data.choices?.[0]?.delta;
            if (!delta) continue;

            // qwen3 model sends "reasoning" tokens first (content is ""),
            // then actual "content" tokens. We stream both to the client.
            const content = delta.content || "";
            const reasoning = delta.reasoning || "";

            // Send actual content if present
            if (content) {
              res.write(`data: ${JSON.stringify({ content })}\n\n`);
            }
            // Optionally: also show reasoning as thinking (uncomment if you want to show thinking)
            // if (reasoning) {
            //   res.write(`data: ${JSON.stringify({ content: reasoning })}\n\n`);
            // }
          } catch (e) {
            console.error("Error parsing Ollama chunk:", dataStr, e.message);
          }
        }
      }

    } else if (provider === 'openai') {
      // --- OPENAI IMPLEMENTATION ---
      console.log(`Using Provider: OpenAI | Model: ${openaiModel}`);

      // Use dynamic API key from frontend if provided, otherwise fallback to env
      const apiKey = openaiApiKey || process.env.OPENAI_API_KEY || "";
      if (!apiKey) {
        throw new Error("No OpenAI API key provided. Please set it in the AI Settings popup.");
      }

      const openaiClient = new OpenAI({ apiKey });

      let messages = [
        { role: "system", content: systemPrompt }
      ];

      if (contextString) {
        messages.push({ role: "system", content: contextString });
      }

      if (Array.isArray(history)) {
        messages = messages.concat(history);
      } else {
        messages.push({ role: "user", content: JSON.stringify(req.body) });
      }

      const stream = await openaiClient.chat.completions.create({
        model: openaiModel,
        messages: messages,
        stream: true,
      });

      for await (const chunk of stream) {
        if (chunk.choices[0]?.delta?.content) {
          res.write(`data: ${JSON.stringify({ content: chunk.choices[0].delta.content })}\n\n`);
        }
      }
    } else {
      throw new Error(`Unknown provider: ${provider}`);
    }

    res.write(`data: ${JSON.stringify({ content: "[DONE]" })}\n\n`);
    res.end();
  } catch (error) {
    console.error("Error in generate endpoint:", error);
    if (!res.headersSent) {
      res.status(500).json({ error: error.message });
    } else {
      res.end();
    }
  }
});

app.get('/', (req, res) => {
  res.send('VersAI Backend API is running. Please access the App at port 3000.');
});

async function startServer() {
  await loadSystemPrompt();
  app.listen(port, () => {
    console.log(`Server running at http://localhost:${port}`);
  });
}

startServer();