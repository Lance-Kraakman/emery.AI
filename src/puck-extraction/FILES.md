# Files in Puck Extraction Package

This document lists all files included in the extraction package.

## Documentation
- `README.md` - Main documentation and integration guide
- `MIGRATION.md` - Step-by-step migration checklist
- `FILES.md` - This file (complete file listing)
- `package.json.example` - Example dependencies

## Components

### Configuration
- `components/config.tsx` - Main Puck configuration
- `components/blocks/index.ts` - Block exports

### Layout Blocks
- `components/blocks/Columns/index.tsx`
- `components/blocks/Columns/styles.module.css`
- `components/blocks/Flex/index.tsx`
- `components/blocks/Flex/styles.module.css`
- `components/blocks/Grid/index.tsx`
- `components/blocks/VerticalSpace/index.tsx`
- `components/blocks/VerticalSpace/options.tsx`

### Content Blocks
- `components/blocks/Heading/index.tsx`
- `components/blocks/Text/index.tsx`
- `components/blocks/Text/styles.module.css`
- `components/blocks/Markdown/index.tsx`
- `components/blocks/Image/index.tsx`
- `components/blocks/Image/styles.module.css`
- `components/blocks/Table/index.tsx`

### RichText Editor (Full Directory)
- `components/blocks/RichText/index.tsx`
- `components/blocks/RichText/server.tsx`
- `components/blocks/RichText/compat/`
- `components/blocks/RichText/rich-text-editor/`
  - Editor, Render components
  - Lexical plugins and utilities
  - UI components (buttons, dropdowns)
  - Server-side rendering support

### Shared Components
- `components/shared/Section/index.tsx`
- `components/shared/Section/styles.module.css`

## Python Generation (Optional)
- `python-puck-gen/README.md`
- `python-puck-gen/puck_gen/__init__.py`
- `python-puck-gen/puck_gen/__main__.py`
- `python-puck-gen/puck_gen/puck_gen.py`
- `python-puck-gen/puck_gen/payload_client.py`

## Demo Routes (in main app)
- `src/app/puck-demo/page.tsx` - Root redirect
- `src/app/puck-demo/editor/page.tsx` - Editor with localStorage
- `src/app/puck-demo/viewer/page.tsx` - Viewer with localStorage

## Total Files
- ~50+ files including full RichText editor implementation
- All dependencies isolated and cleaned
- No PayloadCMS or workflow dependencies
- Ready to copy to new repo
