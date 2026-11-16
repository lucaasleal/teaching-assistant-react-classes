import React, { useState, useEffect, useCallback } from 'react';
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
                    <h3>Report of {classObj.topic} Class ({classObj.year}/{classObj.semester})</h3>
                    <button
                        className="report-close-btn"
                        onClick={onClose}
                        title="Close"
                    >
                        x
                    </button>
                </div>

                <div className="report-modal-contest">
                    {report === null ? (
                        <p className="report-loading">Loading report...</p>
                    ) : (
                        <>
                        <p className="report-sumary">
                            {report.totalEnrolled} enrolled students · generated at{' '}
                            {new Date(report.generatedAt).toLocaleString()} 
                        </p>

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
                                <tr>
                                <td>Passou por média</td>
                                <td>{report.approvedCount}</td>
                                <td>{percentage(report.approvedCount, report.totalEnrolled)}</td>
                                </tr>
                                <tr>
                                <td>Vai para a final</td>
                                <td>{report.approvedFinalCount}</td>
                                <td>{percentage(report.approvedFinalCount, report.totalEnrolled)}</td>
                                </tr>
                                <tr>
                                <td>Reprovado por nota</td>
                                <td>{report.notApprovedCount}</td>
                                <td>{percentage(report.notApprovedCount, report.totalEnrolled)}</td>
                                </tr>
                            </tbody>
                            </table>
                        </div>

                        </>
                    )}
                </div>
            </div>
        </div>
    );
};

export default ReportModal;