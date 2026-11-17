import React, { useState, useEffect } from 'react';
import { Class } from '../types/Class';
import { ReportData } from '../types/Report';
import { classService } from '../services/ClassService';

interface ReportModalProps {
    classObj: Class;
    onClose: () => void;
    onError: (errorMessage: string) => void;
}

const percentage = (count: number, total: number): string =>
  total === 0 ? '0%' : `${Math.round((count / total) * 100)}%`;

const buildStatusRows = (report: ReportData) => [
  { label: 'Approved', count: report.approvedCount },
  { label: 'In Final Exam', count: report.inFinalCount },
  { label: 'Approved at Final', count: report.approvedFinalCount },
  { label: 'Not Approved', count: report.notApprovedCount },
];

const ReportModal: React.FC<ReportModalProps> = ({classObj, onClose, onError}) => {
    const [report, setReport] = useState<ReportData | null>(null);

    useEffect(() => {
        let cancelled = false;

        const loadReport = async () => {
            try {
                const data = await classService.getClassReport(classObj.id);
                if (!cancelled)
                    setReport(data);
            } catch (error) {
                if (!cancelled) {
                    onError((error as Error).message);
                    onClose();
                }
            }
        };

        loadReport();

        return () => {
            cancelled = true;
        };
    }, [classObj.id, onClose, onError]);

    return (
        <div className="report-overlay">
            <div className="report-modal">
                <div className="report-modal-header">
                    <h3>Report of {classObj.topic} ({classObj.year}.{classObj.semester})</h3>
                    <button
                        className="report-close-btn"
                        onClick={onClose}
                        title="Close"
                    >
                        ×
                    </button>
                </div>

                <div className="report-modal-content">
                    {report === null ? (
                        <p className="report-loading">Loading report...</p>
                    ) : (
                        <>
                            <p className="report-summary">
                                Enrolled Students: {report.totalEnrolled}
                            </p>

                            <div className="report-section">
                                <h4 className="report-section-title">Students by Status</h4>
                                <div className="report-table-container">
                                    <table>
                                        <thead>
                                            <tr>
                                                <th>Metric</th>
                                                <th>Students</th>
                                                <th>Percentage</th>
                                            </tr>
                                        </thead>
                                        <tbody>
                                            {buildStatusRows(report).map(row => (
                                                <tr key={row.label}>
                                                    <td>{row.label}</td>
                                                    <td>{row.count}</td>
                                                    <td>{percentage(row.count, report.totalEnrolled)}</td>
                                                </tr>
                                            ))}
                                        </tbody>
                                    </table>
                                </div>
                            </div>
                        </>
                    )}
                </div>

                {/* Outside the scrollable content, so it stays at the bottom of the window */}
                {report !== null && (
                    <div className="report-footer">
                        Generated at {new Date(report.generatedAt).toLocaleString()}
                    </div>
                )}
            </div>
        </div>
    );
};

export default ReportModal;