/**
 * Core Domain Registration Module
 *
 * Registers repositories and services for core domains:
 * - Organizations
 * - Users
 * - Teams
 * - Invitations
 * - RBAC (Role-Based Access Control)
 */

import type { ContextAwareDbClient } from '@/ddd/infrastructure/db/simple-context-proxy';
import { db as rawDb } from '@/ddd/infrastructure/db/client';
import type { IOrganizationRepository } from '@/ddd/domain/organizations/repositories/organization-repository';
import type { IUserRepository } from '@/ddd/domain/users/repositories/user-repository';
import type { ITeamRepository } from '@/ddd/domain/teams/repositories/team-repository';
import type { IInvitationRepository } from '@/ddd/domain/invitations/repositories/invitation-repository';
import type { IRBACRepository } from '@/ddd/domain/rbac/repositories/rbac-repository';

import { DrizzleOrganizationRepository } from '@/ddd/infrastructure/db/repositories/organizations/drizzle-organization-repository';
import { DrizzleUserRepository } from '@/ddd/infrastructure/db/repositories/users/drizzle-user-repository';
import { DrizzleTeamRepository } from '@/ddd/infrastructure/db/repositories/teams/drizzle-team-repository';
import { DrizzleInvitationRepository } from '@/ddd/infrastructure/db/repositories/invitations/drizzle-invitation-repository';
import { DrizzleRBACRepository } from '@/ddd/infrastructure/db/repositories/rbac/drizzle-rbac-repository';

import { TeamApplicationService } from '@/ddd/application/services/teams/team-application-service';
import { UserRoleApplicationService } from '@/ddd/application/services/user-organizations/user-role-application-service';
import { InvitationApplicationService } from '@/ddd/application/services/invitations/invitation-application-service';

export interface CoreServices {
  organizationRepository: IOrganizationRepository;
  userRepository: IUserRepository;
  teamRepository: ITeamRepository;
  invitationRepository: IInvitationRepository;
  rbacRepository: IRBACRepository;
  teamApplicationService: TeamApplicationService;
  userRoleApplicationService: UserRoleApplicationService;
  invitationApplicationService: InvitationApplicationService;
}

export interface CoreDependencies {
  db: ContextAwareDbClient;
  agentRepository?: any; // Will be provided by agent module
}

export function registerCoreServices(deps: CoreDependencies): CoreServices {
  const { db } = deps;

  // Register repositories
  const organizationRepository = new DrizzleOrganizationRepository(db);
  const userRepository = new DrizzleUserRepository(db);
  const teamRepository = new DrizzleTeamRepository(db);
  const invitationRepository = new DrizzleInvitationRepository(db);

  // AIDEV-NOTE: RBAC uses rawDb instead of contextAwareDb because:
  // 1. Permission checks happen before/during RLS context establishment
  // 2. RBAC tables need cross-organizational access (checking user's org membership)
  // 3. These are trusted operations that validate access, not user data
  const rbacRepository = new DrizzleRBACRepository(rawDb);

  // Register application services
  const userRoleApplicationService = new UserRoleApplicationService(
    userRepository,
    organizationRepository,
    rbacRepository
  );

  const invitationApplicationService = new InvitationApplicationService(
    invitationRepository,
    userRepository,
    organizationRepository,
    rbacRepository
  );

  // TeamApplicationService needs agentRepository - will be set later
  const teamApplicationService = new TeamApplicationService(
    teamRepository,
    deps.agentRepository // May be undefined initially
  );

  return {
    organizationRepository,
    userRepository,
    teamRepository,
    invitationRepository,
    rbacRepository,
    teamApplicationService,
    userRoleApplicationService,
    invitationApplicationService
  };
}
