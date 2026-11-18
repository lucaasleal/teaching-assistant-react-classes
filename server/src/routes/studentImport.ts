import { Router } from 'express';
import multer from 'multer';
import { StudentSet } from '../models/StudentSet';
import { Classes } from '../models/Classes';
import { readStudentSpreadsheet, StudentSpreadsheetError } from '../services/StudentSpreadsheet';

const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 5 * 1024 * 1024 } });

/** POST /api/students/import - file (CSV/XLSX) and optional classId. */
export function studentImportRoutes(students: StudentSet, classes: Classes, onStateChanged: () => void): Router {
  const router = Router();

  router.post('/import', (req, res, next) => {
    upload.single('file')(req, res, async (uploadError: unknown) => {
      if (uploadError) {
        res.status(400).json({ error: 'FORMATO_INCOMPATIVEL' });
        return;
      }
      if (!req.file) {
        res.status(400).json({ error: 'ARQUIVO_NAO_SELECIONADO' });
        return;
      }
      try {
        // Validate the destination before parsing or changing any student.
        const classId = req.body.classId;
        if (classId !== undefined && typeof classId !== 'string') {
          res.status(400).json({ error: 'TURMA_INVALIDA' });
          return;
        }
        const destinationClass = classId ? classes.findClassById(classId) : undefined;
        if (classId && !destinationClass) {
          res.status(404).json({ error: 'TURMA_NAO_ENCONTRADA' });
          return;
        }

        // Atomic validation: read and validate every line before adding any student.
        const incoming = await readStudentSpreadsheet(req.file.originalname, req.file.buffer);
        const alreadyPresent = new Set(students.getAllStudents().map(student => student.getCPF()));
        const seenInFile = new Set<string>();
        const toCreate = [] as typeof incoming;
        const toEnroll = [] as typeof incoming;
        let duplicates = 0;

        for (const student of incoming) {
          const cpf = student.getCPF();
          if (seenInFile.has(cpf)) {
            duplicates++;
            continue;
          }
          seenInFile.add(cpf);
          const existing = students.findStudentByCPF(cpf);
          if (alreadyPresent.has(cpf)) duplicates++;
          else toCreate.push(student);

          const studentToEnroll = existing || student;
          if (destinationClass && !destinationClass.findEnrollmentByStudentCPF(cpf)) {
            toEnroll.push(studentToEnroll);
          }
        }

        // All constructors, columns and target class have passed validation.
        // No awaits inside commit: requests cannot interleave midway through it.
        toCreate.forEach(student => students.addStudent(student));
        if (destinationClass) toEnroll.forEach(student => destinationClass.addEnrollment(student));
        if (toCreate.length > 0 || toEnroll.length > 0) onStateChanged();

        res.json({
          imported: toCreate.length,
          duplicated: duplicates,
          enrolled: toEnroll.length,
          message: toCreate.length === 0 && duplicates > 0
            ? 'ALUNO_JA_CADASTRADO'
            : 'Planilha de alunas importada corretamente'
        });
      } catch (error) {
        if (error instanceof StudentSpreadsheetError) {
          res.status(400).json({
            error: error.code,
            ...(error.missingColumns.length ? { missingColumns: error.missingColumns } : {}),
            ...(error.row ? { row: error.row } : {})
          });
          return;
        }
        next(error);
      }
    });
  });
  return router;
}
