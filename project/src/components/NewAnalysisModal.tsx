import React, { useState, useEffect } from "react";
import { X, AlertTriangle, Upload } from "lucide-react";
import toast from "react-hot-toast";
import { useNavigate } from "react-router-dom";

interface Patient {
  id: string;
  name: string;
  age: number;
  gender: "male" | "female";
}

interface DiseaseInfo {
  id: string;
  name: string;
  icon: React.ComponentType<any>;
  color: string;
  bgColor: string;
  description: string;
  symptoms: string[];
  prevalence: string;
}

interface NewAnalysisModalProps {
  isOpen: boolean;
  onClose: () => void;
  disease: DiseaseInfo | null;
}

const NewAnalysisModal: React.FC<NewAnalysisModalProps> = ({
  isOpen,
  onClose,
  disease,
}) => {
  const [selectedPatientId, setSelectedPatientId] = useState("");
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [patients, setPatients] = useState<Patient[]>([]);
  const [isRunning, setIsRunning] = useState(false);
  const navigate = useNavigate();

  useEffect(() => {
    if (isOpen) {
      // Mock patients data - in real app, this would come from API
      const mockPatients: Patient[] = [
        { id: "1", name: "John Doe", age: 34, gender: "male" },
        { id: "2", name: "Sarah Johnson", age: 28, gender: "female" },
        { id: "3", name: "Mike Davis", age: 45, gender: "male" },
        { id: "4", name: "Emily Brown", age: 32, gender: "female" },
        { id: "5", name: "David Wilson", age: 29, gender: "male" },
        { id: "6", name: "Child Patient", age: 5, gender: "male" }, // Under 7 for testing
      ];
      setPatients(mockPatients);
    }
  }, [isOpen]);

  const selectedPatient = patients.find((p) => p.id === selectedPatientId);
  const isPatientTooYoung = selectedPatient && selectedPatient.age < 7;
  const canRun = selectedPatientId && selectedFile && !isPatientTooYoung;

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      // Validate file type
      if (!file.name.toLowerCase().endsWith(".csv")) {
        toast.error("Please select a CSV file");
        return;
      }

      // Validate file size (max 2GB)
      if (file.size > 2048 * 1024 * 1024) {
        toast.error("File size must be less than 2GB");
        return;
      }

      setSelectedFile(file);
    }
  };

  const handleRunAnalysis = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!canRun || !selectedFile || !selectedPatient) {
      return;
    }

    setIsRunning(true);

    try {
      // Simulate analysis start
      await new Promise((resolve) => setTimeout(resolve, 1000));

      toast.success("Analysis started! Redirecting to EEG records...");

      // Reset form and close modal
      setSelectedPatientId("");
      setSelectedFile(null);
      onClose();

      // Navigate to EEGs page
      navigate("/eegs");
    } catch (error) {
      toast.error("Failed to start analysis. Please try again.");
    } finally {
      setIsRunning(false);
    }
  };

  const handleClose = () => {
    if (isRunning) return;
    setSelectedPatientId("");
    setSelectedFile(null);
    onClose();
  };

  if (!isOpen || !disease) return null;

  const IconComponent = disease.icon;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg max-w-2xl w-full mx-4 max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between p-6 border-b">
          <div className="flex items-center">
            <div className={`p-2 rounded-lg ${disease.color} bg-gray-100`}>
              <IconComponent className="h-6 w-6" />
            </div>
            <h3 className="ml-3 text-lg font-medium text-gray-900">
              {disease.name} Analysis
            </h3>
          </div>
          <button
            onClick={handleClose}
            disabled={isRunning}
            className="text-gray-400 hover:text-gray-500 disabled:cursor-not-allowed"
          >
            <X className="h-6 w-6" />
          </button>
        </div>

        <div className="p-6">
          {/* Disease Information */}
          <div className={`${disease.bgColor} border rounded-lg p-4 mb-6`}>
            <h4 className="font-medium text-gray-900 mb-2">
              About {disease.name}
            </h4>
            <p className="text-gray-700 mb-3">{disease.description}</p>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <h5 className="font-medium text-gray-900 mb-2">Symptoms:</h5>
                <ul className="text-sm text-gray-600 space-y-1">
                  {disease.symptoms.map((symptom, index) => (
                    <li key={index} className="flex items-center">
                      <div className="w-1.5 h-1.5 rounded-full bg-gray-400 mr-2"></div>
                      {symptom}
                    </li>
                  ))}
                </ul>
              </div>
              <div>
                <h5 className="font-medium text-gray-900 mb-2">Prevalence:</h5>
                <p className="text-sm text-gray-600">{disease.prevalence}</p>
              </div>
            </div>
          </div>

          {/* Analysis Form */}
          <form onSubmit={handleRunAnalysis} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Select Patient
              </label>
              <select
                value={selectedPatientId}
                onChange={(e) => setSelectedPatientId(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                required
              >
                <option value="">Choose a patient...</option>
                {patients.map((patient) => (
                  <option key={patient.id} value={patient.id}>
                    {patient.name} (Age: {patient.age})
                  </option>
                ))}
              </select>
            </div>

            {isPatientTooYoung && (
              <div className="flex items-center p-3 bg-yellow-50 border border-yellow-200 rounded-md">
                <AlertTriangle className="h-5 w-5 text-yellow-600 mr-2" />
                <p className="text-sm text-yellow-800">
                  Patient must be at least 7 years old for EEG analysis.
                </p>
              </div>
            )}

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Upload EEG file (.csv)
              </label>
              <input
                type="file"
                accept=".csv"
                onChange={handleFileChange}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                required
              />
              {selectedFile && (
                <p className="mt-1 text-sm text-gray-600">
                  Selected: {selectedFile.name} (
                  {(selectedFile.size / 1024 / 1024).toFixed(2)} MB)
                </p>
              )}
            </div>

            <div className="flex justify-end space-x-3 pt-4">
              <button
                type="button"
                onClick={handleClose}
                disabled={isRunning}
                className="px-4 py-2 text-sm font-medium text-gray-700 bg-gray-100 border border-gray-300 rounded-md hover:bg-gray-200 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={!canRun || isRunning}
                className="inline-flex items-center px-4 py-2 text-sm font-medium text-white bg-blue-600 border border-transparent rounded-md hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {isRunning ? (
                  <>
                    <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                    Running...
                  </>
                ) : (
                  <>
                    <Upload className="h-4 w-4 mr-2" />
                    Run Analysis
                  </>
                )}
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
};

export default NewAnalysisModal;
