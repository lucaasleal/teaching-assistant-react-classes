import React, { useState } from 'react';
import { ReportData, StudentStatus, STATUS_LABELS } from '../types/Report';
import ReportStatusChart, { ReportStatusChartRow } from './ReportStatusChart';

type StatusView = 'table' | 'bar' | 'pie';

const VIEW_OPTIONS: { view: StatusView; label: string }[] = [
    { view: 'table', label: 'Table' },
    { view: 'bar', label: 'Bar chart' },
    { view: 'pie', label: 'Pie chart' },
];

const percentage = (count: number, total: number): string =>
    total === 0 ? '0%' : `${Math.round((count / total) * 100)}%`;

// One row per status, shared by the table and by the charts
const buildStatusRows = (report: ReportData): ReportStatusChartRow[] => {
    const counts: [StudentStatus, number][] = [
        ['APPROVED', report.approvedCount],
        ['IN_FINAL', report.inFinalCount],
        ['APPROVED_FINAL', report.approvedFinalCount],
        ['FAILED', report.notApprovedCount],
    ];
    return counts.map(([status, count]) => ({
        status,
        label: STATUS_LABELS[status],
        count,
        fraction: report.totalEnrolled === 0 ? 0 : count / report.totalEnrolled,
        percentage: percentage(count, report.totalEnrolled),
    }));
};

/** "Students by Status" section: the same data as a table, a bar chart or a pie chart. */
const ReportStatusSection: React.FC<{ report: ReportData }> = ({ report }) => {
    const [view, setView] = useState<StatusView>('table');
    const rows = buildStatusRows(report);

    return (
        <div className="report-section">
            <div className="report-section-header">
                <h4 className="report-section-title">Students by Status</h4>
                <div className="report-view-toggle" role="group" aria-label="Report view">
                    {VIEW_OPTIONS.map(option => (
                        <button
                            key={option.view}
                            type="button"
                            className={`report-view-btn${view === option.view ? ' active' : ''}`}
                            aria-pressed={view === option.view}
                            data-testid={`report-view-${option.view}`}
                            onClick={() => setView(option.view)}
                        >
                            {option.label}
                        </button>
                    ))}
                </div>
            </div>

            {view === 'table' ? (
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
                            {rows.map(row => (
                                <tr key={row.status} data-testid={`status-row-${row.status}`}>
                                    <td>{row.label}</td>
                                    <td>{row.count}</td>
                                    <td>{row.percentage}</td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            ) : (
                <ReportStatusChart type={view} rows={rows} />
            )}
        </div>
    );
};

export default ReportStatusSection;