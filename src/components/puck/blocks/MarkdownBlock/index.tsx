'use client';

import React from "react";
import ReactMarkdown from "react-markdown";
import { Prism as SyntaxHighlighter } from "react-syntax-highlighter";
import { oneDark } from "react-syntax-highlighter/dist/esm/styles/prism";
import remarkGfm from "remark-gfm";

import { ComponentConfig } from "@measured/puck";
import { Section } from "../../components/Section";
import { WithLayout, withLayout } from "../../components/Layout";
import { backgroundColorField, textColorField } from "../../fields/standard-fields";
import { useInterpolatedText } from "../../hooks/useInterpolatedText";
import { createVariableTextField } from "../../custom-fields";
import styles from "./styles.module.css";

export type MarkdownBlockProps = WithLayout<{
  content?: string;
  textColor?: string;
  backgroundColor?: string;
  maxWidth?: string;
}>;

/**
 * MarkdownBlock render component - renders markdown with syntax highlighting
 * Supports variable interpolation: "Hello {{state.userName}}!" becomes "Hello John!"
 */
function MarkdownBlockRender({
  content,
  textColor,
  backgroundColor,
  maxWidth,
}: MarkdownBlockProps) {
  // Interpolate variables in content (e.g., {{state.key}}, {{rowData.id}})
  const interpolatedContent = useInterpolatedText(content);

  return (
    <Section maxWidth={maxWidth}>
      <div
        className={styles.markdown}
        style={{
          ...(textColor && { color: textColor }),
          ...(backgroundColor && { backgroundColor }),
        }}
      >
        <ReactMarkdown
          remarkPlugins={[remarkGfm]}
          components={{
            code({ node, className, children, ...props }) {
              const match = /language-(\w+)/.exec(className || '');
              const isInline = !match && !className;

              return isInline ? (
                <code className={styles.inlineCode} {...props}>
                  {children}
                </code>
              ) : (
                <SyntaxHighlighter
                  style={oneDark}
                  language={match ? match[1] : 'text'}
                  PreTag="div"
                  className={styles.codeBlock}
                >
                  {String(children).replace(/\n$/, '')}
                </SyntaxHighlighter>
              );
            },
          }}
        >
          {interpolatedContent || ''}
        </ReactMarkdown>
      </div>
    </Section>
  );
}

const MarkdownBlockInner: ComponentConfig<MarkdownBlockProps> = {
  fields: {
    content: createVariableTextField({
      label: 'Markdown Content',
      multiline: true,
      rows: 12,
    }),
    textColor: textColorField,
    backgroundColor: backgroundColorField,
    maxWidth: {
      type: "text",
      label: "Max Width",
    },
  },
  defaultProps: {
    content: `# Heading

This is a paragraph with **bold** and *italic* text.

## Code Example

\`\`\`typescript
function hello(name: string) {
  console.log(\`Hello, \${name}!\`);
}
\`\`\`

- List item 1
- List item 2

| Column 1 | Column 2 |
|----------|----------|
| Cell 1   | Cell 2   |
`,
    textColor: undefined,
    backgroundColor: undefined,
  },
  render: MarkdownBlockRender,
};

export const MarkdownBlock = withLayout(MarkdownBlockInner);
