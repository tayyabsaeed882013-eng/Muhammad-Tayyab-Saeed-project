"""
Celery tasks for EEG analysis
"""

from celery import Celery
from models import EEGRecord, db
import pandas as pd
import numpy as np
import pickle
import tensorflow as tf
from datetime import datetime
import traceback

# Initialize Celery (this would be configured properly in a real app)
celery = Celery('eeg_analysis')

# Load model and encoder (in a real app, this would be done once at startup)
try:
    model = tf.keras.models.load_model('models/final_model.h5')
    with open('models/encoder.pkl', 'rb') as f:
        encoder = pickle.load(f)
except Exception as e:
    print(f"Error loading ML model: {e}")
    model = None
    encoder = None

@celery.task(bind=True)
def analyze_eeg_task(self, eeg_record_id, file_path):
    """
    Analyze EEG file using machine learning model
    """
    try:
        # Get EEG record
        eeg_record = EEGRecord.query.get(eeg_record_id)
        if not eeg_record:
            raise Exception("EEG record not found")
        
        # Update status to processing
        eeg_record.status = 'Processing'
        db.session.commit()
        
        # Load and validate CSV file
        try:
            df = pd.read_csv(file_path)
        except Exception as e:
            raise Exception(f"Error reading CSV file: {str(e)}")
        
        # Validate CSV structure (should have 1024 numeric columns)
        if df.shape[1] != 1024:
            raise Exception(f"CSV file must have exactly 1024 columns, found {df.shape[1]}")
        
        # Check for non-numeric data
        if not df.select_dtypes(include=[np.number]).shape[1] == df.shape[1]:
            raise Exception("All columns must contain numeric data")
        
        # Preprocess data
        data = df.values
        
        # Reshape for model input (assuming model expects shape (n, 1024, 1))
        data_reshaped = data.reshape(data.shape[0], 1024, 1)
        
        # Scale data if needed (this would depend on how the model was trained)
        # data_scaled = scaler.transform(data_reshaped)
        
        # Make predictions
        if model is None:
            raise Exception("ML model not loaded")
        
        predictions = model.predict(data_reshaped)
        
        # Process predictions
        prediction_results = []
        for i, pred in enumerate(predictions):
            # Get predicted class
            predicted_class_idx = np.argmax(pred)
            confidence = float(np.max(pred))
            
            # Decode class label
            if encoder:
                predicted_label = encoder.inverse_transform([predicted_class_idx])[0]
            else:
                # Fallback class mapping
                class_mapping = {
                    0: 'Healthy',
                    1: 'Insomnia', 
                    2: 'Narcolepsy',
                    3: 'NFLE',
                    4: 'PLM',
                    5: 'RBD'
                }
                predicted_label = class_mapping.get(predicted_class_idx, 'Unknown')
            
            prediction_results.append({
                'index': i,
                'predicted_label': predicted_label,
                'confidence': confidence,
                'raw_predictions': pred.tolist()
            })
        
        # Determine overall result (could be majority vote, highest confidence, etc.)
        if prediction_results:
            # Use the prediction with highest confidence
            best_prediction = max(prediction_results, key=lambda x: x['confidence'])
            final_label = best_prediction['predicted_label']
            final_confidence = best_prediction['confidence']
        else:
            final_label = 'Failed'
            final_confidence = 0.0
        
        # Update EEG record with results
        eeg_record.status = final_label
        eeg_record.predicted_label = final_label
        eeg_record.confidence = final_confidence * 100  # Convert to percentage
        eeg_record.prediction_details = {
            'total_samples': len(prediction_results),
            'predictions': prediction_results[:10],  # Store first 10 predictions
            'analysis_timestamp': datetime.utcnow().isoformat()
        }
        eeg_record.updated_at = datetime.utcnow()
        
        db.session.commit()
        
        return {
            'status': 'success',
            'eeg_record_id': eeg_record_id,
            'predicted_label': final_label,
            'confidence': final_confidence
        }
        
    except Exception as e:
        # Update record status to failed
        try:
            eeg_record = EEGRecord.query.get(eeg_record_id)
            if eeg_record:
                eeg_record.status = 'Failed'
                eeg_record.prediction_details = {
                    'error': str(e),
                    'traceback': traceback.format_exc(),
                    'analysis_timestamp': datetime.utcnow().isoformat()
                }
                eeg_record.updated_at = datetime.utcnow()
                db.session.commit()
        except:
            pass
        
        # Re-raise the exception for Celery
        raise self.retry(exc=e, countdown=60, max_retries=3)