import { ComponentDataOptionalId } from "@measured/puck";
import { type Components } from "../types";

export async function createComponent<T extends keyof Components>(
  component: T,
  props?: Partial<Components[T]>
): Promise<ComponentDataOptionalId<Components[T]>> {
  const { conf: config } = await import("../index");

  return {
    type: component,
    props: {
      ...config.components[component].defaultProps,
      ...props,
    },
  } as ComponentDataOptionalId<Components[T]>;
}
