import React, { useState, useEffect } from "react";
import { X, AlertTriangle } from "lucide-react";
import toast from "react-hot-toast";

interface Patient {
  id: string;
  name: string;
  age: number;
  gender: "male" | "female";
}

interface UploadEEGModalProps {
  isOpen: boolean;
  onClose: () => void;
  onUpload: (data: {
    patientId: string;
    patientName: string;
    patientAge: number;
    file: File;
  }) => void;
}

const UploadEEGModal: React.FC<UploadEEGModalProps> = ({
  isOpen,
  onClose,
  onUpload,
}) => {
  const [selectedPatientId, setSelectedPatientId] = useState("");
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [patients, setPatients] = useState<Patient[]>([]);
  const [isUploading, setIsUploading] = useState(false);

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
  const canUpload = selectedPatientId && selectedFile && !isPatientTooYoung;

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

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!canUpload || !selectedFile || !selectedPatient) {
      return;
    }

    setIsUploading(true);

    try {
      // Simulate upload delay
      await new Promise((resolve) => setTimeout(resolve, 1000));

      onUpload({
        patientId: selectedPatient.id,
        patientName: selectedPatient.name,
        patientAge: selectedPatient.age,
        file: selectedFile,
      });

      // Reset form
      setSelectedPatientId("");
      setSelectedFile(null);
    } catch (error) {
      toast.error("Upload failed. Please try again.");
    } finally {
      setIsUploading(false);
    }
  };

  const handleClose = () => {
    if (isUploading) return;
    setSelectedPatientId("");
    setSelectedFile(null);
    onClose();
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg max-w-md w-full mx-4">
        <div className="flex items-center justify-between p-6 border-b">
          <h3 className="text-lg font-medium text-gray-900">Upload EEG CSV</h3>
          <button
            onClick={handleClose}
            disabled={isUploading}
            className="text-gray-400 hover:text-gray-500 disabled:cursor-not-allowed"
          >
            <X className="h-6 w-6" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-4">
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
              EEG File (.csv only)
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
              disabled={isUploading}
              className="px-4 py-2 text-sm font-medium text-gray-700 bg-gray-100 border border-gray-300 rounded-md hover:bg-gray-200 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={!canUpload || isUploading}
              className="px-4 py-2 text-sm font-medium text-white bg-green-600 border border-transparent rounded-md hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isUploading ? "Uploading..." : "Upload EEG"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default UploadEEGModal;
