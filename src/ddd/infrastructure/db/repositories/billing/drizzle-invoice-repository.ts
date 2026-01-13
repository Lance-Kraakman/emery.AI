/**
 * Drizzle Invoice Repository Implementation
 *
 * Infrastructure implementation of invoice repository using Drizzle ORM.
 */
import { and, eq, gte, lte, desc, sum, count } from 'drizzle-orm';
import type { PostgresJsDatabase } from 'drizzle-orm/postgres-js';
import type {
  IInvoiceRepository,
  InvoiceQueryFilters,
  InvoiceSummary,
} from '@/ddd/domain/billing/repositories/invoice-repository';
import type { Invoice, CreateInvoiceData, InvoiceStatus } from '@/ddd/domain/billing/entities/invoice';
import { InvoiceId } from '@/ddd/domain/billing/value-objects/invoice-id';
import { OrganizationId } from '@/ddd/domain/shared/value-objects';
import { invoices } from '@/ddd/infrastructure/db/schema';

export class DrizzleInvoiceRepository implements IInvoiceRepository {
  constructor(private readonly db: PostgresJsDatabase<Record<string, unknown>>) {}

  async create(data: CreateInvoiceData): Promise<Invoice> {
    const [record] = await this.db
      .insert(invoices)
      .values({
        organizationId: data.organizationId.value,
        stripeInvoiceId: data.stripeInvoiceId,
        stripeSubscriptionId: data.stripeSubscriptionId,
        periodStart: data.periodStart,
        periodEnd: data.periodEnd,
        includedCreditsUsed: data.includedCreditsUsed || 0,
        overageCreditsUsed: data.overageCreditsUsed || 0,
        totalCreditsUsed: data.totalCreditsUsed || 0,
        subscriptionAmountUsd: (data.subscriptionAmountUsd || 0).toFixed(2),
        overageAmountUsd: (data.overageAmountUsd || 0).toFixed(2),
        totalAmountUsd: data.totalAmountUsd.toFixed(2),
        status: data.status || 'draft',
        invoicedAt: data.invoicedAt,
        paidAt: data.paidAt,
        metadata: data.metadata as any,
      })
      .returning();

    return this.toDomain(record);
  }

  async findById(id: InvoiceId): Promise<Invoice | null> {
    const [record] = await this.db
      .select()
      .from(invoices)
      .where(eq(invoices.id, id.value))
      .limit(1);

    return record ? this.toDomain(record) : null;
  }

  async findByStripeInvoiceId(stripeInvoiceId: string): Promise<Invoice | null> {
    const [record] = await this.db
      .select()
      .from(invoices)
      .where(eq(invoices.stripeInvoiceId, stripeInvoiceId))
      .limit(1);

    return record ? this.toDomain(record) : null;
  }

  async find(filters: InvoiceQueryFilters): Promise<Invoice[]> {
    const conditions = [];

    if (filters.organizationId) {
      conditions.push(eq(invoices.organizationId, filters.organizationId.value));
    }
    if (filters.stripeInvoiceId) {
      conditions.push(eq(invoices.stripeInvoiceId, filters.stripeInvoiceId));
    }
    if (filters.stripeSubscriptionId) {
      conditions.push(eq(invoices.stripeSubscriptionId, filters.stripeSubscriptionId));
    }
    if (filters.status) {
      conditions.push(eq(invoices.status, filters.status));
    }
    if (filters.periodStartAfter) {
      conditions.push(gte(invoices.periodStart, filters.periodStartAfter));
    }
    if (filters.periodStartBefore) {
      conditions.push(lte(invoices.periodStart, filters.periodStartBefore));
    }
    if (filters.periodEndAfter) {
      conditions.push(gte(invoices.periodEnd, filters.periodEndAfter));
    }
    if (filters.periodEndBefore) {
      conditions.push(lte(invoices.periodEnd, filters.periodEndBefore));
    }

    const query = this.db
      .select()
      .from(invoices)
      .where(conditions.length > 0 ? and(...conditions) : undefined)
      .orderBy(desc(invoices.createdAt));

    if (filters.limit) {
      query.limit(filters.limit);
    }
    if (filters.offset) {
      query.offset(filters.offset);
    }

    const records = await query;
    return records.map(record => this.toDomain(record));
  }

  async findByOrganizationId(
    organizationId: OrganizationId,
    limit?: number,
    offset?: number
  ): Promise<Invoice[]> {
    return this.find({ organizationId, limit, offset });
  }

  async findByPeriod(
    organizationId: OrganizationId,
    startDate: Date,
    endDate: Date
  ): Promise<Invoice[]> {
    return this.find({
      organizationId,
      periodStartAfter: startDate,
      periodEndBefore: endDate,
    });
  }

  async getOrganizationSummary(
    organizationId: OrganizationId,
    startDate?: Date,
    endDate?: Date
  ): Promise<InvoiceSummary> {
    const conditions = [eq(invoices.organizationId, organizationId.value)];

    if (startDate) {
      conditions.push(gte(invoices.createdAt, startDate));
    }
    if (endDate) {
      conditions.push(lte(invoices.createdAt, endDate));
    }

    const [summaryData] = await this.db
      .select({
        totalInvoices: count(invoices.id).mapWith(Number),
        totalAmountUsd: sum(invoices.totalAmountUsd).mapWith(Number),
        totalCreditsUsed: sum(invoices.totalCreditsUsed).mapWith(Number),
        totalOverageCreditsUsed: sum(invoices.overageCreditsUsed).mapWith(Number),
        totalOverageAmountUsd: sum(invoices.overageAmountUsd).mapWith(Number),
      })
      .from(invoices)
      .where(and(...conditions));

    // Count paid vs unpaid invoices
    const [paidCount] = await this.db
      .select({
        count: count(invoices.id).mapWith(Number),
      })
      .from(invoices)
      .where(and(...conditions, eq(invoices.status, 'paid')));

    const totalInvoices = summaryData.totalInvoices || 0;
    const paidInvoices = paidCount.count || 0;

    return {
      totalInvoices,
      totalAmountUsd: summaryData.totalAmountUsd || 0,
      totalCreditsUsed: summaryData.totalCreditsUsed || 0,
      totalOverageCreditsUsed: summaryData.totalOverageCreditsUsed || 0,
      totalOverageAmountUsd: summaryData.totalOverageAmountUsd || 0,
      paidInvoices,
      unpaidInvoices: totalInvoices - paidInvoices,
    };
  }

  async updateStatus(
    id: InvoiceId,
    status: InvoiceStatus,
    paidAt?: Date
  ): Promise<Invoice> {
    const [record] = await this.db
      .update(invoices)
      .set({
        status,
        paidAt: paidAt || undefined,
      })
      .where(eq(invoices.id, id.value))
      .returning();

    if (!record) {
      throw new Error(`Invoice with id ${id.value} not found`);
    }

    return this.toDomain(record);
  }

  async update(
    id: InvoiceId,
    updates: Partial<CreateInvoiceData>
  ): Promise<Invoice> {
    const updateData: any = {};

    if (updates.stripeInvoiceId !== undefined) {
      updateData.stripeInvoiceId = updates.stripeInvoiceId;
    }
    if (updates.stripeSubscriptionId !== undefined) {
      updateData.stripeSubscriptionId = updates.stripeSubscriptionId;
    }
    if (updates.includedCreditsUsed !== undefined) {
      updateData.includedCreditsUsed = updates.includedCreditsUsed;
    }
    if (updates.overageCreditsUsed !== undefined) {
      updateData.overageCreditsUsed = updates.overageCreditsUsed;
    }
    if (updates.totalCreditsUsed !== undefined) {
      updateData.totalCreditsUsed = updates.totalCreditsUsed;
    }
    if (updates.subscriptionAmountUsd !== undefined) {
      updateData.subscriptionAmountUsd = updates.subscriptionAmountUsd.toFixed(2);
    }
    if (updates.overageAmountUsd !== undefined) {
      updateData.overageAmountUsd = updates.overageAmountUsd.toFixed(2);
    }
    if (updates.totalAmountUsd !== undefined) {
      updateData.totalAmountUsd = updates.totalAmountUsd.toFixed(2);
    }
    if (updates.status !== undefined) {
      updateData.status = updates.status;
    }
    if (updates.invoicedAt !== undefined) {
      updateData.invoicedAt = updates.invoicedAt;
    }
    if (updates.paidAt !== undefined) {
      updateData.paidAt = updates.paidAt;
    }
    if (updates.metadata !== undefined) {
      updateData.metadata = updates.metadata;
    }

    const [record] = await this.db
      .update(invoices)
      .set(updateData)
      .where(eq(invoices.id, id.value))
      .returning();

    if (!record) {
      throw new Error(`Invoice with id ${id.value} not found`);
    }

    return this.toDomain(record);
  }

  async findLatestByOrganizationId(organizationId: OrganizationId): Promise<Invoice | null> {
    const [record] = await this.db
      .select()
      .from(invoices)
      .where(eq(invoices.organizationId, organizationId.value))
      .orderBy(desc(invoices.createdAt))
      .limit(1);

    return record ? this.toDomain(record) : null;
  }

  async existsByStripeInvoiceId(stripeInvoiceId: string): Promise<boolean> {
    const [record] = await this.db
      .select({ id: invoices.id })
      .from(invoices)
      .where(eq(invoices.stripeInvoiceId, stripeInvoiceId))
      .limit(1);

    return !!record;
  }

  private toDomain(record: any): Invoice {
    return {
      id: InvoiceId.fromNumber(record.id),
      organizationId: OrganizationId.fromNumber(record.organizationId),
      stripeInvoiceId: record.stripeInvoiceId || undefined,
      stripeSubscriptionId: record.stripeSubscriptionId || undefined,
      periodStart: record.periodStart,
      periodEnd: record.periodEnd,
      includedCreditsUsed: record.includedCreditsUsed || 0,
      overageCreditsUsed: record.overageCreditsUsed || 0,
      totalCreditsUsed: record.totalCreditsUsed || 0,
      subscriptionAmountUsd: parseFloat(record.subscriptionAmountUsd || '0'),
      overageAmountUsd: parseFloat(record.overageAmountUsd || '0'),
      totalAmountUsd: parseFloat(record.totalAmountUsd || '0'),
      status: record.status,
      invoicedAt: record.invoicedAt || undefined,
      paidAt: record.paidAt || undefined,
      createdAt: record.createdAt,
      metadata: record.metadata,
    };
  }
}
