import { ComponentConfig } from "@measured/puck";

export type TableCardProps = {
  title: string;
  description: string;
  iconName: string;
};

// AIDEV-NOTE: This is a placeholder table component.
// Implement your own table functionality based on your needs.
export const TableCardPuck: ComponentConfig<TableCardProps> = {
  fields: {
    title: { type: "text" },
    description: { type: "textarea" },
    iconName: {
      type: "select",
      options: [
        {
          label: "BarChart3",
          value: "BarChart3",
        },
      ],
    },
  },
  defaultProps: {
    title: "Title",
    description: "Description",
    iconName: "BarChart3",
  },
  render: ({ title, description }) => {
    return (
      <div style={{ padding: "16px", border: "1px solid #ddd", borderRadius: "4px" }}>
        <h3>{title}</h3>
        <p>{description}</p>
        <p style={{ fontStyle: "italic", color: "#666" }}>
          Implement your table component here
        </p>
      </div>
    );
  },
};
