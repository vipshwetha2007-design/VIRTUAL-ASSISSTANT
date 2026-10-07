"""Model prediction, speech, and desktop actions used by the Voice Mate GUI."""

from dataclasses import dataclass
from pathlib import Path
from urllib.parse import quote_plus
from zoneinfo import ZoneInfo

import datetime
from queue import Queue
import re
import subprocess
import threading
import webbrowser

import joblib
import pyttsx3
import speech_recognition as sr


PROJECT_DIR = Path(__file__).resolve().parent
MODEL_PATH = PROJECT_DIR / "model.pkl"
VECTORIZER_PATH = PROJECT_DIR / "vectorizer.pkl"
CONFIDENCE_THRESHOLD = 0.35


@dataclass
class ActionResult:
    """The message to show/speak after an intent has been handled."""

    message: str
    keep_running: bool = True
    success: bool = True
    action_url: str | None = None


class SpeechWorker:
    """Speak queued messages on one background thread so Flask requests stay responsive."""

    def __init__(self):
        self._queue = Queue()
        self._available = None
        self._worker = threading.Thread(
            target=self._run,
            daemon=True,
            name="voice-mate-tts"
        )
        self._worker.start()

    def speak_response(self, text):
        """Queue speech and report promptly whether the local TTS engine can initialize."""

        if self._available is False:
            return False, (
                "Voice output unavailable. "
                "Check your system audio/TTS configuration."
            )

        ready = threading.Event()
        result = {"available": None}

        self._queue.put((text, ready, result))

        if not ready.wait(timeout=2):
            return False, (
                "Voice output unavailable. "
                "Check your system audio/TTS configuration."
            )

        if result["available"] is False:
            return False, (
                "Voice output unavailable. "
                "Check your system audio/TTS configuration."
            )

        return True, None

    def _run(self):
        while True:
            text, ready, result = self._queue.get()
            engine = None

            try:
                self._configure_windows_tts_cache()

                engine = pyttsx3.init()

                voices = engine.getProperty("voices")

                if voices:
                    engine.setProperty("voice", voices[0].id)

                self._available = True
                result["available"] = True
                ready.set()

                engine.say(text)
                engine.runAndWait()

            except Exception as error:
                self._available = False
                result["available"] = False
                print(f"Text-to-speech unavailable: {error}")

            finally:
                if not ready.is_set():
                    ready.set()

                if engine is not None:
                    try:
                        engine.stop()
                    except (AttributeError, RuntimeError):
                        pass

                self._queue.task_done()

    @staticmethod
    def _configure_windows_tts_cache():
        """Keep generated SAPI wrappers out of protected Windows Python folders."""

        try:
            import comtypes.client
            import comtypes.gen

            cache_directory = PROJECT_DIR / ".tts_cache"
            cache_directory.mkdir(exist_ok=True)

            comtypes.client.gen_dir = str(cache_directory)

            # Ignore an incompatible wrapper bundled by some
            # Windows Store Python installations.
            comtypes.gen.__path__[:] = [str(cache_directory)]

        except (ImportError, OSError):
            # Non-Windows systems and installations without
            # comtypes need no setup.
            pass


class VoiceMateService:
    """Loads the trained classifier and performs supported assistant actions."""

    def __init__(self):
        self._ensure_model_files()

        self.model = joblib.load(MODEL_PATH)
        self.vectorizer = joblib.load(VECTORIZER_PATH)

        self.speech = SpeechWorker()

    @staticmethod
    def _ensure_model_files():
        """Train once from the project dataset when saved model files are absent."""

        if MODEL_PATH.exists() and VECTORIZER_PATH.exists():
            return

        from model import train_and_save_models

        train_and_save_models()

    def speak_response(self, message):
        """Speak a response safely without making the command API wait."""

        print("Voice Mate:", message)
        return self.speech.speak_response(message)

    def listen_for_command(self):
        """Return command and error message safely."""

        try:
            recognizer = sr.Recognizer()

            with sr.Microphone() as source:
                recognizer.adjust_for_ambient_noise(
                    source,
                    duration=0.5
                )

                audio = recognizer.listen(
                    source,
                    timeout=5,
                    phrase_time_limit=10
                )

            command = recognizer.recognize_google(audio).lower().strip()

            if not command:
                return (
                    None,
                    "I did not hear a command. "
                    "Please try again or type a command."
                )

            return command, None

        except sr.WaitTimeoutError:
            return (
                None,
                "I did not hear anything. "
                "Please try again or type a command."
            )

        except sr.UnknownValueError:
            return (
                None,
                "I could not understand that. "
                "Please try again or type a command."
            )

        except sr.RequestError:
            return (
                None,
                "Speech recognition is unavailable. "
                "You can still type commands."
            )

        except (AttributeError, OSError, ImportError) as error:
            return (
                None,
                f"Microphone/PyAudio is unavailable ({error}). "
                "You can still type commands."
            )

        except Exception as error:
            return (
                None,
                f"Microphone input could not start ({error}). "
                "You can still type commands."
            )

    def predict_intent(self, command):
        """Predict an intent from a non-exact natural-language command."""

        return self.predict_intent_details(command)["intent"]

    def predict_intent_details(self, command):
        """Return the predicted intent and confidence for the web dashboard."""

        cleaned_command = command.strip().lower()

        if not cleaned_command:
            return {
                "intent": None,
                "confidence": 0.0
            }

        try:
            command_vector = self.vectorizer.transform(
                [cleaned_command]
            )

            if command_vector.nnz == 0:
                return {
                    "intent": None,
                    "confidence": 0.0
                }

            probabilities = self.model.predict_proba(
                command_vector
            )[0]

        except (AttributeError, TypeError, ValueError) as error:
            print(f"Intent prediction unavailable: {error}")

            return {
                "intent": None,
                "confidence": 0.0
            }

        best_index = probabilities.argmax()
        confidence = float(probabilities[best_index])

        intent = (
            self.model.classes_[best_index]
            if confidence >= CONFIDENCE_THRESHOLD
            else None
        )

        return {
            "intent": intent,
            "confidence": confidence
        }

    @property
    def model_name(self):
        """A readable name for the selected saved classifier."""

        return type(self.model).__name__.replace(
            "Classifier",
            " Classifier"
        )

    @staticmethod
    def _search_terms(command):
        prefixes = (
            "google search for ",
            "search google for ",
            "search for ",
            "search "
        )

        lowered = command.lower().strip()

        for prefix in prefixes:
            if lowered.startswith(prefix):
                return command[len(prefix):].strip()

        return command.strip()

    @staticmethod
    def _play_query(command):
        """Keep the words after 'play' so a requested song is not discarded."""

        match = re.search(
            r"\bplay\s+(.+)",
            command,
            flags=re.IGNORECASE
        )

        if not match:
            return "trending songs"

        query = match.group(1).strip()

        if query.lower().startswith("some "):
            query = query[5:].strip()

        return query or "trending songs"

    def execute_command(self, intent, command, reminder=""):
        """Execute a predicted intent and return the action for the web client."""

        print("EXECUTING:", intent)

        try:

            # -------------------------
            # OPEN YOUTUBE
            # -------------------------
            if intent == "open_youtube":
                return self._open_url(
                    "https://www.youtube.com/",
                    "Opening YouTube."
                )

            # -------------------------
            # OPEN GOOGLE
            # -------------------------
            if intent == "open_google":
                return self._open_url(
                    "https://www.google.com/",
                    "Opening Google."
                )

            # -------------------------
            # CURRENT TIME - INDIA
            # -------------------------
            if intent == "tell_time":

                india_now = datetime.datetime.now(
                    ZoneInfo("Asia/Kolkata")
                )

                return ActionResult(
                    f"The time is {india_now:%I:%M %p}."
                )

            # -------------------------
            # CURRENT DATE - INDIA
            # -------------------------
            if intent == "tell_date":

                india_now = datetime.datetime.now(
                    ZoneInfo("Asia/Kolkata")
                )

                return ActionResult(
                    f"Today is {india_now:%d %B %Y}."
                )

            # -------------------------
            # PLAY MUSIC
            # -------------------------
            if intent == "play_music":

                song = self._play_query(command)

                url = (
                    "https://www.youtube.com/results"
                    f"?search_query={quote_plus(song)}"
                )

                return self._open_url(
                    url,
                    f"Playing {song} on YouTube."
                )

            # -------------------------
            # CALCULATOR
            # -------------------------
            if intent == "open_calculator":

                return self._open_windows_app(
                    "calc.exe",
                    "Calculator"
                )

            # -------------------------
            # NOTEPAD
            # -------------------------
            if intent == "open_notepad":

                return self._open_windows_app(
                    "notepad.exe",
                    "Notepad"
                )

            # -------------------------
            # REMINDER
            # -------------------------
            if intent == "set_reminder":

                if not reminder.strip():
                    return ActionResult(
                        "Please enter what you would like me "
                        "to remind you about.",
                        success=False
                    )

                with (
                    PROJECT_DIR / "reminders.txt"
                ).open(
                    "a",
                    encoding="utf-8"
                ) as file:

                    file.write(
                        reminder.strip() + "\n"
                    )

                return ActionResult(
                    "Reminder saved successfully."
                )

            # -------------------------
            # GOOGLE SEARCH
            # -------------------------
            if intent == "google_search":

                query = self._search_terms(command)

                if not query:
                    return ActionResult(
                        "Please include something to search for."
                    )

                return self._open_url(
                    "https://www.google.com/search?q="
                    + quote_plus(query),
                    f"Searching Google for {query}."
                )

            # -------------------------
            # HELP
            # -------------------------
            if intent == "help":

                return ActionResult(
                    "You can open YouTube or Google, "
                    "ask for the time or date, "
                    "play music, open Calculator or Notepad, "
                    "search Google, set a reminder, or exit."
                )

            # -------------------------
            # EXIT
            # -------------------------
            if intent == "exit":

                return ActionResult(
                    "Goodbye!",
                    keep_running=False
                )

        except Exception as error:

            if intent == "play_music":

                return ActionResult(
                    f"I could not play "
                    f"{self._play_query(command)}. "
                    "Check your internet connection and try again.",
                    success=False
                )

            return ActionResult(
                f"I could not complete that action: {error}",
                success=False
            )

        return ActionResult(
            "Sorry, I did not understand. "
            "Click Help or type help for commands.",
            success=False
        )

    # Compatibility alias
    def execute_intent(
        self,
        intent,
        command,
        reminder=""
    ):
        return self.execute_command(
            intent,
            command,
            reminder
        )

    @staticmethod
    def _open_url(url, success_message):
        """Send safe URL to the browser frontend."""

        try:
            opened = webbrowser.open(
                url,
                new=2
            )

            if not opened:
                print(
                    "Desktop browser did not accept the URL; "
                    "sending frontend fallback:",
                    url
                )

        except Exception as error:

            print(
                f"Desktop browser launch failed ({error}); "
                f"sending frontend fallback: {url}"
            )

        return ActionResult(
            success_message,
            action_url=url
        )

    @staticmethod
    def _open_windows_app(
        application,
        display_name
    ):
        """Launch a Windows utility when running locally."""

        try:

            subprocess.Popen(
                [application]
            )

            return ActionResult(
                f"Opening {display_name}."
            )

        except FileNotFoundError:

            return ActionResult(
                f"{display_name} is not available on this computer.",
                success=False
            )

        except OSError as error:

            return ActionResult(
                f"I could not open {display_name}: {error}",
                success=False
            )