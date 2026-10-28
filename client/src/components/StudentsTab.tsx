import React from 'react';
import { Class } from '../types/Class';
import { Student } from '../types/Student';
import ClassFilter from './ClassFilter';
import StudentForm from './StudentForm';
import StudentList from './StudentList';
import StudentListImport from './StudentListImport'

interface StudentsTabProps {
  students: Student[];                          // Every registered student
  classes: Class[];
  selectedClass: Class | null;                  // Class the list is restricted to, if any
  onSelectClass: (classObj: Class | null) => void;
  editingStudent: Student | null;
  onEditStudent: (student: Student) => void;
  onCancelEdit: () => void;
  onStudentAdded: () => void;
  onStudentUpdated: () => void;
  onStudentDeleted: () => void;
  onError: (errorMessage: string) => void;
  onSheetAdded: () => void;
  loading: boolean;
}

/**
 * The Students tab: class filter, student form and student list. When a class
 * is selected, only its enrolled students are listed and new students are
 * automatically enrolled in it.
 */
const StudentsTab: React.FC<StudentsTabProps> = ({
  students,
  classes,
  selectedClass,
  onSelectClass,
  editingStudent,
  onEditStudent,
  onCancelEdit,
  onStudentAdded,
  onStudentUpdated,
  onStudentDeleted,
  onError,
  onSheetAdded,
  loading
}) => (
  <>
    <ClassFilter classes={classes} selectedClass={selectedClass} onSelectClass={onSelectClass} />

    <StudentForm
      onStudentAdded={onStudentAdded}
      onStudentUpdated={onStudentUpdated}
      onError={onError}
      onCancel={editingStudent ? onCancelEdit : undefined}
      editingStudent={editingStudent}
      selectedClass={selectedClass}
    />

    <StudentListImport
      onSheetAdded = {onSheetAdded}
      onError={onError}
      onCancel={undefined}
      selectedClass={selectedClass}
    />

    <StudentList
      students={selectedClass ? selectedClass.enrollments.map(e => e.student) : students}
      onStudentDeleted={onStudentDeleted}
      onEditStudent={onEditStudent}
      onError={onError}
      loading={loading}
    />
  </>
);

export default StudentsTab;
