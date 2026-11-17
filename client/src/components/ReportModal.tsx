import React, { useState, useEffect } from 'react';
import { Class } from '../types/Class';
import { ReportData } from '../types/Report';
import { classService } from '../services/ClassService';
import { GRADES } from '../types/Evaluation';
import ReportStatusSection from './ReportStatusSection';
import ReportStudentsTable from './ReportStudentsTable';

interface ReportModalProps {
    classObj: Class;
    onClose: () => void;
    onError: (errorMessage: string) => void;
}

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

                            <ReportStatusSection
                                report={report}
                            />

                            <div className="report-section">
                                <h4 className="report-section-title">Performance by Goal</h4>
                                {report.evaluationPerformance.length === 0 ? (
                                    <p className="report-empty">No evaluations recorded for this class</p>
                                ) : (
                                    <div className="report-table-container">
                                        <table>
                                            <thead>
                                                <tr>
                                                    <th rowSpan={2}>Goal</th>
                                                    <th rowSpan={2} className="report-center">Average</th>
                                                    <th colSpan={GRADES.length} className="report-group-header">
                                                        Grade Distribution
                                                    </th>
                                                    <th rowSpan={2} className="report-center">Evaluated Students</th>
                                                </tr>
                                                <tr>
                                                    {GRADES.map(grade => (
                                                        <th key={grade} className="report-center">{grade}</th>
                                                    ))}
                                                </tr>
                                            </thead>
                                            <tbody>
                                                {report.evaluationPerformance.map(performance => (
                                                    <tr key={performance.goal}>
                                                        <td>{performance.goal}</td>
                                                        <td className="report-center">{performance.averageGrade.toFixed(1)}</td>
                                                        {GRADES.map(grade => (
                                                            <td key={grade} className="report-center">
                                                                {performance.gradeDistribution[grade]}
                                                            </td>
                                                        ))}
                                                        <td className="report-center">{performance.evaluatedStudents}</td>
                                                    </tr>
                                                ))}
                                            </tbody>
                                        </table>
                                    </div>
                                )}
                            </div>

                            <ReportStudentsTable
                                students={report.students}
                                studentsAverage={report.studentsAverage}
                            />
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