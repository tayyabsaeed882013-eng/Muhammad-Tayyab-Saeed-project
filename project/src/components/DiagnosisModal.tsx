import React, { useState, useEffect } from "react";
import { X, Upload, FileText, AlertTriangle, Stethoscope } from "lucide-react";
import toast from "react-hot-toast";

const API_BASE_URL =
  import.meta.env.VITE_API_BASE_URL || "http://127.0.0.1:5000";
const MAX_CSV_SIZE_MB = 2048;

interface Patient {
  id: string;
  name: string;
  age: number;
  gender: "male" | "female";
  phone: string;
  email: string;
}

interface PredictionResult {
  predicted_label: string;
  confidence: number;
  low_confidence?: boolean;
}

interface DiagnosisModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (patientId: string, file: File, result: PredictionResult) => void;
  patient: Patient | null;
}

const DiagnosisModal: React.FC<DiagnosisModalProps> = ({
  isOpen,
  onClose,
  onSubmit,
  patient,
}) => {
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [showConfirmation, setShowConfirmation] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [apiStatus, setApiStatus] = useState<"unknown" | "online" | "offline">(
    "unknown",
  );

  useEffect(() => {
    // Check if the API is online when the modal opens
    if (isOpen) {
      checkApiStatus();
    }
  }, [isOpen]);

  const checkApiStatus = async () => {
    try {
      const response = await fetch(`${API_BASE_URL}/health`);
      if (response.ok) {
        setApiStatus("online");
        // If API is online, check the response format
        testApiResponseFormat();
      } else {
        setApiStatus("offline");
      }
    } catch (error) {
      console.error("API health check failed:", error);
      setApiStatus("offline");
    }
  };

  // Test function to check the API response format
  const testApiResponseFormat = async () => {
    try {
      // Only run this in development mode
      if (process.env.NODE_ENV !== "development") return;

      console.log("Testing API response format...");
      const response = await fetch(`${API_BASE_URL}/`);
      const data = await response.json();
      console.log("API info response:", data);
    } catch (error) {
      console.error("API test failed:", error);
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      // Validate file type
      if (!file.name.toLowerCase().endsWith(".csv")) {
        toast.error("Please select a CSV file");
        return;
      }

      // Validate file size
      if (file.size > MAX_CSV_SIZE_MB * 1024 * 1024) {
        toast.error(`File size must be less than ${MAX_CSV_SIZE_MB}MB`);
        return;
      }

      setSelectedFile(file);
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    if (!selectedFile || !patient) {
      toast.error("Please select a file");
      return;
    }

    if (apiStatus === "offline") {
      toast.error(
        "The prediction API is currently offline. Please try again later.",
      );
      return;
    }

    setShowConfirmation(true);
  };

  const handleConfirmDiagnosis = async () => {
    if (!selectedFile || !patient) return;

    setIsSubmitting(true);

    try {
      const formData = new FormData();
      formData.append("file", selectedFile);

      console.log("Sending prediction request to API...");

      // Set a timeout for the request (300 seconds = 5 minutes for large files)
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 300000);

      const response = await fetch(`${API_BASE_URL}/predict`, {
        method: "POST",
        body: formData,
        signal: controller.signal,
      });

      clearTimeout(timeoutId);

      const data = await response.json();
      console.log("API response:", data);

      if (!response.ok) {
        throw new Error(data.error || `Server error: ${response.status}`);
      }

      // Extract the first result or use a default if results array is empty or malformed
      let predictionResult: PredictionResult;

      if (
        data.results &&
        Array.isArray(data.results) &&
        data.results.length > 0
      ) {
        const firstResult = data.results[0];
        predictionResult = {
          predicted_label: firstResult.predicted_label || "Unknown",
          confidence:
            typeof firstResult.confidence === "number"
              ? firstResult.confidence
              : 0,
          low_confidence: !!firstResult.low_confidence,
        };
      } else if (data.predicted_label) {
        // Handle direct response format without results array
        predictionResult = {
          predicted_label: data.predicted_label,
          confidence: typeof data.confidence === "number" ? data.confidence : 0,
          low_confidence: !!data.low_confidence,
        };
      } else {
        // Fallback for unexpected response format
        console.error("Unexpected API response format:", data);
        predictionResult = {
          predicted_label: "Unknown",
          confidence: 0,
          low_confidence: true,
        };
      }

      console.log("Parsed prediction result:", predictionResult);

      // Show appropriate toast message
      if (predictionResult.low_confidence) {
        toast.error(
          `⚠️ Low confidence: ${predictionResult.predicted_label} (${predictionResult.confidence.toFixed(1)}%)`,
        );
      } else {
        toast.success(
          `✓ Predicted: ${predictionResult.predicted_label} (${predictionResult.confidence.toFixed(1)}%)`,
        );
      }

      // Pass data and result to parent component
      onSubmit(patient.id, selectedFile, predictionResult);

      // Reset state and close
      setSelectedFile(null);
      setShowConfirmation(false);
      onClose();
    } catch (error: any) {
      console.error("API error:", error);
      if (error.name === "AbortError") {
        toast.error(
          "Prediction timed out after 5 minutes. The file may be too large or the server is slow. Please try again.",
        );
      } else {
        toast.error(error.message || "Prediction failed. Please try again.");
      }
      setIsSubmitting(false);
    }
  };

  const handleClose = () => {
    if (isSubmitting) return;
    setSelectedFile(null);
    setShowConfirmation(false);
    onClose();
  };

  if (!isOpen || !patient) return null;

  // Show loading screen while submitting
  if (isSubmitting) {
    return (
      <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
        <div className="bg-white rounded-xl max-w-md w-full mx-4 shadow-2xl p-8">
          <div className="flex flex-col items-center justify-center">
            {/* Animated Spinner */}
            <div className="mb-6">
              <div className="animate-spin rounded-full h-16 w-16 border-b-4 border-blue-600"></div>
            </div>

            {/* Status Messages */}
            <h3 className="text-lg font-semibold text-gray-900 text-center mb-2">
              Processing Diagnosis
            </h3>
            <p className="text-gray-600 text-center mb-6">
              Analyzing EEG data for {patient.name}...
            </p>
            <p className="text-sm text-gray-500 text-center mb-6 italic">
              {selectedFile && selectedFile.size > 100 * 1024 * 1024
                ? "Large file detected. This may take 1-5 minutes..."
                : "Typically takes 3-5 seconds..."}
            </p>

            {/* Progress Steps */}
            <div className="w-full space-y-3 mb-6">
              <div className="flex items-center">
                <div className="w-8 h-8 rounded-full bg-blue-600 flex items-center justify-center mr-3">
                  <span className="text-white text-sm">✓</span>
                </div>
                <span className="text-sm text-gray-700">File uploaded</span>
              </div>
              <div className="flex items-center">
                <div className="w-8 h-8 rounded-full bg-blue-600 flex items-center justify-center mr-3 animate-pulse">
                  <span className="text-white text-sm">⚙</span>
                </div>
                <span className="text-sm text-gray-700">
                  Running neural network analysis...
                </span>
              </div>
              <div className="flex items-center opacity-50">
                <div className="w-8 h-8 rounded-full bg-gray-300 flex items-center justify-center mr-3">
                  <span className="text-gray-600 text-sm">3</span>
                </div>
                <span className="text-sm text-gray-700">
                  Generating results
                </span>
              </div>
            </div>

            {/* Estimated Time */}
            <p className="text-xs text-gray-500 text-center">
              This typically takes 10-30 seconds. Please wait...
            </p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-xl max-w-2xl w-full mx-4 max-h-[90vh] overflow-y-auto shadow-2xl">
        <div className="flex items-center justify-between p-6 border-b border-gray-200">
          <div className="flex items-center">
            <div className="bg-gradient-to-r from-blue-500 to-indigo-500 p-2 rounded-lg mr-3">
              <Stethoscope className="h-6 w-6 text-white" />
            </div>
            <h3 className="text-lg font-semibold text-gray-900">
              Medical Diagnosis - {patient.name}
            </h3>
          </div>
          <button
            onClick={handleClose}
            disabled={isSubmitting}
            className="text-gray-400 hover:text-gray-500 disabled:cursor-not-allowed transition-colors"
          >
            <X className="h-6 w-6" />
          </button>
        </div>

        <div className="p-6">
          {apiStatus === "offline" && (
            <div className="bg-red-50 border border-red-200 rounded-lg p-4 mb-6">
              <div className="flex items-center">
                <AlertTriangle className="h-5 w-5 text-red-600 mr-2" />
                <span className="text-red-800 font-medium">
                  The prediction API is currently offline. Diagnosis
                  functionality is limited.
                </span>
              </div>
            </div>
          )}

          {!showConfirmation ? (
            <>
              {/* Patient Information */}
              <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-6">
                <h4 className="font-medium text-blue-900 mb-2">
                  Patient Information
                </h4>
                <div className="grid grid-cols-2 gap-4 text-sm text-blue-800">
                  <div>
                    <span className="font-medium">Name:</span> {patient.name}
                  </div>
                  <div>
                    <span className="font-medium">Age:</span> {patient.age}{" "}
                    years
                  </div>
                  <div>
                    <span className="font-medium">Gender:</span>{" "}
                    {patient.gender}
                  </div>
                  <div>
                    <span className="font-medium">Phone:</span> {patient.phone}
                  </div>
                </div>
              </div>

              {/* CSV Upload Instructions */}
              <div className="bg-gray-50 border border-gray-200 rounded-lg p-4 mb-6">
                <div className="flex items-start">
                  <FileText className="h-5 w-5 text-gray-600 mt-0.5 mr-2 flex-shrink-0" />
                  <div>
                    <h4 className="font-medium text-gray-900 mb-2">
                      CSV File Requirements
                    </h4>
                    <ul className="text-sm text-gray-700 space-y-1">
                      <li>• File must be in CSV format (.csv extension)</li>
                      <li>• Maximum file size: 2GB</li>
                      <li>• Must contain medical data with proper headers</li>
                      <li>• Ensure data is properly formatted and complete</li>
                      <li>
                        • Remove any personal identifiers except patient ID
                      </li>
                    </ul>
                  </div>
                </div>
              </div>

              {/* File Upload */}
              <form onSubmit={handleSubmit} className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Upload Medical Data (CSV) *
                  </label>
                  <div className="mt-1 flex justify-center px-6 pt-5 pb-6 border-2 border-gray-300 border-dashed rounded-lg hover:border-blue-400 transition-colors">
                    <div className="space-y-1 text-center">
                      <Upload className="mx-auto h-12 w-12 text-gray-400" />
                      <div className="flex text-sm text-gray-600">
                        <label
                          htmlFor="file-upload"
                          className="relative cursor-pointer bg-white rounded-md font-medium text-blue-600 hover:text-blue-500 focus-within:outline-none focus-within:ring-2 focus-within:ring-offset-2 focus-within:ring-blue-500"
                        >
                          <span>Upload a file</span>
                          <input
                            id="file-upload"
                            name="file-upload"
                            type="file"
                            accept=".csv"
                            onChange={handleFileChange}
                            className="sr-only"
                            required
                          />
                        </label>
                        <p className="pl-1">or drag and drop</p>
                      </div>
                      <p className="text-xs text-gray-500">
                        CSV files up to 2GB
                      </p>
                    </div>
                  </div>
                  {selectedFile && (
                    <div className="mt-2 p-3 bg-green-50 border border-green-200 rounded-lg">
                      <div className="flex items-center">
                        <FileText className="h-4 w-4 text-green-600 mr-2" />
                        <span className="text-sm text-green-800">
                          {selectedFile.name} (
                          {(selectedFile.size / 1024 / 1024).toFixed(2)} MB)
                        </span>
                      </div>
                    </div>
                  )}
                </div>

                <div className="flex justify-end space-x-3 pt-4">
                  <button
                    type="button"
                    onClick={handleClose}
                    className="px-4 py-2 text-sm font-medium text-gray-700 bg-gray-100 border border-gray-300 rounded-lg hover:bg-gray-200 transition-colors"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={!selectedFile}
                    className="px-4 py-2 text-sm font-medium text-white bg-gradient-to-r from-blue-600 to-indigo-600 border border-transparent rounded-lg hover:from-blue-700 hover:to-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed transition-all"
                  >
                    Continue to Diagnosis
                  </button>
                </div>
              </form>
            </>
          ) : (
            /* Confirmation Dialog */
            <div className="text-center">
              <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4 mb-6">
                <div className="flex items-center justify-center mb-3">
                  <AlertTriangle className="h-8 w-8 text-yellow-600" />
                </div>
                <h4 className="font-medium text-yellow-900 mb-2">
                  Confirm Diagnosis
                </h4>
                <p className="text-sm text-yellow-800">
                  You are about to run AI diagnosis on {patient.name}'s medical
                  data. This process will analyze the uploaded CSV file and
                  generate a medical assessment.
                </p>
              </div>

              <div className="bg-gray-50 rounded-lg p-4 mb-6">
                <h5 className="font-medium text-gray-900 mb-2">
                  File Details:
                </h5>
                <div className="text-sm text-gray-700">
                  <p>
                    <span className="font-medium">Filename:</span>{" "}
                    {selectedFile?.name}
                  </p>
                  <p>
                    <span className="font-medium">Size:</span>{" "}
                    {selectedFile &&
                      (selectedFile.size / 1024 / 1024).toFixed(2)}{" "}
                    MB
                  </p>
                  <p>
                    <span className="font-medium">Patient:</span> {patient.name}
                  </p>
                </div>
              </div>

              <div className="flex justify-center space-x-3">
                <button
                  onClick={() => setShowConfirmation(false)}
                  disabled={isSubmitting}
                  className="px-4 py-2 text-sm font-medium text-gray-700 bg-gray-100 border border-gray-300 rounded-lg hover:bg-gray-200 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                >
                  Back
                </button>
                <button
                  onClick={handleConfirmDiagnosis}
                  disabled={isSubmitting}
                  className="px-4 py-2 text-sm font-medium text-white bg-gradient-to-r from-blue-600 to-indigo-600 border border-transparent rounded-lg hover:from-blue-700 hover:to-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed transition-all"
                >
                  {isSubmitting ? (
                    <>
                      <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2 inline-block"></div>
                      Processing...
                    </>
                  ) : (
                    "Run Diagnosis"
                  )}
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default DiagnosisModal;
