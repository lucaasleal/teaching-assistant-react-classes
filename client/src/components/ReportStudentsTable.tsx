import React, { useState } from 'react';
import { ReportFilter, StudentEntry, STATUS_LABELS } from '../types/Report';

interface ReportStudentsTableProps {
    students: StudentEntry[];
    studentsAverage: number; // average of the whole class (not affected by the filter)
}

const FILTER_OPTIONS: { type: ReportFilter['type']; label: string }[] = [
    { type: 'ALL', label: 'All students' },
    { type: 'APPROVED', label: STATUS_LABELS.APPROVED },
    { type: 'IN_FINAL', label: STATUS_LABELS.IN_FINAL },
    { type: 'APPROVED_FINAL', label: STATUS_LABELS.APPROVED_FINAL },
    { type: 'FAILED', label: STATUS_LABELS.FAILED },
    { type: 'BELOW_AVERAGE', label: 'Below class average' },
    { type: 'BELOW_THRESHOLD', label: 'Final grade below...' },
];

/**
 * Applies a report filter to the student list.
 * "Below" is strict: a student whose grade equals the average/threshold stays out.
 */
export const filterStudents = (
    students: StudentEntry[],
    filter: ReportFilter,
    classAverage: number
): StudentEntry[] => {
    switch (filter.type) {
        case 'ALL':
            return students;
        case 'BELOW_AVERAGE':
            return students.filter(student => student.finalGrade < classAverage);
        case 'BELOW_THRESHOLD': {
            const threshold = filter.threshold;
            // nothing typed yet: do not hide anyone
            return threshold === undefined
                ? students
                : students.filter(student => student.finalGrade < threshold);
        }
        default:
            // the remaining filter types are exactly the student statuses
            return students.filter(student => student.status === filter.type);
    }
};

/** "Students" section of the report: filter bar + table with the class average in the footer. */
const ReportStudentsTable: React.FC<ReportStudentsTableProps> = ({ students, studentsAverage }) => {
    const [filter, setFilter] = useState<ReportFilter>({ type: 'ALL' });

    const visibleStudents = filterStudents(students, filter, studentsAverage);

    return (
        <div className="report-section">
            <h4 className="report-section-title">Students</h4>

            {students.length === 0 ? (
                <p className="report-empty">No students enrolled in this class</p>
            ) : (
                <>
                    <div className="report-filter">
                        <label htmlFor="report-filter-select">Show:</label>
                        <select
                            id="report-filter-select"
                            className="report-filter-select"
                            value={filter.type}
                            // changing the type also clears any previous threshold
                            onChange={(e) => setFilter({ type: e.target.value as ReportFilter['type'] })}
                        >
                            {FILTER_OPTIONS.map(option => (
                                <option key={option.type} value={option.type}>{option.label}</option>
                            ))}
                        </select>

                        {filter.type === 'BELOW_THRESHOLD' && (
                            <input
                                type="number"
                                className="report-filter-input"
                                aria-label="Grade threshold"
                                placeholder="e.g. 5"
                                min={0}
                                max={10}
                                step="0.1"
                                value={filter.threshold ?? ''}
                                onChange={(e) => setFilter({
                                    type: 'BELOW_THRESHOLD',
                                    threshold: e.target.value === '' ? undefined : Number(e.target.value)
                                })}
                            />
                        )}

                        <span className="report-filter-count">
                            Showing {visibleStudents.length} of {students.length}
                        </span>
                    </div>

                    {visibleStudents.length === 0 ? (
                        <p className="report-empty">No students match this filter</p>
                    ) : (
                        <div className="report-table-container">
                            <table>
                                <thead>
                                    <tr>
                                        <th>Student</th>
                                        <th className="report-center">Final Grade</th>
                                        <th className="report-center">Status</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {visibleStudents.map(student => (
                                        <tr key={student.studentId}>
                                            <td>{student.name}</td>
                                            <td className="report-center">{student.finalGrade.toFixed(1)}</td>
                                            <td className="report-center">{STATUS_LABELS[student.status]}</td>
                                        </tr>
                                    ))}
                                </tbody>
                                <tfoot className="report-average-row">
                                    <tr>
                                        <td>Class Average</td>
                                        <td className="report-center">{studentsAverage.toFixed(1)}</td>
                                        <td></td>
                                    </tr>
                                </tfoot>
                            </table>
                        </div>
                    )}
                </>
            )}
        </div>
    );
};

export default ReportStudentsTable;