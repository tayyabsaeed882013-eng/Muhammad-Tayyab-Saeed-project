import React, { useState, useEffect, useCallback } from "react";
import {
  FileText,
  Download,
  Calendar,
  Filter,
  Search,
  TrendingUp,
} from "lucide-react";
import toast from "react-hot-toast";
import { getDiagnoses, supabase } from "../lib/supabase";

interface DiagnosisReport {
  id: string;
  patientId: string;
  patientName: string;
  patientAge: number;
  patientGender: "male" | "female";
  diagnosis: string;
  confidence: number;
  diagnosisDate: string;
  fileName: string;
}

const Reports: React.FC = () => {
  const [reports, setReports] = useState<DiagnosisReport[]>([]);
  const [filteredReports, setFilteredReports] = useState<DiagnosisReport[]>([]);
  const [searchTerm, setSearchTerm] = useState("");
  const [dateFilter, setDateFilter] = useState("all");
  const [diagnosisFilter, setDiagnosisFilter] = useState("all");
  const [currentPage, setCurrentPage] = useState(1);
  const [reportsPerPage] = useState(10);
  const [loading, setLoading] = useState(true);

  // Memoize fetchDiagnoses to avoid recreating it on each render
  const fetchDiagnoses = useCallback(async () => {
    try {
      console.log("Fetching reports...");
      setLoading(true);
      const diagnosesData = await getDiagnoses();
      console.log("Reports fetched:", diagnosesData.length);

      // Filter only completed diagnoses
      const completedDiagnoses = diagnosesData.filter(
        (d) => d.status === "completed",
      );
      console.log("Completed diagnoses:", completedDiagnoses.length);

      // Map the diagnoses to the DiagnosisReport format
      const formattedReports: DiagnosisReport[] = completedDiagnoses.map(
        (diagnosis) => ({
          id: diagnosis.id,
          patientId: diagnosis.patient_id,
          patientName: diagnosis.patient?.name || "Unknown Patient",
          patientAge: diagnosis.patient?.age || 0,
          patientGender: diagnosis.patient?.gender || "male",
          diagnosis: diagnosis.diagnosis_result || "Unknown",
          confidence: diagnosis.confidence || 0,
          diagnosisDate: diagnosis.updated_at,
          fileName: diagnosis.file_name,
        }),
      );

      setReports(formattedReports);
      setFilteredReports(formattedReports);
    } catch (error) {
      console.error("Error fetching diagnoses:", error);
      toast.error("Failed to load reports");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    // Initial data fetch
    fetchDiagnoses();

    // Set up direct real-time subscription
    const diagnosesChannel = supabase
      .channel("reports-diagnoses-changes")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "diagnoses" },
        (payload) => {
          console.log(
            "Real-time diagnosis update received in Reports:",
            payload,
          );
          fetchDiagnoses();
        },
      )
      .subscribe();

    // Also listen for patient changes as they might affect report display
    const patientsChannel = supabase
      .channel("reports-patients-changes")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "patients" },
        (payload) => {
          console.log("Real-time patient update received in Reports:", payload);
          fetchDiagnoses(); // Refresh diagnoses to get updated patient info
        },
      )
      .subscribe();

    return () => {
      diagnosesChannel.unsubscribe();
      patientsChannel.unsubscribe();
    };
  }, [fetchDiagnoses]);

  useEffect(() => {
    let filtered = reports.filter((report) => {
      const matchesSearch =
        report.patientName.toLowerCase().includes(searchTerm.toLowerCase()) ||
        report.diagnosis.toLowerCase().includes(searchTerm.toLowerCase());

      const matchesDiagnosis =
        diagnosisFilter === "all" ||
        report.diagnosis.toLowerCase().includes(diagnosisFilter.toLowerCase());

      const reportDate = new Date(report.diagnosisDate);
      const now = new Date();
      let matchesDate = true;

      if (dateFilter === "today") {
        matchesDate = reportDate.toDateString() === now.toDateString();
      } else if (dateFilter === "week") {
        const weekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
        matchesDate = reportDate >= weekAgo;
      } else if (dateFilter === "month") {
        const monthAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
        matchesDate = reportDate >= monthAgo;
      }

      return matchesSearch && matchesDiagnosis && matchesDate;
    });

    // Sort by date (newest first)
    filtered.sort(
      (a, b) =>
        new Date(b.diagnosisDate).getTime() -
        new Date(a.diagnosisDate).getTime(),
    );

    setFilteredReports(filtered);
    setCurrentPage(1);
  }, [searchTerm, dateFilter, diagnosisFilter, reports]);

  const handleDownloadPDF = async (report: DiagnosisReport) => {
    try {
      // Dynamic import for jsPDF
      const { default: jsPDF } = await import("jspdf");
      const { default: autoTable } = await import("jspdf-autotable");

      const doc = new jsPDF();

      // Header
      doc.setFontSize(20);
      doc.setTextColor(59, 130, 246); // Blue color
      doc.text("Medical Diagnosis Report", 20, 30);

      // Patient Information
      doc.setFontSize(14);
      doc.setTextColor(0, 0, 0);
      doc.text("Patient Information", 20, 50);

      doc.setFontSize(12);
      const patientInfo = [
        ["Patient Name:", report.patientName],
        ["Age:", `${report.patientAge} years`],
        ["Gender:", report.patientGender],
        [
          "Diagnosis Date:",
          new Date(report.diagnosisDate).toLocaleDateString(),
        ],
        ["Data File:", report.fileName],
      ];

      let yPos = 60;
      patientInfo.forEach(([label, value]) => {
        doc.text(label, 20, yPos);
        doc.text(value, 80, yPos);
        yPos += 10;
      });

      // Diagnosis Results
      doc.setFontSize(14);
      doc.text("Diagnosis Results", 20, yPos + 10);

      doc.setFontSize(12);
      yPos += 30;
      doc.text("Diagnosis:", 20, yPos);
      doc.text(report.diagnosis, 80, yPos);

      yPos += 10;
      doc.text("Confidence Level:", 20, yPos);
      doc.text(`${report.confidence.toFixed(1)}%`, 80, yPos);

      // Footer
      doc.setFontSize(10);
      doc.setTextColor(128, 128, 128);
      doc.text("Generated by Medical Diagnosis System", 20, 280);
      doc.text(`Report ID: ${report.id}`, 20, 290);

      doc.save(
        `diagnosis_report_${report.patientName.replace(/\s+/g, "_")}_${report.id}.pdf`,
      );
      toast.success("PDF report downloaded successfully");
    } catch (error) {
      toast.error("Failed to generate PDF report");
    }
  };

  const handleDownloadCSV = (report: DiagnosisReport) => {
    const csvContent = [
      ["Field", "Value"],
      ["Patient Name", report.patientName],
      ["Age", report.patientAge],
      ["Gender", report.patientGender],
      ["Diagnosis", report.diagnosis],
      ["Confidence", `${report.confidence}%`],
      ["Diagnosis Date", new Date(report.diagnosisDate).toISOString()],
      ["Data File", report.fileName],
      ["Report ID", report.id],
    ]
      .map((row) => row.join(","))
      .join("\n");

    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
    const link = document.createElement("a");
    const url = URL.createObjectURL(blob);
    link.setAttribute("href", url);
    link.setAttribute(
      "download",
      `diagnosis_report_${report.patientName.replace(/\s+/g, "_")}_${report.id}.csv`,
    );
    link.style.visibility = "hidden";
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);

    toast.success("CSV report downloaded successfully");
  };

  const handleDownloadAllReports = async () => {
    if (filteredReports.length === 0) {
      toast.error("No reports to download");
      return;
    }

    try {
      const { default: jsPDF } = await import("jspdf");
      const { default: autoTable } = await import("jspdf-autotable");

      const doc = new jsPDF();

      // Header
      doc.setFontSize(20);
      doc.setTextColor(59, 130, 246);
      doc.text("Medical Diagnosis Summary Report", 20, 30);

      doc.setFontSize(12);
      doc.setTextColor(0, 0, 0);
      doc.text(`Generated on: ${new Date().toLocaleDateString()}`, 20, 45);
      doc.text(`Total Reports: ${filteredReports.length}`, 20, 55);

      // Table data
      const tableData = filteredReports.map((report) => [
        report.patientName,
        `${report.patientAge}`,
        report.patientGender,
        report.diagnosis,
        `${report.confidence.toFixed(1)}%`,
        new Date(report.diagnosisDate).toLocaleDateString(),
      ]);

      // @ts-ignore - autoTable types issue
      autoTable(doc, {
        head: [
          ["Patient Name", "Age", "Gender", "Diagnosis", "Confidence", "Date"],
        ],
        body: tableData,
        startY: 70,
        styles: { fontSize: 10 },
        headStyles: { fillColor: [59, 130, 246] },
      });

      doc.save(
        `medical_diagnosis_summary_${new Date().toISOString().split("T")[0]}.pdf`,
      );
      toast.success("Summary report downloaded successfully");
    } catch (error) {
      toast.error("Failed to generate summary report");
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

  const getDiagnosisColor = (diagnosis: string) => {
    const diag = diagnosis.toLowerCase();

    if (diag === "healthy") {
      return "text-green-700 bg-green-50 border-green-200";
    } else if (diag === "insomnia") {
      return "text-blue-700 bg-blue-50 border-blue-200";
    } else if (diag === "narcolepsy") {
      return "text-purple-700 bg-purple-50 border-purple-200";
    } else if (diag === "nfle") {
      return "text-red-700 bg-red-50 border-red-200";
    } else if (diag === "plm") {
      return "text-yellow-700 bg-yellow-50 border-yellow-200";
    } else if (diag === "rbd") {
      return "text-orange-700 bg-orange-50 border-orange-200";
    } else if (diag === "sdb") {
      return "text-indigo-700 bg-indigo-50 border-indigo-200";
    } else {
      return "text-gray-700 bg-gray-50 border-gray-200";
    }
  };

  // Pagination
  const indexOfLastReport = currentPage * reportsPerPage;
  const indexOfFirstReport = indexOfLastReport - reportsPerPage;
  const currentReports = filteredReports.slice(
    indexOfFirstReport,
    indexOfLastReport,
  );
  const totalPages = Math.ceil(filteredReports.length / reportsPerPage);

  // Statistics
  const totalReports = reports.length;
  const healthyCount = reports.filter((r) =>
    r.diagnosis.toLowerCase().includes("healthy"),
  ).length;
  const avgConfidence =
    reports.length > 0
      ? reports.reduce((sum, r) => sum + r.confidence, 0) / reports.length
      : 0;

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold bg-gradient-to-r from-blue-600 to-indigo-600 bg-clip-text text-transparent">
            Diagnosis Reports
          </h1>
          <p className="mt-2 text-gray-600">
            View, filter, and download diagnosis reports
          </p>
        </div>
        <button
          onClick={handleDownloadAllReports}
          disabled={filteredReports.length === 0}
          className="inline-flex items-center px-4 py-2 border border-transparent shadow-sm text-sm font-medium rounded-lg text-white bg-gradient-to-r from-green-600 to-emerald-600 hover:from-green-700 hover:to-emerald-700 disabled:opacity-50 disabled:cursor-not-allowed transition-all"
        >
          <Download className="h-4 w-4 mr-2" />
          Download Summary
        </button>
      </div>

      {/* Statistics Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="bg-white rounded-xl shadow-lg p-6 border border-blue-100">
          <div className="flex items-center">
            <div className="bg-gradient-to-r from-blue-500 to-indigo-500 p-3 rounded-lg">
              <FileText className="h-8 w-8 text-white" />
            </div>
            <div className="ml-4">
              <h3 className="text-2xl font-bold text-gray-900">
                {totalReports}
              </h3>
              <p className="text-sm text-gray-600">Total Reports</p>
            </div>
          </div>
        </div>

        <div className="bg-white rounded-xl shadow-lg p-6 border border-green-100">
          <div className="flex items-center">
            <div className="bg-gradient-to-r from-green-500 to-emerald-500 p-3 rounded-lg">
              <TrendingUp className="h-8 w-8 text-white" />
            </div>
            <div className="ml-4">
              <h3 className="text-2xl font-bold text-gray-900">
                {healthyCount}
              </h3>
              <p className="text-sm text-gray-600">Healthy Diagnoses</p>
            </div>
          </div>
        </div>

        <div className="bg-white rounded-xl shadow-lg p-6 border border-purple-100">
          <div className="flex items-center">
            <div className="bg-gradient-to-r from-purple-500 to-indigo-500 p-3 rounded-lg">
              <Calendar className="h-8 w-8 text-white" />
            </div>
            <div className="ml-4">
              <h3 className="text-2xl font-bold text-gray-900">
                {avgConfidence.toFixed(1)}%
              </h3>
              <p className="text-sm text-gray-600">Avg Confidence</p>
            </div>
          </div>
        </div>
      </div>

      {/* Filters */}
      <div className="bg-white shadow-lg rounded-xl p-6 border border-gray-100">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="relative">
            <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
              <Search className="h-5 w-5 text-gray-400" />
            </div>
            <input
              type="text"
              placeholder="Search by patient name or diagnosis..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="block w-full pl-10 pr-3 py-2 border border-gray-300 rounded-lg leading-5 bg-white placeholder-gray-500 focus:outline-none focus:placeholder-gray-400 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            />
          </div>

          <select
            value={dateFilter}
            onChange={(e) => setDateFilter(e.target.value)}
            className="block w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          >
            <option value="all">All Time</option>
            <option value="today">Today</option>
            <option value="week">This Week</option>
            <option value="month">This Month</option>
          </select>

          <select
            value={diagnosisFilter}
            onChange={(e) => setDiagnosisFilter(e.target.value)}
            className="block w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          >
            <option value="all">All Diagnoses</option>
            <option value="healthy">Healthy</option>
            <option value="insomnia">Insomnia</option>
            <option value="narcolepsy">Narcolepsy</option>
            <option value="nfle">NFLE</option>
            <option value="plm">PLM</option>
            <option value="rbd">RBD</option>
            <option value="sdb">SDB</option>
          </select>
        </div>
      </div>

      {/* Loading State */}
      {loading && (
        <div className="flex justify-center py-12">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
        </div>
      )}

      {/* Reports Table */}
      {!loading && (
        <div className="bg-white shadow-lg rounded-xl overflow-hidden border border-gray-100">
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gradient-to-r from-gray-50 to-gray-100">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Patient Details
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
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {currentReports.map((report) => (
                  <tr
                    key={report.id}
                    className="hover:bg-gray-50 transition-colors"
                  >
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div>
                        <div className="text-sm font-medium text-gray-900">
                          {report.patientName}
                        </div>
                        <div className="text-sm text-gray-500">
                          {report.patientAge} years • {report.patientGender}
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span
                        className={`inline-flex px-3 py-1 text-xs font-semibold rounded-full border ${getDiagnosisColor(report.diagnosis)}`}
                      >
                        {report.diagnosis}
                      </span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="flex items-center">
                        <div className="text-sm font-medium text-gray-900">
                          {report.confidence.toFixed(1)}%
                        </div>
                        <div className="ml-2 w-16 bg-gray-200 rounded-full h-2">
                          <div
                            className="bg-blue-600 h-2 rounded-full"
                            style={{ width: `${report.confidence}%` }}
                          ></div>
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                      {formatDate(report.diagnosisDate)}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm font-medium space-x-2">
                      <button
                        onClick={() => handleDownloadPDF(report)}
                        className="inline-flex items-center px-3 py-1 border border-transparent text-xs font-medium rounded text-blue-700 bg-blue-100 hover:bg-blue-200 transition-colors"
                      >
                        <Download className="h-3 w-3 mr-1" />
                        PDF
                      </button>
                      <button
                        onClick={() => handleDownloadCSV(report)}
                        className="inline-flex items-center px-3 py-1 border border-transparent text-xs font-medium rounded text-green-700 bg-green-100 hover:bg-green-200 transition-colors"
                      >
                        <Download className="h-3 w-3 mr-1" />
                        CSV
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
                    <span className="font-medium">
                      {indexOfFirstReport + 1}
                    </span>{" "}
                    to{" "}
                    <span className="font-medium">
                      {Math.min(indexOfLastReport, filteredReports.length)}
                    </span>{" "}
                    of{" "}
                    <span className="font-medium">
                      {filteredReports.length}
                    </span>{" "}
                    results
                  </p>
                </div>
                <div>
                  <nav className="relative z-0 inline-flex rounded-md shadow-sm -space-x-px">
                    <button
                      onClick={() =>
                        setCurrentPage(Math.max(1, currentPage - 1))
                      }
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
      )}

      {!loading && filteredReports.length === 0 && (
        <div className="text-center py-12">
          <FileText className="mx-auto h-12 w-12 text-gray-400" />
          <h3 className="mt-2 text-sm font-medium text-gray-900">
            No reports found
          </h3>
          <p className="mt-1 text-sm text-gray-500">
            Try adjusting your search criteria or generate new diagnosis
            reports.
          </p>
        </div>
      )}
    </div>
  );
};

export default Reports;
