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

const browserTtsAvailable =
  "speechSynthesis" in window &&
  "SpeechSynthesisUtterance" in window;


// ======================================================
// TIME
// ======================================================

function timestamp() {
  return new Date().toLocaleTimeString([], {
    hour: "2-digit",
    minute: "2-digit"
  });
}


// ======================================================
// CHAT MESSAGE
// ======================================================

function addMessage(role, text) {
  const item = document.createElement("div");

  item.className = `message ${role}`;

  const avatar = role === "assistant" ? "VM" : "You";

  item.innerHTML = `
    <div class="avatar">${avatar}</div>
    <div class="bubble"></div>
    <time>${timestamp()}</time>
  `;

  item.querySelector(".bubble").textContent = text;

  chat.appendChild(item);

  chat.scrollTop = chat.scrollHeight;
}


// ======================================================
// MANUAL LINK
// ======================================================

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


// ======================================================
// STATUS
// ======================================================

function setStatus(text, busy = false) {
  status.textContent = text;

  headerStatus.textContent =
    busy
      ? "Online · Processing"
      : "Online · Ready";
}


// ======================================================
// TYPING INDICATOR
// ======================================================

function showTyping() {
  const template =
    document.getElementById("typing-template");

  if (!template) return;

  const node =
    template.content.cloneNode(true);

  chat.appendChild(node);

  chat.scrollTop = chat.scrollHeight;
}


function removeTyping() {
  const node =
    chat.querySelector(".typing");

  if (node) {
    node.remove();
  }
}


// ======================================================
// TEXT TO SPEECH
// ======================================================

function speakResponse(text) {

  if (!browserTtsAvailable || !text) {
    return false;
  }

  try {

    window.speechSynthesis.cancel();

    const utterance =
      new SpeechSynthesisUtterance(text);

    utterance.lang = "en-IN";

    utterance.onerror = (event) => {
      console.error(
        "Browser speech output failed:",
        event.error
      );
    };

    window.speechSynthesis.speak(
      utterance
    );

    return true;

  } catch (error) {

    console.error(
      "Browser speech output failed:",
      error
    );

    return false;
  }
}


// ======================================================
// BROWSER COMMAND URL
// ======================================================

function urlForBrowserCommand(command) {

  const normalized =
    command.trim().toLowerCase();


  // OPEN YOUTUBE

  if (
    normalized.includes("youtube") &&
    !normalized.startsWith("search") &&
    !normalized.startsWith("play ")
  ) {
    return "https://www.youtube.com/";
  }


  // PLAY MUSIC / SONG

  if (normalized.startsWith("play ")) {

    const song =
      command
        .replace(/.*\bplay\s+/i, "")
        .replace(/^some\s+/i, "")
        .trim() || "music";

    return (
      "https://www.youtube.com/results?search_query=" +
      encodeURIComponent(song)
    );
  }


  // OPEN GOOGLE

  if (
    normalized.includes("google") &&
    !normalized.startsWith("search") &&
    !normalized.startsWith("google search")
  ) {
    return "https://www.google.com/";
  }


  // GOOGLE SEARCH

  if (
    normalized.startsWith("search ") ||
    normalized.startsWith("google search") ||
    normalized.startsWith("look up ")
  ) {

    const query =
      command
        .replace(
          /^(google\s+search\s+for|search\s+google\s+for|search\s+for|search|look\s+up)\s*/i,
          ""
        )
        .trim();

    if (query) {

      return (
        "https://www.google.com/search?q=" +
        encodeURIComponent(query)
      );
    }
  }

  return null;
}


// ======================================================
// SECURITY CHECK FOR URL
// ======================================================

function isSafeActionUrl(url) {

  try {

    const parsed =
      new URL(url);

    const allowedHosts = [
      "www.youtube.com",
      "youtube.com",
      "www.google.com",
      "google.com"
    ];

    return (
      parsed.protocol === "https:" &&
      allowedHosts.includes(parsed.hostname)
    );

  } catch (error) {

    return false;
  }
}


// ======================================================
// OPEN WEBSITE
// ======================================================

function openBrowserAction(
  url,
  actionWindow = null
) {

  if (!isSafeActionUrl(url)) {

    console.error(
      "Blocked unsafe browser URL:",
      url
    );

    if (
      actionWindow &&
      !actionWindow.closed
    ) {
      actionWindow.close();
    }

    return false;
  }


  if (
    actionWindow &&
    !actionWindow.closed
  ) {

    actionWindow.location.href = url;

    return true;

  }


  const opened =
    window.open(
      url,
      "_blank",
      "noopener"
    );

  return Boolean(opened);
}


// ======================================================
// SEND COMMAND TO FLASK
// ======================================================

async function sendCommand(
  command,
  reminder = "",
  actionWindow = null
) {

  const cleanCommand =
    command.trim();

  if (!cleanCommand) {
    return;
  }


  console.log(
    "Command sent:",
    cleanCommand
  );


  addMessage(
    "user",
    cleanCommand
  );


  input.value = "";


  setStatus(
    "Processing...",
    true
  );


  showTyping();


  try {

    const response =
      await fetch(
        "/api/command",
        {
          method: "POST",

          headers: {
            "Content-Type":
              "application/json"
          },

          body: JSON.stringify({
            command: cleanCommand,
            reminder: reminder,
            browser_tts:
              browserTtsAvailable
          })
        }
      );


    const data =
      await response.json();


    removeTyping();


    if (!response.ok) {

      throw new Error(
        data.error ||
        "The command could not be processed."
      );
    }


    // UPDATE MODEL INFORMATION

    intentValue.textContent =
      data.intent
        ? data.intent.replaceAll("_", " ")
        : "Unknown";


    confidenceValue.textContent =
      data.confidence
        ? `${data.confidence}%`
        : "—";


    modelValue.textContent =
      data.model || "—";


    // ASSISTANT MESSAGE

    const message =
      data.response ||
      data.message ||
      "Done.";


    addMessage(
      "assistant",
      message
    );


    // OPEN URL

    if (
      data.success &&
      data.action === "open_url" &&
      data.url
    ) {

      const opened =
        openBrowserAction(
          data.url,
          actionWindow
        );


      if (!opened) {

        addMessage(
          "assistant",
          "Please allow pop-ups for this site or use the link below."
        );


        addActionLink(
          data.url,
          "Open requested page"
        );
      }

    } else if (
      actionWindow &&
      !actionWindow.closed
    ) {

      actionWindow.close();
    }


    // FALLBACK ACTION URL

    if (
      !data.success &&
      data.action_url &&
      isSafeActionUrl(
        data.action_url
      )
    ) {

      addActionLink(
        data.action_url
      );
    }


    // SPEAK RESPONSE

    if (
      !speakResponse(message) &&
      !data.voice_output_available &&
      data.voice_notice
    ) {

      addMessage(
        "assistant",
        data.voice_notice
      );
    }


    // REMINDER

    if (data.needs_reminder) {

      const note =
        window.prompt(
          "What should Voice Mate remind you about?"
        );


      if (
        note &&
        note.trim()
      ) {

        sendCommand(
          cleanCommand,
          note.trim()
        );
      }
    }


    setStatus(
      data.keep_running
        ? "Ready"
        : "Goodbye"
    );


  } catch (error) {

    removeTyping();


    if (
      actionWindow &&
      !actionWindow.closed
    ) {

      actionWindow.close();
    }


    console.error(
      "Voice Mate command request failed:",
      error
    );


    const message =
      error.message ||
      "Something went wrong. Please try again.";


    addMessage(
      "assistant",
      message
    );


    speakResponse(
      message
    );


    setStatus(
      "Ready"
    );
  }
}


// ======================================================
// TYPED COMMAND
// ======================================================

form.addEventListener(
  "submit",
  (event) => {

    event.preventDefault();

    const command =
      input.value.trim();

    if (!command) {
      return;
    }


    /*
       Open a blank window immediately
       when command needs a website.

       This helps prevent popup blocking.
    */

    const url =
      urlForBrowserCommand(
        command
      );


    let actionWindow = null;


    if (
      url &&
      isSafeActionUrl(url)
    ) {

      actionWindow =
        window.open(
          "about:blank",
          "_blank"
        );
    }


    sendCommand(
      command,
      "",
      actionWindow
    );
  }
);


// ======================================================
// CLEAR CHAT
// ======================================================

document
  .getElementById("clear-chat")
  .addEventListener(
    "click",
    () => {

      chat.innerHTML = "";

      intentValue.textContent =
        "Waiting";

      confidenceValue.textContent =
        "—";

      input.focus();
    }
  );


// ======================================================
// QUICK ACTION BUTTONS
// ======================================================

document
  .querySelectorAll(
    "[data-command]"
  )
  .forEach((button) => {

    button.addEventListener(
      "click",
      () => {

        const command =
          button.dataset.command;


        const url =
          urlForBrowserCommand(
            command
          );


        let actionWindow = null;


        if (
          url &&
          isSafeActionUrl(url)
        ) {

          actionWindow =
            window.open(
              "about:blank",
              "_blank"
            );
        }


        sendCommand(
          command,
          "",
          actionWindow
        );
      }
    );
  });


// ======================================================
// SPEECH RECOGNITION
// ======================================================

const Recognition =
  window.SpeechRecognition ||
  window.webkitSpeechRecognition;


let recognition = null;

let recognitionErrorShown = false;

let lastVoiceCommand = "";

let lastVoiceCommandTime = 0;


// ======================================================
// VOICE ERROR
// ======================================================

function showVoiceError(message) {

  console.error(message);


  if (!recognitionErrorShown) {

    addMessage(
      "assistant",
      message
    );

    recognitionErrorShown = true;
  }


  listenLabel.textContent =
    message;


  setStatus(
    "Ready"
  );
}


// ======================================================
// BROWSER DOES NOT SUPPORT SPEECH
// ======================================================

if (!Recognition) {

  listenLabel.textContent =
    "Voice recognition requires Chrome or Edge. You can type commands.";


  mic.addEventListener(
    "click",
    () => {

      showVoiceError(
        "Voice recognition is not supported in this browser. Please use Chrome or Edge."
      );
    }
  );

}


// ======================================================
// SPEECH RECOGNITION AVAILABLE
// ======================================================

else {

  recognition =
    new Recognition();


  recognition.lang =
    "en-IN";


  recognition.continuous =
    false;


  recognition.interimResults =
    false;


  recognition.maxAlternatives =
    1;


  // ====================================================
  // MICROPHONE BUTTON
  // ====================================================

  mic.addEventListener(
    "click",
    async () => {

      recognitionErrorShown =
        false;


      try {

        /*
          Verify microphone access.
        */

        const stream =
          await navigator.mediaDevices.getUserMedia({
            audio: true
          });


        console.log(
          "Microphone access successful"
        );


        stream
          .getTracks()
          .forEach(
            (track) =>
              track.stop()
          );


        recognition.start();


      } catch (error) {

        console.error(
          "Microphone error:",
          error
        );


        showVoiceError(
          "Could not access the microphone. Check your microphone settings."
        );
      }
    }
  );


  // ====================================================
  // RECOGNITION START
  // ====================================================

  recognition.onstart =
    () => {

      console.log(
        "Speech recognition started"
      );


      mic.classList.add(
        "listening"
      );


      listenLabel.textContent =
        "Listening... Speak now";


      setStatus(
        "Listening...",
        true
      );
    };


  // ====================================================
  // SPEECH DETECTED
  // ====================================================

  recognition.onspeechstart =
    () => {

      console.log(
        "Speech detected"
      );


      listenLabel.textContent =
        "I can hear you...";
    };


  // ====================================================
  // SPEECH ENDED
  // ====================================================

  recognition.onspeechend =
    () => {

      console.log(
        "Speech ended"
      );


      listenLabel.textContent =
        "Processing...";
    };


  // ====================================================
  // SPEECH RESULT
  // ====================================================

  recognition.onresult =
    (event) => {

      const result =
        event.results[
          event.results.length - 1
        ];


      if (!result.isFinal) {
        return;
      }


      const heard =
        result[0]
          .transcript
          .trim();


      if (!heard) {
        return;
      }


      const now =
        Date.now();


      /*
        Prevent duplicate voice commands.
      */

      if (
        heard.toLowerCase() ===
          lastVoiceCommand.toLowerCase() &&
        now -
          lastVoiceCommandTime <
          3000
      ) {

        console.log(
          "Duplicate voice command ignored:",
          heard
        );

        return;
      }


      lastVoiceCommand =
        heard;


      lastVoiceCommandTime =
        now;


      console.log(
        "Recognized:",
        heard
      );


      input.value =
        heard;


      /*
        Determine whether this command
        needs to open a website.
      */

      const url =
        urlForBrowserCommand(
          heard
        );


      /*
        Speech recognition result itself
        may not always count as a direct
        browser click.

        We first try to create the window.
        If Chrome blocks it, the app will
        show the manual link.
      */

      let actionWindow = null;


      if (
        url &&
        isSafeActionUrl(url)
      ) {

        actionWindow =
          window.open(
            "about:blank",
            "_blank"
          );
      }


      sendCommand(
        heard,
        "",
        actionWindow
      );
    };


  // ====================================================
  // SPEECH ERROR
  // ====================================================

  recognition.onerror =
    (event) => {

      console.error(
        "Speech recognition error:",
        event.error
      );


      if (
        event.error ===
        "no-speech"
      ) {

        showVoiceError(
          "I couldn't hear anything. Click the microphone and speak immediately."
        );

      }


      else if (
        event.error ===
          "not-allowed" ||
        event.error ===
          "service-not-allowed"
      ) {

        showVoiceError(
          "Microphone permission is blocked. Please allow microphone access."
        );

      }


      else if (
        event.error ===
        "audio-capture"
      ) {

        showVoiceError(
          "No working microphone was detected."
        );

      }


      else {

        showVoiceError(
          `Voice recognition error: ${event.error}`
        );
      }
    };


  // ====================================================
  // RECOGNITION ENDED
  // ====================================================

  recognition.onend =
    () => {

      console.log(
        "Speech recognition ended"
      );


      mic.classList.remove(
        "listening"
      );


      if (
        !recognitionErrorShown
      ) {

        listenLabel.textContent =
          "Tap to speak";
      }


      setStatus(
        "Ready"
      );
    };
}