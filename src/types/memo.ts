import { SubjectType } from './index';

export interface MemoSheetConfig {
  id: string;
  session: string;
  semester: string;
  category: SubjectType;
  subject: string;
  examYear: string;
  examDate: string;
  collegeCentre: string;
  professor1Name: string;
  professor1College: string;
  professor2Name: string;
  professor2College: string;
  columnCount: 4 | 5;
  updatedAt?: string;
  updatedBy?: string;
}

export interface MemoSheetData {
  session: string;
  semester: string;
  category: SubjectType;
  subject: string;
  examYear: string;
  examDate: string;
  collegeCentre: string;
  professor1Name: string;
  professor1College: string;
  professor2Name: string;
  professor2College: string;
  columnCount: 4 | 5;
  rollNumbers: string[];
  totalStudents: number;
}

export interface MemoSubjectOption {
  subject: string;
  studentCount: number;
  papers: string[];
}
