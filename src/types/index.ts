export * from './c4.js';
export * from './archimate.js';
export * from './artifacts.js';
export * from './c4-artifacts.js';
export * from './archimate-artifacts.js';

export interface CodebaseInfo {
  rootPath: string;
  name: string;
  language: string;
  framework?: string;
  packageManager?: string;
  entryPoints: string[];
  modules: ModuleInfo[];
  dependencies: DependencyInfo[];
}

export interface ModuleInfo {
  name: string;
  path: string;
  type: 'source' | 'test' | 'config' | 'asset';
  exports?: string[];
  imports?: string[];
  classes?: ClassInfo[];
  functions?: FunctionInfo[];
}

export interface ClassInfo {
  name: string;
  filePath: string;
  lineNumber: number;
  methods: string[];
  properties: string[];
  extends?: string;
  implements?: string[];
  isAbstract?: boolean;
  visibility?: 'public' | 'private' | 'protected';
}

export interface FunctionInfo {
  name: string;
  filePath: string;
  lineNumber: number;
  parameters: string[];
  returnType?: string;
  isAsync?: boolean;
  isExported?: boolean;
}

export interface DependencyInfo {
  name: string;
  version?: string;
  type: 'runtime' | 'dev' | 'peer' | 'optional';
  category?: 'framework' | 'library' | 'tool' | 'database' | 'messaging' | 'other';
}

export interface ArchitectureDocumentation {
  title: string;
  description: string;
  generatedAt: string;
  codebaseInfo: CodebaseInfo;
  c4Model?: import('./c4.js').C4Model;
  archimateModel?: import('./archimate.js').ArchiMateModel;
  diagrams: DiagramOutput[];
  decisions?: ArchitecturalDecision[];
}

export interface DiagramOutput {
  id: string;
  title: string;
  type: 'c4-context' | 'c4-container' | 'c4-component' | 'c4-code' | 'archimate-layered' | 'archimate-application' | 'archimate-technology';
  format: 'mermaid' | 'plantuml' | 'svg';
  content: string;
  description?: string;
}

export interface ArchitecturalDecision {
  id: string;
  title: string;
  status: 'proposed' | 'accepted' | 'deprecated' | 'superseded';
  context: string;
  decision: string;
  consequences: string[];
  date: string;
  supersedes?: string;
  supersededBy?: string;
}

export interface SkillContext {
  workingDirectory: string;
  args?: string;
  conversationHistory?: string[];
}

export interface SkillResult {
  success: boolean;
  output: string;
  diagrams?: DiagramOutput[];
  error?: string;
}
