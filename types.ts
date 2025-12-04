import { SimulationNodeDatum, SimulationLinkDatum } from 'd3';

export enum Gender {
  MALE = 'Male',
  FEMALE = 'Female',
  NON_BINARY = 'Non-Binary',
  UNKNOWN = 'Unknown'
}

export interface Person {
  name: string;
  gender: Gender;
  birthYear?: number;
  deathYear?: number;
  nationality?: string;
}

export interface BibEntry {
  id: string;
  title: string;
  originalTitle?: string;
  publicationYear: number;
  originalPublicationYear?: number;
  author: Person;
  translator: Person;
  publisher: string;
  city?: string;
  sourceLanguage: string;
  targetLanguage: string;
  tags: string[];
}

export interface GraphNode extends SimulationNodeDatum {
  id: string;
  group: 'author' | 'translator' | 'publisher';
  name: string;
  val: number; // sizing
  x?: number;
  y?: number;
  fx?: number | null;
  fy?: number | null;
}

export interface GraphLink extends SimulationLinkDatum<GraphNode> {
  source: string | GraphNode;
  target: string | GraphNode;
  label?: string;
}

export interface NetworkData {
  nodes: GraphNode[];
  links: GraphLink[];
}

export type ViewMode = 'list' | 'stats' | 'network';