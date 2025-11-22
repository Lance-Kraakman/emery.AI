/**
 * InvoiceList Component
 *
 * Displays a table of past invoices with download links and status
 */
'use client';

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { FileText, Download, ExternalLink } from 'lucide-react';
import { formatCurrency, formatBillingDate } from '@/lib/billing/utils';

export interface Invoice {
  id: string;
  invoiceNumber: string;
  amountDue: number;
  amountPaid: number;
  status: 'paid' | 'pending' | 'failed' | 'draft';
  createdAt: Date;
  dueDate: Date | null;
  paidAt: Date | null;
  hostedInvoiceUrl?: string | null;
  invoicePdf?: string | null;
}

export interface InvoiceListProps {
  invoices: Invoice[];
  emptyMessage?: string;
}

export function InvoiceList({ invoices, emptyMessage = 'No invoices yet' }: InvoiceListProps) {
  if (invoices.length === 0) {
    return (
      <Card>
        <CardHeader>
          <div className="flex items-center gap-2">
            <FileText className="h-5 w-5 text-muted-foreground" />
            <CardTitle>Invoices</CardTitle>
          </div>
          <CardDescription>View and download your billing invoices</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex flex-col items-center justify-center py-12 text-center">
            <FileText className="h-12 w-12 text-muted-foreground mb-4" />
            <p className="text-muted-foreground">{emptyMessage}</p>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center gap-2">
          <FileText className="h-5 w-5 text-muted-foreground" />
          <CardTitle>Invoices</CardTitle>
        </div>
        <CardDescription>View and download your billing invoices</CardDescription>
      </CardHeader>
      <CardContent>
        <div className="rounded-md border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Invoice</TableHead>
                <TableHead>Date</TableHead>
                <TableHead>Amount</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {invoices.map((invoice) => (
                <TableRow key={invoice.id}>
                  <TableCell className="font-medium">
                    <div className="flex items-center gap-2">
                      <FileText className="h-4 w-4 text-muted-foreground" />
                      {invoice.invoiceNumber}
                    </div>
                  </TableCell>
                  <TableCell>
                    <div className="text-sm">
                      <div>{formatBillingDate(invoice.createdAt)}</div>
                      {invoice.paidAt && (
                        <div className="text-xs text-muted-foreground">
                          Paid {formatBillingDate(invoice.paidAt)}
                        </div>
                      )}
                    </div>
                  </TableCell>
                  <TableCell>
                    <div className="text-sm">
                      <div className="font-medium">{formatCurrency(invoice.amountDue)}</div>
                      {invoice.amountPaid > 0 && invoice.amountPaid !== invoice.amountDue && (
                        <div className="text-xs text-muted-foreground">
                          Paid: {formatCurrency(invoice.amountPaid)}
                        </div>
                      )}
                    </div>
                  </TableCell>
                  <TableCell>
                    <InvoiceStatusBadge status={invoice.status} />
                  </TableCell>
                  <TableCell className="text-right">
                    <div className="flex items-center justify-end gap-2">
                      {invoice.invoicePdf && (
                        <Button
                          size="sm"
                          variant="ghost"
                          asChild
                        >
                          <a
                            href={invoice.invoicePdf}
                            target="_blank"
                            rel="noopener noreferrer"
                            download
                          >
                            <Download className="h-4 w-4" />
                          </a>
                        </Button>
                      )}
                      {invoice.hostedInvoiceUrl && (
                        <Button
                          size="sm"
                          variant="ghost"
                          asChild
                        >
                          <a
                            href={invoice.hostedInvoiceUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                          >
                            <ExternalLink className="h-4 w-4" />
                          </a>
                        </Button>
                      )}
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      </CardContent>
    </Card>
  );
}

/**
 * Status badge for invoice status
 */
function InvoiceStatusBadge({ status }: { status: Invoice['status'] }) {
  const variants: Record<Invoice['status'], { variant: 'default' | 'secondary' | 'destructive' | 'outline'; label: string }> = {
    paid: { variant: 'default', label: 'Paid' },
    pending: { variant: 'secondary', label: 'Pending' },
    failed: { variant: 'destructive', label: 'Failed' },
    draft: { variant: 'outline', label: 'Draft' },
  };

  const config = variants[status] || variants.draft;

  return <Badge variant={config.variant}>{config.label}</Badge>;
}
