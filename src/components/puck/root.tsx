import { DefaultRootProps } from "@measured/puck";
import { Header } from "./components/Header";
import { Footer } from "./components/Footer";

export type RootProps = DefaultRootProps;

export const Root = {
  defaultProps: {
    title: "My Page",
  },
  render: ({ puck: { isEditing, renderDropZone: DropZone } }: any) => {
    return (
      <div
        className="puck-canvas-content"
        style={{
          display: "flex",
          flexDirection: "column",
          minHeight: "100vh",
          background: "#f5f5f5",
          color: "#181818",
        }}
      >
        <DropZone zone="default-zone" style={{ flexGrow: 1 }} />
      </div>
    );
  },
};

export default Root;
