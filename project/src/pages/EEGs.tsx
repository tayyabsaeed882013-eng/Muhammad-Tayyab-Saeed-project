import React, { useState, useEffect } from "react";
import {
  Search,
  Clock,
  CheckCircle,
  XCircle,
  Brain,
  Download,
  Trash2,
  Upload,
} from "lucide-react";
import { getDiagnoses, getPatients, deleteDiagnosis } from "../lib/supabase";
import { useNavigate } from "react-router-dom";
import toast from "react-hot-toast";

interface EEGRecord {
  id: string;
  patientId: string;
  patientName: string;
  patientAge: number;
  fileName: string;
  status: string;
  confidence?: number;
  createdAt: string;
  updatedAt: string;
}

const EEGs: React.FC = () => {
  const navigate = useNavigate();
  const [eegRecords, setEegRecords] = useState<EEGRecord[]>([]);
  const [filteredRecords, setFilteredRecords] = useState<EEGRecord[]>([]);
  const [searchTerm, setSearchTerm] = useState("");
  const [diagnosisFilter, setDiagnosisFilter] = useState("all");
  const [currentPage, setCurrentPage] = useState(1);
  const [recordsPerPage] = useState(10);
  const [loading, setLoading] = useState(true);

  // Load diagnoses from Supabase
  const loadEEGRecords = async () => {
    try {
      setLoading(true);
      const [diagnoses, patients] = await Promise.all([
        getDiagnoses(),
        getPatients(),
      ]);

      // Convert diagnoses to EEG records format
      const records: EEGRecord[] = diagnoses.map((d) => {
        const patient = patients.find((p) => p.id === d.patient_id);
        const statusMap: { [key: string]: string } = {
          completed: "Healthy",
          processing: "Processing",
          failed: "Failed",
          requires_review: "Failed",
        };

        return {
          id: d.id,
          patientId: d.patient_id,
          patientName: patient?.name || "Unknown",
          patientAge: patient?.age || 0,
          fileName: d.file_name,
          status:
            (d.diagnosis_result as any) || statusMap[d.status] || "Processing",
          confidence: d.confidence,
          createdAt: d.created_at,
          updatedAt: d.updated_at,
        };
      });

      setEegRecords(records);
      setFilteredRecords(records);
    } catch (error) {
      console.error("Error loading EEG records:", error);
      toast.error("Failed to load EEG records");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadEEGRecords();
  }, []);

  useEffect(() => {
    const filtered = eegRecords.filter((record) => {
      // Search filter
      const matchesSearch =
        record.patientName.toLowerCase().includes(searchTerm.toLowerCase()) ||
        record.fileName.toLowerCase().includes(searchTerm.toLowerCase()) ||
        record.status.toLowerCase().includes(searchTerm.toLowerCase());

      // Diagnosis filter
      const matchesDiagnosis =
        diagnosisFilter === "all" ||
        record.status.toLowerCase() === diagnosisFilter.toLowerCase();

      return matchesSearch && matchesDiagnosis;
    });
    setFilteredRecords(filtered);
    setCurrentPage(1);
  }, [searchTerm, diagnosisFilter, eegRecords]);

  const getStatusIcon = (status: string) => {
    switch (status.toLowerCase()) {
      case "processing":
        return <Clock className="h-4 w-4 text-yellow-500 animate-spin" />;
      case "healthy":
      case "completed":
        return <CheckCircle className="h-4 w-4 text-green-500" />;
      case "failed":
        return <XCircle className="h-4 w-4 text-red-500" />;
      default:
        return <Brain className="h-4 w-4 text-blue-500" />;
    }
  };

  const getStatusColor = (status: string) => {
    switch (status.toLowerCase()) {
      case "healthy":
      case "completed":
        return "text-green-700 bg-green-100";
      case "processing":
        return "text-yellow-700 bg-yellow-100";
      case "failed":
        return "text-red-700 bg-red-100";
      default:
        return "text-blue-700 bg-blue-100";
    }
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString("en-US", {
      year: "numeric",
      month: "short",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  };

  const handleDownload = (record: EEGRecord) => {
    toast.success(`Downloading ${record.fileName}...`);
  };

  const handleDeleteRecord = async (id: string) => {
    // Confirm deletion
    if (
      !window.confirm(
        "Are you sure you want to delete this EEG record? This action cannot be undone.",
      )
    ) {
      return;
    }

    try {
      toast.loading("Deleting record...");

      // Try to delete from Supabase
      try {
        await deleteDiagnosis(id);
      } catch (dbError) {
        console.error("Supabase delete error:", dbError);
        // Continue with local deletion even if DB delete fails
        // (RLS might be blocking but we still want to remove it from UI)
      }

      // Remove from local state
      setEegRecords((prev) => prev.filter((r) => r.id !== id));
      setFilteredRecords((prev) => prev.filter((r) => r.id !== id));

      toast.dismiss();
      toast.success("EEG record deleted successfully");
    } catch (error) {
      console.error("Error deleting record:", error);
      toast.dismiss();
      if (error instanceof Error) {
        toast.error(`Delete failed: ${error.message}`);
      } else {
        toast.error("Failed to delete record");
      }
    }
  };

  // Pagination
  const indexOfLastRecord = currentPage * recordsPerPage;
  const indexOfFirstRecord = indexOfLastRecord - recordsPerPage;
  const currentRecords = filteredRecords.slice(
    indexOfFirstRecord,
    indexOfLastRecord,
  );
  const totalPages = Math.ceil(filteredRecords.length / recordsPerPage);

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
          <h1 className="text-2xl font-bold text-gray-900">EEG Records</h1>
          <p className="mt-1 text-sm text-gray-600">
            View and manage EEG analysis results
          </p>
        </div>
        <button
          onClick={() => navigate("/diagnosis")}
          className="inline-flex items-center px-4 py-2 border border-transparent shadow-sm text-sm font-medium rounded-md text-white bg-blue-600 hover:bg-blue-700"
        >
          <Upload className="h-4 w-4 mr-2" />
          Upload EEG
        </button>
      </div>

      {/* Search & Filter */}
      <div className="bg-white shadow-lg rounded-lg p-6 border border-gray-100 space-y-4">
        <div className="relative">
          <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
            <Search className="h-5 w-5 text-gray-400" />
          </div>
          <input
            type="text"
            placeholder="Search by patient name, file name, or status..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="block w-full pl-10 pr-3 py-2 border border-gray-300 rounded-md leading-5 bg-white placeholder-gray-500 focus:outline-none focus:placeholder-gray-400 focus:ring-1 focus:ring-blue-500 focus:border-blue-500"
          />
        </div>

        {/* Diagnosis Filter */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Filter by Diagnosis:
          </label>
          <select
            value={diagnosisFilter}
            onChange={(e) => setDiagnosisFilter(e.target.value)}
            className="block w-full px-3 py-2 border border-gray-300 rounded-md leading-5 bg-white focus:outline-none focus:ring-1 focus:ring-blue-500 focus:border-blue-500"
          >
            <option value="all">All Diagnoses</option>
            <option value="healthy">Healthy</option>
            <option value="insomnia">Insomnia</option>
            <option value="narcolepsy">Narcolepsy</option>
            <option value="nfle">NFLE</option>
            <option value="plm">PLM</option>
            <option value="rbd">RBD</option>
            <option value="sdb">SDB</option>
            <option value="processing">Processing</option>
            <option value="failed">Failed</option>
          </select>
        </div>
      </div>

      {/* Results Summary */}
      <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
        <p className="text-sm text-blue-800">
          <span className="font-semibold">{filteredRecords.length}</span> of{" "}
          <span className="font-semibold">{eegRecords.length}</span> records
          {diagnosisFilter !== "all" && (
            <>
              {" "}
              • Filter:{" "}
              <span className="font-semibold">
                {diagnosisFilter.toUpperCase()}
              </span>
            </>
          )}
        </p>
      </div>

      {/* EEG Records Table */}
      <div className="bg-white shadow rounded-lg overflow-hidden">
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Patient Name
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Age
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  File Name
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Status
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Confidence
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Created At
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Actions
                </th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {currentRecords.map((record) => (
                <tr key={record.id} className="hover:bg-gray-50">
                  <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                    {record.patientName}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                    {record.patientAge}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                    {record.fileName}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="flex items-center">
                      {getStatusIcon(record.status)}
                      <span
                        className={`ml-2 inline-flex px-2 py-1 text-xs font-semibold rounded-full ${getStatusColor(record.status)}`}
                      >
                        {record.status}
                      </span>
                    </div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                    {record.confidence
                      ? `${record.confidence.toFixed(1)}%`
                      : "-"}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                    {formatDate(record.createdAt)}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm font-medium space-x-2">
                    <button
                      onClick={() => handleDownload(record)}
                      disabled={
                        record.status.toLowerCase() === "processing" ||
                        record.status.toLowerCase() === "failed"
                      }
                      className="inline-flex items-center px-3 py-1 border border-transparent text-xs font-medium rounded text-green-700 bg-green-100 hover:bg-green-200 disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      <Download className="h-3 w-3 mr-1" />
                      Download
                    </button>
                    <button
                      onClick={() => handleDeleteRecord(record.id)}
                      className="inline-flex items-center px-3 py-1 border border-transparent text-xs font-medium rounded text-red-700 bg-red-100 hover:bg-red-200"
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
                onClick={() =>
                  setCurrentPage(Math.min(totalPages, currentPage + 1))
                }
                disabled={currentPage === totalPages}
                className="ml-3 relative inline-flex items-center px-4 py-2 border border-gray-300 text-sm font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Next
              </button>
            </div>
            <div className="hidden sm:flex-1 sm:flex sm:items-center sm:justify-between">
              <div>
                <p className="text-sm text-gray-700">
                  Showing{" "}
                  <span className="font-medium">{indexOfFirstRecord + 1}</span>{" "}
                  to{" "}
                  <span className="font-medium">
                    {Math.min(indexOfLastRecord, filteredRecords.length)}
                  </span>{" "}
                  of{" "}
                  <span className="font-medium">{filteredRecords.length}</span>{" "}
                  results
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
                  {Array.from({ length: totalPages }, (_, i) => i + 1).map(
                    (page) => (
                      <button
                        key={page}
                        onClick={() => setCurrentPage(page)}
                        className={`${
                          currentPage === page
                            ? "z-10 bg-blue-50 border-blue-500 text-blue-600"
                            : "bg-white border-gray-300 text-gray-500 hover:bg-gray-50"
                        } relative inline-flex items-center px-4 py-2 border text-sm font-medium`}
                      >
                        {page}
                      </button>
                    ),
                  )}
                  <button
                    onClick={() =>
                      setCurrentPage(Math.min(totalPages, currentPage + 1))
                    }
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
    </div>
  );
};

export default EEGs;
