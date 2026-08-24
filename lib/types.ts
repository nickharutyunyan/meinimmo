export type Facts = { price: number; area: number; rooms: string; year: string; floor: string; energy: string; heating: string; totalCost: number };
export type Report = { id: string; title: string; address: string; location?: string; propertyType: 'flat' | 'house'; source: string; createdAt: string; facts: Facts; score: number; summary: string; considerations: string[]; offerQuestions?: string[]; sunOrientation: string; aiEnriched: boolean };
export type Comparison = { id: string; reportIds: [string, string]; createdAt: string };
