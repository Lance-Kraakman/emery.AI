import { ComponentConfig } from "@measured/puck";
import styles from "./styles.module.css";
import { Section } from "../../shared/Section";

export type ImageProps = {
  alt: string;
  url: string;
  maxWidth: string;
};

export const ImageItem: ComponentConfig<ImageProps> = {
  fields: {
    url: {
      type: "text",
      label: "Image URL",
    },
    alt: {
      type: "text",
      label: "Alt Text",
    },
    maxWidth: {
      type: "text",
      label: "MaxWidth",
    },
  },
  defaultProps: {
    alt: "Image",
    url: "https://via.placeholder.com/400",
    maxWidth: "100%",
  },
  render: ({ url, alt, maxWidth }) => {
    return <ImageBlock url={url} alt={alt} maxWidth={maxWidth} />;
  },
};

const ImageBlock: React.FC<ImageProps> = ({ alt, url, maxWidth }) => {
  return (
    <Section className={styles.logos} maxWidth={maxWidth}>
      <div className={styles.imageWrapper}>
        <img
          className={styles.image}
          alt={alt}
          src={url}
          style={{ maxWidth: "100%", height: "auto" }}
        />
      </div>
    </Section>
  );
};
