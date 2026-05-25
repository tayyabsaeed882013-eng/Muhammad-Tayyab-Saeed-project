"""
Flask EEG Analysis API Server
This is a reference implementation for the backend API.
Note: This won't run in the WebContainer environment.
"""

from flask import Flask, request, jsonify, send_file
from flask_sqlalchemy import SQLAlchemy
from flask_jwt_extended import JWTManager, jwt_required, create_access_token, get_jwt_identity
from flask_cors import CORS
from werkzeug.security import generate_password_hash, check_password_hash
from werkzeug.utils import secure_filename
import os
import pandas as pd
import numpy as np
from datetime import datetime, timedelta
import uuid
from celery import Celery
import pickle
import tensorflow as tf

def create_app():
    app = Flask(__name__)
    
    # Configuration
    app.config['SECRET_KEY'] = os.environ.get('SECRET_KEY', 'dev-secret-key')
    app.config['SQLALCHEMY_DATABASE_URI'] = os.environ.get('DATABASE_URL', 'sqlite:///eeg_app.db')
    app.config['SQLALCHEMY_TRACK_MODIFICATIONS'] = False
    app.config['JWT_SECRET_KEY'] = os.environ.get('JWT_SECRET_KEY', 'jwt-secret-key')
    app.config['JWT_ACCESS_TOKEN_EXPIRES'] = timedelta(hours=24)
    app.config['UPLOAD_FOLDER'] = 'uploads'
    app.config['MAX_CONTENT_LENGTH'] = 50 * 1024 * 1024  # 50MB max file size
    
    # Redis configuration for Celery
    app.config['CELERY_BROKER_URL'] = os.environ.get('REDIS_URL', 'redis://localhost:6379/0')
    app.config['CELERY_RESULT_BACKEND'] = os.environ.get('REDIS_URL', 'redis://localhost:6379/0')
    
    # Initialize extensions
    db = SQLAlchemy(app)
    jwt = JWTManager(app)
    CORS(app)
    
    # Initialize Celery
    celery = Celery(app.import_name, broker=app.config['CELERY_BROKER_URL'])
    celery.conf.update(app.config)
    
    # Ensure upload directory exists
    os.makedirs(app.config['UPLOAD_FOLDER'], exist_ok=True)
    
    return app, db, jwt, celery

app, db, jwt, celery = create_app()

# Import models and routes after app creation
from models import Doctor, Patient, EEGRecord
from routes.auth import auth_bp
from routes.patients import patients_bp
from routes.eegs import eegs_bp
from routes.dashboard import dashboard_bp

# Register blueprints
app.register_blueprint(auth_bp, url_prefix='/api/auth')
app.register_blueprint(patients_bp, url_prefix='/api/patients')
app.register_blueprint(eegs_bp, url_prefix='/api/eegs')
app.register_blueprint(dashboard_bp, url_prefix='/api/dashboard')

# Load ML model and encoder at startup
try:
    model = tf.keras.models.load_model('models/final_model.h5')
    with open('models/encoder.pkl', 'rb') as f:
        encoder = pickle.load(f)
    print("ML model and encoder loaded successfully!")
except Exception as e:
    print(f"Error loading ML model: {e}")
    model = None
    encoder = None

@app.before_first_request
def create_tables():
    db.create_all()
    
    # Create default doctor if doesn't exist
    if not Doctor.query.filter_by(username='doctor').first():
        doctor = Doctor(
            username='doctor',
            email='doctor@hospital.com',
            password_hash=generate_password_hash('password')
        )
        db.session.add(doctor)
        db.session.commit()
        print("Default doctor created: username='doctor', password='password'")

@app.route('/api/health')
def health_check():
    return jsonify({'status': 'healthy', 'timestamp': datetime.utcnow().isoformat()})

if __name__ == '__main__':
    app.run(debug=True, host='0.0.0.0', port=5000)