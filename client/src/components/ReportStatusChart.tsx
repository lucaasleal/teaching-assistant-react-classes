import React from 'react';
import { StudentStatus } from '../types/Report';

/** One category of the chart: how many students are in a status. */
export interface ReportStatusChartRow {
    status: StudentStatus;
    label: string;
    count: number;
    fraction: number;    // count / enrolled students, between 0 and 1
    percentage: string;  // same value as the table shows, e.g. "50%"
}

interface ReportStatusChartProps {
    type: 'bar' | 'pie';
    rows: ReportStatusChartRow[];
}

// One fixed color per status, the same in the bar and in the pie chart
export const STATUS_COLORS: Record<StudentStatus, string> = {
    APPROVED: '#10b981',
    IN_FINAL: '#f59e0b',
    APPROVED_FINAL: '#3b82f6',
    FAILED: '#ef4444',
};

const TEXT_COLOR = '#374151';
const GRID_COLOR = '#e5e7eb';

/* ---------------------------------- Bar chart ---------------------------------- */

const BAR_WIDTH = 520;
const BAR_HEIGHT = 280;
const PLOT = { left: 44, right: 10, top: 24, bottom: 56 };

const BarChart: React.FC<{ rows: ReportStatusChartRow[] }> = ({ rows }) => {
    const plotWidth = BAR_WIDTH - PLOT.left - PLOT.right;
    const plotHeight = BAR_HEIGHT - PLOT.top - PLOT.bottom;
    const slot = plotWidth / rows.length;
    const barWidth = slot * 0.5;
    const baseline = PLOT.top + plotHeight;

    return (
        <svg
            className="report-chart-svg"
            viewBox={`0 0 ${BAR_WIDTH} ${BAR_HEIGHT}`}
            role="img"
            aria-label="Bar chart of the students by status"
            data-testid="status-chart-bar"
        >
            {/* the vertical axis is the share of the enrolled students */}
            {[0, 0.25, 0.5, 0.75, 1].map(tick => {
                const y = PLOT.top + plotHeight * (1 - tick);
                return (
                    <g key={tick}>
                        <line x1={PLOT.left} x2={BAR_WIDTH - PLOT.right} y1={y} y2={y} stroke={GRID_COLOR} />
                        <text x={PLOT.left - 6} y={y + 4} textAnchor="end" fontSize="11" fill={TEXT_COLOR}>
                            {Math.round(tick * 100)}%
                        </text>
                    </g>
                );
            })}

            {rows.map((row, index) => {
                const height = plotHeight * Math.min(1, row.fraction);
                const x = PLOT.left + slot * index + (slot - barWidth) / 2;
                const y = baseline - height;
                return (
                    <g key={row.status}>
                        <rect
                            x={x}
                            y={y}
                            width={barWidth}
                            height={height}
                            fill={STATUS_COLORS[row.status]}
                            data-testid={`chart-segment-${row.status}`}
                            data-count={row.count}
                            data-percentage={row.percentage}
                        >
                            <title>{`${row.label}: ${row.count} (${row.percentage})`}</title>
                        </rect>
                        <text x={x + barWidth / 2} y={y - 6} textAnchor="middle" fontSize="12" fontWeight="600" fill={TEXT_COLOR}>
                            {`${row.count} (${row.percentage})`}
                        </text>
                        <text x={x + barWidth / 2} y={baseline + 20} textAnchor="middle" fontSize="11" fill={TEXT_COLOR}>
                            {row.label}
                        </text>
                    </g>
                );
            })}
        </svg>
    );
};

/* ---------------------------------- Pie chart ---------------------------------- */

const PIE_SIZE = 260;
const CENTER = PIE_SIZE / 2;
const RADIUS = 120;

// Point of the circle at the given angle (radians, 0 = 3 o'clock, clockwise)
const pointAt = (angle: number) => ({
    x: CENTER + RADIUS * Math.cos(angle),
    y: CENTER + RADIUS * Math.sin(angle),
});

const PieChart: React.FC<{ rows: ReportStatusChartRow[] }> = ({ rows }) => {
    // The slices are proportional to the counts, so they always close the circle
    const sum = rows.reduce((acc, row) => acc + row.count, 0);
    const visible = rows.filter(row => row.count > 0);

    let angle = -Math.PI / 2; // starts at 12 o'clock
    const slices = visible.map(row => {
        const sweep = (row.count / sum) * 2 * Math.PI;
        const start = pointAt(angle);
        const end = pointAt(angle + sweep);
        const path = `M ${CENTER} ${CENTER} L ${start.x} ${start.y} A ${RADIUS} ${RADIUS} 0 ${sweep > Math.PI ? 1 : 0} 1 ${end.x} ${end.y} Z`;
        angle += sweep;
        return { row, path };
    });

    const segmentProps = (row: ReportStatusChartRow) => ({
        fill: STATUS_COLORS[row.status],
        'data-testid': `chart-segment-${row.status}`,
        'data-count': row.count,
        'data-percentage': row.percentage,
    });

    return (
        <>
            <svg
                className="report-chart-svg pie"
                viewBox={`0 0 ${PIE_SIZE} ${PIE_SIZE}`}
                role="img"
                aria-label="Pie chart of the students by status"
                data-testid="status-chart-pie"
            >
                {slices.length === 1 ? (
                    // a single status holds everyone: an arc from a point to itself draws nothing
                    <circle cx={CENTER} cy={CENTER} r={RADIUS} {...segmentProps(slices[0].row)}>
                        <title>{`${slices[0].row.label}: ${slices[0].row.count} (${slices[0].row.percentage})`}</title>
                    </circle>
                ) : (
                    slices.map(({ row, path }) => (
                        <path key={row.status} d={path} stroke="white" strokeWidth="2" {...segmentProps(row)}>
                            <title>{`${row.label}: ${row.count} (${row.percentage})`}</title>
                        </path>
                    ))
                )}
            </svg>

            <ul className="report-chart-legend">
                {rows.map(row => (
                    <li key={row.status}>
                        <span className="report-chart-swatch" style={{ backgroundColor: STATUS_COLORS[row.status] }} />
                        {row.label}: {row.count} ({row.percentage})
                    </li>
                ))}
            </ul>
        </>
    );
};

/* ------------------------------------ Wrapper ----------------------------------- */

/** Bar or pie chart of the students by status. */
const ReportStatusChart: React.FC<ReportStatusChartProps> = ({ type, rows }) => {
    if (rows.every(row => row.count === 0)) {
        return <p className="report-empty">No data to chart</p>;
    }

    return (
        <div className="report-chart">
            {type === 'bar' ? <BarChart rows={rows} /> : <PieChart rows={rows} />}
        </div>
    );
};

export default ReportStatusChart;