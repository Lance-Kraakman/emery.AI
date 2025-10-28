import { Data } from "@measured/puck";

/**
 * Puck App Builder Types
 *
 * Hierarchy:
 * App → Pages → Templates
 *
 * - App: Top-level container (e.g., "Marketing Site", "Customer Portal")
 * - Page: A routable page within an app (e.g., "/about", "/pricing")
 * - Template: The actual Puck template/document for a page
 */

// ==================== Template ====================

export type PuckTemplate = {
  id: string;
  name: string;
  slug: string;
  data: Data; // Puck Data object
  createdAt: Date;
  updatedAt: Date;
};

export type CreateTemplateInput = {
  name: string;
  slug: string;
  data?: Data;
};

export type UpdateTemplateInput = {
  name?: string;
  slug?: string;
  data?: Data;
};

// ==================== Page ====================

export type PuckPage = {
  id: string;
  name: string;
  slug: string; // Route path, e.g., "/about" or "/products/pricing"
  description?: string;
  order: number; // For ordering pages in navigation
  templateId: string; // Reference to the template
  appId: string; // Reference to parent app
  isPublished: boolean;
  createdAt: Date;
  updatedAt: Date;
};

export type PuckPageWithTemplate = PuckPage & {
  template: PuckTemplate;
};

export type CreatePageInput = {
  name: string;
  slug: string;
  description?: string;
  order?: number;
  templateId: string;
  appId: string;
  isPublished?: boolean;
};

export type UpdatePageInput = {
  name?: string;
  slug?: string;
  description?: string;
  order?: number;
  templateId?: string;
  isPublished?: boolean;
};

// ==================== App ====================

export type PuckApp = {
  id: string;
  name: string;
  slug: string; // URL-friendly identifier
  description?: string;
  createdAt: Date;
  updatedAt: Date;
};

export type PuckAppWithPages = PuckApp & {
  pages: PuckPageWithTemplate[];
};

export type CreateAppInput = {
  name: string;
  slug: string;
  description?: string;
};

export type UpdateAppInput = {
  name?: string;
  slug?: string;
  description?: string;
};

// ==================== Navigation ====================

export type PageNavigation = {
  id: string;
  name: string;
  slug: string;
  order: number;
  children?: PageNavigation[]; // For nested navigation
};

export type AppNavigation = {
  appId: string;
  appName: string;
  pages: PageNavigation[];
};
