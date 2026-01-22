/**
 * ArchiMate Type Definitions
 * Based on ArchiMate 3.2 Specification: https://pubs.opengroup.org/architecture/archimate32-doc/
 */

// ArchiMate Layers
export type ArchiMateLayer = 'strategy' | 'business' | 'application' | 'technology' | 'physical' | 'implementation';

// ArchiMate Aspect
export type ArchiMateAspect = 'passive' | 'behavior' | 'active';

// Strategy Layer Elements
export type StrategyElement =
  | 'resource'
  | 'capability'
  | 'valueStream'
  | 'courseOfAction';

// Business Layer Elements
export type BusinessElement =
  | 'businessActor'
  | 'businessRole'
  | 'businessCollaboration'
  | 'businessInterface'
  | 'businessProcess'
  | 'businessFunction'
  | 'businessInteraction'
  | 'businessEvent'
  | 'businessService'
  | 'businessObject'
  | 'contract'
  | 'representation'
  | 'product';

// Application Layer Elements
export type ApplicationElement =
  | 'applicationComponent'
  | 'applicationCollaboration'
  | 'applicationInterface'
  | 'applicationFunction'
  | 'applicationInteraction'
  | 'applicationProcess'
  | 'applicationEvent'
  | 'applicationService'
  | 'dataObject';

// Technology Layer Elements
export type TechnologyElement =
  | 'node'
  | 'device'
  | 'systemSoftware'
  | 'technologyCollaboration'
  | 'technologyInterface'
  | 'path'
  | 'communicationNetwork'
  | 'technologyFunction'
  | 'technologyProcess'
  | 'technologyInteraction'
  | 'technologyEvent'
  | 'technologyService'
  | 'artifact';

// Implementation Layer Elements
export type ImplementationElement =
  | 'workPackage'
  | 'deliverable'
  | 'implementationEvent'
  | 'plateau'
  | 'gap';

// Motivation Elements
export type MotivationElement =
  | 'stakeholder'
  | 'driver'
  | 'assessment'
  | 'goal'
  | 'outcome'
  | 'principle'
  | 'requirement'
  | 'constraint'
  | 'meaning'
  | 'value';

export type ArchiMateElementType =
  | StrategyElement
  | BusinessElement
  | ApplicationElement
  | TechnologyElement
  | ImplementationElement
  | MotivationElement;

// ArchiMate Relationship Types
export type ArchiMateRelationType =
  | 'composition'
  | 'aggregation'
  | 'assignment'
  | 'realization'
  | 'serving'
  | 'access'
  | 'influence'
  | 'triggering'
  | 'flow'
  | 'specialization'
  | 'association';

export interface ArchiMateElement {
  id: string;
  name: string;
  type: ArchiMateElementType;
  layer: ArchiMateLayer;
  description?: string;
  properties?: Record<string, string>;
  tags?: string[];
}

export interface ArchiMateRelationship {
  id: string;
  sourceId: string;
  targetId: string;
  type: ArchiMateRelationType;
  name?: string;
  description?: string;
  accessType?: 'read' | 'write' | 'readWrite';
  influenceStrength?: '+' | '++' | '-' | '--';
}

export interface ArchiMateView {
  id: string;
  name: string;
  description?: string;
  viewpoint?: ArchiMateViewpoint;
  elements: string[]; // Element IDs
  relationships: string[]; // Relationship IDs
}

export type ArchiMateViewpoint =
  | 'organization'
  | 'businessProcessCooperation'
  | 'product'
  | 'application'
  | 'applicationCooperation'
  | 'technologyUsage'
  | 'technology'
  | 'physicalEnvironment'
  | 'layered'
  | 'implementation'
  | 'migration'
  | 'stakeholder'
  | 'goalRealization'
  | 'requirementsRealization'
  | 'motivation';

export interface ArchiMateModel {
  name: string;
  description?: string;
  elements: ArchiMateElement[];
  relationships: ArchiMateRelationship[];
  views: ArchiMateView[];
  metadata?: {
    version?: string;
    created?: string;
    modified?: string;
    author?: string;
  };
}

export interface ArchiMateDiagramOptions {
  viewpoint?: ArchiMateViewpoint;
  layers?: ArchiMateLayer[];
  showRelationships?: boolean;
  direction?: 'TB' | 'LR' | 'BT' | 'RL';
  format?: 'mermaid' | 'plantuml' | 'archimate-exchange';
  groupByLayer?: boolean;
}

export interface ArchiMateAnalysisResult {
  model: ArchiMateModel;
  diagrams: {
    viewpoint: ArchiMateViewpoint;
    content: string;
    format: string;
  }[];
  metadata: {
    analyzedAt: string;
    sourceDirectory: string;
    elementCount: number;
    relationshipCount: number;
  };
}
