import React, { useState, useRef } from 'react';
import { Class } from '../types/Class';
import { studentService } from '../services/StudentService';

interface StudentListImportProps {
  onSheetAdded: () => void;
  onCancel?: () => void;
  onError: (error: string) => void;
  selectedClass?: Class | null;
}

const StudentListImport: React.FC<StudentListImportProps> = ({
  onSheetAdded,
  onCancel,
  onError,
  selectedClass
}) => {
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [feedback, setFeedback] = useState('');
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleButtonClick = () => {
    fileInputRef.current?.click();
  };

  const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    // Cancelling the native picker leaves the previous selection unchanged.
    if (!file) return;
    setFeedback('');
    if (!/\.(csv|xlsx)$/i.test(file.name)) {
      setSelectedFile(null);
      event.target.value = '';
      onError('Formato esperado: CSV ou XLSX');
      return;
    }
    setSelectedFile(file);
    onError('');
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedFile) {
      onError('Selecione uma planilha antes de importar');
      return;
    }
    setIsSubmitting(true);
    setFeedback('');
    onError('');
    try {
      const result = await studentService.importStudents(selectedFile, selectedClass?.id);
      setFeedback(result.message === 'ALUNO_JA_CADASTRADO'
        ? 'ALUNO_JA_CADASTRADO'
        : result.duplicated > 0
          ? `Planilha de alunas importada corretamente (${result.duplicated} aluno(s) já cadastrado(s))`
          : 'Planilha de alunas importada corretamente');
      setSelectedFile(null);
      if (fileInputRef.current) fileInputRef.current.value = '';
      // Refresh the original StudentsTab and class enrollment list; no GUI redesign.
      onSheetAdded();
    } catch (error) {
      onError(error instanceof Error ? error.message : 'Falha ao importar planilha');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="student-form" data-testid="student-form">
      <h2>Sheet Import</h2>

      {/* Class enrollment indicator */}
      {selectedClass && (
        <div className="auto-enrollment-notice">
          <strong>Auto-enrollment:</strong> New student will be automatically enrolled in{' '}
          <span className="auto-enrollment-class">
            {selectedClass.topic} ({selectedClass.year}/{selectedClass.semester})
          </span>
        </div>
      )}

      {/* SEÇÃO DO ARQUIVO: Input oculto e o botão estilizado */}
      <div className="file-upload-container" style={{ margin: '20px 0' }}>
        <input
          type="file"
          ref={fileInputRef}
          onChange={handleFileChange}
          style={{ display: 'none' }}
          accept=".csv, .xlsx"
        />

        {/* Usamos type="button" para garantir que ele NÃO envie o formulário ao ser clicado */}
        <button type="button" onClick={handleButtonClick} className="select-file-btn">
          📁 {selectedFile ? 'Alterar Arquivo' : 'Selecionar Planilha'}
        </button>
        {/* Mostra o nome do arquivo selecionado para o usuário ver que funcionou */}
        {selectedFile && (
          <p style={{ marginTop: '8px', fontSize: '14px', color: '#555' }}>
            Arquivo pronto: <strong>{selectedFile.name}</strong>
          </p>
        )}
      </div>

      <div className="form-buttons">
        {/* Este botão sim faz o submit final do formulário */}
        <button type="submit" disabled={isSubmitting} data-testid="submit-student-button">
          {isSubmitting ? 'Saving...' : 'Add Batch of Students'}
        </button>
        {onCancel && (
          <button type="button" onClick={onCancel}>
            Cancel
          </button>
        )}
      </div>
      {feedback && <p role="status" aria-live="polite">{feedback}</p>}
    </form>
  );
};

export default StudentListImport;
