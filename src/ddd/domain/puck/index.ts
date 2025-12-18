// AIDEV-NOTE: Puck domain exports - single entry point for all Puck domain types

// Value Objects
export { AppId } from './value-objects/app-id';
export { PageId } from './value-objects/page-id';
export { AppSlug } from './value-objects/app-slug';
export { PageSlug } from './value-objects/page-slug';
export { PageOrder } from './value-objects/page-order';
export { PuckData, type PuckDataStructure } from './value-objects/puck-data';
export { TemplateId } from './value-objects/template-id';

// Entities
export { App } from './entities/app';
export { PuckPage } from './entities/puck-page';
export { Template } from './entities/template';

// Repository Interfaces
export type { IAppRepository } from './repositories/app-repository';
export type { IPuckPageRepository } from './repositories/puck-page-repository';
export type { ITemplateRepository } from './repositories/template-repository';

// Domain Services
export { AppSlugGenerator } from './services/app-slug-generator';
export { PageSlugGenerator } from './services/page-slug-generator';
export { PageNavigationService, type NavigationItem } from './services/page-navigation-service';
