import React from "react";

export default function PromptEditor({
  promptSettings,
  setPromptSettings,
  containerStyle = {},
}) {
  const { system_prompt, gpt_model } = promptSettings;

  return (
    <div style={{ ...containerStyle }}>
      <h4 style={{ marginTop: 0 }}>Prompt Editor</h4>

      <label>System Prompt:</label>
      <textarea
        value={system_prompt}
        onChange={(e) =>
          setPromptSettings((prev) => ({
            ...prev,
            system_prompt: e.target.value,
          }))
        }
        style={{ width: "100%", height: 120, boxSizing: "border-box" }}
      />

      <label>Model:</label>
      <select
        value={gpt_model}
        onChange={(e) =>
          setPromptSettings((prev) => ({ ...prev, gpt_model: e.target.value }))
        }
        style={{ width: "100%", boxSizing: "border-box", marginBottom: 10 }}
      >
        <option value="gpt-3.5-turbo">gpt-3.5-turbo</option>
        <option value="gpt-4o">gpt-4o</option>
        <option value="gpt-4o-mini">gpt-4o-mini</option>
      </select>

      <div style={{ display: "flex", gap: 8 }}>
        <button
          onClick={() =>
            alert("Saved. Changes will apply on Export / Submit Flow.")
          }
          style={{
            background: "#10b981",
            color: "white",
            border: "none",
            borderRadius: 6,
            padding: "6px 12px",
            cursor: "pointer",
          }}
        >
          Save
        </button>
        <button
          onClick={() =>
            setPromptSettings({
              system_prompt:
                "You are MindPeace, a compassionate mental health assistant. Based on the user's shared info and emotional state, continue the conversation empathetically.",
              gpt_model: "gpt-3.5-turbo",
            })
          }
          style={{
            background: "#ef4444",
            color: "white",
            border: "none",
            borderRadius: 6,
            padding: "6px 12px",
            cursor: "pointer",
          }}
        >
          Reset
        </button>
      </div>

      <div style={{ marginTop: 8, fontSize: 12, color: "#6b7280" }}>
        Changes will be included in Export JSON and used after “Submit Flow”.
      </div>
    </div>
  );
}
