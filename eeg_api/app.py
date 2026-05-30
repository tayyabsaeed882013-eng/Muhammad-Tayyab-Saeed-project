from flask import Flask, request, jsonify
from flask_cors import CORS
from predict import predict_eeg, class_names, SIGNAL_LENGTH
import os
import numpy as np
import pandas as pd
import io

app = Flask(__name__)
CORS(app)  # Enable CORS for all routes

# Configure max upload size to 2.5GB (handles 2GB files with overhead)
app.config['MAX_CONTENT_LENGTH'] = 2.5 * 1024 * 1024 * 1024  # 2.5GB in bytes

# ------------------------------------------------------------------ #
# API Routes
# ------------------------------------------------------------------ #

@app.route("/predict", methods=["POST"])
def predict_endpoint():
    """
    Main prediction endpoint that accepts a CSV file and returns prediction results
    """
    if "file" not in request.files:
        return jsonify({"error": "File part 'file' missing"}), 400

    file = request.files["file"]
    if not file.filename.lower().endswith(".csv"):
        return jsonify({"error": "Only .csv files accepted"}), 400

    try:
        result = predict_eeg(file)
        return jsonify(result), 200
    except Exception as exc:
        return jsonify({"error": str(exc)}), 500

@app.route("/predict/json", methods=["POST"])
def predict_json_endpoint():
    """
    Alternative endpoint that accepts JSON data instead of a file
    """
    if not request.is_json:
        return jsonify({"error": "Request must be JSON"}), 400
    
    try:
        # Get data from request
        data = request.get_json()
        if "data" not in data:
            return jsonify({"error": "Missing 'data' field in JSON"}), 400
            
        # Convert to DataFrame
        signal_data = data["data"]
        if len(signal_data) == 0:
            return jsonify({"error": "Empty data array"}), 400
            
        df = pd.DataFrame(signal_data)
        
        # Check if we have enough columns
        if df.shape[1] < SIGNAL_LENGTH:
            return jsonify({"error": f"Data must have at least {SIGNAL_LENGTH} columns"}), 400
            
        # Convert to CSV in memory
        csv_buffer = io.BytesIO()
        df.to_csv(csv_buffer, index=False, header=False)
        csv_buffer.seek(0)
        
        # Create a file-like object
        class FileStorage:
            def __init__(self, buffer):
                self.buffer = buffer
                self.filename = "data.csv"
            
            def read(self):
                return self.buffer.read()
        
        # Process with the existing predict function
        result = predict_eeg(FileStorage(csv_buffer))
        return jsonify(result), 200
        
    except Exception as exc:
        return jsonify({"error": str(exc)}), 500

@app.route("/health", methods=["GET"])
def health_check():
    """
    Simple health check endpoint
    """
    return jsonify({"status": "ok"}), 200

@app.route("/info", methods=["GET"])
def model_info():
    """
    Endpoint to get information about the model
    """
    try:
        return jsonify({
            "model_name": "EEG Disease Classifier",
            "signal_length": SIGNAL_LENGTH,
            "classes": list(class_names),
            "version": "1.0"
        }), 200
    except Exception as exc:
        return jsonify({"error": str(exc)}), 500

@app.route("/", methods=["GET"])
def index():
    """
    Root endpoint with basic API documentation
    """
    return jsonify({
        "name": "EEG Disease Classification API",
        "endpoints": {
            "/predict": "POST - Submit a CSV file for prediction",
            "/predict/json": "POST - Submit JSON data for prediction",
            "/health": "GET - Check API health",
            "/info": "GET - Get model information"
        },
        "version": "1.0"
    }), 200

# Run the Flask app when this file is executed directly
if __name__ == "__main__":
    print("Starting Flask server...")
    app.run(host="0.0.0.0", port=5000, debug=False)
