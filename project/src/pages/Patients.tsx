import React, { useState, useEffect, useCallback } from 'react';
import { Plus, Edit, Trash2, Search, AlertTriangle, Phone, Mail } from 'lucide-react';
import { getPatients, createPatient, updatePatient, deletePatient, subscribeToPatients, Patient, supabase } from '../lib/supabase';
import AddPatientModal from '../components/AddPatientModal';
import EditPatientModal from '../components/EditPatientModal';
import DeleteConfirmModal from '../components/DeleteConfirmModal';
import toast from 'react-hot-toast';

const Patients: React.FC = () => {
  const [patients, setPatients] = useState<Patient[]>([]);
  const [filteredPatients, setFilteredPatients] = useState<Patient[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | 'undiagnosed' | 'diagnosed'>('all');
  const [showAddModal, setShowAddModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [selectedPatient, setSelectedPatient] = useState<Patient | null>(null);
  const [currentPage, setCurrentPage] = useState(1);
  const [patientsPerPage] = useState(10);
  const [loading, setLoading] = useState(true);

  // Memoize loadPatients to avoid recreating it on each render
  const loadPatients = useCallback(async () => {
    try {
      console.log('Loading patients...');
      setLoading(true);
      const data = await getPatients();
      console.log('Patients loaded:', data.length);
      setPatients(data);
    } catch (error: any) {
      console.error('Error loading patients:', error);
      toast.error('Failed to load patients');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    // Initial data fetch
    loadPatients();

    // Set up direct real-time subscription to ensure immediate updates
    const channel = supabase
      .channel('patients-direct-changes')
      .on('postgres_changes', 
        { event: '*', schema: 'public', table: 'patients' }, 
        (payload) => {
          console.log('Real-time update received:', payload);
          loadPatients(); // Immediately reload patients on any change
        }
      )
      .subscribe();

    return () => {
      channel.unsubscribe();
    };
  }, [loadPatients]);

  useEffect(() => {
    let filtered = patients.filter(patient => {
      const matchesSearch = patient.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
                           patient.email.toLowerCase().includes(searchTerm.toLowerCase()) ||
                           patient.phone.includes(searchTerm);
      
      const matchesStatus = statusFilter === 'all' || 
                           (statusFilter === 'undiagnosed' && patient.status === 'undiagnosed') ||
                           (statusFilter === 'diagnosed' && patient.status === 'diagnosed');
      
      return matchesSearch && matchesStatus;
    });

    // Sort undiagnosed patients first
    filtered.sort((a, b) => {
      if (a.status === 'undiagnosed' && b.status === 'diagnosed') return -1;
      if (a.status === 'diagnosed' && b.status === 'undiagnosed') return 1;
      return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
    });

    setFilteredPatients(filtered);
    setCurrentPage(1);
  }, [searchTerm, statusFilter, patients]);

  const handleAddPatient = async (patientData: Omit<Patient, 'id' | 'created_at' | 'updated_at' | 'status'>) => {
    try {
      console.log('Adding patient:', patientData);
      const newPatient = await createPatient(patientData);
      console.log('Patient added successfully:', newPatient);
      setShowAddModal(false);
      toast.success('Patient added successfully');
      
      // Force refresh immediately after adding
      loadPatients();
    } catch (error: any) {
      console.error('Error adding patient:', error);
      toast.error(`Failed to add patient: ${error?.message || 'Unknown error'}`);
    }
  };

  const handleEditPatient = async (patientData: Omit<Patient, 'id' | 'created_at' | 'updated_at' | 'status'>) => {
    if (!selectedPatient) return;
    
    try {
      console.log('Updating patient:', selectedPatient.id, patientData);
      const updatedPatient = await updatePatient(selectedPatient.id, patientData);
      console.log('Patient updated successfully:', updatedPatient);
      setShowEditModal(false);
      setSelectedPatient(null);
      toast.success('Patient updated successfully');
      
      // Force refresh immediately after updating
      loadPatients();
    } catch (error: any) {
      console.error('Error updating patient:', error);
      toast.error('Failed to update patient');
    }
  };

  const handleDeletePatient = async () => {
    if (!selectedPatient) return;
    
    try {
      console.log('Deleting patient:', selectedPatient.id);
      await deletePatient(selectedPatient.id);
      console.log('Patient deleted successfully');
      setShowDeleteModal(false);
      setSelectedPatient(null);
      toast.success('Patient deleted successfully');
      
      // Force refresh immediately after deleting
      loadPatients();
    } catch (error: any) {
      console.error('Error deleting patient:', error);
      toast.error('Failed to delete patient');
    }
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric'
    });
  };

  const getStatusColor = (status: string) => {
    return status === 'undiagnosed' 
      ? 'text-yellow-700 bg-yellow-100 border-yellow-200' 
      : 'text-green-700 bg-green-100 border-green-200';
  };

  // Pagination
  const indexOfLastPatient = currentPage * patientsPerPage;
  const indexOfFirstPatient = indexOfLastPatient - patientsPerPage;
  const currentPatients = filteredPatients.slice(indexOfFirstPatient, indexOfLastPatient);
  const totalPages = Math.ceil(filteredPatients.length / patientsPerPage);

  const undiagnosedCount = patients.filter(p => p.status === 'undiagnosed').length;

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-64">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Patient Management</h1>
          <p className="mt-1 text-sm text-gray-600">
            Manage patient records and track diagnosis status
          </p>
        </div>
        <button
          onClick={() => setShowAddModal(true)}
          className="inline-flex items-center px-4 py-2 border border-transparent shadow-sm text-sm font-medium rounded-lg text-white bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 transition-all"
        >
          <Plus className="h-4 w-4 mr-2" />
          Add Patient
        </button>
      </div>

      {/* Undiagnosed Alert */}
      {undiagnosedCount > 0 && (
        <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
          <div className="flex items-center">
            <AlertTriangle className="h-5 w-5 text-yellow-600 mr-2" />
            <p className="text-sm font-medium text-yellow-800">
              {undiagnosedCount} patient{undiagnosedCount > 1 ? 's' : ''} require{undiagnosedCount === 1 ? 's' : ''} diagnosis
            </p>
          </div>
        </div>
      )}

      {/* Filters */}
      <div className="bg-white shadow-lg rounded-lg p-6 border border-gray-100">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="relative">
            <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
              <Search className="h-5 w-5 text-gray-400" />
            </div>
            <input
              type="text"
              placeholder="Search by name, email, or phone..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="block w-full pl-10 pr-3 py-2 border border-gray-300 rounded-lg leading-5 bg-white placeholder-gray-500 focus:outline-none focus:placeholder-gray-400 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            />
          </div>
          
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value as 'all' | 'undiagnosed' | 'diagnosed')}
            className="block w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          >
            <option value="all">All Patients</option>
            <option value="undiagnosed">Undiagnosed Only</option>
            <option value="diagnosed">Diagnosed Only</option>
          </select>
        </div>
      </div>

      {/* Patients Table */}
      <div className="bg-white shadow-lg rounded-lg overflow-hidden border border-gray-100">
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gradient-to-r from-gray-50 to-gray-100">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Patient Details
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Contact Info
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Status
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Added
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Actions
                </th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {currentPatients.map((patient) => (
                <tr key={patient.id} className="hover:bg-gray-50 transition-colors">
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div>
                      <div className="text-sm font-medium text-gray-900">{patient.name}</div>
                      <div className="text-sm text-gray-500">
                        {patient.age} years • {patient.gender}
                      </div>
                    </div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="space-y-1">
                      <div className="flex items-center text-sm text-gray-600">
                        <Phone className="h-3 w-3 mr-1" />
                        {patient.phone}
                      </div>
                      <div className="flex items-center text-sm text-gray-600">
                        <Mail className="h-3 w-3 mr-1" />
                        {patient.email}
                      </div>
                    </div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <span className={`inline-flex px-3 py-1 text-xs font-semibold rounded-full border ${getStatusColor(patient.status)}`}>
                      {patient.status}
                    </span>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                    {formatDate(patient.created_at)}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm font-medium space-x-2">
                    <button
                      onClick={() => {
                        setSelectedPatient(patient);
                        setShowEditModal(true);
                      }}
                      className="inline-flex items-center px-3 py-1 border border-transparent text-xs font-medium rounded text-blue-700 bg-blue-100 hover:bg-blue-200 transition-colors"
                    >
                      <Edit className="h-3 w-3 mr-1" />
                      Edit
                    </button>
                    <button
                      onClick={() => {
                        setSelectedPatient(patient);
                        setShowDeleteModal(true);
                      }}
                      className="inline-flex items-center px-3 py-1 border border-transparent text-xs font-medium rounded text-red-700 bg-red-100 hover:bg-red-200 transition-colors"
                    >
                      <Trash2 className="h-3 w-3 mr-1" />
                      Delete
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* Pagination */}
        {totalPages > 1 && (
          <div className="bg-white px-4 py-3 flex items-center justify-between border-t border-gray-200 sm:px-6">
            <div className="flex-1 flex justify-between sm:hidden">
              <button
                onClick={() => setCurrentPage(Math.max(1, currentPage - 1))}
                disabled={currentPage === 1}
                className="relative inline-flex items-center px-4 py-2 border border-gray-300 text-sm font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Previous
              </button>
              <button
                onClick={() => setCurrentPage(Math.min(totalPages, currentPage + 1))}
                disabled={currentPage === totalPages}
                className="ml-3 relative inline-flex items-center px-4 py-2 border border-gray-300 text-sm font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Next
              </button>
            </div>
            <div className="hidden sm:flex-1 sm:flex sm:items-center sm:justify-between">
              <div>
                <p className="text-sm text-gray-700">
                  Showing{' '}
                  <span className="font-medium">{indexOfFirstPatient + 1}</span>
                  {' '}to{' '}
                  <span className="font-medium">
                    {Math.min(indexOfLastPatient, filteredPatients.length)}
                  </span>
                  {' '}of{' '}
                  <span className="font-medium">{filteredPatients.length}</span>
                  {' '}results
                </p>
              </div>
              <div>
                <nav className="relative z-0 inline-flex rounded-md shadow-sm -space-x-px">
                  <button
                    onClick={() => setCurrentPage(Math.max(1, currentPage - 1))}
                    disabled={currentPage === 1}
                    className="relative inline-flex items-center px-2 py-2 rounded-l-md border border-gray-300 bg-white text-sm font-medium text-gray-500 hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    Previous
                  </button>
                  {Array.from({ length: totalPages }, (_, i) => i + 1).map((page) => (
                    <button
                      key={page}
                      onClick={() => setCurrentPage(page)}
                      className={`${
                        currentPage === page
                          ? 'z-10 bg-blue-50 border-blue-500 text-blue-600'
                          : 'bg-white border-gray-300 text-gray-500 hover:bg-gray-50'
                      } relative inline-flex items-center px-4 py-2 border text-sm font-medium`}
                    >
                      {page}
                    </button>
                  ))}
                  <button
                    onClick={() => setCurrentPage(Math.min(totalPages, currentPage + 1))}
                    disabled={currentPage === totalPages}
                    className="relative inline-flex items-center px-2 py-2 rounded-r-md border border-gray-300 bg-white text-sm font-medium text-gray-500 hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    Next
                  </button>
                </nav>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Modals */}
      <AddPatientModal
        isOpen={showAddModal}
        onClose={() => setShowAddModal(false)}
        onAdd={handleAddPatient}
      />

      <EditPatientModal
        isOpen={showEditModal}
        onClose={() => {
          setShowEditModal(false);
          setSelectedPatient(null);
        }}
        onEdit={handleEditPatient}
        patient={selectedPatient}
      />

      <DeleteConfirmModal
        isOpen={showDeleteModal}
        onClose={() => {
          setShowDeleteModal(false);
          setSelectedPatient(null);
        }}
        onConfirm={handleDeletePatient}
        title="Delete Patient"
        message={`Are you sure you want to delete ${selectedPatient?.name}? This action cannot be undone and will remove all associated diagnosis data.`}
      />
    </div>
  );
};

export default Patients;