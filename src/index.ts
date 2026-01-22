/**
 * ArchiMate & C4 Architecture Plugin for Claude Code
 *
 * This plugin provides skills and agents for architectural documentation
 * and visualization using C4 Model and ArchiMate standards.
 *
 * Skills:
 * - /c4 - Generate C4 model diagrams
 * - /archimate - Generate ArchiMate diagrams
 * - /arch-analyze - Analyze codebase architecture
 * - /arch-plan - Create architectural plans and ADRs
 *
 * Agents:
 * - architecture-documenter - Autonomous codebase documentation
 */

// Type exports
export * from './types/index.js';

// Generator exports
export * from './generators/index.js';

// Analyzer exports
export * from './analyzers/index.js';

// Utility exports
export * from './utils/index.js';

// Skill exports
export * from './skills/index.js';

// Agent exports
export * from './agents/index.js';

// Version info
export const VERSION = '0.1.0';
export const PLUGIN_NAME = 'archimate-c4';
