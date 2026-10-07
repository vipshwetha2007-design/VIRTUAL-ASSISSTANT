"""Flask web application for the Voice Mate assistant."""

from flask import Flask, jsonify, render_template, request

from voice_mate import VoiceMateService


app = Flask(__name__)
assistant_service = VoiceMateService()


@app.get("/")
def index():
    """Render the Voice Mate dashboard."""
    return render_template("index.html", model_name=assistant_service.model_name)


@app.get("/api/health")
def health():
    """Provide a lightweight readiness check for the browser interface."""
    return jsonify({"status": "Ready", "model": assistant_service.model_name})


@app.post("/api/command")
def command():
    """Classify and execute one typed or browser-recognized command."""
    payload = request.get_json(silent=True) or {}
    user_command = payload.get("command", "")
    reminder = payload.get("reminder", "")
    browser_tts = payload.get("browser_tts", False)

    if not isinstance(user_command, str) or not user_command.strip():
        return jsonify({"error": "Please type or say a command.", "status": "Ready"}), 400
    if not isinstance(reminder, str):
        return jsonify({"error": "Reminder text must be valid text.", "status": "Ready"}), 400

    print("COMMAND RECEIVED:", user_command)
    prediction = assistant_service.predict_intent_details(user_command)
    intent = prediction["intent"]
    print("PREDICTED INTENT:", intent)
    result = assistant_service.execute_command(intent, user_command, reminder)
    if browser_tts is True:
        voice_available, voice_notice = True, None
    else:
        voice_available, voice_notice = assistant_service.speak_response(result.message)

    return jsonify(
        {
            "success": result.success,
            "response": result.message,
            "message": result.message,
            "intent": prediction["intent"] or "unknown",
            "confidence": round(prediction["confidence"] * 100, 1),
            "model": assistant_service.model_name,
            "status": "Ready",
            "keep_running": result.keep_running,
            "needs_reminder": prediction["intent"] == "set_reminder" and not reminder.strip(),
            "action": "open_url" if result.action_url else "none",
            "action_url": result.action_url,
            "url": result.action_url,
            "voice_output_available": voice_available,
            "voice_notice": voice_notice,
        }
    )


if __name__ == "__main__":
    app.run(host="127.0.0.1", port=5000, debug=False)
