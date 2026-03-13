# VersAI 🧠🌿

> **Giao diện chat LLM phi tuyến tính** — phân nhánh, hợp nhất và điều hướng lại lịch sử hội thoại như quản lý mã nguồn với Git.

VersAI là một ứng dụng web chat với các mô hình ngôn ngữ lớn (LLM), biến cuộc hội thoại thành một **sơ đồ nút (flowchart)** thay vì giao diện chat tuyến tính truyền thống. Người dùng có thể tạo nhánh, hợp nhất, chỉnh sửa và tái tạo phản hồi — tất cả trên một canvas tương tác có thể zoom và pan.

Dự án được phát triển dựa trên ý tưởng từ [GitChat](https://github.com/DrustZ/GitChat), mở rộng với hỗ trợ **đa nhà cung cấp AI** (OpenAI & Ollama), **tải file lên kèm OCR**, và nhiều cải tiến giao diện.

---

## ✨ Tính năng chính

### 🗺️ Giao diện hội thoại dạng Flowchart
- Tin nhắn được trình bày dưới dạng **nút (node)** kết nối với nhau trên canvas
- Hỗ trợ **zoom**, **pan** và **minimap** để dễ dàng điều hướng
- Sử dụng [React Flow](https://reactflow.dev/) cho trải nghiệm tương tác mượt mà

### 🌿 Phân nhánh & Hợp nhất (Branch & Merge)
- **Phân nhánh:** Tạo nhiều nhánh hội thoại song song từ cùng một điểm
- **Hợp nhất:** Kết hợp ngữ cảnh từ nhiều nhánh khác nhau
- **Tái nối (rewire):** Thay đổi kết nối giữa các nút để điều chỉnh ngữ cảnh cho LLM

### 🤖 Đa nhà cung cấp AI
- **OpenAI** — Hỗ trợ GPT-4o và các model OpenAI khác (cần API key)
- **Ollama** — Kết nối tới server Ollama tự host (mặc định: `qwen3:8b`)
- Cấu hình provider, model và API key ngay trên giao diện thông qua **AI Settings Popup**

### 📎 Tải file & OCR
- Tải file lên trực tiếp vào cuộc hội thoại (PDF, DOCX, ảnh, text)
- **Trích xuất nội dung tự động:**
  - PDF → text (với fallback sang OCR via Tesseract.js + pdftoppm)
  - DOCX → text (via Mammoth)
  - Ảnh → OCR (via Tesseract.js)
- Nội dung file được xử lý trực tiếp dưới dạng Node attachment hoặc qua hệ thống RAG

### 📚 Hệ thống RAG Thông Minh (Vector DB)
- **Quản lý Vector Database:** Upload và index tài liệu vào cơ sở dữ liệu ChromaDB cục bộ
- **Truy xuất thông minh (Modular Pipeline):** 
  - Tự động diễn giải và mở rộng câu hỏi (Query Translation & Routing)
  - Semantic nhúng vector (Hỗ trợ cấu hình `Embedding Model` riêng biệt cho OpenAI và Ollama)
  - Truy xuất và Re-rank thông minh tài liệu liên quan nhất để đưa vào Context của LLM
- Cung cấp tính năng quản lý tài liệu (thêm, xóa, clear data) thông qua **RAG Manager Panel**

### ✏️ Chỉnh sửa & Tái tạo
- Sửa nội dung bất kỳ nút nào (user input hoặc LLM response)
- Tái tạo (regenerate) phản hồi LLM cho từng nút riêng lẻ
- **Cascade regeneration:** Sửa một input → tất cả các phản hồi LLM con tự động được tái tạo

### 🎨 Render Markdown
- Phản hồi LLM được render dưới dạng **Markdown** đầy đủ
- Hỗ trợ **syntax highlighting** cho code block
- Hỗ trợ **GitHub Flavored Markdown** (bảng, checkbox, v.v.)

---

## 🏗️ Kiến trúc dự án

```
VersAI/
├── nodechat/                # Frontend (React)
│   ├── src/
│   │   ├── components/
│   │   │   ├── NodeChat.js          # Component chính — quản lý flowchart
│   │   │   ├── UserInputNode.js     # Node input của người dùng
│   │   │   ├── LLMResponseNode.js   # Node phản hồi LLM (streaming)
│   │   │   ├── AISettingsPopup.js   # Popup cấu hình AI provider/model
│   │   │   ├── CustomEdge.js        # Edge tùy chỉnh giữa các nút
│   │   │   ├── FileChip.js          # Hiển thị file đã upload
│   │   │   ├── RAGManagerPopup.js   # Module quản lý tài liệu RAG
│   │   │   └── Utility.js           # Hàm tiện ích
│   │   ├── config.js                # Cấu hình API URL
│   │   ├── App.js                   # Entry point React
│   │   └── index.js                 # ReactDOM render
│   ├── public/
│   └── package.json
│
├── server/                  # Backend (Node.js + Express)
│   ├── server.js            # API server chính
│   ├── ocr.js               # Module OCR (Tesseract.js + pdftoppm)
│   ├── ragPipeline.js       # Core logic xử lý truy xuất RAG & Chunking
│   └── package.json
│
└── README.md                # ← Bạn đang đọc file này
```

---

## 🛠️ Tech Stack

| Layer      | Công nghệ                                                  |
|------------|-------------------------------------------------------------|
| Frontend   | React 18, React Flow (xyflow), TailwindCSS 3               |
| Markdown   | react-markdown, remark-gfm, react-syntax-highlighter       |
| Backend    | Node.js, Express 4                                          |
| Database   | ChromaDB (Vector Search cho hệ thống RAG)                   |
| AI         | OpenAI API, Ollama (OpenAI-compatible endpoint)             |
| File Parse | pdf-parse, Mammoth (DOCX), Tesseract.js (OCR), pdf-poppler |
| Dev Tools  | nodemon, react-scripts (CRA)                                |

---

## 🚀 Bắt đầu

### Yêu cầu hệ thống

- **Node.js** ≥ 18 (Khuyến nghị cho tương thích ChromaDB)
- **npm** (đi kèm Node.js)
- **pdftoppm** (từ `poppler-utils`) — cần cho tính năng OCR trên PDF
  ```bash
  # Ubuntu/Debian
  sudo apt install poppler-utils

  # macOS
  brew install poppler
  ```

### Cài đặt

1. **Clone repository:**
   ```bash
   git clone <your-repo-url>
   cd VersAI
   ```

2. **Cài đặt Frontend:**
   ```bash
   cd nodechat
   npm install
   ```

3. **Cài đặt Backend:**
   ```bash
   cd ../server
   npm install
   ```

4. **Cấu hình biến môi trường:**

   Tạo file `.env` trong thư mục `server/`:
   ```env
   OPENAI_API_KEY=sk-your-api-key-here
   PORT=3001
   CHROMA_URL=http://localhost:8001
   ```
   > **Lưu ý:** API key cũng có thể được nhập trực tiếp trên giao diện qua AI Settings Popup. Vector Database (`ChromaDB`) cho RAG mặc định lắng nghe ở port 8001. Hệ thống RAG sẽ tự động bỏ qua tính năng semantic retrieval nếu DB không chạy.

5. **Chạy ChromaDB container (Bắt buộc cho RAG):**
   ```bash
   docker run -p 8001:8000 chromadb/chroma
   ```

### Chạy ứng dụng

Mở **3 terminal** riêng biệt:

**Terminal 1 — ChromaDB:**
```bash
docker run -p 8001:8000 -v ./chroma_data:/chroma/chroma chromadb/chroma
```

**Terminal 2 — Backend:**
```bash
cd server
npm start        # hoặc: npm run dev (chế độ auto-reload với nodemon)
```

**Terminal 3 — Frontend:**
```bash
cd nodechat
npm start
```

Mở trình duyệt tại **http://localhost:3000** 🎉

---

## 📖 Hướng dẫn sử dụng

### Tạo nút mới
- Nhập tin nhắn ở ô input phía dưới và nhấn **Send** để tạo nút User Input + LLM Response
- Hoặc nhấn nút **"Add User Input"** / **"Add LLM Response"** để tạo nút đơn lẻ

### Chỉnh sửa nút
- **Double-click** vào nút để chỉnh sửa nội dung

### Tạo kết nối (nhánh mới)
- Kéo từ **handle dưới** của nút này tới **handle trên** của nút khác

### Nhân bản nút
- **Chuột phải** vào nút → chọn **"Replicate Node"** để tạo bản sao song song

### Tạo nút kết nối
- **Chuột phải** vào nút → chọn **"Create Connected Node"** để tạo nút mới đã kết nối

### Xóa nút / kết nối
- Click vào **edge** để xóa kết nối
- Chọn nhiều nút bằng cách kéo chuột, sau đó nhấn **Delete** / **Backspace**

### Tải file lên
- Click vào biểu tượng đính kèm file để upload PDF, DOCX, ảnh hoặc file text
- Nội dung file sẽ được tự động trích xuất và gửi kèm ngữ cảnh cho LLM

### Cấu hình AI
- Click vào biểu tượng **⚙️ AI Engine** để mở popup cấu hình:
  - Chọn provider: **OpenAI** hoặc **Ollama**
  - Nhập API key (cho OpenAI)
  - Chọn hoặc nhập Text Generation Model
  - Chọn hoặc nhập Embedding Model (Dành riêng cho hệ thống RAG)
  - Cấu hình Ollama URL (cho self-hosted server)

### Xem và quản lý tài liệu RAG
- Click vào biểu tượng **📚 RAG Manager** ở thanh công cụ góc trên
- Bạn có thể upload hàng loạt file `.txt`, `.pdf`, `.docx`
- Hệ thống sẽ tự chunking và phân tích semantic text saving xuống Vector DB
- Xem danh sách hoặc xóa tài liệu khỏi kho nhớ của AI

### Điều hướng canvas
- **Scroll chuột** để zoom in/out
- **Click + kéo** trên nền để di chuyển canvas
- Sử dụng **minimap** ở góc để điều hướng nhanh

---

## ⚙️ Cấu hình

### Thay đổi API URL

Sửa file `nodechat/src/config.js`:
```javascript
export const API_BASE_URL = "http://localhost:3001"; // Local development
```

### Provider mặc định

Server hỗ trợ 2 provider, cấu hình qua request body của endpoint `/generate`:

| Provider | Tham số                                      |
|----------|-----------------------------------------------|
| `openai` | `openaiApiKey`, `openaiModel` (default: gpt-4o) |
| `ollama` | `ollamaUrl`, `ollamaModel` (default: qwen3:8b)  |

---

## 🙏 Ghi nhận

- Ý tưởng chat phi tuyến tính lấy cảm hứng từ dự án [Sensecape](https://dl.acm.org/doi/10.1145/3586183.3606756) — xem [video demo](https://www.youtube.com/watch?v=MIfhunAwZew)
- Lấy cảm hứng từ trao đổi với [Xingyu Bruce Liu](https://liubruce.me/)
- Fork từ [GitChat](https://github.com/DrustZ/GitChat)
- Sử dụng [React Flow](https://reactflow.dev/) cho chức năng flowchart

---

## 📄 License

ISC

---

<p align="center">
  Được xây dựng với ❤️ bởi Dang Tan
</p>