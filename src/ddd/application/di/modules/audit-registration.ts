/**
 * Audit Domain Registration Module
 */

import type { DbClient } from '@/lib/db/client';
import type { IOrganizationRepository } from '@/ddd/domain/organizations/repositories/organization-repository';
import type { IAuditRepository, IRowHistoryRepository } from '@/ddd/domain/audit/interfaces/audit-repository';
import { DrizzleAuditRepository } from '@/ddd/infrastructure/db/repositories/audit/drizzle-audit-repository';
import { DrizzleRowHistoryRepository } from '@/ddd/infrastructure/db/repositories/audit/drizzle-row-history-repository';
import { AuditApplicationService } from '@/ddd/application/services/audit/audit-application-service';
import { OrganizationId } from '@/ddd/domain/shared/value-objects';

export interface AuditServices {
  auditRepository: IAuditRepository;
  rowHistoryRepository: IRowHistoryRepository;
  auditApplicationService: AuditApplicationService;
}

export interface AuditDependencies {
  db: DbClient;
  organizationRepository: IOrganizationRepository;
}

export function registerAuditServices(deps: AuditDependencies): AuditServices {
  const { db, organizationRepository } = deps;

  const auditRepository = new DrizzleAuditRepository(db);
  const rowHistoryRepository = new DrizzleRowHistoryRepository(db);

  const auditApplicationService = new AuditApplicationService(
    auditRepository,
    rowHistoryRepository,
    async (orgId: number) => {
      const org = await organizationRepository.findById(OrganizationId.fromNumber(orgId));
      return org?.plan ?? 'free';
    }
  );

  console.log('✅ Audit services registered');

  return {
    auditRepository,
    rowHistoryRepository,
    auditApplicationService,
  };
}
