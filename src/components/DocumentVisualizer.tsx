import React, { useEffect, useState } from "react";
import { motion } from "framer-motion";
import { Download, X } from "lucide-react";
import { format } from "date-fns";
import { toast } from "sonner";
import { Document } from "../pages/DocumentLibrary";
import {
  analyzeDocument,
  type DocumentAnalysis,
  type ExtractedTerm,
} from "../services/documentAnalyzer";
import { dynamicAnalyzer, type DynamicAnalysisResult } from "../services/dynamicDocumentAnalyzer";
import { highlightingEngine } from "../services/highlightingEngine";
import { exportAnalysisToPDF } from "../services/pdfExporter";

interface DocumentVisualizerProps {
  document: Document;
  onClose: () => void;
}

// Term type icon mapping
const termColors: Record<string, string> = {
  date: "bg-blue-100 text-blue-800",
  amount: "bg-green-100 text-green-800",
  term: "bg-purple-100 text-purple-800",
  clause: "bg-yellow-100 text-yellow-800",
  section: "bg-gray-100 text-gray-800",
  reference: "bg-orange-100 text-orange-800",
  percentage: "bg-teal-100 text-teal-800",
  other: "bg-pink-100 text-pink-800",
};

const riskLevelColors = {
  low: "bg-green-100 text-green-800",
  medium: "bg-yellow-100 text-yellow-800",
  high: "bg-red-100 text-red-800",
};

export function DocumentVisualizer({
  document,
  onClose,
}: DocumentVisualizerProps) {
  const [analysis, setAnalysis] = useState<DocumentAnalysis | null>(null);
  const [dynamicAnalysis, setDynamicAnalysis] = useState<DynamicAnalysisResult | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [exporting, setExporting] = useState(false);
  const [analysisMode, setAnalysisMode] = useState<'standard' | 'dynamic'>('dynamic');

  useEffect(() => {
    const loadAnalysis = async () => {
      try {
        setLoading(true);
        
        if (analysisMode === 'dynamic' && document.content) {
          // Use dynamic analysis with highlighting
          const documentType = dynamicAnalyzer.detectDocumentType(document.content, document.title);
          const dynamicResult = await dynamicAnalyzer.analyzeDocument(
            document.content,
            documentType
          );
          
          // Apply highlighting to the content
          const highlightedContent = highlightingEngine.applyHighlighting(
            dynamicResult.structured_text,
            dynamicResult.highlights,
            dynamicResult.visual_config.color_scheme
          );
          
          setDynamicAnalysis({
            ...dynamicResult,
            structured_text: highlightedContent
          });
        } else {
          // Fallback to standard analysis
          const result = await analyzeDocument(document);
          setAnalysis(result);
        }
      } catch (err) {
        setError(
          err instanceof Error ? err.message : "Failed to analyze document"
        );
      } finally {
        setLoading(false);
      }
    };

    loadAnalysis();
  }, [document, analysisMode]);

  const handleExport = async () => {
    if (!analysis) return;

    try {
      setExporting(true);
      const pdfBlob = await exportAnalysisToPDF(document, analysis);

      // Access DOM document (not our Document type)
      const url = URL.createObjectURL(pdfBlob);
      const a = window.document.createElement("a");
      a.href = url;
      a.download = `${document.title
        .replace(/[^a-z0-9]/gi, "_")
        .toLowerCase()}_analysis.pdf`;
      window.document.body.appendChild(a);
      a.click();
      window.document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } catch (err) {
      console.error("Failed to export PDF:", err);
      toast.error("Failed to export PDF. Please try again.");
    } finally {
      setExporting(false);
    }
  };

  if (loading) {
    return (
      <div className="fixed inset-0 bg-gray-900 bg-opacity-50 flex items-center justify-center p-4 z-50">
        <div className="bg-white rounded-xl shadow-xl p-6">
          <div className="animate-spin rounded-full h-8 w-8 border-t-2 border-b-2 border-indigo-600 mx-auto" />
          <p className="mt-4 text-center text-gray-600">
            Analyzing document...
          </p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="fixed inset-0 bg-gray-900 bg-opacity-50 flex items-center justify-center p-4 z-50">
        <div className="bg-white rounded-xl shadow-xl p-6">
          <p className="text-red-600">{error}</p>
          <button
            onClick={onClose}
            className="mt-4 px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700"
          >
            Close
          </button>
        </div>
      </div>
    );
  }

  if (!analysis && !dynamicAnalysis) return null;

  // Use dynamic analysis if available, fallback to standard analysis
  const currentAnalysis = dynamicAnalysis || analysis;

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: 20 }}
      className="fixed inset-0 bg-gray-900 bg-opacity-50 flex items-center justify-center p-4 z-50"
    >
      <motion.div
        className="bg-white rounded-xl shadow-xl max-w-4xl w-full max-h-[90vh] overflow-y-auto"
        initial={{ scale: 0.95 }}
        animate={{ scale: 1 }}
      >
        <div className="p-6">
          <div className="flex justify-between items-center mb-6">
            <h2 className="text-2xl font-bold text-gray-900">
              {document.title}
            </h2>
            <div className="flex space-x-2">
              <button
                onClick={handleExport}
                disabled={exporting}
                className={`p-2 ${
                  exporting
                    ? "text-gray-400 cursor-not-allowed"
                    : "text-gray-600 hover:text-indigo-600"
                } transition-colors`}
                title={exporting ? "Exporting..." : "Export analysis"}
              >
                {exporting ? (
                  <div className="animate-spin rounded-full h-5 w-5 border-t-2 border-b-2 border-indigo-600" />
                ) : (
                  <Download className="h-5 w-5" />
                )}
              </button>
              <button
                onClick={onClose}
                className="p-2 text-gray-600 hover:text-red-600 transition-colors"
                title="Close"
              >
                <X className="h-5 w-5" />
              </button>
            </div>
          </div>

          {/* Risk Analysis */}
          <div className="mb-6">
            <h3 className="text-lg font-semibold text-gray-900 mb-3">
              Risk Analysis
            </h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div
                className={`p-4 rounded-lg ${
                  dynamicAnalysis 
                    ? riskLevelColors[dynamicAnalysis.summary?.overall_risk || 'medium']
                    : riskLevelColors[analysis?.riskLevel || 'medium']
                }`}
              >
                <p className="text-sm font-medium">Risk Level</p>
                <p className="text-2xl font-bold">
                  {dynamicAnalysis 
                    ? (dynamicAnalysis.summary?.overall_risk || 'medium').toUpperCase()
                    : (analysis?.riskLevel || 'medium').toUpperCase()
                  }
                </p>
              </div>
              <div className="bg-gray-50 p-4 rounded-lg">
                <p className="text-sm font-medium">
                  {dynamicAnalysis ? 'Processing Time' : 'Risk Score'}
                </p>
                <p className="text-2xl font-bold">
                  {dynamicAnalysis 
                    ? `${dynamicAnalysis.summary?.processing_time || 0}ms`
                    : analysis?.riskScore?.toFixed(1) || '0.0'
                  }
                </p>
              </div>
            </div>
            
            {/* Dynamic Analysis Summary */}
            {dynamicAnalysis && (
              <div className="mt-4 grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="bg-gray-50 p-4 rounded-lg">
                  <p className="text-sm font-medium">Highlights</p>
                  <p className="text-2xl font-bold">
                    {dynamicAnalysis.highlights?.length || 0}
                  </p>
                </div>
                <div className="bg-gray-50 p-4 rounded-lg">
                  <p className="text-sm font-medium">Document Type</p>
                  <p className="text-lg font-bold capitalize">
                    {(dynamicAnalysis.document_type || 'document').replace('_', ' ')}
                  </p>
                </div>
              </div>
            )}
          </div>

          {/* Clauses */}
          {analysis && analysis.clauses.length > 0 && (
            <div className="mb-6">
              <h3 className="text-lg font-semibold text-gray-900 mb-3">
                Key Clauses
              </h3>
              <div className="space-y-4">
                {analysis.clauses.map((clause, index) => (
                  <div
                    key={index}
                    className={`p-4 rounded-lg ${
                      riskLevelColors[clause.riskLevel]
                    }`}
                  >
                    <div className="flex justify-between items-start">
                      <div>
                        <p className="font-medium">{clause.type}</p>
                        <p className="text-sm text-gray-600 mt-1">
                          {clause.content}
                        </p>
                      </div>
                      <span className="text-xs uppercase bg-white/50 px-2 py-1 rounded">
                        {clause.riskLevel}
                      </span>
                    </div>
                    {clause.riskFactors.length > 0 && (
                      <div className="mt-3">
                        <p className="text-sm font-medium text-gray-700">
                          Risk Factors:
                        </p>
                        <div className="flex flex-wrap gap-2 mt-1">
                          {clause.riskFactors.map((factor, factorIndex) => (
                            <span
                              key={factorIndex}
                              className="text-xs bg-white/50 px-2 py-1 rounded"
                            >
                              {factor}
                            </span>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Extracted Terms */}
          <div className="mb-6">
            <h3 className="text-lg font-semibold text-gray-900 mb-3">
              Extracted Terms
            </h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                              {analysis && analysis.keyTerms.map((term, index) => (
                <div
                  key={index}
                  className={`p-3 rounded-lg ${
                    termColors[term.type] || "bg-gray-100 text-gray-800"
                  } flex justify-between items-center`}
                >
                  <div>
                    <p className="font-medium">{term.value}</p>
                    <p className="text-sm opacity-75">
                      Confidence: {term.confidence.toFixed(1)}%
                    </p>
                    {term.riskFactors && term.riskFactors.length > 0 && (
                      <div className="mt-1">
                        <p className="text-xs font-medium">Risk Factors:</p>
                        <div className="flex flex-wrap gap-1">
                          {term.riskFactors?.map((factor: string, factorIndex: number) => (
                            <span
                              key={factorIndex}
                              className="text-xs bg-white/50 px-1.5 py-0.5 rounded"
                            >
                              {factor}
                            </span>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                  <span className="text-xs uppercase">{term.type}</span>
                </div>
              ))}
            </div>
          </div>

          {/* Document Content with Dynamic Highlighting */}
          <div className="mb-6">
            <div className="flex justify-between items-center mb-3">
              <h3 className="text-lg font-semibold text-gray-900">
                {dynamicAnalysis ? 'Enhanced Document Analysis' : 'Document Preview'}
              </h3>
              {document.content && (
                <div className="flex space-x-2">
                  <button
                    onClick={() => setAnalysisMode('dynamic')}
                    className={`px-3 py-1 text-sm rounded-lg transition-colors ${
                      analysisMode === 'dynamic' 
                        ? 'bg-blue-100 text-blue-800' 
                        : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                    }`}
                  >
                    Smart Highlighting
                  </button>
                  <button
                    onClick={() => setAnalysisMode('standard')}
                    className={`px-3 py-1 text-sm rounded-lg transition-colors ${
                      analysisMode === 'standard' 
                        ? 'bg-blue-100 text-blue-800' 
                        : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                    }`}
                  >
                    Standard
                  </button>
                </div>
              )}
            </div>
            <div className="bg-gray-50 p-4 rounded-lg max-h-96 overflow-y-auto document-content">
              {dynamicAnalysis ? (
                <div>
                  <div
                    className="text-gray-700"
                    dangerouslySetInnerHTML={{ 
                      __html: highlightingEngine.generateAnimationCSS() + dynamicAnalysis.structured_text
                    }}
                    style={{
                      fontSize: '14px',
                      lineHeight: '1.7',
                      textAlign: 'justify'
                    }}
                  />
                  <div className="mt-4 p-3 bg-green-50 border border-green-200 rounded-lg">
                    <p className="text-sm text-green-800">
                      <strong>✅ Full Document Analysis:</strong> Complete document highlighted with {dynamicAnalysis.highlights.length} intelligent highlights. 
                      Scroll to explore all sections with interactive tooltips.
                    </p>
                  </div>
                </div>
              ) : (
                <p className="text-gray-700 whitespace-pre-wrap">
                  {document.content?.substring(0, 2000)}{document.content && document.content.length > 2000 ? '...' : ''}
                </p>
              )}
            </div>
            
            {/* Dynamic Analysis Issues */}
            {dynamicAnalysis && dynamicAnalysis.issues.length > 0 && (
              <div className="mt-4">
                <h4 className="font-medium text-gray-900 mb-2">Key Issues Detected</h4>
                <div className="space-y-2">
                  {dynamicAnalysis.issues.slice(0, 3).map((issue, index) => (
                    <div
                      key={index}
                      className={`p-3 rounded-lg border-l-4 ${
                        issue.severity === 'critical' 
                          ? 'bg-red-50 border-red-400 text-red-800'
                          : issue.severity === 'warning'
                          ? 'bg-yellow-50 border-yellow-400 text-yellow-800'
                          : 'bg-blue-50 border-blue-400 text-blue-800'
                      }`}
                    >
                      <div className="flex justify-between items-start">
                        <div>
                          <p className="font-medium text-sm">{issue.title}</p>
                          <p className="text-sm mt-1">{issue.description}</p>
                        </div>
                        {issue.action_required && (
                          <span className="text-xs bg-red-100 text-red-800 px-2 py-1 rounded-full">
                            Action Required
                          </span>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* Metadata */}
          {document.metadata && (
            <div>
              <h3 className="text-lg font-semibold text-gray-900 mb-3">
                Metadata
              </h3>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <p className="text-sm text-gray-500">Pages</p>
                  <p className="font-medium">
                    {document.metadata.pageCount || "N/A"}
                  </p>
                </div>
                <div>
                  <p className="text-sm text-gray-500">Words</p>
                  <p className="font-medium">{document.metadata.wordCount}</p>
                </div>
                {document.metadata.ocrResults && (
                  <div>
                    <p className="text-sm text-gray-500">OCR Confidence</p>
                    <p className="font-medium">
                      {Math.round(document.metadata.ocrResults.confidence)}%
                    </p>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      </motion.div>
    </motion.div>
  );
}
