/**
 * LocalStorage utilities for Puck App Builder Demo
 *
 * This provides localStorage-based persistence for the demo.
 * Replace with your database queries in production.
 */

import { Data } from "@measured/puck";
import type {
  PuckApp,
  PuckPage,
  PuckTemplate,
  PuckAppWithPages,
  PuckPageWithTemplate,
} from "../types";

const STORAGE_KEYS = {
  APPS: "puck-apps",
  PAGES: "puck-pages",
  TEMPLATES: "puck-templates",
};

// ==================== Apps ====================

export const getApps = (): PuckApp[] => {
  if (typeof window === "undefined") return [];
  const stored = localStorage.getItem(STORAGE_KEYS.APPS);
  return stored ? JSON.parse(stored) : [];
};

export const getApp = (id: string): PuckApp | null => {
  const apps = getApps();
  return apps.find((app) => app.id === id) || null;
};

export const getAppBySlug = (slug: string): PuckApp | null => {
  const apps = getApps();
  return apps.find((app) => app.slug === slug) || null;
};

export const createApp = (name: string, slug: string, description?: string): PuckApp => {
  const apps = getApps();
  const newApp: PuckApp = {
    id: crypto.randomUUID(),
    name,
    slug,
    description,
    createdAt: new Date(),
    updatedAt: new Date(),
  };
  apps.push(newApp);
  localStorage.setItem(STORAGE_KEYS.APPS, JSON.stringify(apps));
  return newApp;
};

export const updateApp = (id: string, updates: Partial<PuckApp>): PuckApp | null => {
  const apps = getApps();
  const index = apps.findIndex((app) => app.id === id);
  if (index === -1) return null;

  apps[index] = {
    ...apps[index],
    ...updates,
    updatedAt: new Date(),
  };
  localStorage.setItem(STORAGE_KEYS.APPS, JSON.stringify(apps));
  return apps[index];
};

export const deleteApp = (id: string): boolean => {
  const apps = getApps();
  const filtered = apps.filter((app) => app.id !== id);
  if (filtered.length === apps.length) return false;

  localStorage.setItem(STORAGE_KEYS.APPS, JSON.stringify(filtered));

  // Also delete associated pages
  const pages = getPages();
  const filteredPages = pages.filter((page) => page.appId !== id);
  localStorage.setItem(STORAGE_KEYS.PAGES, JSON.stringify(filteredPages));

  return true;
};

// ==================== Templates ====================

export const getTemplates = (): PuckTemplate[] => {
  if (typeof window === "undefined") return [];
  const stored = localStorage.getItem(STORAGE_KEYS.TEMPLATES);
  return stored ? JSON.parse(stored) : [];
};

export const getTemplate = (id: string): PuckTemplate | null => {
  const templates = getTemplates();
  return templates.find((t) => t.id === id) || null;
};

export const createTemplate = (
  name: string,
  slug: string,
  data?: Data
): PuckTemplate => {
  const templates = getTemplates();
  const newTemplate: PuckTemplate = {
    id: crypto.randomUUID(),
    name,
    slug,
    data: data || { content: [], root: {}, zones: {} },
    createdAt: new Date(),
    updatedAt: new Date(),
  };
  templates.push(newTemplate);
  localStorage.setItem(STORAGE_KEYS.TEMPLATES, JSON.stringify(templates));
  return newTemplate;
};

export const updateTemplate = (
  id: string,
  updates: Partial<PuckTemplate>
): PuckTemplate | null => {
  const templates = getTemplates();
  const index = templates.findIndex((t) => t.id === id);
  if (index === -1) return null;

  templates[index] = {
    ...templates[index],
    ...updates,
    updatedAt: new Date(),
  };
  localStorage.setItem(STORAGE_KEYS.TEMPLATES, JSON.stringify(templates));
  return templates[index];
};

export const deleteTemplate = (id: string): boolean => {
  const templates = getTemplates();
  const filtered = templates.filter((t) => t.id !== id);
  if (filtered.length === templates.length) return false;

  localStorage.setItem(STORAGE_KEYS.TEMPLATES, JSON.stringify(filtered));
  return true;
};

// ==================== Pages ====================

export const getPages = (): PuckPage[] => {
  if (typeof window === "undefined") return [];
  const stored = localStorage.getItem(STORAGE_KEYS.PAGES);
  return stored ? JSON.parse(stored) : [];
};

export const getPage = (id: string): PuckPage | null => {
  const pages = getPages();
  return pages.find((page) => page.id === id) || null;
};

export const getPageBySlug = (appSlug: string, pageSlug: string): PuckPage | null => {
  const app = getAppBySlug(appSlug);
  if (!app) return null;

  const pages = getPages();
  return pages.find((page) => page.appId === app.id && page.slug === pageSlug) || null;
};

export const getPagesByApp = (appId: string): PuckPage[] => {
  const pages = getPages();
  return pages.filter((page) => page.appId === appId).sort((a, b) => a.order - b.order);
};

export const getPageWithTemplate = (id: string): PuckPageWithTemplate | null => {
  const page = getPage(id);
  if (!page) return null;

  const template = getTemplate(page.templateId);
  if (!template) return null;

  return { ...page, template };
};

export const createPage = (
  appId: string,
  name: string,
  slug: string,
  templateId: string,
  options?: {
    description?: string;
    order?: number;
    isPublished?: boolean;
  }
): PuckPage => {
  const pages = getPages();
  const newPage: PuckPage = {
    id: crypto.randomUUID(),
    name,
    slug,
    description: options?.description,
    order: options?.order ?? pages.filter((p) => p.appId === appId).length,
    templateId,
    appId,
    isPublished: options?.isPublished ?? false,
    createdAt: new Date(),
    updatedAt: new Date(),
  };
  pages.push(newPage);
  localStorage.setItem(STORAGE_KEYS.PAGES, JSON.stringify(pages));
  return newPage;
};

export const updatePage = (id: string, updates: Partial<PuckPage>): PuckPage | null => {
  const pages = getPages();
  const index = pages.findIndex((page) => page.id === id);
  if (index === -1) return null;

  pages[index] = {
    ...pages[index],
    ...updates,
    updatedAt: new Date(),
  };
  localStorage.setItem(STORAGE_KEYS.PAGES, JSON.stringify(pages));
  return pages[index];
};

export const deletePage = (id: string): boolean => {
  const pages = getPages();
  const filtered = pages.filter((page) => page.id !== id);
  if (filtered.length === pages.length) return false;

  localStorage.setItem(STORAGE_KEYS.PAGES, JSON.stringify(filtered));
  return true;
};

// ==================== Combined Queries ====================

export const getAppWithPages = (appId: string): PuckAppWithPages | null => {
  const app = getApp(appId);
  if (!app) return null;

  const pages = getPagesByApp(appId);
  const pagesWithTemplates: PuckPageWithTemplate[] = pages
    .map((page) => {
      const template = getTemplate(page.templateId);
      return template ? { ...page, template } : null;
    })
    .filter((p): p is PuckPageWithTemplate => p !== null);

  return { ...app, pages: pagesWithTemplates };
};

export const getAppWithPagesBySlug = (appSlug: string): PuckAppWithPages | null => {
  const app = getAppBySlug(appSlug);
  if (!app) return null;
  return getAppWithPages(app.id);
};

// ==================== Initialization ====================

export const initializeDemoData = () => {
  // Check if data already exists
  const apps = getApps();
  if (apps.length > 0) return;

  // Create demo app
  const app = createApp(
    "Demo App",
    "demo-app",
    "A demo application for testing Puck"
  );

  // Create demo templates
  const homeTemplate = createTemplate("Home Template", "home", {
    content: [
      {
        type: "Heading",
        props: {
          id: "heading-1",
          text: "Welcome to Puck App Builder",
          type: "h1",
          align: "center",
          color: "default",
          padding: "24px",
          maxWidth: "100%",
          weight: "bold",
        },
      },
      {
        type: "Text",
        props: {
          id: "text-1",
          text: "Build beautiful pages with drag and drop",
          size: "m",
          align: "center",
          color: "default",
          padding: "16px",
          maxWidth: "100%",
          weight: "normal",
        },
      },
    ],
    root: {},
    zones: {},
  });

  const aboutTemplate = createTemplate("About Template", "about", {
    content: [
      {
        type: "Heading",
        props: {
          id: "heading-2",
          text: "About Us",
          type: "h1",
          align: "left",
          color: "default",
          padding: "24px",
          maxWidth: "100%",
          weight: "bold",
        },
      },
    ],
    root: {},
    zones: {},
  });

  // Create demo pages
  createPage(app.id, "Home", "/", homeTemplate.id, {
    description: "Homepage",
    order: 0,
    isPublished: true,
  });

  createPage(app.id, "About", "/about", aboutTemplate.id, {
    description: "About page",
    order: 1,
    isPublished: true,
  });
};

// ==================== Clear All Data ====================

export const clearAllData = () => {
  localStorage.removeItem(STORAGE_KEYS.APPS);
  localStorage.removeItem(STORAGE_KEYS.PAGES);
  localStorage.removeItem(STORAGE_KEYS.TEMPLATES);
};
