"""
Authentication routes for EEG Analysis App
"""

from flask import Blueprint, request, jsonify
from flask_jwt_extended import create_access_token, jwt_required, get_jwt_identity
from werkzeug.security import check_password_hash
from models import Doctor, db

auth_bp = Blueprint('auth', __name__)

@auth_bp.route('/login', methods=['POST'])
def login():
    try:
        data = request.get_json()
        username = data.get('username')
        password = data.get('password')
        
        if not username or not password:
            return jsonify({'error': 'Username and password are required'}), 400
        
        # Find doctor by username
        doctor = Doctor.query.filter_by(username=username).first()
        
        if not doctor or not check_password_hash(doctor.password_hash, password):
            return jsonify({'error': 'Invalid credentials'}), 401
        
        # Create access token
        access_token = create_access_token(identity=doctor.id)
        
        return jsonify({
            'access_token': access_token,
            'doctor': doctor.to_dict()
        }), 200
        
    except Exception as e:
        return jsonify({'error': str(e)}), 500

@auth_bp.route('/logout', methods=['POST'])
@jwt_required()
def logout():
    # In a real app, you might want to blacklist the token
    return jsonify({'message': 'Successfully logged out'}), 200

@auth_bp.route('/me', methods=['GET'])
@jwt_required()
def get_current_user():
    try:
        doctor_id = get_jwt_identity()
        doctor = Doctor.query.get(doctor_id)
        
        if not doctor:
            return jsonify({'error': 'Doctor not found'}), 404
        
        return jsonify({'doctor': doctor.to_dict()}), 200
        
    except Exception as e:
        return jsonify({'error': str(e)}), 500