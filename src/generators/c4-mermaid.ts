/**
 * C4 Model Diagram Generator using Mermaid
 * Generates C4 diagrams in Mermaid syntax
 */

import type {
  C4Model,
  C4Person,
  C4SoftwareSystem,
  C4Container,
  C4Component,
  C4Relationship,
  C4DiagramOptions,
  C4Level
} from '../types/c4.js';

export class C4MermaidGenerator {
  /**
   * Generate a C4 diagram in Mermaid syntax
   */
  generate(model: C4Model, options: C4DiagramOptions): string {
    switch (options.level) {
      case 'context':
        return this.generateContextDiagram(model, options);
      case 'container':
        return this.generateContainerDiagram(model, options);
      case 'component':
        return this.generateComponentDiagram(model, options);
      case 'code':
        return this.generateCodeDiagram(model, options);
      default:
        throw new Error(`Unknown C4 level: ${options.level}`);
    }
  }

  /**
   * Generate System Context diagram (Level 1)
   */
  private generateContextDiagram(model: C4Model, options: C4DiagramOptions): string {
    const direction = options.direction || 'TB';
    const lines: string[] = [
      `%% C4 Context Diagram: ${model.title}`,
      `%% ${model.description || 'System context showing users and external systems'}`,
      '',
      `graph ${direction}`,
      ''
    ];

    // Add styling
    lines.push(...this.getC4Styles());
    lines.push('');

    // Add people
    for (const person of model.people) {
      const style = person.external ? ':::person_ext' : ':::person';
      lines.push(`    ${person.id}["👤 ${person.name}<br/><i>${person.description}</i>"]${style}`);
    }

    // Add systems
    for (const system of model.systems) {
      if (options.showExternal !== false || !system.external) {
        const style = system.external ? ':::system_ext' : ':::system';
        lines.push(`    ${system.id}["🖥️ ${system.name}<br/><i>${system.description}</i>"]${style}`);
      }
    }

    lines.push('');

    // Add relationships
    if (options.showRelationships !== false) {
      for (const rel of model.relationships) {
        const label = rel.technology ? `${rel.description}<br/>[${rel.technology}]` : rel.description;
        lines.push(`    ${rel.sourceId} -->|"${label}"| ${rel.targetId}`);
      }
    }

    return lines.join('\n');
  }

  /**
   * Generate Container diagram (Level 2)
   */
  private generateContainerDiagram(model: C4Model, options: C4DiagramOptions): string {
    const direction = options.direction || 'TB';
    const targetSystem = options.scope
      ? model.systems.find(s => s.id === options.scope)
      : model.systems.find(s => !s.external);

    if (!targetSystem) {
      throw new Error('No system found for container diagram');
    }

    const lines: string[] = [
      `%% C4 Container Diagram: ${targetSystem.name}`,
      `%% Showing containers within ${targetSystem.name}`,
      '',
      `graph ${direction}`,
      ''
    ];

    lines.push(...this.getC4Styles());
    lines.push('');

    // Add people
    for (const person of model.people) {
      const style = person.external ? ':::person_ext' : ':::person';
      lines.push(`    ${person.id}["👤 ${person.name}"]${style}`);
    }

    // Add external systems
    if (options.showExternal !== false) {
      for (const system of model.systems) {
        if (system.external) {
          lines.push(`    ${system.id}["🖥️ ${system.name}"]:::system_ext`);
        }
      }
    }

    // Add system boundary with containers
    lines.push('');
    lines.push(`    subgraph ${targetSystem.id}_boundary["${targetSystem.name}"]`);

    for (const container of targetSystem.containers || []) {
      lines.push(`        ${container.id}["📦 ${container.name}<br/><i>${container.technology}</i><br/>${container.description}"]:::container`);
    }

    lines.push('    end');
    lines.push('');

    // Add relationships
    if (options.showRelationships !== false) {
      for (const rel of model.relationships) {
        const label = rel.technology ? `${rel.description}<br/>[${rel.technology}]` : rel.description;
        lines.push(`    ${rel.sourceId} -->|"${label}"| ${rel.targetId}`);
      }
    }

    return lines.join('\n');
  }

  /**
   * Generate Component diagram (Level 3)
   */
  private generateComponentDiagram(model: C4Model, options: C4DiagramOptions): string {
    const direction = options.direction || 'TB';

    // Find the target container
    let targetContainer: C4Container | undefined;
    for (const system of model.systems) {
      targetContainer = system.containers?.find(c => c.id === options.scope);
      if (targetContainer) break;
    }

    if (!targetContainer) {
      // Default to first container with components
      for (const system of model.systems) {
        targetContainer = system.containers?.find(c => c.components && c.components.length > 0);
        if (targetContainer) break;
      }
    }

    if (!targetContainer) {
      throw new Error('No container found for component diagram');
    }

    const lines: string[] = [
      `%% C4 Component Diagram: ${targetContainer.name}`,
      `%% Showing components within ${targetContainer.name}`,
      '',
      `graph ${direction}`,
      ''
    ];

    lines.push(...this.getC4Styles());
    lines.push('');

    // Add container boundary with components
    lines.push(`    subgraph ${targetContainer.id}_boundary["${targetContainer.name} [${targetContainer.technology}]"]`);

    for (const component of targetContainer.components || []) {
      lines.push(`        ${component.id}["⚙️ ${component.name}<br/><i>${component.technology}</i><br/>${component.description}"]:::component`);
    }

    lines.push('    end');
    lines.push('');

    // Add relationships for components
    if (options.showRelationships !== false) {
      const componentIds = new Set(targetContainer.components?.map(c => c.id) || []);
      for (const rel of model.relationships) {
        if (componentIds.has(rel.sourceId) || componentIds.has(rel.targetId)) {
          const label = rel.technology ? `${rel.description}<br/>[${rel.technology}]` : rel.description;
          lines.push(`    ${rel.sourceId} -->|"${label}"| ${rel.targetId}`);
        }
      }
    }

    return lines.join('\n');
  }

  /**
   * Generate Code diagram (Level 4)
   */
  private generateCodeDiagram(model: C4Model, options: C4DiagramOptions): string {
    const direction = options.direction || 'TB';

    // Find components with code elements
    let codeElements: { component: C4Component; elements: NonNullable<C4Component['codeElements']> }[] = [];

    for (const system of model.systems) {
      for (const container of system.containers || []) {
        for (const component of container.components || []) {
          if (component.codeElements && component.codeElements.length > 0) {
            if (!options.scope || component.id === options.scope) {
              codeElements.push({ component, elements: component.codeElements });
            }
          }
        }
      }
    }

    const lines: string[] = [
      `%% C4 Code Diagram`,
      `%% Showing code-level elements`,
      '',
      `classDiagram`,
      ''
    ];

    for (const { component, elements } of codeElements) {
      lines.push(`    %% Component: ${component.name}`);
      for (const elem of elements) {
        const stereotype = elem.type === 'interface' ? '<<interface>>' : '';
        lines.push(`    class ${elem.name} {`);
        if (stereotype) lines.push(`        ${stereotype}`);
        if (elem.description) lines.push(`        ${elem.description}`);
        lines.push(`    }`);
      }
      lines.push('');
    }

    return lines.join('\n');
  }

  /**
   * Get C4 styling classes for Mermaid
   */
  private getC4Styles(): string[] {
    return [
      '    classDef person fill:#08427b,stroke:#052e56,color:#fff',
      '    classDef person_ext fill:#999999,stroke:#6b6b6b,color:#fff',
      '    classDef system fill:#1168bd,stroke:#0b4884,color:#fff',
      '    classDef system_ext fill:#999999,stroke:#6b6b6b,color:#fff',
      '    classDef container fill:#438dd5,stroke:#2e6295,color:#fff',
      '    classDef component fill:#85bbf0,stroke:#5d99c6,color:#000'
    ];
  }
}

/**
 * Generate all C4 diagrams for a model
 */
export function generateAllC4Diagrams(model: C4Model, format: 'mermaid' = 'mermaid'): Map<C4Level, string> {
  const generator = new C4MermaidGenerator();
  const diagrams = new Map<C4Level, string>();

  // Context diagram
  diagrams.set('context', generator.generate(model, { level: 'context' }));

  // Container diagram for each non-external system
  for (const system of model.systems.filter(s => !s.external)) {
    if (system.containers && system.containers.length > 0) {
      diagrams.set('container', generator.generate(model, { level: 'container', scope: system.id }));
      break; // Just generate one container diagram
    }
  }

  // Component diagram if there are components
  for (const system of model.systems) {
    for (const container of system.containers || []) {
      if (container.components && container.components.length > 0) {
        diagrams.set('component', generator.generate(model, { level: 'component', scope: container.id }));
        break;
      }
    }
  }

  return diagrams;
}
