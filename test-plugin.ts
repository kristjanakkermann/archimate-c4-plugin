/**
 * Test script for ArchiMate & C4 Plugin
 * Run with: npx tsx test-plugin.ts
 */

// Import from built dist files
import {
  // Registry
  createRegistry,
  registerArtifact,
  registerRelationship,
  createRelationship,
  generateUrn,
  serializeRegistry,
  getRegistryStats,

  // Templates
  createFromTemplate,
  ARTIFACT_TEMPLATES,

  // C4 Generator
  C4MermaidGenerator,

  // ArchiMate Generator
  ArchiMateMermaidGenerator,
} from './dist/index.js';

import { createExampleC4Model } from './dist/skills/c4-skill.js';
import { createExampleArchiMateModel } from './dist/skills/archimate-skill.js';

console.log('🏗️  ArchiMate & C4 Plugin Test\n');
console.log('=' .repeat(50));

// Test 1: Artifact Registry
console.log('\n📦 Test 1: Artifact Registry\n');

const registry = createRegistry('test-project', 'Test E-Commerce Project', 'https://github.com/acme/ecommerce');

// Create artifacts using templates
const systemArtifact = createFromTemplate(
  'c4-system',
  { org: 'acme', repo: 'ecommerce', category: 'system', name: 'ecommerce-platform' },
  { name: 'E-Commerce Platform' },
  { technology: 'TypeScript/Node.js' }
);
registerArtifact(registry, systemArtifact);
console.log(`✅ Created system: ${systemArtifact.urn}`);

const containerArtifact = createFromTemplate(
  'c4-container',
  { org: 'acme', repo: 'ecommerce', category: 'container', name: 'api-server' },
  { name: 'API Server', technology: 'Node.js/Express' },
  {
    source: { filePath: 'src/server/index.ts', repository: 'https://github.com/acme/ecommerce' },
    additionalProperties: { parentUrn: systemArtifact.urn }
  }
);
registerArtifact(registry, containerArtifact);
console.log(`✅ Created container: ${containerArtifact.urn}`);

const componentArtifact = createFromTemplate(
  'c4-component',
  { org: 'acme', repo: 'ecommerce', category: 'component', name: 'order-controller', qualifier: 'api-server' },
  { name: 'Order Controller', technology: 'Express Router' },
  {
    source: { filePath: 'src/server/controllers/order.controller.ts', lineRange: [1, 150] },
    additionalProperties: { parentUrn: containerArtifact.urn }
  }
);
registerArtifact(registry, componentArtifact);
console.log(`✅ Created component: ${componentArtifact.urn}`);

// Create relationship
const rel = createRelationship(
  containerArtifact.urn,
  componentArtifact.urn,
  'contains',
  { label: 'contains' }
);
registerRelationship(registry, rel);
console.log(`✅ Created relationship: ${rel.urn}`);

// Show stats
const stats = getRegistryStats(registry);
console.log('\n📊 Registry Stats:');
console.log(JSON.stringify(stats, null, 2));

// Test 2: C4 Diagram Generation
console.log('\n' + '='.repeat(50));
console.log('\n📐 Test 2: C4 Diagram Generation\n');

const c4Model = createExampleC4Model();
const c4Generator = new C4MermaidGenerator();

console.log('System Context Diagram:');
console.log('-'.repeat(30));
const contextDiagram = c4Generator.generate(c4Model, { level: 'context' });
console.log(contextDiagram.substring(0, 500) + '...\n');

console.log('Container Diagram:');
console.log('-'.repeat(30));
const containerDiagram = c4Generator.generate(c4Model, { level: 'container', scope: 'ecommerce' });
console.log(containerDiagram.substring(0, 500) + '...\n');

// Test 3: ArchiMate Diagram Generation
console.log('='.repeat(50));
console.log('\n🏛️  Test 3: ArchiMate Diagram Generation\n');

const archimateModel = createExampleArchiMateModel();
const archimateGenerator = new ArchiMateMermaidGenerator();

console.log('Layered View:');
console.log('-'.repeat(30));
const layeredDiagram = archimateGenerator.generate(archimateModel, { viewpoint: 'layered' });
console.log(layeredDiagram.substring(0, 500) + '...\n');

// Test 4: Available Templates
console.log('='.repeat(50));
console.log('\n📋 Test 4: Available Artifact Templates\n');

Object.entries(ARTIFACT_TEMPLATES).forEach(([id, template]) => {
  console.log(`  ${id}: ${template.category} (${template.requiredFields.join(', ')})`);
});

// Test 5: URN Generation
console.log('\n' + '='.repeat(50));
console.log('\n🔗 Test 5: URN Examples\n');

const examples = [
  { org: 'acme', repo: 'ecommerce', category: 'system' as const, name: 'platform' },
  { org: 'acme', repo: 'ecommerce', category: 'container' as const, name: 'web-app' },
  { org: 'acme', repo: 'ecommerce', category: 'component' as const, name: 'auth-service', qualifier: 'api-server' },
  { org: 'acme', repo: 'ecommerce', category: 'code' as const, name: 'UserService', qualifier: 'api-server/auth-service' },
];

examples.forEach(id => {
  console.log(`  ${generateUrn(id)}`);
});

console.log('\n' + '='.repeat(50));
console.log('\n✨ All tests completed!\n');

// Serialize registry for inspection
console.log('📄 Serialized Registry (JSON):');
console.log('-'.repeat(30));
const serialized = serializeRegistry(registry);
console.log(JSON.stringify(serialized, null, 2).substring(0, 1000) + '...\n');
