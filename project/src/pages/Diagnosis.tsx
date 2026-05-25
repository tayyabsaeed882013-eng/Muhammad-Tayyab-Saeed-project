import React, { useState, useEffect, useCallback } from "react";
import {
  Stethoscope,
  Upload,
  AlertTriangle,
  CheckCircle,
  Clock,
  FileText,
} from "lucide-react";
import DiagnosisModal from "../components/DiagnosisModal";
import toast from "react-hot-toast";
import {
  supabase,
  getPatients,
  createDiagnosis,
  updatePatient,
  getDiagnoses,
} from "../lib/supabase";

const API_BASE_URL =
  import.meta.env.VITE_API_BASE_URL || "http://127.0.0.1:5000";

interface Patient {
  id: string;
  name: string;
  age: number;
  gender: "male" | "female";
  phone: string;
  email: string;
  status: "undiagnosed" | "diagnosed";
  created_at: string;
  updated_at: string;
}

interface Diagnosis {
  id: string;
  patient_id: string;
  file_name: string;
  file_url?: string;
  diagnosis_result?: string;
  confidence?: number;
  status: "processing" | "completed" | "failed" | "requires_review";
  created_at: string;
  updated_at: string;
  patient?: Patient;
}

interface PredictionResult {
  predicted_label: string;
  confidence: number;
  low_confidence?: boolean;
}

const Diagnosis: React.FC = () => {
  const [patients, setPatients] = useState<Patient[]>([]);
  const [diagnoses, setDiagnoses] = useState<Diagnosis[]>([]);
  const [undiagnosedPatients, setUndiagnosedPatients] = useState<Patient[]>([]);
  const [showDiagnosisModal, setShowDiagnosisModal] = useState(false);
  const [selectedPatient, setSelectedPatient] = useState<Patient | null>(null);
  const [processingPatients, setProcessingPatients] = useState<Set<string>>(
    new Set(),
  );
  const [loading, setLoading] = useState(true);
  const [loadingDiagnoses, setLoadingDiagnoses] = useState(true);
  const [apiStatus, setApiStatus] = useState<"online" | "offline" | "checking">(
    "checking",
  );

  // Check if the API is online
  useEffect(() => {
    const checkApiStatus = async () => {
      try {
        const response = await fetch(`${API_BASE_URL}/health`);
        if (response.ok) {
          setApiStatus("online");
        } else {
          setApiStatus("offline");
        }
      } catch (error) {
        console.error("API health check failed:", error);
        setApiStatus("offline");
      }
    };

    checkApiStatus();
  }, []);

  // Memoize fetch functions to avoid recreating them on each render
  const fetchPatients = useCallback(async () => {
    try {
      console.log("Fetching patients...");
      setLoading(true);
      const data = await getPatients();
      console.log("Patients fetched:", data.length);
      setPatients(data);
      setUndiagnosedPatients(data.filter((p) => p.status === "undiagnosed"));
    } catch (error) {
      console.error("Error fetching patients:", error);
      toast.error("Failed to load patients");
    } finally {
      setLoading(false);
    }
  }, []);

  const fetchDiagnoses = useCallback(async () => {
    try {
      console.log("Fetching diagnoses...");
      setLoadingDiagnoses(true);
      const data = await getDiagnoses();
      console.log("Diagnoses fetched:", data.length);
      setDiagnoses(data);
    } catch (error) {
      console.error("Error fetching diagnoses:", error);
      toast.error("Failed to load diagnoses");
    } finally {
      setLoadingDiagnoses(false);
    }
  }, []);

  useEffect(() => {
    // Initial data fetch
    fetchPatients();
    fetchDiagnoses();

    // Debounce timers to avoid excessive refetches
    let patientsFetchTimeout: NodeJS.Timeout | null = null;
    let diagnosesFetchTimeout: NodeJS.Timeout | null = null;

    // Set up direct real-time subscriptions with debouncing
    const patientsChannel = supabase
      .channel("diagnosis-patients-changes")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "patients" },
        (payload) => {
          console.log("Real-time patient update received:", payload);
          // Clear existing timeout and set a new one (debounce for 1 second)
          if (patientsFetchTimeout) clearTimeout(patientsFetchTimeout);
          patientsFetchTimeout = setTimeout(() => {
            fetchPatients();
          }, 1000);
        },
      )
      .subscribe();

    const diagnosesChannel = supabase
      .channel("diagnosis-diagnoses-changes")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "diagnoses" },
        (payload) => {
          console.log("Real-time diagnosis update received:", payload);
          // Clear existing timeout and set a new one (debounce for 1 second)
          if (diagnosesFetchTimeout) clearTimeout(diagnosesFetchTimeout);
          diagnosesFetchTimeout = setTimeout(() => {
            fetchDiagnoses();
          }, 1000);
        },
      )
      .subscribe();

    return () => {
      patientsChannel.unsubscribe();
      diagnosesChannel.unsubscribe();
      if (patientsFetchTimeout) clearTimeout(patientsFetchTimeout);
      if (diagnosesFetchTimeout) clearTimeout(diagnosesFetchTimeout);
    };
  }, [fetchPatients, fetchDiagnoses]);

  const handleStartDiagnosis = (patient: Patient) => {
    if (apiStatus === "offline") {
      toast.error(
        "The prediction API is currently offline. Please try again later.",
      );
      return;
    }

    setSelectedPatient(patient);
    setShowDiagnosisModal(true);
  };

  const handleDiagnosisSubmit = async (
    patientId: string,
    file: File,
    predictionResult: PredictionResult,
  ) => {
    setProcessingPatients((prev) => new Set(prev).add(patientId));
    setShowDiagnosisModal(false);
    setSelectedPatient(null);

    // Show immediate feedback about prediction
    const savingToastId = toast.loading(
      `📊 Saving diagnosis: ${predictionResult.predicted_label} (${predictionResult.confidence.toFixed(1)}%)...`,
    );

    try {
      console.log("Starting diagnosis submission for patient:", patientId);
      console.log("Prediction result:", predictionResult);

      // Validate prediction result
      if (!predictionResult.predicted_label) {
        predictionResult.predicted_label = "Unknown";
      }

      if (
        typeof predictionResult.confidence !== "number" ||
        isNaN(predictionResult.confidence)
      ) {
        predictionResult.confidence = 0;
      }

      // Step 1: Try to upload the file first
      let fileUrl = "";
      try {
        toast.loading("📁 Uploading EEG file...", { id: savingToastId });

        const fileExt = file.name.split(".").pop();
        const fileName = `${patientId}_${Date.now()}.${fileExt}`;
        const filePath = `diagnoses/${fileName}`;

        // Create a blob from the file
        const fileBlob = new Blob([file], { type: file.type });

        const { error: uploadError } = await supabase.storage
          .from("medical-files")
          .upload(filePath, fileBlob, {
            cacheControl: "3600",
            upsert: true,
            contentType: file.type,
          });

        if (!uploadError) {
          // Get the public URL
          const { data } = supabase.storage
            .from("medical-files")
            .getPublicUrl(filePath);

          if (data?.publicUrl) {
            fileUrl = data.publicUrl;
            console.log("File uploaded successfully:", fileUrl);
          }
        } else {
          console.error("File upload error:", uploadError);
        }
      } catch (uploadErr) {
        console.error("File upload error (non-critical):", uploadErr);
      }

      // Step 2: Insert the diagnosis record with all data at once
      toast.loading("💾 Creating diagnosis record...", { id: savingToastId });

      const diagnosisData = {
        patient_id: patientId,
        file_name: file.name,
        file_url: fileUrl || null,
        diagnosis_result: predictionResult.predicted_label,
        confidence: predictionResult.confidence,
        // Keep status DB-compatible across environments.
        status: "completed",
      };

      console.log("Creating diagnosis with data:", diagnosisData);
      await createDiagnosis(diagnosisData);

      // Step 3: Update patient status locally first for immediate UI feedback
      setPatients((prev) =>
        prev.map((p) =>
          p.id === patientId ? { ...p, status: "diagnosed" } : p,
        ),
      );
      setUndiagnosedPatients((prev) => prev.filter((p) => p.id !== patientId));

      // Step 4: Update patient status in database
      toast.loading("👤 Updating patient status...", { id: savingToastId });
      console.log("Updating patient status to diagnosed");
      await updatePatient(patientId, { status: "diagnosed" });

      // Success - update UI
      setProcessingPatients((prev) => {
        const newSet = new Set(prev);
        newSet.delete(patientId);
        return newSet;
      });

      toast.dismiss(savingToastId);
      toast.success(
        `✅ Diagnosis complete: ${predictionResult.predicted_label} (${predictionResult.confidence.toFixed(1)}%)`,
      );

      // Real-time subscriptions will handle the refresh automatically
      // No need for manual refetch
    } catch (error) {
      console.error("Diagnosis error:", error);

      // Revert local state on error
      setProcessingPatients((prev) => {
        const newSet = new Set(prev);
        newSet.delete(patientId);
        return newSet;
      });

      toast.dismiss(savingToastId);
      if (error instanceof Error) {
        toast.error(`❌ Error: ${error.message}`);
      } else {
        toast.error("Failed to save diagnosis. Please try again.");
      }
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

  const getStatusColor = (status: string) => {
    return status === "undiagnosed"
      ? "text-yellow-700 bg-yellow-100 border-yellow-200"
      : "text-green-700 bg-green-100 border-green-200";
  };

  const getDiagnosisColor = (
    diagnosis: string | undefined | null,
    status: string,
  ) => {
    if (status === "failed") {
      return "text-red-700 bg-red-50";
    }

    if (status === "requires_review") {
      return "text-purple-700 bg-purple-50";
    }

    // Handle undefined or null diagnosis
    if (!diagnosis) {
      return "text-gray-700 bg-gray-50";
    }

    switch (diagnosis.toLowerCase()) {
      case "healthy":
      case "normal range":
        return "text-green-700 bg-green-50";
      case "requires follow-up":
      case "attention needed":
        return "text-orange-700 bg-orange-50";
      default:
        return "text-blue-700 bg-blue-50";
    }
  };

  // Count completed diagnoses today
  const getCompletedToday = () => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    return diagnoses.filter(
      (d) => d.status === "completed" && new Date(d.created_at) >= today,
    ).length;
  };

  // Get unique patients with diagnoses
  const getDiagnosedPatients = () => {
    // Return diagnoses with completed or failed status
    return diagnoses.filter(
      (d) => d.status === "completed" || d.status === "failed",
    );
  };

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="text-center">
        <h1 className="text-3xl font-bold bg-gradient-to-r from-blue-600 to-indigo-600 bg-clip-text text-transparent">
          Medical Diagnosis Center
        </h1>
        <p className="mt-2 text-gray-600">
          Run AI-powered diagnosis on patient data
        </p>
      </div>

      {/* API Status Warning */}
      {apiStatus === "offline" && (
        <div className="bg-red-50 border border-red-200 rounded-lg p-4 mb-6">
          <div className="flex items-center">
            <AlertTriangle className="h-5 w-5 text-red-600 mr-2" />
            <div>
              <h3 className="text-sm font-medium text-red-800">
                Prediction API Unavailable
              </h3>
              <p className="text-sm text-red-700 mt-1">
                The EEG prediction API is currently offline. Diagnosis
                functionality will be limited. Please check your API connection
                or contact technical support.
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="bg-white rounded-xl shadow-lg p-6 border border-yellow-100">
          <div className="flex items-center">
            <div className="bg-gradient-to-r from-yellow-500 to-orange-500 p-3 rounded-lg">
              <AlertTriangle className="h-8 w-8 text-white" />
            </div>
            <div className="ml-4">
              <h3 className="text-2xl font-bold text-gray-900">
                {loading ? "..." : undiagnosedPatients.length}
              </h3>
              <p className="text-sm text-gray-600">Awaiting Diagnosis</p>
            </div>
          </div>
        </div>

        <div className="bg-white rounded-xl shadow-lg p-6 border border-blue-100">
          <div className="flex items-center">
            <div className="bg-gradient-to-r from-blue-500 to-indigo-500 p-3 rounded-lg">
              <Clock className="h-8 w-8 text-white" />
            </div>
            <div className="ml-4">
              <h3 className="text-2xl font-bold text-gray-900">
                {processingPatients.size}
              </h3>
              <p className="text-sm text-gray-600">Currently Processing</p>
            </div>
          </div>
        </div>

        <div className="bg-white rounded-xl shadow-lg p-6 border border-green-100">
          <div className="flex items-center">
            <div className="bg-gradient-to-r from-green-500 to-emerald-500 p-3 rounded-lg">
              <CheckCircle className="h-8 w-8 text-white" />
            </div>
            <div className="ml-4">
              <h3 className="text-2xl font-bold text-gray-900">
                {loadingDiagnoses ? "..." : getCompletedToday()}
              </h3>
              <p className="text-sm text-gray-600">Completed Today</p>
            </div>
          </div>
        </div>
      </div>

      {/* Loading State */}
      {loading && (
        <div className="flex justify-center py-12">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
        </div>
      )}

      {/* Undiagnosed Patients */}
      {!loading && undiagnosedPatients.length > 0 && (
        <div className="bg-white shadow-lg rounded-xl border border-gray-100">
          <div className="px-6 py-4 border-b border-gray-200">
            <div className="flex items-center">
              <AlertTriangle className="h-5 w-5 text-yellow-600 mr-2" />
              <h3 className="text-lg font-semibold text-gray-900">
                Patients Requiring Diagnosis ({undiagnosedPatients.length})
              </h3>
            </div>
          </div>
          <div className="p-6">
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {undiagnosedPatients.map((patient) => (
                <div
                  key={patient.id}
                  className="bg-gradient-to-br from-yellow-50 to-orange-50 border border-yellow-200 rounded-lg p-4 hover:shadow-md transition-shadow"
                >
                  <div className="flex items-start justify-between mb-3">
                    <div>
                      <h4 className="font-semibold text-gray-900">
                        {patient.name}
                      </h4>
                      <p className="text-sm text-gray-600">
                        {patient.age} years • {patient.gender}
                      </p>
                    </div>
                    <span
                      className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full border ${getStatusColor(patient.status)}`}
                    >
                      {patient.status === "undiagnosed"
                        ? "Undiagnosed"
                        : "Diagnosed"}
                    </span>
                  </div>

                  <div className="space-y-1 mb-4">
                    <p className="text-xs text-gray-600">{patient.phone}</p>
                    <p className="text-xs text-gray-600">{patient.email}</p>
                  </div>

                  <button
                    onClick={() => handleStartDiagnosis(patient)}
                    disabled={processingPatients.has(patient.id)}
                    className="w-full inline-flex items-center justify-center px-3 py-2 border border-transparent text-sm font-medium rounded-lg text-white bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed transition-all"
                  >
                    {processingPatients.has(patient.id) ? (
                      <>
                        <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                        Processing...
                      </>
                    ) : (
                      <>
                        <Stethoscope className="h-4 w-4 mr-2" />
                        Start Diagnosis
                      </>
                    )}
                  </button>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* No Undiagnosed Patients Message */}
      {!loading && undiagnosedPatients.length === 0 && (
        <div className="bg-white shadow-lg rounded-xl border border-gray-100 p-12 text-center">
          <AlertTriangle className="mx-auto h-12 w-12 text-gray-400" />
          <h3 className="mt-2 text-lg font-medium text-gray-900">
            No patients awaiting diagnosis
          </h3>
          <p className="mt-1 text-gray-500">
            All patients have been diagnosed or no patients have been added yet.
          </p>
        </div>
      )}

      {/* Recent Diagnoses */}
      <div className="bg-white shadow-lg rounded-xl border border-gray-100">
        <div className="px-6 py-4 border-b border-gray-200">
          <div className="flex items-center justify-between">
            <h3 className="text-lg font-semibold text-gray-900">
              Recent Diagnoses
            </h3>
            <FileText className="h-5 w-5 text-gray-400" />
          </div>
        </div>
        <div className="p-6">
          {loadingDiagnoses ? (
            <div className="flex justify-center py-8">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
            </div>
          ) : getDiagnosedPatients().length === 0 ? (
            <div className="text-center py-8">
              <Stethoscope className="mx-auto h-12 w-12 text-gray-400" />
              <h3 className="mt-2 text-sm font-medium text-gray-900">
                No diagnoses yet
              </h3>
              <p className="mt-1 text-sm text-gray-500">
                Start diagnosing patients to see results here.
              </p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Patient
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Diagnosis
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Confidence
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Date
                    </th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {getDiagnosedPatients()
                    .sort(
                      (a, b) =>
                        new Date(b.updated_at).getTime() -
                        new Date(a.updated_at).getTime(),
                    )
                    .map((diagnosis) => (
                      <tr key={diagnosis.id} className="hover:bg-gray-50">
                        <td className="px-6 py-4 whitespace-nowrap">
                          <div>
                            <div className="text-sm font-medium text-gray-900">
                              {diagnosis.patient?.name || "Unknown Patient"}
                            </div>
                            <div className="text-sm text-gray-500">
                              {diagnosis.patient
                                ? `${diagnosis.patient.age} years • ${diagnosis.patient.gender}`
                                : ""}
                            </div>
                          </div>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <span
                            className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${getDiagnosisColor(diagnosis.diagnosis_result, diagnosis.status)}`}
                          >
                            {diagnosis.status === "failed"
                              ? "Failed"
                              : diagnosis.diagnosis_result || "Unknown"}
                          </span>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                          {diagnosis.status === "failed"
                            ? "N/A"
                            : diagnosis.confidence
                              ? `${diagnosis.confidence.toFixed(1)}%`
                              : "N/A"}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                          {formatDate(diagnosis.updated_at)}
                        </td>
                      </tr>
                    ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>

      {/* Diagnosis Modal */}
      <DiagnosisModal
        isOpen={showDiagnosisModal}
        onClose={() => {
          setShowDiagnosisModal(false);
          setSelectedPatient(null);
        }}
        onSubmit={handleDiagnosisSubmit}
        patient={selectedPatient}
      />
    </div>
  );
};

export default Diagnosis;
