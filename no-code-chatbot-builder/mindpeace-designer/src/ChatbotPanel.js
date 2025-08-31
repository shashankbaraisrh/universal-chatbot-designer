import React, { useEffect, useRef } from "react";

export default function ChatbotPanel({
  chatbotReady,
  chatHistory,
  inputValue,
  currentNodeId,
  submittedFlow,
  setChatHistory,
  setInputValue,
  handleUserResponse,
  handleGPTContinuation
}) {
  const currentNode = submittedFlow?.nodes?.[currentNodeId];

  const isChoiceNode =
    currentNode &&
    (currentNode.type === "choice" || currentNode.type === "multi_choice");

  const isGptDone =
    currentNode?.type === "gpt" || currentNodeId === "__gpt_continuation__";

  const onSend = () => {
    const trimmed = inputValue.trim();
    if (!trimmed) return;
    if (currentNodeId === "__gpt_continuation__") {
      handleGPTContinuation(trimmed);
    } else {
      handleUserResponse(trimmed);
    }
    setInputValue("");
  };

  const onChoiceClick = (option) => {
    handleUserResponse(option);
  };

  const chatEndRef = useRef(null);
  useEffect(() => {
    if (chatEndRef.current) {
      chatEndRef.current.scrollIntoView({ behavior: "smooth" });
    }
  }, [chatHistory]);

  return (
    <div
      style={{
        width: "320px",
        borderLeft: "1px solid #ddd",
        display: "flex",
        flexDirection: "column",
        background: "#f0f2f5",
        fontFamily: "Segoe UI, sans-serif"
      }}
    >
      <div
        style={{
          padding: "14px",
          fontWeight: "bold",
          background: "#075e54",
          color: "white",
          fontSize: "18px",
          borderBottom: "1px solid #ccc"
        }}
      >
        💬 MindPeace Assistant
      </div>

      <div
        style={{
          flex: 1,
          padding: "10px",
          overflowY: "auto",
          display: "flex",
          flexDirection: "column",
          gap: "10px"
        }}
      >
        {chatHistory.map((msg, index) => (
          <div
            key={index}
            style={{
              alignSelf: msg.sender === "user" ? "flex-end" : "flex-start",
              backgroundColor: msg.sender === "user" ? "#d9fdd3" : "#ffffff",
              color: "#111",
              borderRadius: "16px",
              padding: "10px 14px",
              maxWidth: "80%",
              boxShadow: "0 1px 3px rgba(0,0,0,0.1)",
              wordBreak: "break-word"
            }}
          >
            {msg.message}
          </div>
        ))}

        {/* Render choice buttons */}
        {chatbotReady &&
          isChoiceNode &&
          Object.entries(currentNode.options || {}).map(([key]) => (
            <button
              key={key}
              onClick={() => onChoiceClick(key)}
              style={{
                alignSelf: "flex-start",
                backgroundColor: "#e0f7fa",
                border: "1px solid #26c6da",
                borderRadius: "12px",
                padding: "8px 14px",
                marginTop: "4px",
                cursor: "pointer",
                fontWeight: "500"
              }}
            >
              {key}
            </button>
          ))}

        <div ref={chatEndRef} />
      </div>

      {/* Input box for text */}
      {chatbotReady && (!isChoiceNode || isGptDone) && (
        <div
          style={{
            padding: "10px",
            borderTop: "1px solid #ccc",
            display: "flex",
            gap: "10px",
            background: "#fff"
          }}
        >
          <input
            type="text"
            value={inputValue}
            onChange={(e) => setInputValue(e.target.value)}
            placeholder="Type your message..."
            style={{
              flex: 1,
              padding: "10px",
              borderRadius: "20px",
              border: "1px solid #ccc",
              outline: "none",
              fontSize: "14px"
            }}
            onKeyDown={(e) => e.key === "Enter" && onSend()}
          />
          <button
            onClick={onSend}
            style={{
              background: "#25D366",
              color: "white",
              padding: "10px 16px",
              borderRadius: "20px",
              border: "none",
              cursor: "pointer",
              fontWeight: "bold"
            }}
          >
            Send
          </button>
        </div>
      )}
    </div>
  );
}
