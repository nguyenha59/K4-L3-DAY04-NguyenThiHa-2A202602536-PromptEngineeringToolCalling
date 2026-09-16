from __future__ import annotations

import json
from pathlib import Path
from typing import Any

from flask import Flask, jsonify, request, send_from_directory

from chat import now_iso, run_model_tool_loop, safe_slug, trim_history, write_transcript
from env_loader import load_lab_env
from providers import make_provider
from tools import load_tool_declarations, to_openai_tools
from versioning import artifact_version_dict, build_artifact_version

ROOT = Path(__file__).parent
ARTIFACTS_DIR = ROOT / "artifacts"
STATIC_DIR = ROOT / "ui_static"
TRANSCRIPTS_DIR = ROOT / "transcripts"
load_lab_env(ROOT)

app = Flask(__name__, static_folder=None)

SESSION: dict[str, Any] = {}


def start_session(provider_name: str, version: str, model: str | None, history_window: int, max_tool_rounds: int) -> dict[str, Any]:
    system_prompt_path = ARTIFACTS_DIR / "system_prompt.md"
    tools_path = ARTIFACTS_DIR / "tools.yaml"
    system_prompt = system_prompt_path.read_text(encoding="utf-8")
    tool_declarations = load_tool_declarations(tools_path)
    openai_tools = to_openai_tools(tool_declarations)
    provider = make_provider(provider_name)
    selected_model = model or getattr(provider, "default_model", None)
    artifact_version = build_artifact_version(version, system_prompt_path, tools_path)

    timestamp = now_iso().replace(":", "").replace("-", "")
    transcript_id = "_".join([safe_slug(version), safe_slug(provider_name), "ui", timestamp])
    transcript_path = TRANSCRIPTS_DIR / f"{transcript_id}.transcript.json"
    transcript = {
        "transcript_id": transcript_id,
        **artifact_version_dict(artifact_version),
        "provider": provider_name,
        "model": selected_model,
        "system_prompt": str(system_prompt_path),
        "tools": str(tools_path),
        "history_window": history_window,
        "max_tool_rounds": max_tool_rounds,
        "created_at": now_iso(),
        "updated_at": now_iso(),
        "turns": [],
    }

    SESSION.clear()
    SESSION.update({
        "provider_name": provider_name,
        "provider": provider,
        "model": model,
        "selected_model": selected_model,
        "system_prompt": system_prompt,
        "tools": openai_tools,
        "artifact_version": artifact_version.artifact_version,
        "history_window": history_window,
        "max_tool_rounds": max_tool_rounds,
        "history": [],
        "turn_index": 0,
        "transcript": transcript,
        "transcript_path": transcript_path,
    })
    write_transcript(transcript_path, transcript)
    return session_status()


def extract_display_text(assistant_text: str | None) -> str | None:
    """The starter system prompt asks the model to reply as a JSON envelope
    ({intent, action, reply, evidence_ids}). run_eval only checks tool_calls,
    so it never notices, but a plain-text chat turn (no tool call) then shows
    that raw JSON to the user instead of a normal sentence. Unwrap it here for
    display only; the raw text is still what gets saved to the transcript."""
    if not assistant_text:
        return assistant_text
    try:
        parsed = json.loads(assistant_text)
    except (json.JSONDecodeError, TypeError):
        return assistant_text
    if isinstance(parsed, dict) and isinstance(parsed.get("reply"), str) and parsed["reply"].strip():
        return parsed["reply"]
    return assistant_text


def session_status() -> dict[str, Any]:
    if not SESSION:
        return {"active": False}
    return {
        "active": True,
        "provider": SESSION["provider_name"],
        "model": SESSION["selected_model"],
        "artifact_version": SESSION["artifact_version"],
        "transcript_path": str(SESSION["transcript_path"]),
        "turn_count": SESSION["turn_index"],
    }


@app.get("/")
def index() -> Any:
    return send_from_directory(STATIC_DIR, "index.html")


@app.get("/<path:filename>")
def static_files(filename: str) -> Any:
    return send_from_directory(STATIC_DIR, filename)


@app.get("/api/session")
def get_session() -> Any:
    return jsonify(session_status())


@app.post("/api/session/start")
def post_session_start() -> Any:
    body = request.get_json(force=True) or {}
    provider_name = body.get("provider", "openai")
    version = body.get("version", "v5")
    model = body.get("model") or None
    history_window = int(body.get("history_window", 5))
    max_tool_rounds = int(body.get("max_tool_rounds", 4))
    try:
        status = start_session(provider_name, version, model, history_window, max_tool_rounds)
        return jsonify(status)
    except Exception as exc:
        return jsonify({"active": False, "error": f"{type(exc).__name__}: {exc}"}), 400


@app.post("/api/chat")
def post_chat() -> Any:
    if not SESSION:
        return jsonify({"error": "no_active_session", "message": "Start a session first."}), 400

    body = request.get_json(force=True) or {}
    user_text = (body.get("message") or "").strip()
    if not user_text:
        return jsonify({"error": "empty_message"}), 400

    SESSION["turn_index"] += 1
    turn_index = SESSION["turn_index"]
    history = SESSION["history"]

    messages = [
        {"role": "system", "content": SESSION["system_prompt"]},
        *trim_history(history, SESSION["history_window"]),
        {"role": "user", "content": user_text},
    ]

    turn_record: dict[str, Any] = {
        "turn_index": turn_index,
        "started_at": now_iso(),
        "user": user_text,
        "status": "started",
        "assistant_text": None,
        "rounds": [],
        "tool_events": [],
    }

    try:
        result = run_model_tool_loop(
            provider=SESSION["provider"],
            messages=messages,
            tools=SESSION["tools"],
            model=SESSION["model"],
            max_tool_rounds=SESSION["max_tool_rounds"],
        )
        turn_record.update(result)
        assistant_text = result["assistant_text"]
        history.append({"role": "user", "content": user_text})
        history.append({"role": "assistant", "content": assistant_text})
    except Exception as exc:
        turn_record.update({
            "status": "provider_error",
            "error": f"{type(exc).__name__}: {str(exc)}",
        })

    turn_record["ended_at"] = now_iso()
    SESSION["transcript"]["turns"].append(turn_record)
    write_transcript(SESSION["transcript_path"], SESSION["transcript"])

    response_turn = dict(turn_record)
    response_turn["display_text"] = extract_display_text(turn_record.get("assistant_text"))

    return jsonify({
        "turn": response_turn,
        "artifact_version": SESSION["artifact_version"],
        "transcript_path": str(SESSION["transcript_path"]),
    })


if __name__ == "__main__":
    app.run(host="127.0.0.1", port=5000, debug=False)
