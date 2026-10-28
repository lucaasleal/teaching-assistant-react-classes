import React, { useState, useEffect, useRef } from 'react';
import { Student } from '../types/Student';
import { formatCPF } from '../types/CPF';
import { Class } from '../types/Class';
import { studentService } from '../services/StudentService';
import { enrollmentService } from '../services/EnrollmentService';

interface StudentListImportProps {
  onSheetAdded: () => void;      // Callback when student is successfully added
  onCancel?: () => void;
  onError: (error: string) => void; // Callback for error handling
  selectedClass?: Class | null;     // Currently selected class for auto-enrollment
}

const StudentListImport: React.FC<StudentListImportProps> = ({ 
  onSheetAdded, 
  onCancel, 
  onError,
  selectedClass
}) => {
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  
  const fileInputRef = useRef<HTMLInputElement>(null);  

  const handleButtonClick = () => {
    if(fileInputRef.current){
        fileInputRef.current.click();
    }
  }

  const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    if (event.target.files && event.target.files[0]) {
      const file = event.target.files[0];
      setSelectedFile(file);
      console.log("Arquivo selecionado:", file.name);
    }
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!selectedFile) {
      onError("Por favor, selecione um arquivo antes de salvar.");
      return;
    }

    setIsSubmitting(true);

        
    // Auto-enroll in selected class if one is selected
    /*if (selectedClass) {
        try {
        await enrollmentService.enrollStudent(selectedClass.id, newStudent.cpf);
        console.log(`Student ${newStudent.name} enrolled in ${selectedClass.topic}`);
        } catch (enrollmentError) {
        // Student was created but enrollment failed - show warning
        onError(`Student created successfully, but enrollment failed: ${(enrollmentError as Error).message}`);
        setFormData({ name: '', cpf: '', email: '' }); // Clear form anyway
        return; // Exit early to avoid showing success message
        }
    }
        */
    
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
          accept=".csv, .xlsx, .xls" // Opcional: restringe para arquivos de planilha
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
        <button type="submit" disabled={isSubmitting || !selectedFile} data-testid="submit-student-button">
          {isSubmitting ? 'Saving...' : 'Add Student'}
        </button>
        {onCancel && (
          <button type="button" onClick={onCancel}>
            Cancel
          </button>
        )}
      </div>
    </form>
  );
};
export default StudentListImport;