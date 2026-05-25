"""
EEG management routes for EEG Analysis App
"""

from flask import Blueprint, request, jsonify, send_file, current_app
from flask_jwt_extended import jwt_required
from werkzeug.utils import secure_filename
from models import Patient, EEGRecord, db
from tasks import analyze_eeg_task
import os
import uuid
from sqlalchemy import or_

eegs_bp = Blueprint('eegs', __name__)

ALLOWED_EXTENSIONS = {'csv'}

def allowed_file(filename):
    return '.' in filename and filename.rsplit('.', 1)[1].lower() in ALLOWED_EXTENSIONS

@eegs_bp.route('', methods=['GET'])
@jwt_required()
def get_eegs():
    try:
        # Get query parameters
        page = request.args.get('page', 1, type=int)
        per_page = request.args.get('per_page', 10, type=int)
        search = request.args.get('search', '', type=str)
        status = request.args.get('status', '', type=str)
        
        # Build query
        query = EEGRecord.query.join(Patient)
        
        if search:
            query = query.filter(
                or_(
                    Patient.name.contains(search),
                    EEGRecord.original_filename.contains(search),
                    EEGRecord.status.contains(search)
                )
            )
        
        if status:
            query = query.filter(EEGRecord.status == status)
        
        # Paginate results
        eegs = query.order_by(EEGRecord.created_at.desc()).paginate(
            page=page, per_page=per_page, error_out=False
        )
        
        return jsonify({
            'eegs': [eeg.to_dict() for eeg in eegs.items],
            'total': eegs.total,
            'pages': eegs.pages,
            'current_page': page,
            'per_page': per_page
        }), 200
        
    except Exception as e:
        return jsonify({'error': str(e)}), 500

@eegs_bp.route('/upload', methods=['POST'])
@jwt_required()
def upload_eeg():
    try:
        # Check if file is present
        if 'file' not in request.files:
            return jsonify({'error': 'No file provided'}), 400
        
        file = request.files['file']
        patient_id = request.form.get('patient_id')
        
        if not patient_id:
            return jsonify({'error': 'Patient ID is required'}), 400
        
        # Validate patient exists
        patient = Patient.query.get(patient_id)
        if not patient:
            return jsonify({'error': 'Patient not found'}), 404
        
        # Check age requirement
        if patient.age < 7:
            return jsonify({'error': 'Patient must be at least 7 years old for EEG analysis'}), 400
        
        if file.filename == '':
            return jsonify({'error': 'No file selected'}), 400
        
        if not allowed_file(file.filename):
            return jsonify({'error': 'Only CSV files are allowed'}), 400
        
        # Generate unique filename
        original_filename = secure_filename(file.filename)
        unique_filename = f"{uuid.uuid4()}_{original_filename}"
        file_path = os.path.join(current_app.config['UPLOAD_FOLDER'], unique_filename)
        
        # Save file
        file.save(file_path)
        file_size = os.path.getsize(file_path)
        
        # Create EEG record
        eeg_record = EEGRecord(
            patient_id=patient_id,
            filename=unique_filename,
            original_filename=original_filename,
            file_path=file_path,
            file_size=file_size,
            status='Processing'
        )
        
        db.session.add(eeg_record)
        db.session.commit()
        
        # Start async analysis task
        task = analyze_eeg_task.delay(eeg_record.id, file_path)
        eeg_record.task_id = task.id
        db.session.commit()
        
        return jsonify({'eeg': eeg_record.to_dict()}), 201
        
    except Exception as e:
        db.session.rollback()
        return jsonify({'error': str(e)}), 500

@eegs_bp.route('/<eeg_id>', methods=['GET'])
@jwt_required()
def get_eeg(eeg_id):
    try:
        eeg = EEGRecord.query.get(eeg_id)
        
        if not eeg:
            return jsonify({'error': 'EEG record not found'}), 404
        
        return jsonify({'eeg': eeg.to_dict()}), 200
        
    except Exception as e:
        return jsonify({'error': str(e)}), 500

@eegs_bp.route('/<eeg_id>', methods=['PUT'])
@jwt_required()
def update_eeg(eeg_id):
    try:
        eeg = EEGRecord.query.get(eeg_id)
        
        if not eeg:
            return jsonify({'error': 'EEG record not found'}), 404
        
        data = request.get_json()
        
        # Only allow updating certain fields
        allowed_fields = ['status', 'predicted_label', 'confidence', 'prediction_details']
        
        for field in allowed_fields:
            if field in data:
                setattr(eeg, field, data[field])
        
        db.session.commit()
        
        return jsonify({'eeg': eeg.to_dict()}), 200
        
    except Exception as e:
        db.session.rollback()
        return jsonify({'error': str(e)}), 500

@eegs_bp.route('/<eeg_id>', methods=['DELETE'])
@jwt_required()
def delete_eeg(eeg_id):
    try:
        eeg = EEGRecord.query.get(eeg_id)
        
        if not eeg:
            return jsonify({'error': 'EEG record not found'}), 404
        
        # Delete file from filesystem
        if os.path.exists(eeg.file_path):
            os.remove(eeg.file_path)
        
        db.session.delete(eeg)
        db.session.commit()
        
        return jsonify({'message': 'EEG record deleted successfully'}), 200
        
    except Exception as e:
        db.session.rollback()
        return jsonify({'error': str(e)}), 500

@eegs_bp.route('/<eeg_id>/download', methods=['GET'])
@jwt_required()
def download_eeg(eeg_id):
    try:
        eeg = EEGRecord.query.get(eeg_id)
        
        if not eeg:
            return jsonify({'error': 'EEG record not found'}), 404
        
        if eeg.status in ['Processing', 'Failed']:
            return jsonify({'error': 'File cannot be downloaded while processing or failed'}), 400
        
        if not os.path.exists(eeg.file_path):
            return jsonify({'error': 'File not found on server'}), 404
        
        return send_file(
            eeg.file_path,
            as_attachment=True,
            download_name=eeg.original_filename,
            mimetype='text/csv'
        )
        
    except Exception as e:
        return jsonify({'error': str(e)}), 500