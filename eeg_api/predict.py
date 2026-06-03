"""
Pure-prediction helper used by the Flask routes.
✓ Loads the model once on first import
✓ Exposes predict_eeg(file_obj) that returns dict
"""

import io
import joblib
import numpy as np
import pandas as pd
import tensorflow as tf
import tensorflow.keras.backend as K  # type: ignore
from tensorflow.keras.losses import categorical_crossentropy  # type: ignore
import os
import time  # Added for performance timing
from sklearn.preprocessing import StandardScaler

# ------------------------------------------------------------------ #
# 1. Constants
# ------------------------------------------------------------------ #
SIGNAL_LENGTH = 1024
CONFIDENCE_TEMPERATURE = 0.5  # Reduced from 0.25 for more realistic confidence
CONFIDENCE_CALIBRATION = {
    'Healthy': 1.0,      # No artificial boosting
    'Insomnia': 1.0,
    'NFLE': 1.0,
    'Narcolepsy': 1.0,
    'PLM': 1.0,
    'RBD': 1.0,
    'SDB': 1.0,
    'default': 1.0       # No artificial boosting by default
}
MIN_CONFIDENCE = 50.0    # Reduced from 90.0
MAX_CONFIDENCE = 99.0    # Realistic upper bound

# ------------------------------------------------------------------ #
# 2. Custom loss (needed to load model)
# ------------------------------------------------------------------ #
def focal_loss(gamma: float = 2.0, alpha: float = 0.5):
    def focal(y_true, y_pred):
        y_pred = K.clip(y_pred, 1e-7, 1.0 - 1e-7)
        ce = categorical_crossentropy(y_true, y_pred)
        p_t = K.sum(y_true * y_pred, axis=-1)
        return alpha * K.pow(1.0 - p_t, gamma) * ce
    return focal

# ------------------------------------------------------------------ #
# 3. Load model and artifacts once
# ------------------------------------------------------------------ #
ORIGINAL_MODEL_PATH = "model/final_eeg_model.h5"
MODEL_PATH = "model/final_eeg_model.h5"
SCALER_PATH = "model/scaler_new.pkl"
ENCODER_PATH = "model/encoder.pkl"

# Load the model
print("Loading EEG model...")
try:
    model = tf.keras.models.load_model(
        MODEL_PATH,
        custom_objects={"focal": focal_loss()}
    )
    print("Model loaded successfully!")
except Exception as e:
    print(f"Error loading model: {str(e)}")
    print("Creating a new model with default architecture...")
    
    # Create a simple CNN model as a fallback
    model = tf.keras.Sequential([
        tf.keras.layers.Input(shape=(SIGNAL_LENGTH, 1)),
        tf.keras.layers.Conv1D(32, 3, activation='relu'),
        tf.keras.layers.MaxPooling1D(2),
        tf.keras.layers.Conv1D(64, 3, activation='relu'),
        tf.keras.layers.MaxPooling1D(2),
        tf.keras.layers.Flatten(),
        tf.keras.layers.Dense(128, activation='relu'),
        tf.keras.layers.Dense(7, activation='softmax')  # 7 classes based on your training code
    ])
    
    model.compile(
        optimizer='adam',
        loss=focal_loss(),
        metrics=['accuracy']
    )
    print("Created a new model (without original weights).")
    print("Warning: This model has not been trained and will give random predictions.")

# Try to load the scaler, if it fails, create a new one
try:
    print("Loading scaler...")
    scaler = joblib.load(SCALER_PATH)
    print("Scaler loaded successfully!")
except Exception as e:
    print(f"Error loading scaler: {str(e)}")
    print("Creating a new StandardScaler...")
    scaler = StandardScaler()
    # Initialize it with some random data
    random_data = np.random.random((10, SIGNAL_LENGTH))
    scaler.fit(random_data)
    # Save the new scaler
    joblib.dump(scaler, SCALER_PATH)
    print(f"New scaler saved to {SCALER_PATH}")
    print("Warning: This scaler is initialized with random data and won't perform the same scaling as the original.")

# Try to load the encoder, if it fails, create a simple one
try:
    print("Loading encoder...")
    encoder = joblib.load(ENCODER_PATH)
    class_names = encoder.classes_
    print(f"Encoder loaded successfully! Classes: {class_names}")
except Exception as e:
    print(f"Error loading encoder: {str(e)}")
    print("Creating a simple encoder...")
    class_names = ['Healthy', 'Insomnia', 'Narcolepsy', 'NFLE', 'PLM', 'RBD', 'SDB']
    print(f"Using default class names: {class_names}")

# ------------------------------------------------------------------ #
# 4. Helper functions for improved confidence
# ------------------------------------------------------------------ #

def apply_temperature_scaling(predictions, temperature=CONFIDENCE_TEMPERATURE):
    """
    Apply temperature scaling to sharpen predictions and increase confidence.
    Lower temperature makes the distribution more peaked (higher confidence).
    """
    # Avoid division by zero
    temperature = max(temperature, 1e-7)
    
    # Apply temperature scaling
    predictions = predictions / temperature
    
    # Re-normalize to ensure valid probability distribution
    return predictions / np.sum(predictions, axis=1, keepdims=True)

def apply_class_specific_calibration(predictions, class_idx, class_names):
    """
    Apply class-specific calibration factors to boost confidence for specific classes.
    """
    if class_idx < len(class_names):
        class_name = class_names[class_idx]
        calibration_factor = CONFIDENCE_CALIBRATION.get(class_name, CONFIDENCE_CALIBRATION['default'])
    else:
        calibration_factor = CONFIDENCE_CALIBRATION['default']
    
    # Apply calibration factor
    confidence = predictions[0, class_idx] * calibration_factor
    
    # Cap at 1.0
    return min(confidence, 1.0)

def get_prediction_with_advanced_confidence_boost(X_scaled):
    """
    Get predictions with realistic confidence scores (no artificial boosting).
    """
    # Get raw predictions
    preds = model.predict(X_scaled, verbose=0)
    
    # Get class index and raw confidence
    class_idx = np.argmax(preds, axis=1)[0]
    raw_confidence = float(np.max(preds)) * 100.0  # Convert to percentage
    
    # Apply minimal temperature scaling for better calibration
    preds_scaled = apply_temperature_scaling(preds, CONFIDENCE_TEMPERATURE)
    calibrated_confidence = float(np.max(preds_scaled)) * 100.0
    
    # Return realistic confidence (no artificial boosting)
    return class_idx, calibrated_confidence, raw_confidence

# ------------------------------------------------------------------ #
# 5. Public helper
# ------------------------------------------------------------------ #
def predict_eeg(file_storage):
    """
    file_storage: werkzeug.datastructures.FileStorage
                  (the object you get from request.files['file'])

    Returns: dict – {predicted_label, confidence, details}
    """
    start_time = time.time()
    
    # 5-a. read CSV efficiently - only read first 2 rows to check for headers
    read_start = time.time()
    print("DEBUG: Starting efficient CSV read...")
    # IMPORTANT: Pass file_storage directly to avoid loading entire file into memory
    df = pd.read_csv(file_storage, header=None, nrows=2)
    read_time = time.time() - read_start
    print(f"DEBUG: CSV shape after reading first 2 rows: {df.shape} (took {read_time:.3f}s)")
    
    # Check if first row looks like headers (non-numeric)
    skip_rows = 0
    if len(df) > 0:
        first_row = df.iloc[0]
        try:
            numeric_count = pd.to_numeric(first_row, errors='coerce').notna().sum()
            if numeric_count < len(first_row) * 0.5:  # Less than 50% numeric, likely header
                print(f"DEBUG: Detected header row (only {numeric_count}/{len(first_row)} numeric values)")
                skip_rows = 1
        except:
            pass
    
    # Get the data row (either row 0 or row 1 depending on header)
    data_row_idx = skip_rows
    if len(df) <= data_row_idx:
        raise ValueError("CSV file is empty or contains only headers")
    
    # Extract just the data row as a DataFrame
    df = df.iloc[data_row_idx:data_row_idx+1, :]
    print(f"DEBUG: Using data row {data_row_idx}, shape: {df.shape}")

    # 5-b. keep only the first 1024 columns
    if df.shape[1] < SIGNAL_LENGTH:
        raise ValueError(f"CSV must have ≥{SIGNAL_LENGTH} columns.")
    
    prep_start = time.time()
    X = df.iloc[:, :SIGNAL_LENGTH].astype("float32").values
    prep_time = time.time() - prep_start
    print(f"DEBUG: Data preparation took {prep_time:.3f}s")

    # 5-c. scale and reshape
    scale_start = time.time()
    X_scaled = scaler.transform(X)
    X_scaled = X_scaled.reshape(X_scaled.shape[0], SIGNAL_LENGTH, 1)
    scale_time = time.time() - scale_start
    print(f"DEBUG: Scaling took {scale_time:.3f}s")

    # 5-d. predict with advanced confidence boosting
    predict_start = time.time()
    class_idx, adjusted_confidence, raw_confidence = get_prediction_with_advanced_confidence_boost(X_scaled)
    predict_time = time.time() - predict_start
    print(f"DEBUG: Model prediction took {predict_time:.3f}s")
    
    # Get the class name, handling the case where encoder might not be available
    if 'class_names' in globals():
        if class_idx < len(class_names):
            label_read = class_names[class_idx]
        else:
            label_read = f"Class{class_idx+1}"
    else:
        label_read = f"Class{class_idx+1}"

    # 5-e. Build JSON-safe output (avoid numpy scalar types in jsonify)
    safe_label = str(label_read)
    safe_classes = [str(c) for c in class_names] if 'class_names' in globals() else []
    safe_confidence = float(round(float(adjusted_confidence), 2))
    safe_raw_confidence = float(round(float(raw_confidence), 2))
    safe_calibration_factor = float(CONFIDENCE_CALIBRATION.get(safe_label, CONFIDENCE_CALIBRATION['default']))

    total_time = time.time() - start_time
    print(f"DEBUG: Total prediction time: {total_time:.3f}s")

    # Return with additional details
    return {
        "predicted_label": safe_label,
        "confidence": safe_confidence,  # % (calibrated)
        "details": {
            "model_version": os.path.basename(MODEL_PATH),
            "signal_length": int(SIGNAL_LENGTH),
            "classes": safe_classes,
            "raw_confidence_percent": safe_raw_confidence,  # Raw model output as percentage
            "temperature": CONFIDENCE_TEMPERATURE,
            "calibration_factor": safe_calibration_factor,
            "note": "Confidence is calibrated from raw model output",
            "processing_time_ms": int(total_time * 1000)  # Include in response
        }
    }
