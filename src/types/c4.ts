/**
 * C4 Model Type Definitions
 * Based on Simon Brown's C4 Model: https://c4model.com/
 */

export type C4Level = 'context' | 'container' | 'component' | 'code';

export interface C4Person {
  id: string;
  name: string;
  description: string;
  external?: boolean;
  tags?: string[];
}

export interface C4SoftwareSystem {
  id: string;
  name: string;
  description: string;
  external?: boolean;
  containers?: C4Container[];
  tags?: string[];
}

export interface C4Container {
  id: string;
  name: string;
  description: string;
  technology: string;
  components?: C4Component[];
  tags?: string[];
}

export interface C4Component {
  id: string;
  name: string;
  description: string;
  technology: string;
  codeElements?: C4CodeElement[];
  tags?: string[];
}

export interface C4CodeElement {
  id: string;
  name: string;
  type: 'class' | 'interface' | 'function' | 'module' | 'package';
  filePath?: string;
  description?: string;
  tags?: string[];
}

export interface C4Relationship {
  sourceId: string;
  targetId: string;
  description: string;
  technology?: string;
  tags?: string[];
}

export interface C4Model {
  title: string;
  description?: string;
  people: C4Person[];
  systems: C4SoftwareSystem[];
  relationships: C4Relationship[];
}

export interface C4DiagramOptions {
  level: C4Level;
  scope?: string; // ID of the element to focus on
  showExternal?: boolean;
  showRelationships?: boolean;
  direction?: 'TB' | 'LR' | 'BT' | 'RL';
  format?: 'mermaid' | 'plantuml' | 'structurizr';
}

export interface C4AnalysisResult {
  model: C4Model;
  diagrams: {
    level: C4Level;
    content: string;
    format: string;
  }[];
  metadata: {
    analyzedAt: string;
    sourceDirectory: string;
    fileCount: number;
    componentCount: number;
  };
}
