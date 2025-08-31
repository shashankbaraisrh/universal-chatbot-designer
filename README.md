
# Universal Chatbot Designer: A No-Code Platform

A no-code, hybrid chatbot platform for the thesis “Interactive Scenario Design for Enhanced Chatbot Conversations.” Build chatbots by drawing a decision tree–like conversation in a React Flow editor.  
A lightweight Flask backend runs a universal JSON schema (choice, input, multi-choice, GPT, end) with an embedded test chat.  
Includes import/export of flows, undo/redo, and optional AI handoff while you keep control of the path.  
Evaluation focuses on usability and GDPR-style consent handling for transparent, auditable conversations.





## Repo Structure

- **mindpeace-designer/**
  - **frontend/** – React Flow UI (React app)
  - **backend/** – Python/Flask API
- **tkinter-prototype-conversation-flow-tester/** – Tkinter flow tester (archived)
- **evaluation/** – SUS/usability data & analysis


## Features

- 🧩 **No-code flow builder** with nodes/edges (choice, multi_choice, input, LLM, end)
- 🔁 **Universal JSON schema** for import/export and backend execution
- 🤖 **GPT handoff** at authored points (optional)
- 🌐 **Flask API** with CORS, health checks, and flow loading
- 📊 **Evaluation** folder with SUS templates, scripts, and results
