import { useState, useEffect, useCallback, useRef } from 'react';
import { MainLayout } from '@/components/layout/MainLayout';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { Icon } from '@/components/ui/Icon';
import { PaymentModal } from '@/components/payment/PaymentModal';
import { practitionerApi } from '@/services/api';
import { formatDateUK } from '@/lib/utils';

interface SubscriptionMembership {
  type: string;
  subscriptionType: string | null;
  subscriptionEndDate: string | null;
  suspensionDate: string | null;
  terminationRequestedAt: string | null;
}

interface SubscriptionStatus {
  canBook: boolean;
  reason?: string;
  membership?: SubscriptionMembership;
}

const MONTHLY_SUBSCRIPTION_PENCE = 10500;
const AD_HOC_SUBSCRIPTION_PENCE = 15000;

function extractApiErrorMessage(err: unknown, fallback: string): string {
  if (err && typeof err === 'object' && 'response' in err) {
    const error = (err as { response?: { data?: { error?: string } } }).response?.data?.error;
    if (typeof error === 'string' && error.trim()) return error;
  }
  return fallback;
}

/** Show purchase card only for ad-hoc members without an active subscription (permanent are billed outside the app). */
function showPurchaseCardForAdHoc(membership: SubscriptionMembership | undefined): boolean {
  return (membership?.type === 'ad_hoc' && !membership.subscriptionType) ?? false;
}

export const Subscription: React.FC = () => {
  const [status, setStatus] = useState<SubscriptionStatus | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [terminating, setTerminating] = useState(false);
  const [terminateError, setTerminateError] = useState<string | null>(null);
  const [terminateConfirmOpen, setTerminateConfirmOpen] = useState(false);
  const [paymentModalOpen, setPaymentModalOpen] = useState(false);
  const [paymentClientSecret, setPaymentClientSecret] = useState<string | null>(null);
  const [paymentAmountPence, setPaymentAmountPence] = useState<number | undefined>(undefined);
  const [paymentTitle, setPaymentTitle] = useState<string | undefined>(undefined);
  const [purchaseError, setPurchaseError] = useState<string | null>(null);
  const [purchasing, setPurchasing] = useState<'monthly' | 'ad_hoc' | null>(null);
  const [purchaseSuccessMessage, setPurchaseSuccessMessage] = useState<string | null>(null);
  const statusAbortRef = useRef<AbortController | null>(null);

  const fetchStatus = useCallback(async (signal?: AbortSignal) => {
    setLoading(true);
    setError(null);
    try {
      const res = await practitionerApi.getSubscriptionStatus(signal);
      if (signal?.aborted) return;
      if (res.data.success) {
        setStatus({
          canBook: res.data.canBook,
          reason: res.data.reason,
          membership: res.data.membership,
        });
      } else {
        setStatus(null);
      }
    } catch (err) {
      if (
        signal?.aborted ||
        (err instanceof Error && (err.name === 'AbortError' || err.name === 'CanceledError'))
      )
        return;
      setError('Failed to load subscription status.');
      setStatus(null);
    } finally {
      if (!signal?.aborted) setLoading(false);
    }
  }, []);

  useEffect(() => {
    const controller = new AbortController();
    statusAbortRef.current = controller;
    fetchStatus(controller.signal);
    return () => {
      controller.abort();
      statusAbortRef.current = null;
    };
  }, [fetchStatus]);

  const runTerminate = async () => {
    setTerminateError(null);
    setTerminating(true);
    try {
      await practitionerApi.terminateSubscription();
      setTerminateError(null);
      setTerminateConfirmOpen(false);
      statusAbortRef.current?.abort();
      const controller = new AbortController();
      statusAbortRef.current = controller;
      await fetchStatus(controller.signal);
    } catch (err) {
      if (err instanceof Error && (err.name === 'AbortError' || err.name === 'CanceledError'))
        return;
      setTerminateError(extractApiErrorMessage(err, 'Failed to terminate subscription.'));
    } finally {
      setTerminating(false);
    }
  };

  const startMonthlySubscription = async () => {
    setPurchaseError(null);
    setPurchaseSuccessMessage(null);
    setPurchasing('monthly');
    try {
      const res = await practitionerApi.createMonthlySubscription();
      const data = res.data;
      if (!data.success) {
        setPurchaseError(data.error ?? 'Failed to start monthly subscription.');
        return;
      }
      if (data.clientSecret) {
        const amountPence =
          typeof data.currentMonthAmount === 'number'
            ? Math.round(data.currentMonthAmount * 100)
            : MONTHLY_SUBSCRIPTION_PENCE;
        setPaymentClientSecret(data.clientSecret);
        setPaymentAmountPence(amountPence);
        setPaymentTitle('Subscribe monthly');
        setPaymentModalOpen(true);
      } else {
        setPurchaseSuccessMessage('Monthly subscription set up.');
        statusAbortRef.current?.abort();
        const controller = new AbortController();
        statusAbortRef.current = controller;
        await fetchStatus(controller.signal);
      }
    } catch (err) {
      setPurchaseError(extractApiErrorMessage(err, 'Failed to start monthly subscription.'));
    } finally {
      setPurchasing(null);
    }
  };

  const startAdHocSubscription = async () => {
    setPurchaseError(null);
    setPurchaseSuccessMessage(null);
    setPurchasing('ad_hoc');
    try {
      const res = await practitionerApi.createAdHocSubscription();
      const data = res.data;
      if (!data.success) {
        setPurchaseError(data.error ?? 'Failed to start ad-hoc subscription.');
        return;
      }
      if (data.clientSecret) {
        setPaymentClientSecret(data.clientSecret);
        setPaymentAmountPence(AD_HOC_SUBSCRIPTION_PENCE);
        setPaymentTitle('Purchase ad-hoc subscription (£150)');
        setPaymentModalOpen(true);
      } else {
        setPurchaseError('Payment setup failed. Please try again.');
      }
    } catch (err) {
      setPurchaseError(extractApiErrorMessage(err, 'Failed to start ad-hoc subscription.'));
    } finally {
      setPurchasing(null);
    }
  };

  const handlePaymentSuccess = () => {
    setPaymentModalOpen(false);
    setPaymentClientSecret(null);
    setPaymentAmountPence(undefined);
    setPaymentTitle(undefined);
    setPurchaseSuccessMessage('Payment successful. Your subscription is now active.');
    statusAbortRef.current?.abort();
    const controller = new AbortController();
    statusAbortRef.current = controller;
    fetchStatus(controller.signal);
  };

  const handlePaymentModalOpenChange = (open: boolean) => {
    setPaymentModalOpen(open);
    if (!open) {
      setPaymentClientSecret(null);
      setPaymentAmountPence(undefined);
      setPaymentTitle(undefined);
    }
  };

  const membership = status?.membership;
  const isAdHoc = membership?.subscriptionType === 'ad_hoc' || membership?.type === 'ad_hoc';
  const canTerminate = isAdHoc && !membership?.terminationRequestedAt;

  return (
    <MainLayout>
      <div className="space-y-8">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 dark:text-white">Subscription</h1>
          <p className="text-slate-600 dark:text-slate-400 mt-1">
            View your subscription status and manage your membership.
          </p>
        </div>

        {loading ? (
          <Card>
            <CardContent className="pt-6">
              <p className="text-sm text-slate-500">Loading…</p>
            </CardContent>
          </Card>
        ) : error ? (
          <Card>
            <CardContent className="pt-6">
              <p className="text-sm text-red-600 dark:text-red-400" role="alert">
                {error}
              </p>
            </CardContent>
          </Card>
        ) : (
          <>
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-base flex items-center gap-2">
                  <Icon name="credit_card" className="text-primary" />
                  Status
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex items-center gap-2">
                  <span className="text-sm font-medium text-slate-600 dark:text-slate-400">
                    Can make bookings:
                  </span>
                  <span
                    className={
                      status?.canBook
                        ? 'text-green-600 dark:text-green-400'
                        : 'text-amber-600 dark:text-amber-400'
                    }
                  >
                    {status?.canBook ? 'Yes' : 'No'}
                  </span>
                </div>
                {status?.reason && (
                  <p className="text-sm text-slate-600 dark:text-slate-400">{status.reason}</p>
                )}
                {membership && (
                  <dl className="grid gap-2 text-sm">
                    <div>
                      <dt className="text-slate-500 dark:text-slate-400">Membership type</dt>
                      <dd className="font-medium capitalize">
                        {membership.type?.replace(/_/g, ' ') ?? '—'}
                        {membership.type === 'permanent' && (
                          <span className="text-slate-500 dark:text-slate-400 font-normal ml-1">
                            (billed externally)
                          </span>
                        )}
                      </dd>
                    </div>
                    {membership.subscriptionType && (
                      <div>
                        <dt className="text-slate-500 dark:text-slate-400">Subscription</dt>
                        <dd className="font-medium capitalize">
                          {membership.subscriptionType.replace(/_/g, ' ')}
                        </dd>
                      </div>
                    )}
                    {membership.subscriptionEndDate && (
                      <div>
                        <dt className="text-slate-500 dark:text-slate-400">
                          Subscription end date
                        </dt>
                        <dd className="font-medium">
                          {formatDateUK(membership.subscriptionEndDate)}
                        </dd>
                      </div>
                    )}
                    {membership.suspensionDate && (
                      <div>
                        <dt className="text-slate-500 dark:text-slate-400">Suspension date</dt>
                        <dd className="font-medium">{formatDateUK(membership.suspensionDate)}</dd>
                      </div>
                    )}
                    {membership.terminationRequestedAt && (
                      <div>
                        <dt className="text-slate-500 dark:text-slate-400">
                          Termination requested
                        </dt>
                        <dd className="font-medium">
                          {formatDateUK(membership.terminationRequestedAt)}
                        </dd>
                      </div>
                    )}
                  </dl>
                )}
              </CardContent>
            </Card>

            {purchaseSuccessMessage && (
              <output
                className="text-sm text-green-600 dark:text-green-400"
                role="status"
                aria-live="polite"
              >
                {purchaseSuccessMessage}
              </output>
            )}

            {(status && !status.canBook) || showPurchaseCardForAdHoc(membership) ? (
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-base">Purchase subscription</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <p className="text-sm text-slate-600 dark:text-slate-400">
                    Subscribe to start making bookings. Choose monthly billing or a one-off ad-hoc
                    month.
                  </p>
                  {purchaseError && (
                    <p className="text-sm text-red-600 dark:text-red-400" role="alert">
                      {purchaseError}
                    </p>
                  )}
                  <div className="flex flex-wrap gap-3">
                    <Button onClick={startMonthlySubscription} disabled={purchasing !== null}>
                      {purchasing === 'monthly' ? 'Starting…' : 'Subscribe monthly (£105/month)'}
                    </Button>
                    <Button
                      variant="outline"
                      onClick={startAdHocSubscription}
                      disabled={purchasing !== null}
                    >
                      {purchasing === 'ad_hoc' ? 'Starting…' : 'Purchase ad-hoc (£150 one month)'}
                    </Button>
                  </div>
                </CardContent>
              </Card>
            ) : null}

            {canTerminate && (
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-base">Terminate ad-hoc subscription</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <p className="text-sm text-slate-600 dark:text-slate-400">
                    You can terminate your ad-hoc subscription at any time. You will keep access
                    until the end of the grace period (end of month after the month you terminate).
                    No refunds are given for unused time.
                  </p>
                  {terminateError && (
                    <p className="text-sm text-red-600 dark:text-red-400" role="alert">
                      {terminateError}
                    </p>
                  )}
                  <AlertDialog open={terminateConfirmOpen} onOpenChange={setTerminateConfirmOpen}>
                    <Button
                      variant="outline"
                      className="text-red-600 border-red-300 hover:bg-red-50 dark:border-red-700 dark:hover:bg-red-900/20"
                      onClick={() => setTerminateConfirmOpen(true)}
                      disabled={terminating}
                    >
                      {terminating ? 'Terminating…' : 'Terminate subscription'}
                    </Button>
                    <AlertDialogContent aria-describedby="terminate-description">
                      <AlertDialogHeader>
                        <AlertDialogTitle>Terminate ad-hoc subscription?</AlertDialogTitle>
                        <AlertDialogDescription id="terminate-description">
                          You can use the system until the end of the grace period (end of month
                          after the month you terminate). No refunds will be given for unused time.
                          Are you sure you want to terminate?
                        </AlertDialogDescription>
                      </AlertDialogHeader>
                      <AlertDialogFooter>
                        <AlertDialogCancel>Cancel</AlertDialogCancel>
                        <AlertDialogAction
                          onClick={(e) => {
                            e.preventDefault();
                            runTerminate();
                          }}
                          disabled={terminating}
                          aria-busy={terminating}
                          aria-disabled={terminating}
                          className="bg-red-600 hover:bg-red-700 text-white disabled:opacity-70 disabled:pointer-events-none disabled:cursor-not-allowed"
                        >
                          Terminate
                        </AlertDialogAction>
                      </AlertDialogFooter>
                    </AlertDialogContent>
                  </AlertDialog>
                </CardContent>
              </Card>
            )}
          </>
        )}

        <PaymentModal
          open={paymentModalOpen}
          onOpenChange={handlePaymentModalOpenChange}
          clientSecret={paymentClientSecret}
          amountPence={paymentAmountPence}
          title={paymentTitle}
          onSuccess={handlePaymentSuccess}
        />
      </div>
    </MainLayout>
  );
};
