/**
 * Invoice Application Service
 *
 * Orchestrates invoice management, billing history, and Stripe invoice sync.
 * Handles invoice creation, status updates, and reporting.
 */
import type { IInvoiceRepository, InvoiceSummary } from '@/ddd/domain/billing/repositories/invoice-repository';
import type { IOrganizationRepository } from '@/ddd/domain/organizations/repositories/organization-repository';
import type { CreateInvoiceData, Invoice, InvoiceStatus } from '@/ddd/domain/billing/entities/invoice';
import { InvoiceUtils } from '@/ddd/domain/billing/entities/invoice';
import { InvoiceId } from '@/ddd/domain/billing/value-objects/invoice-id';
import { OrganizationId } from '@/ddd/domain/shared/value-objects';
import type { Result } from '@/ddd/domain/shared/result';
import { ResultHelpers } from '@/ddd/domain/shared/result';
import { createDebugLogger } from '@/lib/utils/debug-logger';
import { PRICE_PER_CREDIT_USD } from '@/ddd/infrastructure/external/stripe/config';

const logger = createDebugLogger('InvoiceService');

export interface CreateInvoiceDTO {
  organizationId: number;
  stripeInvoiceId?: string;
  stripeSubscriptionId?: string;
  periodStart: Date;
  periodEnd: Date;
  includedCreditsUsed?: number;
  overageCreditsUsed?: number;
  totalCreditsUsed?: number;
  subscriptionAmountUsd?: number;
  overageAmountUsd?: number;
  totalAmountUsd: number;
  status?: InvoiceStatus;
  invoicedAt?: Date;
  paidAt?: Date;
  metadata?: Record<string, any>;
}

export interface InvoiceDTO {
  id: number;
  organizationId: number;
  stripeInvoiceId?: string;
  stripeSubscriptionId?: string;
  periodStart: Date;
  periodEnd: Date;
  includedCreditsUsed: number;
  overageCreditsUsed: number;
  totalCreditsUsed: number;
  subscriptionAmountUsd: number;
  overageAmountUsd: number;
  totalAmountUsd: number;
  status: InvoiceStatus;
  invoicedAt?: Date;
  paidAt?: Date;
  createdAt: Date;
  metadata?: Record<string, any>;
}

export interface InvoiceSummaryDTO {
  totalInvoices: number;
  totalAmountUsd: number;
  totalCreditsUsed: number;
  totalOverageCreditsUsed: number;
  totalOverageAmountUsd: number;
  paidInvoices: number;
  unpaidInvoices: number;
}

export class InvoiceApplicationService {
  constructor(
    private readonly invoiceRepository: IInvoiceRepository,
    private readonly organizationRepository: IOrganizationRepository
  ) {}

  /**
   * Create a new invoice
   * Validates data and ensures organization exists
   */
  async createInvoice(dto: CreateInvoiceDTO): Promise<Result<InvoiceDTO>> {
    try {
      const organizationId = OrganizationId.fromNumber(dto.organizationId);

      // Verify organization exists
      const organization = await this.organizationRepository.findById(organizationId);
      if (!organization) {
        return ResultHelpers.failure('Organization not found');
      }

      // Build invoice data
      const invoiceData: CreateInvoiceData = {
        organizationId,
        stripeInvoiceId: dto.stripeInvoiceId,
        stripeSubscriptionId: dto.stripeSubscriptionId,
        periodStart: dto.periodStart,
        periodEnd: dto.periodEnd,
        includedCreditsUsed: dto.includedCreditsUsed || 0,
        overageCreditsUsed: dto.overageCreditsUsed || 0,
        totalCreditsUsed: dto.totalCreditsUsed || 0,
        subscriptionAmountUsd: dto.subscriptionAmountUsd || 0,
        overageAmountUsd: dto.overageAmountUsd || 0,
        totalAmountUsd: dto.totalAmountUsd,
        status: dto.status || 'draft',
        invoicedAt: dto.invoicedAt,
        paidAt: dto.paidAt,
        metadata: dto.metadata,
      };

      // Validate invoice data
      const validation = InvoiceUtils.validateInvoiceData(invoiceData);
      if (!validation.valid) {
        logger.error('Invalid invoice data', { errors: validation.errors });
        return ResultHelpers.failure(validation.errors.join(', '));
      }

      // Check for duplicate Stripe invoice ID
      if (dto.stripeInvoiceId) {
        const exists = await this.invoiceRepository.existsByStripeInvoiceId(dto.stripeInvoiceId);
        if (exists) {
          return ResultHelpers.failure('Invoice with this Stripe ID already exists');
        }
      }

      // Create invoice
      const invoice = await this.invoiceRepository.create(invoiceData);

      logger.summary('Invoice created', {
        invoiceId: invoice.id.value,
        organizationId: dto.organizationId,
        totalAmountUsd: invoice.totalAmountUsd,
        status: invoice.status,
      });

      return ResultHelpers.success(this.toDTO(invoice));
    } catch (error) {
      logger.error('Failed to create invoice', { error, dto });
      return ResultHelpers.failure(
        error instanceof Error ? error.message : 'Failed to create invoice'
      );
    }
  }

  /**
   * Get invoice by ID
   */
  async getInvoiceById(invoiceId: number): Promise<Result<InvoiceDTO>> {
    try {
      const id = InvoiceId.fromNumber(invoiceId);
      const invoice = await this.invoiceRepository.findById(id);

      if (!invoice) {
        return ResultHelpers.failure('Invoice not found');
      }

      return ResultHelpers.success(this.toDTO(invoice));
    } catch (error) {
      logger.error('Failed to get invoice', { error, invoiceId });
      return ResultHelpers.failure(
        error instanceof Error ? error.message : 'Failed to get invoice'
      );
    }
  }

  /**
   * Get invoice by Stripe invoice ID
   */
  async getInvoiceByStripeId(stripeInvoiceId: string): Promise<Result<InvoiceDTO | null>> {
    try {
      const invoice = await this.invoiceRepository.findByStripeInvoiceId(stripeInvoiceId);

      if (!invoice) {
        return ResultHelpers.success(null);
      }

      return ResultHelpers.success(this.toDTO(invoice));
    } catch (error) {
      logger.error('Failed to get invoice by Stripe ID', { error, stripeInvoiceId });
      return ResultHelpers.failure(
        error instanceof Error ? error.message : 'Failed to get invoice'
      );
    }
  }

  /**
   * Get all invoices for an organization
   */
  async getOrganizationInvoices(
    organizationId: number,
    limit?: number,
    offset?: number
  ): Promise<Result<InvoiceDTO[]>> {
    try {
      const orgId = OrganizationId.fromNumber(organizationId);
      const invoices = await this.invoiceRepository.findByOrganizationId(orgId, limit, offset);

      return ResultHelpers.success(invoices.map(inv => this.toDTO(inv)));
    } catch (error) {
      logger.error('Failed to get organization invoices', { error, organizationId });
      return ResultHelpers.failure(
        error instanceof Error ? error.message : 'Failed to get invoices'
      );
    }
  }

  /**
   * Get invoice summary for organization
   */
  async getOrganizationSummary(
    organizationId: number,
    startDate?: Date,
    endDate?: Date
  ): Promise<Result<InvoiceSummaryDTO>> {
    try {
      const orgId = OrganizationId.fromNumber(organizationId);
      const summary = await this.invoiceRepository.getOrganizationSummary(
        orgId,
        startDate,
        endDate
      );

      return ResultHelpers.success(summary);
    } catch (error) {
      logger.error('Failed to get invoice summary', { error, organizationId });
      return ResultHelpers.failure(
        error instanceof Error ? error.message : 'Failed to get summary'
      );
    }
  }

  /**
   * Update invoice status (e.g., after payment)
   */
  async updateInvoiceStatus(
    invoiceId: number,
    status: InvoiceStatus,
    paidAt?: Date
  ): Promise<Result<InvoiceDTO>> {
    try {
      const id = InvoiceId.fromNumber(invoiceId);
      const invoice = await this.invoiceRepository.updateStatus(id, status, paidAt);

      logger.summary('Invoice status updated', {
        invoiceId,
        status,
        paidAt,
      });

      return ResultHelpers.success(this.toDTO(invoice));
    } catch (error) {
      logger.error('Failed to update invoice status', { error, invoiceId, status });
      return ResultHelpers.failure(
        error instanceof Error ? error.message : 'Failed to update invoice'
      );
    }
  }

  /**
   * Get latest invoice for organization
   */
  async getLatestInvoice(organizationId: number): Promise<Result<InvoiceDTO | null>> {
    try {
      const orgId = OrganizationId.fromNumber(organizationId);
      const invoice = await this.invoiceRepository.findLatestByOrganizationId(orgId);

      return ResultHelpers.success(invoice ? this.toDTO(invoice) : null);
    } catch (error) {
      logger.error('Failed to get latest invoice', { error, organizationId });
      return ResultHelpers.failure(
        error instanceof Error ? error.message : 'Failed to get latest invoice'
      );
    }
  }

  /**
   * Calculate invoice totals from organization usage
   * Used when creating invoices from webhook
   */
  async calculateInvoiceFromUsage(
    organizationId: number,
    periodStart: Date,
    periodEnd: Date,
    subscriptionAmountUsd: number = 0
  ): Promise<Result<Partial<CreateInvoiceDTO>>> {
    try {
      const orgId = OrganizationId.fromNumber(organizationId);

      const organization = await this.organizationRepository.findById(orgId);
      if (!organization) {
        return ResultHelpers.failure('Organization not found');
      }

      const allowanceCredits = organization.usageAllowanceCredits || 0;
      const usedCredits = organization.creditsUsedCurrentMonth || 0;

      const includedCreditsUsed = Math.min(usedCredits, allowanceCredits);
      const overageCreditsUsed = Math.max(0, usedCredits - allowanceCredits);
      const overageAmountUsd = overageCreditsUsed * PRICE_PER_CREDIT_USD;
      const totalAmountUsd = subscriptionAmountUsd + overageAmountUsd;

      return ResultHelpers.success({
        includedCreditsUsed,
        overageCreditsUsed,
        totalCreditsUsed: usedCredits,
        subscriptionAmountUsd,
        overageAmountUsd,
        totalAmountUsd,
      });
    } catch (error) {
      logger.error('Failed to calculate invoice from usage', { error, organizationId });
      return ResultHelpers.failure(
        error instanceof Error ? error.message : 'Failed to calculate invoice'
      );
    }
  }

  /**
   * Convert domain Invoice to DTO
   */
  private toDTO(invoice: Invoice): InvoiceDTO {
    return {
      id: invoice.id.value,
      organizationId: invoice.organizationId.value,
      stripeInvoiceId: invoice.stripeInvoiceId,
      stripeSubscriptionId: invoice.stripeSubscriptionId,
      periodStart: invoice.periodStart,
      periodEnd: invoice.periodEnd,
      includedCreditsUsed: invoice.includedCreditsUsed,
      overageCreditsUsed: invoice.overageCreditsUsed,
      totalCreditsUsed: invoice.totalCreditsUsed,
      subscriptionAmountUsd: invoice.subscriptionAmountUsd,
      overageAmountUsd: invoice.overageAmountUsd,
      totalAmountUsd: invoice.totalAmountUsd,
      status: invoice.status,
      invoicedAt: invoice.invoicedAt,
      paidAt: invoice.paidAt,
      createdAt: invoice.createdAt,
      metadata: invoice.metadata,
    };
  }
}
