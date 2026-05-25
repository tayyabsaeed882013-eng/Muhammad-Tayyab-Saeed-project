import React, { useState, useEffect } from 'react';
import { Users, Stethoscope, FileText, AlertTriangle, TrendingUp, Clock, CheckCircle } from 'lucide-react';
import { Link } from 'react-router-dom';
import { getPatients, getDiagnoses, subscribeToPatients, subscribeToDiagnoses } from '../lib/supabase';

interface DashboardStats {
  totalPatients: number;
  undiagnosedPatients: number;
  diagnosedToday: number;
  totalDiagnoses: number;
  recentActivity: Array<{
    id: string;
    patientName: string;
    action: string;
    status: string;
    timestamp: string;
  }>;
}

const Dashboard: React.FC = () => {
  const [stats, setStats] = useState<DashboardStats>({
    totalPatients: 0,
    undiagnosedPatients: 0,
    diagnosedToday: 0,
    totalDiagnoses: 0,
    recentActivity: []
  });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadDashboardData();

    // Subscribe to real-time updates
    const patientsSubscription = subscribeToPatients(() => {
      loadDashboardData();
    });

    const diagnosesSubscription = subscribeToDiagnoses(() => {
      loadDashboardData();
    });

    return () => {
      patientsSubscription.unsubscribe();
      diagnosesSubscription.unsubscribe();
    };
  }, []);

  const loadDashboardData = async () => {
    try {
      const [patients, diagnoses] = await Promise.all([
        getPatients(),
        getDiagnoses()
      ]);

      const today = new Date();
      today.setHours(0, 0, 0, 0);

      const diagnosedToday = diagnoses.filter(d => 
        new Date(d.created_at) >= today && d.status === 'completed'
      ).length;

      // Create recent activity from patients and diagnoses
      const recentActivity = [
        ...patients.slice(0, 3).map(p => ({
          id: p.id,
          patientName: p.name,
          action: 'Patient Added',
          status: p.status === 'undiagnosed' ? 'Undiagnosed' : 'Diagnosed',
          timestamp: p.created_at
        })),
        ...diagnoses.slice(0, 2).map(d => ({
          id: d.id,
          patientName: d.patient?.name || 'Unknown',
          action: 'Diagnosis Completed',
          status: d.diagnosis_result || 'Processing',
          timestamp: d.updated_at
        }))
      ].sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()).slice(0, 5);

      setStats({
        totalPatients: patients.length,
        undiagnosedPatients: patients.filter(p => p.status === 'undiagnosed').length,
        diagnosedToday,
        totalDiagnoses: diagnoses.filter(d => d.status === 'completed').length,
        recentActivity
      });
    } catch (error) {
      console.error('Error loading dashboard data:', error);
    } finally {
      setLoading(false);
    }
  };

  const getStatusColor = (status: string) => {
    switch (status.toLowerCase()) {
      case 'healthy':
        return 'text-green-600 bg-green-50';
      case 'undiagnosed':
        return 'text-yellow-600 bg-yellow-50';
      case 'requires attention':
        return 'text-red-600 bg-red-50';
      case 'completed':
      case 'diagnosed':
        return 'text-blue-600 bg-blue-50';
      default:
        return 'text-gray-600 bg-gray-50';
    }
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-64">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="text-center">
        <h1 className="text-3xl font-bold bg-gradient-to-r from-blue-600 to-indigo-600 bg-clip-text text-transparent">
          Medical Diagnosis Dashboard
        </h1>
        <p className="mt-2 text-gray-600">
          Monitor patient status and system activity
        </p>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <div className="bg-white rounded-xl shadow-lg p-6 border border-blue-100 hover:shadow-xl transition-shadow">
          <div className="flex items-center">
            <div className="flex-shrink-0">
              <div className="bg-gradient-to-r from-blue-500 to-blue-600 p-3 rounded-lg">
                <Users className="h-8 w-8 text-white" />
              </div>
            </div>
            <div className="ml-5 w-0 flex-1">
              <dl>
                <dt className="text-sm font-medium text-gray-500 truncate">
                  Total Patients
                </dt>
                <dd className="text-3xl font-bold text-gray-900">
                  {stats.totalPatients}
                </dd>
              </dl>
            </div>
          </div>
        </div>

        <div className="bg-white rounded-xl shadow-lg p-6 border border-yellow-100 hover:shadow-xl transition-shadow">
          <div className="flex items-center">
            <div className="flex-shrink-0">
              <div className="bg-gradient-to-r from-yellow-500 to-orange-500 p-3 rounded-lg">
                <AlertTriangle className="h-8 w-8 text-white" />
              </div>
            </div>
            <div className="ml-5 w-0 flex-1">
              <dl>
                <dt className="text-sm font-medium text-gray-500 truncate">
                  Undiagnosed
                </dt>
                <dd className="text-3xl font-bold text-gray-900">
                  {stats.undiagnosedPatients}
                </dd>
              </dl>
            </div>
          </div>
        </div>

        <div className="bg-white rounded-xl shadow-lg p-6 border border-green-100 hover:shadow-xl transition-shadow">
          <div className="flex items-center">
            <div className="flex-shrink-0">
              <div className="bg-gradient-to-r from-green-500 to-emerald-500 p-3 rounded-lg">
                <Stethoscope className="h-8 w-8 text-white" />
              </div>
            </div>
            <div className="ml-5 w-0 flex-1">
              <dl>
                <dt className="text-sm font-medium text-gray-500 truncate">
                  Diagnosed Today
                </dt>
                <dd className="text-3xl font-bold text-gray-900">
                  {stats.diagnosedToday}
                </dd>
              </dl>
            </div>
          </div>
        </div>

        <div className="bg-white rounded-xl shadow-lg p-6 border border-purple-100 hover:shadow-xl transition-shadow">
          <div className="flex items-center">
            <div className="flex-shrink-0">
              <div className="bg-gradient-to-r from-purple-500 to-indigo-500 p-3 rounded-lg">
                <TrendingUp className="h-8 w-8 text-white" />
              </div>
            </div>
            <div className="ml-5 w-0 flex-1">
              <dl>
                <dt className="text-sm font-medium text-gray-500 truncate">
                  Total Diagnoses
                </dt>
                <dd className="text-3xl font-bold text-gray-900">
                  {stats.totalDiagnoses}
                </dd>
              </dl>
            </div>
          </div>
        </div>
      </div>

      {/* Quick Actions */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <Link
          to="/patients"
          className="bg-white rounded-xl shadow-lg p-6 border border-blue-100 hover:shadow-xl hover:border-blue-200 transition-all group"
        >
          <div className="flex items-center">
            <Users className="h-8 w-8 text-blue-600 group-hover:text-blue-700" />
            <div className="ml-4">
              <h3 className="text-lg font-semibold text-gray-900">Manage Patients</h3>
              <p className="text-sm text-gray-600">Add and view patient records</p>
            </div>
          </div>
        </Link>

        <Link
          to="/diagnosis"
          className="bg-white rounded-xl shadow-lg p-6 border border-green-100 hover:shadow-xl hover:border-green-200 transition-all group"
        >
          <div className="flex items-center">
            <Stethoscope className="h-8 w-8 text-green-600 group-hover:text-green-700" />
            <div className="ml-4">
              <h3 className="text-lg font-semibold text-gray-900">Run Diagnosis</h3>
              <p className="text-sm text-gray-600">Analyze patient data</p>
            </div>
          </div>
        </Link>

        <Link
          to="/reports"
          className="bg-white rounded-xl shadow-lg p-6 border border-purple-100 hover:shadow-xl hover:border-purple-200 transition-all group"
        >
          <div className="flex items-center">
            <FileText className="h-8 w-8 text-purple-600 group-hover:text-purple-700" />
            <div className="ml-4">
              <h3 className="text-lg font-semibold text-gray-900">View Reports</h3>
              <p className="text-sm text-gray-600">Generate and download reports</p>
            </div>
          </div>
        </Link>
      </div>

      {/* Recent Activity */}
      <div className="bg-white shadow-lg rounded-xl border border-gray-100">
        <div className="px-6 py-4 border-b border-gray-200">
          <div className="flex items-center justify-between">
            <h3 className="text-lg font-semibold text-gray-900">Recent Activity</h3>
            <Clock className="h-5 w-5 text-gray-400" />
          </div>
        </div>
        <div className="p-6">
          {stats.recentActivity.length === 0 ? (
            <div className="text-center py-8">
              <AlertTriangle className="mx-auto h-12 w-12 text-gray-400" />
              <h3 className="mt-2 text-sm font-medium text-gray-900">No recent activity</h3>
              <p className="mt-1 text-sm text-gray-500">
                System activity will appear here as you use the application.
              </p>
            </div>
          ) : (
            <div className="space-y-4">
              {stats.recentActivity.map((activity) => (
                <div key={activity.id} className="flex items-center justify-between p-4 bg-gray-50 rounded-lg hover:bg-gray-100 transition-colors">
                  <div className="flex items-center space-x-4">
                    <div className="flex-shrink-0">
                      {activity.action.includes('Diagnosis') ? (
                        <Stethoscope className="h-5 w-5 text-green-600" />
                      ) : activity.action.includes('Patient') ? (
                        <Users className="h-5 w-5 text-blue-600" />
                      ) : (
                        <FileText className="h-5 w-5 text-purple-600" />
                      )}
                    </div>
                    <div>
                      <p className="text-sm font-medium text-gray-900">
                        {activity.patientName}
                      </p>
                      <p className="text-sm text-gray-600">
                        {activity.action}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center space-x-3">
                    <span className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${getStatusColor(activity.status)}`}>
                      {activity.status}
                    </span>
                    <span className="text-sm text-gray-500">
                      {formatDate(activity.timestamp)}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default Dashboard;