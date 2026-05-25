"""
SQLAlchemy Models for EEG Analysis App
"""

from flask_sqlalchemy import SQLAlchemy
from datetime import datetime
import uuid

db = SQLAlchemy()

class Doctor(db.Model):
    __tablename__ = 'doctors'
    
    id = db.Column(db.String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    username = db.Column(db.String(80), unique=True, nullable=False)
    email = db.Column(db.String(120), unique=True, nullable=False)
    password_hash = db.Column(db.String(255), nullable=False)
    created_at = db.Column(db.DateTime, default=datetime.utcnow)
    updated_at = db.Column(db.DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
    
    def to_dict(self):
        return {
            'id': self.id,
            'username': self.username,
            'email': self.email,
            'created_at': self.created_at.isoformat(),
            'updated_at': self.updated_at.isoformat()
        }

class Patient(db.Model):
    __tablename__ = 'patients'
    
    id = db.Column(db.String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    name = db.Column(db.String(100), nullable=False)
    age = db.Column(db.Integer, nullable=False)
    gender = db.Column(db.Enum('male', 'female', name='gender_enum'), nullable=False)
    created_at = db.Column(db.DateTime, default=datetime.utcnow)
    updated_at = db.Column(db.DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
    
    # Relationship
    eeg_records = db.relationship('EEGRecord', backref='patient', lazy=True, cascade='all, delete-orphan')
    
    def to_dict(self):
        return {
            'id': self.id,
            'name': self.name,
            'age': self.age,
            'gender': self.gender,
            'created_at': self.created_at.isoformat(),
            'updated_at': self.updated_at.isoformat()
        }

class EEGRecord(db.Model):
    __tablename__ = 'eeg_records'
    
    id = db.Column(db.String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    patient_id = db.Column(db.String(36), db.ForeignKey('patients.id'), nullable=False)
    filename = db.Column(db.String(255), nullable=False)
    original_filename = db.Column(db.String(255), nullable=False)
    file_path = db.Column(db.String(500), nullable=False)
    file_size = db.Column(db.Integer, nullable=False)
    status = db.Column(
        db.Enum('Processing', 'Healthy', 'Insomnia', 'Narcolepsy', 'NFLE', 'PLM', 'RBD', 'Failed', 
                name='status_enum'), 
        default='Processing', 
        nullable=False
    )
    predicted_label = db.Column(db.String(50), nullable=True)
    confidence = db.Column(db.Float, nullable=True)
    prediction_details = db.Column(db.JSON, nullable=True)  # Store full prediction results
    task_id = db.Column(db.String(36), nullable=True)  # Celery task ID
    created_at = db.Column(db.DateTime, default=datetime.utcnow)
    updated_at = db.Column(db.DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
    
    def to_dict(self):
        return {
            'id': self.id,
            'patient_id': self.patient_id,
            'patient_name': self.patient.name if self.patient else None,
            'patient_age': self.patient.age if self.patient else None,
            'filename': self.original_filename,
            'file_size': self.file_size,
            'status': self.status,
            'predicted_label': self.predicted_label,
            'confidence': self.confidence,
            'prediction_details': self.prediction_details,
            'created_at': self.created_at.isoformat(),
            'updated_at': self.updated_at.isoformat()
        }