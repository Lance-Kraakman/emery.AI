import { DefaultRootProps } from "@measured/puck";
import { Header } from "./components/Header";
import { Footer } from "./components/Footer";
import { useTheme } from "./theme-context";

export type RootProps = DefaultRootProps;

export const Root = {
  defaultProps: {
    title: "My Page",
  },
  render: ({ puck: { isEditing, renderDropZone: DropZone } }: DefaultRootProps) => {
    // Get theme from context (will use default if not provided)
    const theme = useTheme();
    const cssVariables = theme.toCSSVariables();

    return (
      <div
        className="puck-canvas-content"
        style={{
          // Inject theme CSS variables
          ...cssVariables,
          // Layout styles
          display: "flex",
          flexDirection: "column",
          minHeight: "100vh",
          // Use CSS variables with fallbacks
          background: "var(--theme-background, #f5f5f5)",
          color: "var(--theme-text, #181818)",
          fontFamily: "var(--theme-font-family, 'Inter, system-ui, sans-serif')",
        }}
      >
        <DropZone zone="default-zone" style={{ flexGrow: 1 }} />
      </div>
    );
  },
};

export default Root;
