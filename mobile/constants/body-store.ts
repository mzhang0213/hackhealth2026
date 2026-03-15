import type { Slug } from 'react-native-body-highlighter';

export const BODY_DIAGRAM_KEY = 'body_diagram';

export type InjuryStatus = 'pain' | 'moderate' | 'recovering';

export type MarkedPart = {
  slug: Slug;
  side?: 'left' | 'right';
  status: InjuryStatus;
  howItHappened?: string;
  dateOfInjury?: string;
  doctorDiagnosis?: string;
  initialSymptoms?: string;
};
