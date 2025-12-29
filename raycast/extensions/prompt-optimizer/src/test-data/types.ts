export interface TestCase {
  id: string;
  category: string;
  description: string;
  userRequest: string;
  additionalContext?: string;
  persona?: string;
  expectedScore?: { min: number; max: number };
  expectedStructurePass?: boolean;
  excludeFromAB?: boolean;
}
