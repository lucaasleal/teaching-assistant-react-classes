import React, { useState, useEffect, useCallback } from 'react';
import { Class } from '../types/Class';
import { ReportData } from '../types/Report';
import { classService } from '../services/ClassService';

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


    return null;
}

export default ReportModal;