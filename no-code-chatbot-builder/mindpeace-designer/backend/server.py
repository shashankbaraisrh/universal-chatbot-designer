# server.py
from flask import Flask, request, jsonify
from flask_cors import CORS
import time
from random import uniform
import traceback
import openai
from openai.error import Timeout as OpenAITimeout, APIConnectionError, ServiceUnavailableError, RateLimitError

# ===== CONFIG =====

openai.api_key = "sk-use_your_api_key_L7smLvQmu6iYJPROTLcs8_kmLiwLkanKxLO9sKdT3BlbkFJajruneST0eQT-oO9Ri5ZL_q5u9SWFMYOShM4yX_qZlqHGkylJSM7AAvfLKZdSz-aE9-PcAVYAA"  # <--- put your key here

app = Flask(__name__)
CORS(app, resources={r"/*": {"origins": ["http://localhost:3000", "http://127.0.0.1:3000"]}})

conversation_data = None
chat_history = []
user_inputs = {}

# Helper for GPT with retries 
def call_openai_with_retry(model, messages, temperature=0.8, request_timeout=30, max_retries=3):
    attempt = 0
    while True:
        try:
            return openai.ChatCompletion.create(
                model=model,
                messages=messages,
                temperature=temperature,
                request_timeout=request_timeout
            )
        except (OpenAITimeout, APIConnectionError, ServiceUnavailableError) as e:
            attempt += 1
            if attempt > max_retries:
                raise
            sleep_s = min(2 ** attempt, 8) + uniform(0, 0.5)
            print(f"⚠️ GPT error {type(e).__name__}, retry {attempt}/{max_retries} in {sleep_s:.1f}s")
            time.sleep(sleep_s)
        except RateLimitError as e:
            attempt += 1
            if attempt > max_retries:
                raise
            sleep_s = 3 + uniform(0, 0.5)
            print(f"⚠️ Rate limit hit, retry {attempt}/{max_retries} in {sleep_s:.1f}s")
            time.sleep(sleep_s)

# ===== Flow validation =====
def validate_flow_payload(flow):
    if not isinstance(flow, dict):
        return "Invalid JSON."
    if "settings" not in flow or "nodes" not in flow:
        return "Missing 'settings' or 'nodes'."
    if "system_prompt" not in flow["settings"] or "gpt_model" not in flow["settings"]:
        return "Missing 'system_prompt' or 'gpt_model' in settings."
    if "1" not in flow["nodes"]:
        return "Start node '1' is missing."
    return None

# ===== Routes =====
@app.route("/health", methods=["GET"])
def health():
    return jsonify({"status": "ok"}), 200

@app.route("/submit", methods=["POST"])
def submit_flow():
    global conversation_data, chat_history, user_inputs
    try:
        data = request.get_json(silent=True) or {}
        err = validate_flow_payload(data)
        if err:
            return jsonify({"error": "invalid_flow", "detail": err}), 400

        conversation_data = data
        chat_history = []
        user_inputs = {}
        print("✅ Received Flow JSON")
        return jsonify({"status": "success"}), 200
    except Exception as e:
        traceback.print_exc()
        return jsonify({"error": "submit_failed"}), 500

@app.route("/chat", methods=["POST"])
def chat():
    global conversation_data, chat_history, user_inputs
    try:
        if conversation_data is None:
            return jsonify({"error": "no_flow_submitted"}), 400

        data = request.get_json(silent=True) or {}
        system_prompt = data.get("system_prompt", conversation_data["settings"].get("system_prompt", "You are a helpful assistant."))
        gpt_model = data.get("gpt_model", conversation_data["settings"].get("gpt_model", "gpt-3.5-turbo"))
        client_history = data.get("chat_history", [])
        user_inputs = data.get("user_inputs", user_inputs) or {}

        safe_history = []
        for m in client_history:
            if isinstance(m, dict) and "role" in m and "content" in m:
                if m["role"] in ("user", "assistant", "system"):
                    safe_history.append({"role": m["role"], "content": str(m["content"])[:8000]})

        if len(safe_history) > 20:
            safe_history = safe_history[-20:]

        messages = [{"role": "system", "content": system_prompt}] + safe_history

        response = call_openai_with_retry(
            model=gpt_model,
            messages=messages,
            temperature=0.8,
            request_timeout=30,
            max_retries=3
        )

        reply = response.choices[0].message["content"]
        chat_history.append({"role": "assistant", "content": reply})
        return jsonify({"reply": reply}), 200

    except OpenAITimeout:
        return jsonify({"error": "timeout"}), 504
    except (APIConnectionError, ServiceUnavailableError):
        return jsonify({"error": "upstream_unavailable"}), 503
    except RateLimitError:
        return jsonify({"error": "rate_limited"}), 429
    except Exception as e:
        traceback.print_exc()
        return jsonify({"error": "server_error"}), 500

if __name__ == "__main__":
    app.run(host="127.0.0.1", port=5000, debug=True)
