"use client";

import { ReactNode, useEffect, useState, useMemo } from "react";
import styles from "./Button.module.css";
import getClassNameFactory from "../../lib/get-class-name-factory";
import { Loader } from "../Loader";
import { filterDataAttrs } from "../../lib/filter-data-attrs";
import { resolveLinkAction, type LinkResolutionContext } from "../../utils/resolve-link-action";
import type { LinkActionConfig } from "../../custom-fields/link-action-field";
import type { Action } from "../../types/actions";
import { useLinkContext } from "../../link-context";
import { useActionContext } from "../../contexts/ActionContext";
import { executeActions } from "../../actions/execute-action";

const getClassName = getClassNameFactory("Button", styles);

export const Button = ({
  children,
  href,
  onClick,
  action,
  actions,
  linkContext,
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
  action?: LinkActionConfig;
  actions?: Action[]; // New actions system
  linkContext?: LinkResolutionContext;
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
  const contextFromProvider = useLinkContext();
  const buildActionContext = useActionContext();

  useEffect(() => setLoading(loadingProp), [loadingProp]);

  // Resolve link action if provided
  const resolvedAction = useMemo(() => {
    if (action) {
      // Merge context from provider with prop-based context (props take precedence)
      const mergedContext: LinkResolutionContext = {
        ...contextFromProvider,
        ...linkContext,
        isEditing: isEditing !== undefined ? isEditing : contextFromProvider.isEditing || false,
      };

      return resolveLinkAction(action, mergedContext);
    }
    return null;
  }, [action, linkContext, isEditing, contextFromProvider]);

  // Determine final href, onClick, target, and rel
  const finalHref = resolvedAction?.href || href;
  const finalTarget = resolvedAction?.target || (newTab ? "_blank" : undefined);
  const finalRel = resolvedAction?.rel || (newTab ? "noreferrer" : undefined);
  const finalOnClick = resolvedAction?.onClick || onClick;

  const ElementType = finalHref ? "a" : type ? "button" : "span";
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
        // Execute new actions system if provided
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

        // Fallback to legacy onClick handler
        if (!finalOnClick) return;

        setLoading(true);
        Promise.resolve(finalOnClick(e)).then(() => {
          setLoading(false);
        });
      }}
      type={type}
      disabled={disabled || loading}
      tabIndex={tabIndex}
      target={finalTarget}
      rel={finalRel}
      href={finalHref}
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
