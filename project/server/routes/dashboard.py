"""
Dashboard API routes for system statistics and summaries
"""

from flask import Blueprint, jsonify
from flask_jwt_extended import jwt_required
from models import Doctor, Patient, EEGRecord
from app import db

dashboard_bp = Blueprint('dashboard', __name__)


@dashboard_bp.route('/stats', methods=['GET'])
@jwt_required()
def get_dashboard_stats():
    """Get overall dashboard statistics"""
    try:
        total_patients = db.session.query(Patient).count()
        total_eeg_records = db.session.query(EEGRecord).count()
        total_doctors = db.session.query(Doctor).count()
        
        return jsonify({
            'status': 'success',
            'data': {
                'total_patients': total_patients,
                'total_eeg_records': total_eeg_records,
                'total_doctors': total_doctors
            }
        }), 200
    except Exception as e:
        return jsonify({
            'status': 'error',
            'message': str(e)
        }), 500


@dashboard_bp.route('/recent-eeg', methods=['GET'])
@jwt_required()
def get_recent_eeg():
    """Get recent EEG records for dashboard"""
    try:
        recent_eeg = db.session.query(EEGRecord).order_by(
            EEGRecord.created_at.desc()
        ).limit(10).all()
        
        records = [{
            'id': eeg.id,
            'patient_name': eeg.patient.name if eeg.patient else 'Unknown',
            'eeg_type': eeg.eeg_type,
            'created_at': eeg.created_at.isoformat() if eeg.created_at else None
        } for eeg in recent_eeg]
        
        return jsonify({
            'status': 'success',
            'data': records
        }), 200
    except Exception as e:
        return jsonify({
            'status': 'error',
            'message': str(e)
        }), 500
