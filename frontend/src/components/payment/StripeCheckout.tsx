import { useState, useEffect, useRef } from 'react';
import { PaymentElement, useStripe, useElements } from '@stripe/react-stripe-js';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

export interface StripeCheckoutProps {
  onSuccess?: () => void;
  onCancel?: () => void;
  /** Called when processing state changes (e.g. so modal can block outside-click close). */
  onProcessingChange?: (processing: boolean) => void;
  submitLabel?: string;
  disabled?: boolean;
  className?: string;
}

/**
 * Payment form using Stripe Payment Element. Must be rendered inside <Elements options={{ clientSecret }}>.
 * Call onSuccess when payment is confirmed; onCancel when user cancels (e.g. close modal).
 */
export function StripeCheckout({
  onSuccess,
  onCancel,
  onProcessingChange,
  submitLabel = 'Pay now',
  disabled = false,
  className,
}: StripeCheckoutProps) {
  const stripe = useStripe();
  const elements = useElements();
  const onSuccessRef = useRef(onSuccess);
  onSuccessRef.current = onSuccess;

  const [isProcessing, setIsProcessing] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [statusMessage, setStatusMessage] = useState<string | null>(null);

  useEffect(() => {
    onProcessingChange?.(isProcessing);
  }, [isProcessing, onProcessingChange]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!stripe || !elements) return;

    setIsProcessing(true);
    setErrorMessage(null);
    setStatusMessage(null);

    const { error, paymentIntent } = await stripe.confirmPayment({
      elements,
      redirect: 'if_required',
      confirmParams: {
        return_url: window.location.href,
      },
    });

    if (error) {
      setErrorMessage(error.message ?? 'Payment failed');
      setIsProcessing(false);
      return;
    }

    if (paymentIntent?.status === 'succeeded') {
      setIsProcessing(false);
      onSuccess?.();
      return;
    }

    if (paymentIntent?.status === 'processing') {
      setStatusMessage('Payment is processing. You will be notified when it completes.');
      setIsProcessing(false);
      return;
    }

    setIsProcessing(false);
  };

  // Handle return from redirect (e.g. 3DS): check URL for payment_intent_client_secret and invoke onSuccess if payment succeeded
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const clientSecret = params.get('payment_intent_client_secret');
    const redirectStatus = params.get('redirect_status');
    if (!clientSecret || redirectStatus !== 'succeeded' || !stripe) return;

    stripe
      .retrievePaymentIntent(clientSecret)
      .then(({ paymentIntent }) => {
        if (paymentIntent?.status === 'succeeded') {
          onSuccessRef.current?.();
          window.history.replaceState({}, '', window.location.pathname);
        }
      })
      .catch((err) => {
        console.error('retrievePaymentIntent failed', err);
        setErrorMessage(err?.message ?? 'Payment retrieval failed');
      });
  }, [stripe]);

  return (
    <form onSubmit={handleSubmit} className={cn('space-y-4', className)}>
      <PaymentElement
        options={{
          layout: 'tabs',
        }}
      />
      {errorMessage && (
        <p className="text-sm text-red-600 dark:text-red-400" role="alert">
          {errorMessage}
        </p>
      )}
      {statusMessage && (
        <p className="text-sm text-slate-600 dark:text-slate-400" role="status">
          {statusMessage}
        </p>
      )}
      <div className="flex gap-2 justify-end">
        {onCancel && (
          <Button type="button" variant="outline" onClick={onCancel} disabled={isProcessing}>
            Cancel
          </Button>
        )}
        <Button type="submit" disabled={!stripe || !elements || disabled || isProcessing}>
          {isProcessing ? 'Processing…' : submitLabel}
        </Button>
      </div>
    </form>
  );
}
