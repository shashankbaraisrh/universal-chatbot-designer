
import React, { useState, useMemo, useRef, useEffect } from "react";
import ReactFlow, {
  MiniMap,
  Controls,
  Background,
  useNodesState,
  useEdgesState,
  addEdge,
  MarkerType,
} from "reactflow";
import "reactflow/dist/style.css";
import PromptEditor from "./PromptEditor";

const initialNodes = [
  {
    id: "1",
    data: {
      message:
        "Hi there, I’m MindPeace — your friendly mental health support assistant. Would you like to begin our conversation?",
      type: "choice",
      options: {},
      capture: "",
      next: "",
    },
    position: { x: 250, y: 0 },
    type: "default",
  },
];

const initialEdges = [];
let nodeCounter = 2;

/* ================================
   Flow persistence helpers
   ================================ */

const FLOWS_KEY = "mindpeace_flows";          // map of id -> flow object
const ACTIVE_KEY = "mindpeace_active_flow";   // id of last active flow

function readFlows() {
  try { return JSON.parse(localStorage.getItem(FLOWS_KEY) || "{}"); }
  catch { return {}; }
}
function writeFlows(map) {
  localStorage.setItem(FLOWS_KEY, JSON.stringify(map));
}
function setActiveFlowId(id) {
  localStorage.setItem(ACTIVE_KEY, id);
}
function getActiveFlowId() {
  return localStorage.getItem(ACTIVE_KEY);
}
function computeNextCounterFromNodes(nodesArr) {
  const maxId = nodesArr.reduce((m, n) => Math.max(m, Number(n.id) || 0), 0);
  return (isFinite(maxId) ? maxId + 1 : 2);
}
function makeFlowPayload({ id, name, nodes, edges, promptSettings, nodeCounter }) {
  return { id, name, nodes, edges, promptSettings, nodeCounter, savedAt: Date.now() };
}

/* ================================
   Component
   ================================ */

export default function App() {
  // Hard-disable page scrolling (no browser scrollbar at all)
  useEffect(() => {
    const prevHtmlOverflow = document.documentElement.style.overflow;
    const prevBodyOverflow = document.body.style.overflow;
    const prevBodyMargin = document.body.style.margin;
    document.documentElement.style.overflow = "hidden";
    document.body.style.overflow = "hidden";
    document.body.style.margin = "0";
    return () => {
      document.documentElement.style.overflow = prevHtmlOverflow;
      document.body.style.overflow = prevBodyOverflow;
      document.body.style.margin = prevBodyMargin;
    };
  }, []);

  const [nodes, setNodes, onNodesChange] = useNodesState(initialNodes);
  const [manualEdges, setEdges, onEdgesChange] = useEdgesState(initialEdges);
  const [selectedNodeId, setSelectedNodeId] = useState(null);
  const [selectedEdgeId, setSelectedEdgeId] = useState(null);
  const [chatbotReady, setChatbotReady] = useState(false);
  const [submittedFlow, setSubmittedFlow] = useState(null);
  const [currentNodeId, setCurrentNodeId] = useState(null);
  const [gptMode, setGptMode] = useState(false);
  const [chatHistory, setChatHistory] = useState([]);
  const [userInputs, setUserInputs] = useState({});
  const [inputValue, setInputValue] = useState("");
  const [multiChoiceSelection, setMultiChoiceSelection] = useState([]);

  // Typing indicator + auto-scroll refs/state
  const [isTyping, setIsTyping] = useState(false);
  const chatScrollRef = useRef(null);

  // Prompt Editor state
  const [promptSettings, setPromptSettings] = useState({
    system_prompt:
      "You are MindPeace, a compassionate mental health assistant. Based on the user's shared info and emotional state, continue the conversation empathetically.",
    gpt_model: "gpt-3.5-turbo",
  });

  // Flow switcher UI state
  const [flowsMeta, setFlowsMeta] = useState([]);            // [{id,name,savedAt}]
  const [activeFlowIdState, setActiveFlowIdState] = useState(null);
  const [selectedFlowId, setSelectedFlowId] = useState(null);

  const history = useRef([{ nodes: initialNodes, edges: initialEdges }]);
  const historyIndex = useRef(0);

  const selectedNode = nodes.find((n) => n.id === selectedNodeId);
  const selectedEdge = manualEdges.find((e) => e.id === selectedEdgeId);

  // Shared card style (Node/Prompt/Edge)
  const cardStyle = {
    background: "#fff7ed",
    padding: 12,
    border: "1px solid #f59e0b",
    borderRadius: 10,
    width: "100%",
    boxSizing: "border-box",
    marginRight: 10,
    boxShadow: "0 2px 6px rgba(0,0,0,0.08)",
  };

  // Auto-scroll whenever messages change or typing state toggles
  useEffect(() => {
    const el = chatScrollRef.current;
    if (!el) return;
    el.scrollTop = el.scrollHeight;
  }, [chatHistory, isTyping]);

  const pushToHistory = (newNodes, newEdges) => {
    const currentState = { nodes: newNodes, edges: newEdges };
    const newHistory = history.current.slice(0, historyIndex.current + 1);
    newHistory.push(currentState);
    history.current = newHistory;
    historyIndex.current++;
  };

  const undo = () => {
    if (historyIndex.current > 0) {
      historyIndex.current--;
      const { nodes, edges } = history.current[historyIndex.current];
      setNodes(nodes);
      setEdges(edges);
    }
  };

  const redo = () => {
    if (historyIndex.current < history.current.length - 1) {
      historyIndex.current++;
      const { nodes, edges } = history.current[historyIndex.current];
      setNodes(nodes);
      setEdges(edges);
    }
  };

  const getNodeStyle = (type) => {
    const baseStyle = {
      borderRadius: 10,
      padding: 10,
      boxShadow: "2px 2px 8px #ccc",
      whiteSpace: "pre-wrap",
      wordWrap: "break-word",
      fontFamily: "Segoe UI, sans-serif",
      minWidth: 180,
      maxWidth: 300,
    };
    switch (type) {
      case "choice":
        return { ...baseStyle, background: "#0284c7", border: "1px solid #0369a1", color: "white" };
      case "input":
        return { ...baseStyle, background: "#DCFCE7", border: "1px solid #22c55e" };
      case "multi_choice":
        return { ...baseStyle, background: "#facc15", border: "1px solid #eab308" };
      case "gpt":
        return { ...baseStyle, background: "#F3E8FF", border: "1px solid #8b5cf6" };
      case "end":
        return { ...baseStyle, background: "#FEE2E2", border: "1px solid #f87171" };
      default:
        return { ...baseStyle, background: "#F3F4F6", border: "1px solid #d1d5db" };
    }
  };

  const autoGeneratedEdges = useMemo(() => {
    const existing = new Set(manualEdges.map((e) => `${e.source}->${e.target}`));
    const autoEdges = [];
    for (const node of nodes) {
      const target = node.data?.next;
      if (target && !existing.has(`${node.id}->${target}`)) {
        autoEdges.push({
          id: `auto-${node.id}-${target}`,
          source: node.id,
          target,
          type: "default",
          animated: false,
          style: { strokeDasharray: "5,5", stroke: "#999" },
          markerEnd: { type: MarkerType.ArrowClosed },
          label: "next",
        });
      }
    }
    return autoEdges;
  }, [nodes, manualEdges]);

  const allEdges = [...manualEdges, ...autoGeneratedEdges];

  const getExportJSON = () => {
    const output = {
      settings: {
        system_prompt: promptSettings.system_prompt,
        gpt_model: promptSettings.gpt_model,
      },
      nodes: {},
    };
    nodes.forEach(({ id, data }) => {
      const { message, type, options, capture, next } = data;
      const nodeObj = { message, type };
      if (options && Object.keys(options).length) nodeObj.options = options;
      if (capture) nodeObj.capture = capture;
      if (next) nodeObj.next = next;
      output.nodes[id] = nodeObj;
    });
    return output;
  };


  /* ================================
     Flow Switcher helpers
     ================================ */
  const refreshFlowsMeta = () => {
    const map = readFlows();
    const list = Object.values(map)
      .map(f => ({ id: f.id, name: f.name || "(unnamed)", savedAt: f.savedAt || 0 }))
      .sort((a, b) => b.savedAt - a.savedAt);
    const activeId = getActiveFlowId();
    setFlowsMeta(list);
    setActiveFlowIdState(activeId);
    setSelectedFlowId(activeId || (list[0]?.id ?? null));
  };

  const loadFlowById = (id) => {
    const flows = readFlows();
    const f = flows[id];
    if (!f) return window.alert("Flow not found.");
    setNodes(f.nodes || initialNodes);
    setEdges(f.edges || []);
    setPromptSettings(f.promptSettings || promptSettings);
    nodeCounter = f.nodeCounter || computeNextCounterFromNodes(f.nodes || initialNodes);

    // reset runtime/chat state
    setSelectedNodeId(null);
    setSelectedEdgeId(null);
    setChatbotReady(false);
    setSubmittedFlow(null);
    setCurrentNodeId(null);
    setGptMode(false);
    setChatHistory([]);
    setUserInputs({});
    setInputValue("");
    setMultiChoiceSelection([]);

    history.current = [{ nodes: f.nodes || initialNodes, edges: f.edges || [] }];
    historyIndex.current = 0;

    setActiveFlowId(id);
    setActiveFlowIdState(id);
    setSelectedFlowId(id);
    refreshFlowsMeta();
  };

  const renameFlowById = (id) => {
    const flows = readFlows();
    const f = flows[id];
    if (!f) return window.alert("Flow not found.");
    const newName = window.prompt("Rename flow:", f.name || "My Flow");
    if (!newName) return;
    f.name = newName;
    f.savedAt = Date.now();
    flows[id] = f;
    writeFlows(flows);
    refreshFlowsMeta();
  };

  const deleteFlowById = (id) => {
    const flows = readFlows();
    if (!flows[id]) return window.alert("Flow not found.");
    if (!window.confirm("Delete this flow permanently?")) return;

    delete flows[id];
    writeFlows(flows);

    if (getActiveFlowId() === id) {
      const remaining = Object.values(flows);
      if (remaining.length) {
        const fallback = remaining.sort((a,b) => (b.savedAt||0)-(a.savedAt||0))[0];
        setActiveFlowId(fallback.id);
        loadFlowById(fallback.id);
      } else {
        const newId = String(Date.now());
        const payload = makeFlowPayload({
          id: newId,
          name: "My First Flow",
          nodes: initialNodes,
          edges: initialEdges,
          promptSettings,
          nodeCounter: 2
        });
        const map = {};
        map[newId] = payload;
        writeFlows(map);
        setActiveFlowId(newId);
        loadFlowById(newId);
      }
    } else {
      refreshFlowsMeta();
    }
  };

  // Restore last active flow on refresh (or create first)
  useEffect(() => {
    const flows = readFlows();
    const activeId = getActiveFlowId();
    if (activeId && flows[activeId]) {
      const f = flows[activeId];
      setNodes(f.nodes || initialNodes);
      setEdges(f.edges || []);
      setPromptSettings(f.promptSettings || promptSettings);
      nodeCounter = f.nodeCounter || computeNextCounterFromNodes(f.nodes || initialNodes);
      history.current = [{ nodes: f.nodes || initialNodes, edges: f.edges || [] }];
      historyIndex.current = 0;
    } else {
      const id = String(Date.now());
      const payload = makeFlowPayload({
        id,
        name: "My First Flow",
        nodes: initialNodes,
        edges: initialEdges,
        promptSettings,
        nodeCounter
      });
      const map = readFlows();
      map[id] = payload;
      writeFlows(map);
      setActiveFlowId(id);
    }
    refreshFlowsMeta();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const submitFlow = async () => {
    const payload = getExportJSON();
    try {
      const res = await fetch("http://localhost:5000/submit", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      if (res.ok) {
        const firstMsg = payload.nodes["1"]?.message || "Let's begin.";
        setSubmittedFlow(payload);
        setChatbotReady(true);
        setChatHistory([{ sender: "bot", message: firstMsg }]);
        setUserInputs({});
        setInputValue("");
        setCurrentNodeId("1");
        setGptMode(false);
        window.alert("Flow submitted successfully.");
      } else {
        window.alert("Submission failed.");
      }
    } catch {
      window.alert("Backend error.");
    }
  };

  /* ================================
     Save / New Flow (persistence)
     ================================ */
  const saveCurrentFlow = () => {
    const flows = readFlows();
    const activeId = getActiveFlowId() || String(Date.now());
    const existing = flows[activeId];

    let name = existing?.name;
    if (!name) {
      name = window.prompt("Name this flow:", "My Flow");
      if (!name) return;
    }

    const payload = makeFlowPayload({
      id: activeId,
      name,
      nodes,
      edges: manualEdges,
      promptSettings,
      nodeCounter
    });

    flows[activeId] = payload;
    writeFlows(flows);
    setActiveFlowId(activeId);
    setActiveFlowIdState(activeId);
    setSelectedFlowId(activeId);
    refreshFlowsMeta();
    window.alert(`Saved ✓  (${name})`);
  };

  const createNewFlow = () => {
    const name = window.prompt("New flow name:", "New Flow");
    if (!name) return;

    const freshNodes = [{
      id: "1",
      data: {
        message:
          "Hi there, I’m MindPeace — your friendly mental health support assistant. Would you like to begin our conversation?",
        type: "choice",
        options: {},
        capture: "",
        next: "",
      },
      position: { x: 250, y: 0 },
      type: "default",
    }];
    const freshEdges = [];
    nodeCounter = 2;

    setNodes(freshNodes);
    setEdges(freshEdges);
    setSelectedNodeId(null);
    setSelectedEdgeId(null);
    setChatbotReady(false);
    setSubmittedFlow(null);
    setCurrentNodeId(null);
    setGptMode(false);
    setChatHistory([]);
    setUserInputs({});
    setInputValue("");
    setMultiChoiceSelection([]);

    history.current = [{ nodes: freshNodes, edges: freshEdges }];
    historyIndex.current = 0;

    const id = String(Date.now());
    const flows = readFlows();
    flows[id] = makeFlowPayload({
      id, name, nodes: freshNodes, edges: freshEdges, promptSettings, nodeCounter
    });
    writeFlows(flows);
    setActiveFlowId(id);
    setActiveFlowIdState(id);
    setSelectedFlowId(id);
    refreshFlowsMeta();

    window.alert(`New flow created ✓  (${name})`);
  };

  /* ================================
     Chat + inputs
     ================================ */

  const handleUserResponse = async (response) => {
    if (!submittedFlow) return;

    const updatedHistory = [...chatHistory, { sender: "user", message: response }];
    setChatHistory(updatedHistory);

    const formattedHistory = updatedHistory.map((entry) => ({
      role: entry.sender === "user" ? "user" : "assistant",
      content: entry.message,
    }));

    //  Free-chat mode with typing indicator
    if (gptMode) {
      try {
        setIsTyping(true);
        const res = await fetch("http://localhost:5000/chat", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            chat_history: formattedHistory,
            system_prompt: submittedFlow.settings.system_prompt,
            gpt_model: submittedFlow.settings.gpt_model,
            user_inputs: userInputs,
          }),
        });
        const data = await res.json();
        const gptReply = data.reply || "No response from GPT.";
        setChatHistory((prev) => [...prev, { sender: "bot", message: gptReply }]);
      } catch {
        setChatHistory((prev) => [...prev, { sender: "bot", message: "Error contacting GPT." }]);
      } finally {
        setIsTyping(false);
      }
      return;
    }

    const currentNode = submittedFlow.nodes[currentNodeId];
    const newInputs = { ...userInputs };
    if (currentNode.capture) newInputs[currentNode.capture] = response;

    let nextId = currentNode.next || currentNode.options?.[response];
    const nextNode = submittedFlow.nodes?.[nextId];

    if (!nextNode) {
      setUserInputs(newInputs);
      setChatHistory([...updatedHistory, { sender: "bot", message: "Conversation complete." }]);
      setCurrentNodeId(null);
      return;
    }

    if (nextNode.type === "gpt") {
      const message = nextNode.message || "Let's continue.";
      try {
        setIsTyping(true);
        const res = await fetch("http://localhost:5000/chat", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            chat_history: [...formattedHistory, { role: "user", content: response }],
            system_prompt: submittedFlow.settings.system_prompt,
            gpt_model: submittedFlow.settings.gpt_model,
            user_inputs: newInputs,
          }),
        });
        const data = await res.json();
        const gptReply = data.reply || "No response from GPT.";
        setChatHistory([
          ...updatedHistory,
          { sender: "bot", message },
          { sender: "bot", message: gptReply },
        ]);
      } catch {
        setChatHistory([
          ...updatedHistory,
          { sender: "bot", message },
          { sender: "bot", message: "Error contacting GPT." },
        ]);
      } finally {
        setIsTyping(false);
        setCurrentNodeId(null);
        setGptMode(true);
        setUserInputs(newInputs);
      }
    } else {
      setUserInputs(newInputs);
      setChatHistory([...updatedHistory, { sender: "bot", message: nextNode.message }]);
      setCurrentNodeId(nextId);
    }
  };

  const renderChatInput = () => {
    if (!submittedFlow || (!currentNodeId && !gptMode)) return null;

    if (gptMode) {
      return (
        <div style={{ display: "flex", gap: "6px" }}>
          <input
            value={inputValue}
            onChange={(e) => setInputValue(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                if (!inputValue.trim()) return;
                handleUserResponse(inputValue);
                setInputValue("");
              }
            }}
            style={{
              flex: 1,
              padding: "8px",
              borderRadius: 6,
              border: "1px solid #f59e0b",
              background: "#fff7ed",
              height: "38px",
              boxSizing: "border-box",
            }}
          />
          <button
            onClick={() => {
              if (!inputValue.trim()) return;
              handleUserResponse(inputValue);
              setInputValue("");
            }}
            style={{
              background: "#38bdf8",
              color: "white",
              borderRadius: 6,
              padding: "0 14px",
              border: "none",
              height: "38px",
              whiteSpace: "nowrap",
              cursor: "pointer",
              fontWeight: 600,
            }}
          >
            Send
          </button>
        </div>
      );
    }

    const node = submittedFlow.nodes[currentNodeId];

    if (node.type === "choice") {
      const opts = Object.keys(node.options || {});
      return (
        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          {opts.map((opt) => (
            <button
              key={opt}
              onClick={() => handleUserResponse(opt)}
              style={{
                padding: "8px",
                width: "100%",
                borderRadius: 6,
                border: "1px solid #0369a1",
                background: "#0284c7",
                color: "white",
                cursor: "pointer",
              }}
            >
              {opt}
            </button>
          ))}
        </div>
      );
    }

    if (node.type === "multi_choice") {
      return (
        <div>
          {Object.keys(node.options || {}).map((opt) => (
            <div
              key={opt}
              style={{
                background: "#facc15",
                padding: "4px 8px",
                borderRadius: "4px",
                margin: "4px 0",
              }}
            >
              <label>
                <input
                  type="checkbox"
                  checked={multiChoiceSelection.includes(opt)}
                  onChange={() =>
                    setMultiChoiceSelection((prev) =>
                      prev.includes(opt)
                        ? prev.filter((o) => o !== opt)
                        : [...prev, opt]
                    )
                  }
                />{" "}
                {opt}
              </label>
            </div>
          ))}
          <button
            onClick={() => {
              if (multiChoiceSelection.length > 0) {
                handleUserResponse(multiChoiceSelection.join(", "));
                setMultiChoiceSelection([]);
                setInputValue("");
              }
            }}
            style={{
              marginTop: 10,
              background: "#22c55e",
              color: "white",
              padding: 8,
              borderRadius: 6,
              border: "none",
              width: "100%",
              cursor: "pointer",
            }}
          >
            Submit Selection
          </button>
        </div>
      );
    }

    if (node.type === "input") {
      return (
        <div style={{ display: "flex", gap: "6px" }}>
          <input
            value={inputValue}
            onChange={(e) => setInputValue(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                if (!inputValue.trim()) return;
                handleUserResponse(inputValue);
                setInputValue("");
              }
            }}
            style={{
              flex: 1,
              padding: "8px",
              borderRadius: 6,
              border: "1px solid #f59e0b",
              background: "#fff7ed",
              height: "38px",
              boxSizing: "border-box",
            }}
          />
          <button
            onClick={() => {
              if (!inputValue.trim()) return;
              handleUserResponse(inputValue);
              setInputValue("");
            }}
            style={{
              background: "#38bdf8",
              color: "white",
              borderRadius: 6,
              padding: "0 14px",
              border: "none",
              height: "38px",
              whiteSpace: "nowrap",
              cursor: "pointer",
              fontWeight: 600,
            }}
          >
            Submit
          </button>
        </div>
      );
    }

    return null;
  };

  // Edge cleanup
  const handleEdgesChange = (changes) => {
    const removedIds = new Set(
      changes.filter((c) => c.type === "remove" && c.id).map((c) => c.id)
    );
    const removedEdges = manualEdges.filter((e) => removedIds.has(e.id));

    onEdgesChange(changes);
    if (!removedEdges.length) return;

    const updatedNodes = nodes.map((n) => {
      let data = { ...n.data };
      let mutated = false;

      for (const e of removedEdges) {
        if (e.source !== n.id) continue;

        if ((data.type === "choice" || data.type === "multi_choice") && data.options) {
          if (e.label && data.options[e.label] === e.target) {
            const opts = { ...data.options };
            delete opts[e.label];
            data.options = opts;
            mutated = true;
          } else {
            const opts = { ...data.options };
            for (const [k, v] of Object.entries(opts)) {
              if (v === e.target) delete opts[k];
            }
            if (Object.keys(opts).length !== Object.keys(data.options).length) {
              data.options = opts;
              mutated = true;
            }
          }
        } else if (data.next === e.target) {
          data.next = "";
          mutated = true;
        }
      }

      return mutated ? { ...n, data } : n;
    });

    setNodes(updatedNodes);
    const remainingEdges = manualEdges.filter((e) => !removedIds.has(e.id));
    pushToHistory(updatedNodes, remainingEdges);
  };


  // For the Flow Switcher UI: is the selected flow the active one?
  const activeSelected = Boolean(selectedFlowId && selectedFlowId === activeFlowIdState);

  return (
    <div
      style={{
        width: "100vw",
        height: "100vh",
        display: "flex",
        overflow: "hidden",
        overscrollBehavior: "contain",
      }}
    >
      {/* Left workspace */}
      <div style={{ flex: 1, position: "relative", overflow: "hidden" }}>
        {/* Header (2 rows): Row1 title+switcher, Row2 actions+undo/redo */}
        <div
          style={{
            position: "absolute",
            top: 0,
            left: 0,
            right: 0,
            padding: "8px 12px",
            background: "#ffffffdd",
            backdropFilter: "blur(6px)",
            borderBottom: "1px solid #e5e7eb",
            zIndex: 12,
            boxSizing: "border-box",
          }}
        >
          {/* Row 1 */}
          <div
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              marginBottom: 6,
            }}
          >
            {/* Title ONLY — refined ring + sheen + deeper shadow */}
            <div
              style={{
                padding: 2,
                borderRadius: 16,
                background:
                  "conic-gradient(from 140deg, #e5e7eb, #cbd5e1, #e2e8f0, #e5e7eb)",
              }}
            >
              <div
                style={{
                  position: "relative",
                  display: "inline-flex",
                  alignItems: "center",
                  padding: "12px 20px",
                  borderRadius: 14,
                  background: "linear-gradient(180deg,#f8fafc,#eef2f7)",
                  boxShadow:
                    "0 22px 38px rgba(15,23,42,0.18), 0 3px 8px rgba(0,0,0,0.08), inset 0 1px 0 rgba(255,255,255,0.85)",
                }}
              >
                {/* soft top sheen */}
                <div
                  style={{
                    position: "absolute",
                    top: 0,
                    left: 8,
                    right: 8,
                    height: "48%",
                    borderRadius: 12,
                    background: "linear-gradient(180deg, rgba(255,255,255,0.65), rgba(255,255,255,0))",
                    pointerEvents: "none",
                  }}
                />
                <span
                  style={{
                    fontWeight: 800,
                    fontSize: 16,
                    letterSpacing: 0.25,
                    color: "#334155",
                  }}
                >
                  FlowChat Designer: A No-Code AI Chatbot Builder
                </span>
              </div>
            </div>

            {/* Flow Switcher (right) */}
            <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
              <select
                value={selectedFlowId || ""}
                onChange={(e) => setSelectedFlowId(e.target.value)}
                style={{
                  height: 30,
                  padding: "0 10px",
                  borderRadius: 8,
                  border: `1px solid ${activeSelected ? "#16a34a" : "#e5e7eb"}`,
                  background: "#fff",
                  outline: "none",
                }}
              >
                {flowsMeta.length === 0 && <option value="">No flows</option>}
                {flowsMeta.map((f) => (
                  <option key={f.id} value={f.id}>
                    {f.name}
                  </option>
                ))}
              </select>

              {selectedFlowId && (
                <span
                  style={{
                    padding: "2px 8px",
                    height: 26,
                    display: "inline-flex",
                    alignItems: "center",
                    borderRadius: 999,
                    border: `1px solid ${activeSelected ? "#16a34a22" : "#6b728022"}`,
                    background: activeSelected ? "#16a34a11" : "#6b728011",
                    color: activeSelected ? "#16a34a" : "#6b7280",
                    fontWeight: 600,
                    fontSize: 12,
                  }}
                >
                  {activeSelected ? "Active" : "Not loaded"}
                </span>
              )}

              <button
                style={btnGrad("#0ea5e9", "#0284c7")}
                disabled={!selectedFlowId || activeSelected}
                onClick={() => selectedFlowId && loadFlowById(selectedFlowId)}
              >
                {activeSelected ? "Loaded" : "Load"}
              </button>

              <button
                style={btnGrad("#f59e0b", "#d97706")}
                onClick={() => selectedFlowId && renameFlowById(selectedFlowId)}
              >
                Rename
              </button>
              <button
                style={btnGrad("#ef4444", "#dc2626")}
                onClick={() => selectedFlowId && deleteFlowById(selectedFlowId)}
              >
                Delete
              </button>
            </div>
          </div>

          {/* Row 2 */}
          <div
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
            }}
          >
            {/* Actions (left) */}
            <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
              <button
                style={btnGrad("#4f46e5", "#4338ca")}
                onClick={() => {
                  const newId = nodeCounter.toString();
                  nodeCounter++;
                  const position = selectedNodeId
                    ? {
                        x: nodes.find((n) => n.id === selectedNodeId).position.x + 220,
                        y: nodes.find((n) => n.id === selectedNodeId).position.y + 50,
                      }
                    : { x: Math.random() * 400, y: Math.random() * 400 };
                  const newNode = {
                    id: newId,
                    data: {
                      message: `This is node ${newId}`,
                      type: "choice",
                      options: {},
                      capture: "",
                      next: "",
                    },
                    position,
                    type: "default",
                  };
                  const updatedNodes = [...nodes, newNode];
                  setNodes(updatedNodes);
                  pushToHistory(updatedNodes, manualEdges);
                }}
              >
                Add Node
              </button>

              <button
                style={btnGrad("#14b8a6", "#0d9488")}
                onClick={() => {
                  const blob = new Blob([JSON.stringify(getExportJSON(), null, 2)], {
                    type: "application/json",
                  });
                  const url = URL.createObjectURL(blob);
                  const link = document.createElement("a");
                  link.href = url;
                  link.download = "conversation_data.json";
                  document.body.appendChild(link);
                  link.click();
                  document.body.removeChild(link);
                }}
              >
                Export JSON
              </button>

              <button
                style={btnGrad("#ef4444", "#dc2626")}
                onClick={() => {
                  if (!selectedNodeId) return;

                  const deletedId = selectedNodeId;

                  const updatedNodesBase = nodes.filter((n) => n.id !== deletedId);
                  const updatedEdges = manualEdges.filter(
                    (e) => e.source !== deletedId && e.target !== deletedId
                  );

                  const updatedNodes = updatedNodesBase.map((n) => {
                    const data = { ...n.data };
                    let mutated = false;

                    if (data.next === deletedId) {
                      data.next = "";
                      mutated = true;
                    }
                    if (data.options && Object.keys(data.options).length) {
                      const opts = { ...data.options };
                      for (const [k, v] of Object.entries(opts)) {
                        if (v === deletedId) delete opts[k];
                      }
                      if (Object.keys(opts).length !== Object.keys(data.options).length) {
                        data.options = opts;
                        mutated = true;
                      }
                    }
                    return mutated ? { ...n, data } : n;
                  });

                  setNodes(updatedNodes);
                  setEdges(updatedEdges);
                  setSelectedNodeId(null);
                  pushToHistory(updatedNodes, updatedEdges);
                }}
              >
                Delete Node
              </button>

              <button style={btnGrad("#10b981", "#059669")} onClick={submitFlow}>
                Submit Flow
              </button>
              <button style={btnGrad("#0ea5e9", "#0284c7")} onClick={saveCurrentFlow}>
                Save Flow
              </button>
              <button style={btnGrad("#64748b", "#475569")} onClick={createNewFlow}>
                New Flow
              </button>
            </div>

            {/* Undo/Redo (right) — icon-only with labels above */}
            <div style={{ display: "flex", gap: 12, alignItems: "flex-end" }}>
              <div style={{ display: "flex", flexDirection: "column", alignItems: "center" }}>
                <span style={{ fontSize: 11, color: "#64748b", marginBottom: 4 }}>Undo</span>
                <button
                  aria-label="Undo"
                  title="Undo"
                  style={iconCircleGrad("#8b5cf6", "#7c3aed")}
                  onClick={undo}
                >
                  ↺
                </button>
              </div>
              <div style={{ display: "flex", flexDirection: "column", alignItems: "center" }}>
                <span style={{ fontSize: 11, color: "#64748b", marginBottom: 4 }}>Redo</span>
                <button
                  aria-label="Redo"
                  title="Redo"
                  style={iconCircleGrad("#f59e0b", "#d97706")}
                  onClick={redo}
                >
                  ↻
                </button>
              </div>
            </div>
          </div>
        </div>

        {/* Inspector column — spacing below header */}
        <div
          style={{
            position: "absolute",
            top: 120,
            left: 10,
            bottom: 10,
            width: 350,
            boxSizing: "border-box",
            overflowY: "auto",
            overflowX: "hidden",
            paddingRight: 28,
            paddingLeft: 4,
            scrollbarGutter: "stable both-edges",
            display: "flex",
            flexDirection: "column",
            gap: 12,
            zIndex: 11,
          }}
        >
          <PromptEditor
            promptSettings={promptSettings}
            setPromptSettings={setPromptSettings}
            containerStyle={cardStyle}
          />

          {selectedNode && (
            <div style={cardStyle}>
              <h4 style={{ marginTop: 0 }}>Editing Node: {selectedNode.id}</h4>
              <label>Message:</label>
              <textarea
                value={selectedNode.data.message}
                onChange={(e) => {
                  const updatedNodes = nodes.map((node) =>
                    node.id === selectedNodeId
                      ? { ...node, data: { ...node.data, message: e.target.value } }
                      : node
                  );
                  setNodes(updatedNodes);
                  pushToHistory(updatedNodes, manualEdges);
                }}
                style={{ width: "100%", boxSizing: "border-box", height: 60 }}
              />
              <label>Type:</label>
              <select
                value={selectedNode.data.type}
                onChange={(e) => {
                  const newType = e.target.value;
                  const updatedNodes = nodes.map((node) => {
                    if (node.id !== selectedNodeId) return node;
                    const nd = { ...node, data: { ...node.data, type: newType } };
                    if (newType !== "choice" && newType !== "multi_choice") {
                      nd.data.options = {};
                    }
                    return nd;
                  });
                  setNodes(updatedNodes);
                  pushToHistory(updatedNodes, manualEdges);
                }}
                style={{ width: "100%", boxSizing: "border-box" }}
              >
                <option value="choice">choice</option>
                <option value="input">input</option>
                <option value="multi_choice">multi_choice</option>
                <option value="gpt">gpt</option>
                <option value="end">end</option>
              </select>
              <label>Capture Field:</label>
              <input
                type="text"
                value={selectedNode.data.capture}
                onChange={(e) => {
                  const updatedNodes = nodes.map((node) =>
                    node.id === selectedNodeId
                      ? { ...node, data: { ...node.data, capture: e.target.value } }
                      : node
                  );
                  setNodes(updatedNodes);
                  pushToHistory(updatedNodes, manualEdges);
                }}
                style={{ width: "100%", boxSizing: "border-box" }}
              />
              <label>Next Node ID:</label>
              <input
                type="text"
                value={selectedNode.data.next}
                onChange={(e) => {
                  const updatedNodes = nodes.map((node) =>
                    node.id === selectedNodeId
                      ? { ...node, data: { ...node.data, next: e.target.value } }
                      : node
                  );
                  setNodes(updatedNodes);
                  pushToHistory(updatedNodes, manualEdges);
                }}
                style={{ width: "100%", boxSizing: "border-box" }}
              />
            </div>
          )}

          {selectedEdge && (
            <div style={cardStyle}>
              <h4 style={{ marginTop: 0 }}>Editing Edge</h4>
              <label>Option Label:</label>
              <input
                type="text"
                value={selectedEdge.label}
                onChange={(e) => {
                  const newLabel = e.target.value;
                  const updatedEdges = manualEdges.map((edge) =>
                    edge.id === selectedEdge.id ? { ...edge, label: newLabel } : edge
                  );
                  const sourceId = selectedEdge.source;
                  const targetId = selectedEdge.target;
                  const updatedNodes = nodes.map((node) => {
                    if (node.id === sourceId) {
                      const updated = { ...node };
                      if (updated.data.type === "choice" || updated.data.type === "multi_choice") {
                        const newOptions = { ...updated.data.options };
                        delete newOptions[selectedEdge.label];
                        newOptions[newLabel] = targetId;
                        updated.data.options = newOptions;
                      } else {
                        updated.data.next = targetId;
                      }
                      return updated;
                    }
                    return node;
                  });
                  setEdges(updatedEdges);
                  setNodes(updatedNodes);
                  pushToHistory(updatedNodes, updatedEdges);
                }}
                style={{ width: "100%", boxSizing: "border-box" }}
              />
            </div>
          )}
        </div>

        {/* Flow canvas */}
        <ReactFlow
          nodes={nodes.map((n) => ({
            ...n,
            data: { ...n.data, label: n.data.message },
            style: getNodeStyle(n.data.type),
          }))}
          edges={allEdges}
          onNodesChange={onNodesChange}
          onEdgesChange={handleEdgesChange}
          onConnect={(params) => {
            const sourceNode = nodes.find(n => n.id === params.source);
            let label = "";
            if (sourceNode && (sourceNode.data.type === "choice" || sourceNode.data.type === "multi_choice")) {
              label = window.prompt("Enter option key for this connection:", "") || "";
              if (!label) return;
            }
            const edgeId = `e${params.source}-${params.target}`;
            
            const updatedEdges = addEdge(
              { ...params, id: edgeId, markerEnd: { type: MarkerType.ArrowClosed }, label },
              manualEdges
            );
            const updatedNodes = nodes.map((node) => {
              if (node.id === params.source) {
                const updated = { ...node };
                if (updated.data.type === "choice" || updated.data.type === "multi_choice") {
                  updated.data.options = { ...updated.data.options, [label]: params.target };
                } else {
                  updated.data.next = params.target;
                }
                return updated;
              }
              return node;
            });
            setEdges(updatedEdges);
            setNodes(updatedNodes);
            pushToHistory(updatedNodes, updatedEdges);
          }}
          onNodeClick={(_, node) => {
            setSelectedNodeId(node.id);
            setSelectedEdgeId(null);
          }}
          onEdgeClick={(_, edge) => {
            setSelectedEdgeId(edge.id);
            setSelectedNodeId(null);
          }}
          fitView
          edgeLabelMode="always"
        >
          <MiniMap />
          <Controls />
          <Background />
        </ReactFlow>
      </div>

      {/* Right Chat Panel */}
      <div
        style={{
          width: 320,
          margin: 10,
          padding: 12,
          background: "#fff7ed",
          border: "1px solid #f59e0b",
          borderRadius: 10,
          boxShadow: "0 2px 6px rgba(0,0,0,0.08)",
          display: "flex",
          flexDirection: "column",
          height: "calc(100vh - 20px)",
          boxSizing: "border-box",
          overflow: "hidden",
        }}
      >
        <div
          style={{
            fontWeight: "bold",
            marginBottom: 8,
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            flexShrink: 0,
          }}
        >
          <span>Chat Assistant</span>
          {chatbotReady && (
            <button
              onClick={() => {
                const textContent = chatHistory
                  .map((entry) => `${entry.sender === "user" ? "You" : "MindPeace"}: ${entry.message}`)
                  .join("\n\n");
                const blob = new Blob([textContent], { type: "text/plain" });
                const url = URL.createObjectURL(blob);
                const link = document.createElement("a");
                link.href = url;
                link.download = "chat_history.txt";
                document.body.appendChild(link);
                link.click();
                document.body.removeChild(link);
              }}
              style={btnGrad("#6366f1", "#4f46e5")}
            >
              Export
            </button>
          )}
        </div>

        <div
          style={{
            flex: 1,
            overflowY: "auto",
            overflowX: "hidden",
            paddingRight: 6,
            paddingLeft: 2,
            paddingTop: 2,
            background: "transparent",
            borderRadius: 8,
          }}
          ref={chatScrollRef}  //  attach scroll ref
        >
          {chatbotReady ? (
            <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
              {chatHistory.map((entry, index) => (
                <div
                  key={index}
                  style={{
                    alignSelf: entry.sender === "user" ? "flex-end" : "flex-start",
                    background: entry.sender === "user" ? "#e0f2fe" : "#fde68a",
                    padding: 8,
                    borderRadius: 6,
                    maxWidth: "90%",
                    boxSizing: "border-box",
                    overflowWrap: "anywhere",
                  }}
                >
                  {entry.message}
                </div>
              ))}
              {isTyping && <TypingIndicator />} {/* ✅ three moving dots */}
            </div>
          ) : (
            <div style={{ opacity: 0.8 }}>Please submit your flow to activate the chatbot.</div>
          )}
        </div>

        {chatbotReady && (
          <div style={{ flexShrink: 0, paddingTop: 8, background: "transparent" }}>
            {renderChatInput()}
          </div>
        )}
      </div>
    </div>
  );
}

/* ===== Typing Indicator component ===== */
function TypingIndicator() {
  return (
    <>
      <style>{`
        @keyframes dotPulse {
          0% { opacity: .2; transform: translateY(0); }
          50% { opacity: 1; transform: translateY(-2px); }
          100% { opacity: .2; transform: translateY(0); }
        }
        .dot {
          display: inline-block;
          width: 6px;
          height: 6px;
          margin: 0 2px;
          border-radius: 50%;
          background: #92400e;
          animation: dotPulse 1s infinite ease-in-out;
        }
        .dot:nth-child(2) { animation-delay: .15s; }
        .dot:nth-child(3) { animation-delay: .3s; }
      `}</style>
      <div
        style={{
          alignSelf: "flex-start",
          background: "#fde68a",
          padding: 8,
          borderRadius: 6,
          maxWidth: "90%",
          boxSizing: "border-box",
        }}
      >
        <span className="dot" /> <span className="dot" /> <span className="dot" />
      </div>
    </>
  );
}

/* helper styles — gradients + compact sizes */
function btnGrad(from, to) {
  return {
    background: `linear-gradient(180deg, ${from}, ${to})`,
    color: "white",
    height: 30,
    padding: "0 12px",
    borderRadius: 8,
    border: "1px solid rgba(0,0,0,0.06)",  // ✅ fixed quotes
    cursor: "pointer",
    fontWeight: 600,
    fontSize: 13,
    boxShadow: "0 3px 8px rgba(0,0,0,0.08)",
  };
}
function iconCircleGrad(from, to) {
  return {
    background: `linear-gradient(180deg, ${from}, ${to})`,
    color: "white",
    width: 28,
    height: 28,
    borderRadius: 999,
    border: "1px solid rgba(0,0,0,0.06)",  // ✅ fixed quotes
    cursor: "pointer",
    fontWeight: 700,
    fontSize: 16,
    lineHeight: "28px",
    textAlign: "center",
    boxShadow: "0 3px 8px rgba(0,0,0,0.08)",
  };
}

