import React from 'react';
import { Class } from '../types/Class';
import { classService } from '../services/ClassService';

interface ClassListProps {
  classes: Class[];
  onEditClass: (classObj: Class) => void;     // Callback when Edit is clicked
  onClassDeleted: () => void;                 // Callback when a class is successfully deleted
  onEnrollStudents: (classObj: Class) => void; // Callback when Enroll is clicked
  onViewReport: (classObs: Class) => void; // Callback when Report is clicked
  onError: (errorMessage: string) => void;
}

/** Describes a semester (1 or 2) for display. */
const semesterLabel = (semester: number): string => (semester === 1 ? '1st Semester' : '2nd Semester');

/** Table of the existing classes with their actions. */
const ClassList: React.FC<ClassListProps> = ({ classes, onEditClass, onClassDeleted, onEnrollStudents, onViewReport, onError }) => {
  const handleDelete = async (classObj: Class) => {
    if (window.confirm(`Are you sure you want to delete the class "${classObj.topic} (${classObj.year}/${classObj.semester})"?`)) {
      try {
        await classService.deleteClass(classObj.id);
        onClassDeleted();
      } catch (error) {
        onError((error as Error).message);
      }
    }
  };

  return (
    <div className="classes-list">
      <h3>Existing Classes ({classes.length})</h3>

      {classes.length === 0 ? (
        <div className="no-classes">
          No classes created yet. Add your first class using the form above.
        </div>
      ) : (
        <div className="table-container">
          <table>
            <thead>
              <tr>
                <th>Topic</th>
                <th>Year</th>
                <th>Semester</th>
                <th>Enrolled Students</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {classes.map((classObj) => (
                <tr key={classObj.id}>
                  <td><strong>{classObj.topic}</strong></td>
                  <td><strong>{classObj.year}</strong></td>
                  <td><strong>{semesterLabel(classObj.semester)}</strong></td>
                  <td>{classObj.enrollments.length}</td>
                  <td>
                    <button
                      className="edit-btn"
                      onClick={() => onEditClass(classObj)}
                      title="Edit class"
                    >
                      Edit
                    </button>
                    <button
                      className="delete-btn"
                      onClick={() => handleDelete(classObj)}
                      title="Delete class"
                    >
                      Delete
                    </button>
                    <button
                      className="enroll-btn"
                      onClick={() => onEnrollStudents(classObj)}
                      title="Enroll students"
                    >
                      Enroll
                    </button>
                    <button
                      className="report-btn"
                      onClick={() => onViewReport(classObj)}
                      title="View report"
                    >
                      Report
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
};

export default ClassList;
