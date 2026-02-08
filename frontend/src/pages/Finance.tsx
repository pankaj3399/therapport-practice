import { useState, useEffect, useCallback } from 'react';
import { MainLayout } from '@/components/layout/MainLayout';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Icon } from '@/components/ui/Icon';
import { practitionerApi } from '@/services/api';

type InvoiceItem = {
  id: string;
  number: string | null;
  status: string;
  amount_paid: number;
  currency: string;
  created: number;
  invoice_pdf: string | null;
};

function formatAmount(pence: number, currency: string): string {
  if (currency === 'gbp') return `£${(pence / 100).toFixed(2)}`;
  return `${(pence / 100).toFixed(2)} ${currency.toUpperCase()}`;
}

function formatInvoiceDate(created: number): string {
  return new Date(created * 1000).toLocaleDateString('en-GB', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  });
}

export const Finance: React.FC = () => {
  const [invoices, setInvoices] = useState<InvoiceItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchInvoices = useCallback(async (signal?: AbortSignal) => {
    setLoading(true);
    setError(null);
    try {
      const res = await practitionerApi.getInvoices(signal);
      if (signal?.aborted) return;
      if (res.data.success && Array.isArray(res.data.invoices)) {
        setInvoices(res.data.invoices);
      } else {
        setInvoices([]);
      }
    } catch (err) {
      if (
        signal?.aborted ||
        (err instanceof Error && (err.name === 'AbortError' || err.name === 'CanceledError'))
      )
        return;
      setInvoices([]);
      setError('Failed to load invoices');
    } finally {
      if (!signal?.aborted) setLoading(false);
    }
  }, []);

  useEffect(() => {
    const c = new AbortController();
    fetchInvoices(c.signal);
    return () => c.abort();
  }, [fetchInvoices]);

  return (
    <MainLayout>
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 dark:text-white">Finance</h1>
          <p className="text-slate-600 dark:text-slate-400 mt-1">
            View and download your invoice history from Stripe.
          </p>
        </div>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base flex items-center gap-2">
              <Icon name="receipt_long" className="text-primary" />
              Invoice history
            </CardTitle>
          </CardHeader>
          <CardContent>
            {loading ? (
              <p className="text-sm text-slate-500">Loading invoices…</p>
            ) : error ? (
              <p className="text-sm text-red-600 dark:text-red-400" role="alert">
                {error}
              </p>
            ) : invoices.length === 0 ? (
              <p className="text-sm text-slate-500">No invoices yet.</p>
            ) : (
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Invoice #</TableHead>
                      <TableHead>Date</TableHead>
                      <TableHead>Amount</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead className="text-right">Download</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {invoices.map((inv) => (
                      <TableRow key={inv.id}>
                        <TableCell className="font-medium">
                          {inv.number ?? inv.id}
                        </TableCell>
                        <TableCell>{formatInvoiceDate(inv.created)}</TableCell>
                        <TableCell>{formatAmount(inv.amount_paid, inv.currency)}</TableCell>
                        <TableCell>
                          <span
                            className={
                              inv.status === 'paid'
                                ? 'text-green-600 dark:text-green-400'
                                : 'text-slate-600 dark:text-slate-400'
                            }
                          >
                            {inv.status}
                          </span>
                        </TableCell>
                        <TableCell className="text-right">
                          {inv.invoice_pdf ? (
                            <a
                              href={inv.invoice_pdf}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="text-primary hover:underline text-sm"
                            >
                              PDF
                            </a>
                          ) : (
                            <span className="text-slate-400 text-sm">—</span>
                          )}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </MainLayout>
  );
};
