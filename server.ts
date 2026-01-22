/**
 * Simple preview server for ArchiMate & C4 diagrams
 * Run with: npx tsx server.ts
 */

import { createServer } from 'http';
import { C4MermaidGenerator } from './dist/generators/c4-mermaid.js';
import { ArchiMateMermaidGenerator } from './dist/generators/archimate-mermaid.js';
import { createExampleC4Model } from './dist/skills/c4-skill.js';
import { createExampleArchiMateModel } from './dist/skills/archimate-skill.js';

const PORT = 4000;

// Generate all diagrams
const c4Model = createExampleC4Model();
const archimateModel = createExampleArchiMateModel();
const c4Generator = new C4MermaidGenerator();
const archimateGenerator = new ArchiMateMermaidGenerator();

const diagrams = {
  'c4-context': c4Generator.generate(c4Model, { level: 'context' }),
  'c4-container': c4Generator.generate(c4Model, { level: 'container', scope: 'ecommerce' }),
  'c4-component': c4Generator.generate(c4Model, { level: 'component', scope: 'api' }),
  'archimate-layered': archimateGenerator.generate(archimateModel, { viewpoint: 'layered' }),
  'archimate-application': archimateGenerator.generate(archimateModel, { viewpoint: 'application' }),
  'archimate-technology': archimateGenerator.generate(archimateModel, { viewpoint: 'technology' }),
};

function generateHTML(): string {
  const diagramSections = Object.entries(diagrams).map(([name, content]) => `
    <div class="diagram-section">
      <h2>${name.replace('-', ' ').toUpperCase()}</h2>
      <div class="mermaid">
${content}
      </div>
      <details>
        <summary>View Source</summary>
        <pre><code>${content.replace(/</g, '&lt;').replace(/>/g, '&gt;')}</code></pre>
      </details>
    </div>
  `).join('\n');

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>ArchiMate & C4 Plugin Preview</title>
  <script src="https://cdn.jsdelivr.net/npm/mermaid/dist/mermaid.min.js"></script>
  <style>
    * { box-sizing: border-box; }
    body {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
      max-width: 1400px;
      margin: 0 auto;
      padding: 20px;
      background: #f5f5f5;
    }
    h1 {
      text-align: center;
      color: #1a1a2e;
      border-bottom: 3px solid #4361ee;
      padding-bottom: 10px;
    }
    .diagram-section {
      background: white;
      border-radius: 8px;
      padding: 20px;
      margin: 20px 0;
      box-shadow: 0 2px 4px rgba(0,0,0,0.1);
    }
    .diagram-section h2 {
      color: #4361ee;
      margin-top: 0;
      font-size: 1.2em;
      text-transform: capitalize;
    }
    .mermaid {
      display: flex;
      justify-content: center;
      padding: 20px;
      background: #fafafa;
      border-radius: 4px;
      overflow-x: auto;
    }
    details {
      margin-top: 15px;
    }
    summary {
      cursor: pointer;
      color: #4361ee;
      font-weight: 500;
    }
    pre {
      background: #1a1a2e;
      color: #e0e0e0;
      padding: 15px;
      border-radius: 4px;
      overflow-x: auto;
      font-size: 12px;
    }
    .nav {
      display: flex;
      flex-wrap: wrap;
      gap: 10px;
      justify-content: center;
      margin: 20px 0;
    }
    .nav a {
      background: #4361ee;
      color: white;
      padding: 8px 16px;
      border-radius: 4px;
      text-decoration: none;
      font-size: 14px;
    }
    .nav a:hover {
      background: #3451d1;
    }
    .info {
      background: #e8f4f8;
      border-left: 4px solid #4361ee;
      padding: 15px;
      margin: 20px 0;
    }
  </style>
</head>
<body>
  <h1>🏗️ ArchiMate & C4 Architecture Plugin</h1>

  <div class="info">
    <strong>Plugin Features:</strong>
    <ul>
      <li><strong>Unique URNs</strong>: Every artifact has a persistent identifier like <code>urn:archimate-c4:acme:ecommerce:container:api-server</code></li>
      <li><strong>Artifact Registry</strong>: Stored in <code>.architecture/artifacts.json</code></li>
      <li><strong>Reusable Templates</strong>: 20+ predefined templates for C4 and ArchiMate elements</li>
      <li><strong>Mermaid Output</strong>: All diagrams render in any markdown viewer</li>
    </ul>
  </div>

  <div class="nav">
    <a href="#c4-context">C4 Context</a>
    <a href="#c4-container">C4 Container</a>
    <a href="#c4-component">C4 Component</a>
    <a href="#archimate-layered">ArchiMate Layered</a>
    <a href="#archimate-application">ArchiMate Application</a>
    <a href="#archimate-technology">ArchiMate Technology</a>
  </div>

  ${Object.entries(diagrams).map(([name, content]) => `
    <div class="diagram-section" id="${name}">
      <h2>${name.replace(/-/g, ' ')}</h2>
      <div class="mermaid">
${content}
      </div>
      <details>
        <summary>View Mermaid Source</summary>
        <pre><code>${content.replace(/</g, '&lt;').replace(/>/g, '&gt;')}</code></pre>
      </details>
    </div>
  `).join('\n')}

  <script>
    mermaid.initialize({
      startOnLoad: true,
      theme: 'default',
      securityLevel: 'loose'
    });
  </script>
</body>
</html>`;
}

const server = createServer((req, res) => {
  if (req.url === '/' || req.url === '/index.html') {
    res.writeHead(200, { 'Content-Type': 'text/html' });
    res.end(generateHTML());
  } else if (req.url === '/api/diagrams') {
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify(diagrams, null, 2));
  } else {
    res.writeHead(404);
    res.end('Not Found');
  }
});

server.listen(PORT, () => {
  console.log(`\n🚀 ArchiMate & C4 Preview Server running at:\n`);
  console.log(`   http://localhost:${PORT}\n`);
  console.log(`   Diagrams available:`);
  Object.keys(diagrams).forEach(name => {
    console.log(`   - ${name}`);
  });
  console.log(`\n   Press Ctrl+C to stop\n`);
});
