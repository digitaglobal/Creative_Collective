// Server-side contract only. Do not supply an adapter until a provider is approved.
export interface VerifiedPaymentEvent {
  eventId: string;
  paymentId: string;
  bookingId: string;
  kind: "paid" | "failed" | "refunded";
  amountMinor: number;
  currency: "JMD";
}
export interface PaymentProvider {
  createCheckout(input: {
    bookingId: string;
    amountMinor: number;
    currency: "JMD";
    expiresAt: string;
    idempotencyKey: string;
  }): Promise<{ url: string; paymentId: string }>;
  verifyEvent(rawBody: string, headers: Headers): Promise<VerifiedPaymentEvent>;
  lookupPayment(paymentId: string): Promise<VerifiedPaymentEvent>;
  refund(input: {
    paymentId: string;
    amountMinor: number;
    idempotencyKey: string;
  }): Promise<{ refundId: string }>;
}
export const onlinePaymentsEnabled = false;
