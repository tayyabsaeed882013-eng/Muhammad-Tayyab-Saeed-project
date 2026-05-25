"""
Patient management routes for EEG Analysis App
"""

from flask import Blueprint, request, jsonify
from flask_jwt_extended import jwt_required
from models import Patient, db
from sqlalchemy import or_

patients_bp = Blueprint('patients', __name__)

@patients_bp.route('', methods=['GET'])
@jwt_required()
def get_patients():
    try:
        # Get query parameters
        page = request.args.get('page', 1, type=int)
        per_page = request.args.get('per_page', 10, type=int)
        search = request.args.get('search', '', type=str)
        
        # Build query
        query = Patient.query
        
        if search:
            query = query.filter(
                or_(
                    Patient.name.contains(search),
                    Patient.age.like(f'%{search}%'),
                    Patient.gender.contains(search)
                )
            )
        
        # Paginate results
        patients = query.order_by(Patient.created_at.desc()).paginate(
            page=page, per_page=per_page, error_out=False
        )
        
        return jsonify({
            'patients': [patient.to_dict() for patient in patients.items],
            'total': patients.total,
            'pages': patients.pages,
            'current_page': page,
            'per_page': per_page
        }), 200
        
    except Exception as e:
        return jsonify({'error': str(e)}), 500

@patients_bp.route('', methods=['POST'])
@jwt_required()
def create_patient():
    try:
        data = request.get_json()
        
        # Validate required fields
        required_fields = ['name', 'age', 'gender']
        for field in required_fields:
            if field not in data:
                return jsonify({'error': f'{field} is required'}), 400
        
        # Validate age
        if not isinstance(data['age'], int) or data['age'] <= 0:
            return jsonify({'error': 'Age must be a positive integer'}), 400
        
        # Validate gender
        if data['gender'] not in ['male', 'female']:
            return jsonify({'error': 'Gender must be either "male" or "female"'}), 400
        
        # Create new patient
        patient = Patient(
            name=data['name'].strip(),
            age=data['age'],
            gender=data['gender']
        )
        
        db.session.add(patient)
        db.session.commit()
        
        return jsonify({'patient': patient.to_dict()}), 201
        
    except Exception as e:
        db.session.rollback()
        return jsonify({'error': str(e)}), 500

@patients_bp.route('/<patient_id>', methods=['GET'])
@jwt_required()
def get_patient(patient_id):
    try:
        patient = Patient.query.get(patient_id)
        
        if not patient:
            return jsonify({'error': 'Patient not found'}), 404
        
        return jsonify({'patient': patient.to_dict()}), 200
        
    except Exception as e:
        return jsonify({'error': str(e)}), 500

@patients_bp.route('/<patient_id>', methods=['PUT'])
@jwt_required()
def update_patient(patient_id):
    try:
        patient = Patient.query.get(patient_id)
        
        if not patient:
            return jsonify({'error': 'Patient not found'}), 404
        
        data = request.get_json()
        
        # Update fields if provided
        if 'name' in data:
            patient.name = data['name'].strip()
        
        if 'age' in data:
            if not isinstance(data['age'], int) or data['age'] <= 0:
                return jsonify({'error': 'Age must be a positive integer'}), 400
            patient.age = data['age']
        
        if 'gender' in data:
            if data['gender'] not in ['male', 'female']:
                return jsonify({'error': 'Gender must be either "male" or "female"'}), 400
            patient.gender = data['gender']
        
        db.session.commit()
        
        return jsonify({'patient': patient.to_dict()}), 200
        
    except Exception as e:
        db.session.rollback()
        return jsonify({'error': str(e)}), 500

@patients_bp.route('/<patient_id>', methods=['DELETE'])
@jwt_required()
def delete_patient(patient_id):
    try:
        patient = Patient.query.get(patient_id)
        
        if not patient:
            return jsonify({'error': 'Patient not found'}), 404
        
        # Check if patient has EEG records
        if patient.eeg_records:
            return jsonify({'error': 'Cannot delete patient with existing EEG records'}), 400
        
        db.session.delete(patient)
        db.session.commit()
        
        return jsonify({'message': 'Patient deleted successfully'}), 200
        
    except Exception as e:
        db.session.rollback()
        return jsonify({'error': str(e)}), 500