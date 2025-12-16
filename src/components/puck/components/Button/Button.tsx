"use client";

import { ReactNode, useEffect, useState } from "react";
import styles from "./Button.module.css";
import getClassNameFactory from "../../lib/get-class-name-factory";
import { Loader } from "../Loader";
import { filterDataAttrs } from "../../lib/filter-data-attrs";
import type { Action } from "../../types/actions";
import { useActionContext } from "../../contexts/ActionContext";
import { executeActions } from "../../actions/execute-action";

const getClassName = getClassNameFactory("Button", styles);

export const Button = ({
  children,
  href,
  onClick,
  actions,
  isEditing,
  variant = "primary",
  type,
  disabled,
  tabIndex,
  newTab,
  fullWidth,
  icon,
  size = "medium",
  loading: loadingProp = false,
  ...props
}: {
  children: ReactNode;
  href?: string;
  onClick?: (e: any) => void | Promise<void>;
  actions?: Action[];
  isEditing?: boolean;
  variant?: "primary" | "secondary";
  type?: "button" | "submit" | "reset";
  disabled?: boolean;
  tabIndex?: number;
  newTab?: boolean;
  fullWidth?: boolean;
  icon?: ReactNode;
  size?: "medium" | "large";
  loading?: boolean;
}) => {
  const [loading, setLoading] = useState(loadingProp);
  const buildActionContext = useActionContext();

  useEffect(() => setLoading(loadingProp), [loadingProp]);

  const finalTarget = newTab ? "_blank" : undefined;
  const finalRel = newTab ? "noreferrer" : undefined;

  const ElementType = href ? "a" : type ? "button" : "span";
  const dataAttrs = filterDataAttrs(props);

  const el = (
    <ElementType
      className={getClassName({
        primary: variant === "primary",
        secondary: variant === "secondary",
        disabled,
        fullWidth,
        [size]: true,
      })}
      onClick={async (e) => {
        // Execute actions if provided
        if (actions && actions.length > 0) {
          setLoading(true);
          try {
            const context = buildActionContext();
            await executeActions(actions, context);
          } catch (error) {
            console.error('[Button] Error executing actions:', error);
          } finally {
            setLoading(false);
          }
          return;
        }

        // Fallback to onClick handler
        if (!onClick) return;

        setLoading(true);
        Promise.resolve(onClick(e)).then(() => {
          setLoading(false);
        });
      }}
      type={type}
      disabled={disabled || loading}
      tabIndex={tabIndex}
      target={finalTarget}
      rel={finalRel}
      href={href}
      {...dataAttrs}
    >
      {icon && <div className={getClassName("icon")}>{icon}</div>}
      {children}
      {loading && (
        <div className={getClassName("spinner")}>
          <Loader size={14} />
        </div>
      )}
    </ElementType>
  );

  return el;
};
