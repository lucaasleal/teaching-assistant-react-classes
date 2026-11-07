import React, { useState } from 'react';
import { Class } from '../types/Class';
import { classService } from '../services/ClassService';

interface ReportModalProps {
    classObj: Class;
    onClose: () => void;
    onError: (errorMessage: string) => void;
}

const ReportModal: React.FC<ReportModalProps> = ({classObj, onError}) => {

    return null;
}

export default ReportModal;