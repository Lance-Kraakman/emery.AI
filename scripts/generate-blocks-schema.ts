#!/usr/bin/env tsx
/**
 * Puck Blocks Schema Generator
 *
 * Parses TypeScript Props types from Puck block components and generates
 * a JSON schema for validation in Python (page_crud templateData validation).
 *
 * Usage:
 *   pnpm generate:blocks-schema
 *
 * Output:
 *   src/components/puck/blocks-schema.generated.json
 */

import * as ts from 'typescript';
import * as fs from 'fs';
import * as path from 'path';
import { glob } from 'glob';

// Types for our schema format
interface PropSchema {
  type: string;
  description?: string;
  required?: boolean;
  default?: unknown;
  enum?: string[];
  items?: PropSchema;
}

interface BlockSchema {
  description: string;
  props: Record<string, PropSchema>;
  slots?: string[];
  requires?: string;
}

interface GeneratedSchema {
  $schema: string;
  version: string;
  generated: string;
  generator: string;
  blocks: Record<string, BlockSchema>;
  categories: Record<string, { title: string; description: string; blocks: string[] }>;
}

// Map TypeScript types to JSON schema types
function mapTsTypeToSchema(type: string): string {
  const typeMap: Record<string, string> = {
    'string': 'string',
    'number': 'number',
    'boolean': 'boolean',
    'object': 'object',
    'any': 'any',
    'unknown': 'any',
    'null': 'null',
    'undefined': 'null',
  };

  // Handle array types
  if (type.endsWith('[]')) {
    return 'array';
  }

  // Handle common complex types
  if (type.includes('Slot')) return 'slot';
  if (type.includes('Action')) return 'array';
  if (type.includes('FourSidedSpacing') || type.includes('FourCornerRadius')) return 'object';
  if (type.includes('RowFilterConfig') || type.includes('RowSortConfig')) return 'array';
  if (type.includes('ComponentType')) return 'slot';

  return typeMap[type] || 'object';
}

// Extract union type values (for enums)
function extractUnionValues(typeNode: ts.TypeNode, checker: ts.TypeChecker): string[] | undefined {
  if (ts.isUnionTypeNode(typeNode)) {
    const values: string[] = [];
    for (const member of typeNode.types) {
      if (ts.isLiteralTypeNode(member)) {
        if (ts.isStringLiteral(member.literal)) {
          values.push(member.literal.text);
        }
      }
    }
    if (values.length > 0) {
      return values;
    }
  }
  return undefined;
}

// Parse props from a type literal node
function parseTypeLiteralProps(
  typeNode: ts.TypeLiteralNode,
  sourceFile: ts.SourceFile,
  checker: ts.TypeChecker
): Record<string, PropSchema> {
  const props: Record<string, PropSchema> = {};

  for (const member of typeNode.members) {
    if (ts.isPropertySignature(member) && member.name) {
      const propName = member.name.getText(sourceFile);
      const isOptional = member.questionToken !== undefined;

      let propType = 'any';
      let enumValues: string[] | undefined;

      if (member.type) {
        propType = member.type.getText(sourceFile);
        enumValues = extractUnionValues(member.type, checker);
      }

      const schema: PropSchema = {
        type: mapTsTypeToSchema(propType),
      };

      if (!isOptional) {
        schema.required = true;
      }

      if (enumValues) {
        schema.type = 'enum';
        schema.enum = enumValues;
      }

      // Skip internal props (prefixed with _)
      if (!propName.startsWith('_')) {
        props[propName] = schema;
      }
    }
  }

  return props;
}

// Parse a Props interface from a source file
function parsePropsInterface(
  sourceFile: ts.SourceFile,
  checker: ts.TypeChecker,
  propsName: string
): Record<string, PropSchema> | undefined {
  const props: Record<string, PropSchema> = {};

  function visit(node: ts.Node) {
    // Look for type alias (export type FooProps = { ... })
    if (ts.isTypeAliasDeclaration(node) && node.name.text === propsName) {
      let typeNode = node.type;

      // Handle direct type literal: type FooProps = { ... }
      if (ts.isTypeLiteralNode(typeNode)) {
        Object.assign(props, parseTypeLiteralProps(typeNode, sourceFile, checker));
      }

      // Handle wrapped types: type FooProps = WithLayout<{ ... }>
      // or type FooProps = SomeWrapper<OtherWrapper<{ ... }>>
      if (ts.isTypeReferenceNode(typeNode) && typeNode.typeArguments) {
        // Look for type literal in type arguments
        for (const typeArg of typeNode.typeArguments) {
          if (ts.isTypeLiteralNode(typeArg)) {
            Object.assign(props, parseTypeLiteralProps(typeArg, sourceFile, checker));
            break;
          }
          // Handle nested wrappers: WithLayout<WithSomething<{ ... }>>
          if (ts.isTypeReferenceNode(typeArg) && typeArg.typeArguments) {
            for (const nestedArg of typeArg.typeArguments) {
              if (ts.isTypeLiteralNode(nestedArg)) {
                Object.assign(props, parseTypeLiteralProps(nestedArg, sourceFile, checker));
                break;
              }
            }
          }
        }
      }

      // Handle intersection types: type FooProps = BaseProps & { ... }
      if (ts.isIntersectionTypeNode(typeNode)) {
        for (const member of typeNode.types) {
          if (ts.isTypeLiteralNode(member)) {
            Object.assign(props, parseTypeLiteralProps(member, sourceFile, checker));
          }
          // Handle wrapped types in intersection
          if (ts.isTypeReferenceNode(member) && member.typeArguments) {
            for (const typeArg of member.typeArguments) {
              if (ts.isTypeLiteralNode(typeArg)) {
                Object.assign(props, parseTypeLiteralProps(typeArg, sourceFile, checker));
              }
            }
          }
        }
      }
    }

    // Also check interface declarations
    if (ts.isInterfaceDeclaration(node) && node.name.text === propsName) {
      for (const member of node.members) {
        if (ts.isPropertySignature(member) && member.name) {
          const propName = member.name.getText(sourceFile);
          const isOptional = member.questionToken !== undefined;

          let propType = 'any';
          let enumValues: string[] | undefined;

          if (member.type) {
            propType = member.type.getText(sourceFile);
            enumValues = extractUnionValues(member.type, checker);
          }

          const schema: PropSchema = {
            type: mapTsTypeToSchema(propType),
          };

          if (!isOptional) {
            schema.required = true;
          }

          if (enumValues) {
            schema.type = 'enum';
            schema.enum = enumValues;
          }

          // Skip internal props (prefixed with _)
          if (!propName.startsWith('_')) {
            props[propName] = schema;
          }
        }
      }
    }

    ts.forEachChild(node, visit);
  }

  visit(sourceFile);

  return Object.keys(props).length > 0 ? props : undefined;
}

// Get block description from JSDoc or file structure
function getBlockDescription(blockName: string, props: Record<string, PropSchema>): string {
  const descriptions: Record<string, string> = {
    // Layout
    Grid: 'CSS grid layout container',
    Flex: 'Flexbox container for flexible layouts',
    Container: 'Content wrapper with max-width constraints',
    Space: 'Vertical spacing element',
    Divider: 'Horizontal divider line',
    // Typography
    Heading: 'Section heading (h1-h6)',
    Text: 'Rich text paragraph content',
    // Actions
    Button: 'CTA button with configurable actions',
    LinkBlock: 'Navigation link with variable support',
    // Auth
    LoginBlock: 'Sign in / sign up form',
    SignOutBlock: 'Sign out button',
    // Data
    DataBlock: 'Data container that provides row context to children. Required parent for Field blocks.',
    TableBlock: 'Display tabular data from a view',
    MetricBlock: 'Display a single metric/KPI value',
    ChartBlock: 'Data visualization chart',
    FormBlock: 'Input form for creating/editing rows',
    // Fields
    TextField: 'Display text field value from DataBlock context',
    NumberField: 'Display number field with formatting',
    BooleanField: 'Display boolean as checkbox/toggle',
    DateField: 'Display date field with formatting',
    SelectField: 'Display select/dropdown field value',
    ImageField: 'Display image from field',
    FileField: 'Display file download link',
    DocumentField: 'Display document field',
    RelationField: 'Display linked record',
    LinkField: 'Display URL as clickable link',
    // Logic
    ConditionalBlock: 'Show/hide content based on conditions',
    // Content
    EditorBlock: 'Rich text editor content',
    MarkdownBlock: 'Markdown content renderer',
    // Structure
    HeaderBlock: 'Page header with navigation',
    FooterBlock: 'Page footer',
    // Templates
    Hero: 'Hero section with title, description, and CTA',
    Card: 'Card container with optional header/footer',
    Logos: 'Logo grid/carousel',
    Stats: 'Statistics display grid',
    Template: 'Reusable template component',
  };

  return descriptions[blockName] || `${blockName} block component`;
}

// Determine if block requires DataBlock parent
function getBlockRequirement(blockName: string): string | undefined {
  const fieldBlocks = [
    'TextField', 'NumberField', 'BooleanField', 'DateField',
    'SelectField', 'ImageField', 'FileField', 'DocumentField',
    'RelationField', 'LinkField'
  ];

  if (fieldBlocks.includes(blockName)) {
    return 'DataBlock parent';
  }

  return undefined;
}

// Detect slots from props
function detectSlots(props: Record<string, PropSchema>): string[] | undefined {
  const slots: string[] = [];

  for (const [name, schema] of Object.entries(props)) {
    if (schema.type === 'slot') {
      slots.push(name);
    }
  }

  return slots.length > 0 ? slots : undefined;
}

// Categorize blocks
function categorizeBlocks(blockNames: string[]): Record<string, { title: string; description: string; blocks: string[] }> {
  const categories: Record<string, { title: string; description: string; blocks: string[] }> = {
    layout: {
      title: 'Layout',
      description: 'Structural containers for organizing content',
      blocks: [],
    },
    typography: {
      title: 'Typography',
      description: 'Text display components',
      blocks: [],
    },
    interactive: {
      title: 'Actions',
      description: 'Clickable elements with configurable actions',
      blocks: [],
    },
    authentication: {
      title: 'Authentication',
      description: 'User auth components',
      blocks: [],
    },
    data: {
      title: 'Data',
      description: 'Data-aware blocks that connect to database tables/views',
      blocks: [],
    },
    fields: {
      title: 'Fields',
      description: 'Display individual field values from DataBlock context',
      blocks: [],
    },
    logic: {
      title: 'Logic',
      description: 'Conditional rendering',
      blocks: [],
    },
    content: {
      title: 'Content',
      description: 'Rich content blocks',
      blocks: [],
    },
    structure: {
      title: 'Page Structure',
      description: 'Page-level layout components',
      blocks: [],
    },
    templates: {
      title: 'Templates',
      description: 'Pre-built component combinations',
      blocks: [],
    },
  };

  const categoryMap: Record<string, string> = {
    Grid: 'layout',
    Flex: 'layout',
    Container: 'layout',
    Space: 'layout',
    Divider: 'layout',
    Heading: 'typography',
    Text: 'typography',
    Button: 'interactive',
    LinkBlock: 'interactive',
    LoginBlock: 'authentication',
    SignOutBlock: 'authentication',
    DataBlock: 'data',
    TableBlock: 'data',
    MetricBlock: 'data',
    ChartBlock: 'data',
    FormBlock: 'data',
    TextField: 'fields',
    NumberField: 'fields',
    BooleanField: 'fields',
    DateField: 'fields',
    SelectField: 'fields',
    ImageField: 'fields',
    FileField: 'fields',
    DocumentField: 'fields',
    RelationField: 'fields',
    LinkField: 'fields',
    ConditionalBlock: 'logic',
    EditorBlock: 'content',
    MarkdownBlock: 'content',
    HeaderBlock: 'structure',
    FooterBlock: 'structure',
    Hero: 'templates',
    Card: 'templates',
    Logos: 'templates',
    Stats: 'templates',
    Template: 'templates',
  };

  for (const blockName of blockNames) {
    const category = categoryMap[blockName] || 'templates';
    if (categories[category]) {
      categories[category].blocks.push(blockName);
    }
  }

  // Remove empty categories
  for (const key of Object.keys(categories)) {
    if (categories[key].blocks.length === 0) {
      delete categories[key];
    }
  }

  return categories;
}

async function main() {
  const blocksDir = path.resolve(__dirname, '../src/components/puck/blocks');
  const outputPath = path.resolve(__dirname, '../src/components/puck/blocks-schema.generated.json');

  console.log('🔍 Scanning blocks directory:', blocksDir);

  // Find all TypeScript files in blocks directory (both .tsx and .ts for types)
  const tsxFiles = await glob('**/*.tsx', { cwd: blocksDir, absolute: true });
  const tsFiles = await glob('**/types.ts', { cwd: blocksDir, absolute: true });
  const allFiles = [...tsxFiles, ...tsFiles];

  // Filter to main component files (not styles, hooks, etc.)
  const blockFiles = allFiles.filter(f => {
    const basename = path.basename(f).replace(/\.(tsx?|ts)$/, '');
    // Skip styles, hooks, etc. but KEEP types.ts
    if (basename.startsWith('styles') || basename.startsWith('use')) {
      return false;
    }
    // Keep main component files and types.ts
    return true;
  });

  console.log(`📁 Found ${blockFiles.length} potential block files (including types.ts)`);

  // Create TypeScript program
  const program = ts.createProgram(blockFiles, {
    target: ts.ScriptTarget.ESNext,
    module: ts.ModuleKind.ESNext,
    moduleResolution: ts.ModuleResolutionKind.NodeNext,
    jsx: ts.JsxEmit.React,
    esModuleInterop: true,
    skipLibCheck: true,
  });

  const checker = program.getTypeChecker();

  const blocks: Record<string, BlockSchema> = {};

  for (const filePath of blockFiles) {
    const sourceFile = program.getSourceFile(filePath);
    if (!sourceFile) continue;

    // Determine block name from file path
    const dirName = path.basename(path.dirname(filePath));
    const ext = path.extname(filePath);
    const fileName = path.basename(filePath, ext);

    // For types.ts files, we only care about the directory name
    const isTypesFile = fileName === 'types';

    // Try to find Props type - check patterns:
    // 1. DirNameProps (most common, e.g., EditorBlockProps in EditorBlock/types.ts)
    // 2. FileNameProps (e.g., HeroProps from Hero.tsx)
    let propsName = `${dirName}Props`;
    let props = parsePropsInterface(sourceFile, checker, propsName);

    // If not found and not a types file, try file name
    if (!props && !isTypesFile && fileName !== dirName) {
      propsName = `${fileName}Props`;
      props = parsePropsInterface(sourceFile, checker, propsName);
    }

    if (props) {
      // Use directory name as block name for consistency
      const blockName = dirName === fileName ? fileName : dirName;

      // Skip if already processed (index.tsx might re-export)
      if (blocks[blockName]) continue;

      const slots = detectSlots(props);
      const requires = getBlockRequirement(blockName);

      // Remove slot props from the main props object
      if (slots) {
        for (const slot of slots) {
          delete props[slot];
        }
      }

      blocks[blockName] = {
        description: getBlockDescription(blockName, props),
        props,
        ...(slots && { slots }),
        ...(requires && { requires }),
      };

      console.log(`  ✅ ${blockName}: ${Object.keys(props).length} props`);
    }
  }

  // Generate final schema
  const schema: GeneratedSchema = {
    $schema: 'https://json-schema.org/draft/2020-12/schema',
    version: '1.0.0',
    generated: new Date().toISOString(),
    generator: 'scripts/generate-blocks-schema.ts',
    blocks,
    categories: categorizeBlocks(Object.keys(blocks)),
  };

  // Write output
  fs.writeFileSync(outputPath, JSON.stringify(schema, null, 2));

  console.log(`\n✨ Generated schema with ${Object.keys(blocks).length} blocks`);
  console.log(`📄 Output: ${outputPath}`);
}

main().catch(console.error);
