'use server';

/**
 * Invoice Server Actions
 *
 * Handles invoice retrieval and management for organization billing history.
 * Provides read-only access to invoice data for authorized users.
 */

import { auth } from '@/lib/auth';
import { requireResourcePermission } from './permissions';
import { withAuthContext } from '@/lib/auth/with-context';
import { getInvoiceApplicationService } from '@/ddd/application/di/getters';
import type { InvoiceDTO, InvoiceSummaryDTO } from '@/ddd/application/services/billing/invoice-application-service';
import type { Result } from '@/ddd/domain/shared/result';

export interface GetInvoicesResult {
  success: boolean;
  invoices?: InvoiceDTO[];
  error?: string;
}

export interface GetInvoiceResult {
  success: boolean;
  invoice?: InvoiceDTO;
  error?: string;
}

export interface GetInvoiceSummaryResult {
  success: boolean;
  summary?: InvoiceSummaryDTO;
  error?: string;
}

/**
 * Get all invoices for the current organization
 * Requires organizations:manage permission
 */
export async function getOrganizationInvoices(
  limit?: number,
  offset?: number
): Promise<GetInvoicesResult> {
  return withAuthContext(async () => {
    try {
      const session = await auth();
      if (!session?.user?.id) {
        return { success: false, error: 'Unauthorized' };
      }

      const orgId = session.user.currentOrganizationId;
      if (!orgId) {
        return { success: false, error: 'No organization selected' };
      }

      // Require organizations:manage permission to view invoices
      await requireResourcePermission(
        'organizations:manage',
        'organization',
        orgId
      );

      const invoiceService = getInvoiceApplicationService();
      const result = await invoiceService.getOrganizationInvoices(orgId, limit, offset);

      if (!result.success) {
        return { success: false, error: result.error };
      }

      return {
        success: true,
        invoices: result.data,
      };
    } catch (error) {
      console.error('Error getting organization invoices:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to get invoices',
      };
    }
  });
}

/**
 * Get invoice summary for the current organization
 * Provides aggregated stats: total invoices, amounts, credits used
 */
export async function getOrganizationInvoiceSummary(
  startDate?: Date,
  endDate?: Date
): Promise<GetInvoiceSummaryResult> {
  return withAuthContext(async () => {
    try {
      const session = await auth();
      if (!session?.user?.id) {
        return { success: false, error: 'Unauthorized' };
      }

      const orgId = session.user.currentOrganizationId;
      if (!orgId) {
        return { success: false, error: 'No organization selected' };
      }

      // Require organizations:manage permission to view summary
      await requireResourcePermission(
        'organizations:manage',
        'organization',
        orgId
      );

      const invoiceService = getInvoiceApplicationService();
      const result = await invoiceService.getOrganizationSummary(orgId, startDate, endDate);

      if (!result.success) {
        return { success: false, error: result.error };
      }

      return {
        success: true,
        summary: result.data,
      };
    } catch (error) {
      console.error('Error getting invoice summary:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to get summary',
      };
    }
  });
}

/**
 * Get latest invoice for the current organization
 * Useful for displaying most recent billing information
 */
export async function getLatestInvoice(): Promise<GetInvoiceResult> {
  return withAuthContext(async () => {
    try {
      const session = await auth();
      if (!session?.user?.id) {
        return { success: false, error: 'Unauthorized' };
      }

      const orgId = session.user.currentOrganizationId;
      if (!orgId) {
        return { success: false, error: 'No organization selected' };
      }

      await requireResourcePermission(
        'organizations:manage',
        'organization',
        orgId
      );

      const invoiceService = getInvoiceApplicationService();
      const result = await invoiceService.getLatestInvoice(orgId);

      if (!result.success) {
        return { success: false, error: result.error };
      }

      if (!result.data) {
        return { success: true, invoice: undefined };
      }

      return {
        success: true,
        invoice: result.data,
      };
    } catch (error) {
      console.error('Error getting latest invoice:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to get invoice',
      };
    }
  });
}

/**
 * Get specific invoice by ID
 * Verifies user has access to the organization before returning
 */
export async function getInvoiceById(invoiceId: number): Promise<GetInvoiceResult> {
  return withAuthContext(async () => {
    try {
      const session = await auth();
      if (!session?.user?.id) {
        return { success: false, error: 'Unauthorized' };
      }

      const orgId = session.user.currentOrganizationId;
      if (!orgId) {
        return { success: false, error: 'No organization selected' };
      }

      await requireResourcePermission(
        'organizations:manage',
        'organization',
        orgId
      );

      const invoiceService = getInvoiceApplicationService();
      const result = await invoiceService.getInvoiceById(invoiceId);

      if (!result.success) {
        return { success: false, error: result.error };
      }

      // Verify invoice belongs to user's organization
      if (result.data && result.data.organizationId !== orgId) {
        return { success: false, error: 'Invoice not found' };
      }

      return {
        success: true,
        invoice: result.data,
      };
    } catch (error) {
      console.error('Error getting invoice:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to get invoice',
      };
    }
  });
}
