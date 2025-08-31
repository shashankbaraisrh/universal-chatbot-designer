
# Universal Chatbot Designer: A No-Code Platform

Design, test, and run chatbots **without coding**.  
Visual flow editor (React Flow) + Python/Flask backend using a **universal JSON** conversation schema, optional GPT handoff, and SUS usability evaluation. Includes an archived Tkinter prototype used to validate flows.

> Repo includes:
> - `mindpeace-designer/` — main app (frontend + backend)
> - `tkinter-prototype-conversation-flow-tester/` — Tkinter flow tester (archived)
> - `evaluation/` — SUS/usability data and analysis

---

## Features
- 🧩 **No-code flow builder** with nodes/edges (choice, multi_choice, input, gpt, end)
- 🔁 **Universal JSON schema** for import/export and backend execution
- 🤖 **GPT handoff** at authored points (optional)
- 🌐 **Flask API** with CORS, health checks, and flow loading
- 📊 **Evaluation** folder with SUS templates, scripts, and results

---

## Repository Layout
universal-chatbot-designer/
├─ mindpeace-designer/
│ ├─ backend/ # Flask API
│ │ ├─ server.py
│ │ ├─ requirements.txt
│ │ └─ conversation_data/ # sample flows (e.g., mindpeace.json)
│ └─ frontend/ # React Flow UI
│ ├─ package.json
│ ├─ public/
│ └─ src/ # App.js, ChatbotPanel.js, etc.
│
├─ tkinter-prototype-conversation-flow-tester/
│ ├─ app_tk.py
│ ├─ flows/
│ ├─ utils/
│ └─ requirements.txt
│
└─ evaluation/
├─ data/ # anonymized inputs
├─ analysis/ # notebooks / scripts
└─ results/ # plots / tables
