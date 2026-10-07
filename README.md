# Voice Mate

Voice Mate is a local Flask web application that uses TF-IDF and the best saved
classifier selected between Logistic Regression and Random Forest to understand commands.

## Run the application

1. Open a terminal in this project folder.
2. Install the dependencies:

   ```bash
   pip install -r requirements.txt
   ```

3. Start Voice Mate:

   ```bash
   python app.py
   ```

4. Open [http://127.0.0.1:5000/](http://127.0.0.1:5000/) in your browser.
5. Allow microphone permission if you want to use voice input.
6. Type a command or use the microphone button.

If `model.pkl` or `vectorizer.pkl` is missing, Voice Mate automatically trains them
from `dataset.csv` on startup. If browser microphone permission is unavailable, typed
commands continue to work.
