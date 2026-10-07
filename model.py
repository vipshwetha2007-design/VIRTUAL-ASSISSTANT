"""Train and select the best intent classifier for Voice Mate."""

from pathlib import Path

import joblib
import pandas as pd
from sklearn.ensemble import RandomForestClassifier
from sklearn.feature_extraction.text import TfidfVectorizer
from sklearn.linear_model import LogisticRegression
from sklearn.metrics import accuracy_score
from sklearn.model_selection import train_test_split

PROJECT_DIR = Path(__file__).resolve().parent
DATASET_PATH = PROJECT_DIR / "dataset.csv"
MODEL_PATH = PROJECT_DIR / "model.pkl"
VECTORIZER_PATH = PROJECT_DIR / "vectorizer.pkl"


def load_dataset():
    """Read and validate the command/intent training data."""
    data = pd.read_csv(DATASET_PATH)
    if not {"command", "intent"}.issubset(data.columns):
        raise ValueError("dataset.csv must contain 'command' and 'intent' columns.")
    data = data.dropna(subset=["command", "intent"])
    data["command"] = data["command"].astype(str).str.strip()
    data["intent"] = data["intent"].astype(str).str.strip()
    return data[(data["command"] != "") & (data["intent"] != "")]


def train_and_save_models():
    """Train both classifiers, save the validation winner, and return results."""
    data = load_dataset()
    commands, intents = data["command"], data["intent"]
    X_train, X_test, y_train, y_test = train_test_split(
        commands, intents, test_size=0.25, random_state=42, stratify=intents
    )

    # Bigrams help distinguish phrases such as "open google" and "search google".
    vectorizer = TfidfVectorizer(
        lowercase=True, ngram_range=(1, 2), sublinear_tf=True, strip_accents="unicode"
    )
    X_train_vectors = vectorizer.fit_transform(X_train)
    X_test_vectors = vectorizer.transform(X_test)

    candidates = {
        "Logistic Regression": LogisticRegression(max_iter=1000, random_state=42),
        "Random Forest": RandomForestClassifier(
            n_estimators=300, random_state=42, class_weight="balanced", n_jobs=1
        ),
    }
    scores, trained_models = {}, {}
    for name, classifier in candidates.items():
        classifier.fit(X_train_vectors, y_train)
        scores[name] = accuracy_score(y_test, classifier.predict(X_test_vectors))
        trained_models[name] = classifier
        print(f"{name} validation accuracy: {scores[name]:.2%}")

    best_name = max(scores, key=scores.get)
    best_model = trained_models[best_name]

    # Refit the winning algorithm with all examples before deployment.
    all_vectors = vectorizer.fit_transform(commands)
    best_model.fit(all_vectors, intents)
    joblib.dump(best_model, MODEL_PATH)
    joblib.dump(vectorizer, VECTORIZER_PATH)

    print(f"Selected algorithm: {best_name}")
    print(f"Saved model: {MODEL_PATH.name}")
    print(f"Saved TF-IDF vectorizer: {VECTORIZER_PATH.name}")
    return best_name, scores


if __name__ == "__main__":
    train_and_save_models()
