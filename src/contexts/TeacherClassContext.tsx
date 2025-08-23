import React, { createContext, useContext, useState, ReactNode } from 'react';

interface TeacherClass {
  id: string;
  name: string;
  grade: string;
  studentCount: number;
  isActive: boolean;
}

interface TeacherClassContextType {
  selectedClass: TeacherClass | null;
  setSelectedClass: (cls: TeacherClass | null) => void;
  teacherClasses: TeacherClass[];
  setTeacherClasses: (classes: TeacherClass[]) => void;
}

const TeacherClassContext = createContext<TeacherClassContextType | undefined>(undefined);

export const useTeacherClass = () => {
  const context = useContext(TeacherClassContext);
  if (context === undefined) {
    throw new Error('useTeacherClass must be used within a TeacherClassProvider');
  }
  return context;
};

interface TeacherClassProviderProps {
  children: ReactNode;
}

export const TeacherClassProvider: React.FC<TeacherClassProviderProps> = ({ children }) => {
  const [selectedClass, setSelectedClass] = useState<TeacherClass | null>(null);
  const [teacherClasses, setTeacherClasses] = useState<TeacherClass[]>([]);

  return (
    <TeacherClassContext.Provider value={{
      selectedClass,
      setSelectedClass,
      teacherClasses,
      setTeacherClasses
    }}>
      {children}
    </TeacherClassContext.Provider>
  );
};
