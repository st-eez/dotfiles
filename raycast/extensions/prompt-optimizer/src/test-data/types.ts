export interface TestCase {
  id: string;
  category: string;
  description: string;
  userRequest: string;
  additionalContext?: string;
  persona?: string;
  mode: "quick" | "detailed";
  expectedScore?: { min: number; max: number };
  expectedStructurePass?: boolean;
}
