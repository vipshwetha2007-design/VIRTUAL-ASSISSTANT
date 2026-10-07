const chat = document.getElementById("chat");
const form = document.getElementById("command-form");
const input = document.getElementById("command-input");
const mic = document.getElementById("microphone");
const listenLabel = document.getElementById("listen-label");
const status = document.getElementById("assistant-status");
const headerStatus = document.getElementById("header-status");
const intentValue = document.getElementById("intent-value");
const confidenceValue = document.getElementById("confidence-value");
const modelValue = document.getElementById("model-value");
const browserTtsAvailable = "speechSynthesis" in window && "SpeechSynthesisUtterance" in window;

function timestamp() { return new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }); }
function addMessage(role, text) {
  const item = document.createElement("div");
  item.className = `message ${role}`;
  const avatar = role === "assistant" ? "VM" : "You";
  item.innerHTML = `<div class="avatar">${avatar}</div><div class="bubble"></div><time>${timestamp()}</time>`;
  item.querySelector(".bubble").textContent = text;
  chat.appendChild(item);
  chat.scrollTop = chat.scrollHeight;
}
function addActionLink(url, label = "Open link manually") {
  const link = document.createElement("a");
  link.className = "action-link";
  link.href = url;
  link.target = "_blank";
  link.rel = "noopener";
  link.textContent = label;
  chat.appendChild(link);
  chat.scrollTop = chat.scrollHeight;
}
function setStatus(text, busy = false) {
  status.textContent = text;
  headerStatus.textContent = busy ? "Online · Processing" : "Online · Ready";
}
function showTyping() {
  const node = document.getElementById("typing-template").content.cloneNode(true);
  chat.appendChild(node);
  chat.scrollTop = chat.scrollHeight;
}
function removeTyping() { const node = chat.querySelector(".typing"); if (node) node.remove(); }

function speakResponse(text) {
  if (!browserTtsAvailable || !text) return false;
  try {
    window.speechSynthesis.cancel();
    const utterance = new SpeechSynthesisUtterance(text);
    utterance.lang = "en-US";
    utterance.onerror = (event) => console.error("Browser speech output failed:", event.error);
    window.speechSynthesis.speak(utterance);
    return true;
  } catch (error) {
    console.error("Browser speech output failed:", error);
    return false;
  }
}

function urlForBrowserCommand(command) {
  const normalized = command.trim().toLowerCase();
  if (normalized.includes("youtube") && !normalized.startsWith("search")) return "https://www.youtube.com/";
  if (normalized.startsWith("play ")) {
    const song = command.replace(/.*\bplay\s+/i, "").replace(/^some\s+/i, "").trim() || "music";
    return `https://www.youtube.com/results?search_query=${encodeURIComponent(song)}`;
  }
  if (normalized.includes("google") && !normalized.startsWith("search")) return "https://www.google.com/";
  if (normalized.startsWith("search ") || normalized.startsWith("google search") || normalized.startsWith("look up ")) {
    const query = command.replace(/^(google\s+search\s+for|search\s+google\s+for|search\s+for|search|look\s+up)\s*/i, "").trim();
    return query ? `https://www.google.com/search?q=${encodeURIComponent(query)}` : null;
  }
  return null;
}

function isSafeActionUrl(url) {
  try {
    const parsed = new URL(url);
    return parsed.protocol === "https:" && ["www.youtube.com", "youtube.com", "www.google.com", "google.com"].includes(parsed.hostname);
  } catch (_) {
    return false;
  }
}

function openBrowserAction(url, actionWindow = null) {
  if (!isSafeActionUrl(url)) {
    console.error("Blocked unsafe browser action URL:", url);
    if (actionWindow && !actionWindow.closed) actionWindow.close();
    return false;
  }
  if (actionWindow && !actionWindow.closed) {
    actionWindow.location.href = url;
    return true;
  } else {
    return Boolean(window.open(url, "_blank"));
  }
}

async function sendCommand(command, reminder = "", actionWindow = null) {
  const cleanCommand = command.trim();
  if (!cleanCommand) return;
  console.log("Command sent:", cleanCommand);
  addMessage("user", cleanCommand);
  input.value = "";
  setStatus("Processing...", true);
  showTyping();
  try {
    const response = await fetch("/api/command", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ command: cleanCommand, reminder, browser_tts: browserTtsAvailable })
    });
    const data = await response.json();
    removeTyping();
    if (!response.ok) throw new Error(data.error || "The command could not be processed.");

    intentValue.textContent = data.intent.replaceAll("_", " ");
    confidenceValue.textContent = data.confidence ? `${data.confidence}%` : "—";
    modelValue.textContent = data.model;
    const message = data.response || data.message;
    addMessage("assistant", message);

    if (data.success && data.action === "open_url" && data.url) {
      const opened = openBrowserAction(data.url, actionWindow);
      if (!opened) {
        addMessage("assistant", "Please allow pop-ups for this site, then try again or use the link below.");
        addActionLink(data.url, "Open requested page");
      }
    } else if (actionWindow && !actionWindow.closed) {
      actionWindow.close();
    }
    if (!data.success && data.action_url && isSafeActionUrl(data.action_url)) addActionLink(data.action_url);

    if (!speakResponse(message) && !data.voice_output_available && data.voice_notice) {
      addMessage("assistant", data.voice_notice);
    }
    if (data.needs_reminder) {
      const note = window.prompt("What should Voice Mate remind you about?");
      if (note && note.trim()) sendCommand(cleanCommand, note.trim());
    }
    setStatus(data.keep_running ? "Ready" : "Goodbye");
  } catch (error) {
    removeTyping();
    if (actionWindow && !actionWindow.closed) actionWindow.close();
    console.error("Voice Mate command request failed:", error);
    const message = error.message || "Something went wrong. Please try again.";
    addMessage("assistant", message);
    speakResponse(message);
    setStatus("Ready");
  }
}

form.addEventListener("submit", (event) => {
  event.preventDefault();
  const command = input.value;
  sendCommand(command);
});
document.getElementById("clear-chat").addEventListener("click", () => {
  chat.innerHTML = "";
  intentValue.textContent = "Waiting";
  confidenceValue.textContent = "—";
  input.focus();
});
document.querySelectorAll("[data-command]").forEach((button) => {
  button.addEventListener("click", () => {
    const command = button.dataset.command;
    // This runs inside the button click so browsers do not block YouTube, Google,
    // music, or search actions while the Flask request is in progress.
    const url = urlForBrowserCommand(command);
    const actionWindow = url && isSafeActionUrl(url) ? window.open(url, "_blank") : null;
    sendCommand(command, "", actionWindow);
  });
});

const Recognition = window.SpeechRecognition || window.webkitSpeechRecognition;

let recognitionErrorShown = false;
let recognition = null;

function showVoiceError(message) {
  console.error(message);

  if (!recognitionErrorShown) {
    addMessage("assistant", message);
    recognitionErrorShown = true;
  }

  listenLabel.textContent = message;
  setStatus("Ready");
}

if (!Recognition) {

  listenLabel.textContent =
    "Voice recognition requires Chrome or Edge. You can type commands.";

  mic.addEventListener("click", () => {
    showVoiceError(
      "Voice recognition is not supported in this browser."
    );
  });

} else {

  recognition = new Recognition();

  recognition.lang = "en-IN";
  recognition.continuous = false;
  recognition.interimResults = true;
  recognition.maxAlternatives = 1;

  mic.addEventListener("click", async () => {

    recognitionErrorShown = false;

    try {

      // Force browser to request/check microphone access
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: true
      });

      console.log("Microphone access successful");

      // We only use this stream to verify microphone access.
      stream.getTracks().forEach(track => track.stop());

      recognition.start();

    } catch (error) {

      console.error("Microphone error:", error);

      showVoiceError(
        "Could not access the microphone. Check your microphone settings."
      );
    }
  });

  recognition.onstart = () => {

    console.log("Speech recognition started");

    mic.classList.add("listening");

    listenLabel.textContent = "Listening... Speak now";

    setStatus("Listening...", true);
  };

  recognition.onspeechstart = () => {

    console.log("Speech detected");

    listenLabel.textContent = "I can hear you...";
  };

  recognition.onspeechend = () => {

    console.log("Speech ended");

    listenLabel.textContent = "Processing...";
  };

  recognition.onresult = (event) => {

    let heard = "";

    for (let i = event.resultIndex; i < event.results.length; i++) {

      heard += event.results[i][0].transcript;

    }

    heard = heard.trim();

    console.log("Recognized:", heard);

    if (!heard) return;

    input.value = heard;

    // IMPORTANT:
    // Voice command goes through the SAME function
    // as typed commands.
    sendCommand(heard);
  };

  recognition.onerror = (event) => {

    console.error("Speech recognition error:", event.error);

    if (event.error === "no-speech") {

      showVoiceError(
        "I couldn't hear anything. Click the microphone and speak immediately."
      );

    } else if (
      event.error === "not-allowed" ||
      event.error === "service-not-allowed"
    ) {

      showVoiceError(
        "Microphone permission is blocked. Please allow microphone access."
      );

    } else if (event.error === "audio-capture") {

      showVoiceError(
        "No working microphone was detected."
      );

    } else {

      showVoiceError(
        `Voice recognition error: ${event.error}`
      );
    }
  };

  recognition.onend = () => {

    console.log("Speech recognition ended");

    mic.classList.remove("listening");

    if (!recognitionErrorShown) {
      listenLabel.textContent = "Tap to speak";
    }

    setStatus("Ready");
  };
}