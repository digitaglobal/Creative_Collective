import {
  AlertTriangle,
  Ban,
  CalendarCheck,
  CircleCheck,
  CircleDashed,
  Clock,
  CreditCard,
  LogIn,
  UserX,
} from "lucide-react";
import type { ReactNode } from "react";
import type { BookingState, PaymentState } from "@/data/catalog";

/** Never colour alone: every state carries an icon and a text label. */
const bookingMap: Record<BookingState, { label: string; tone: string; icon: ReactNode }> = {
  held: {
    label: "Hold in checkout",
    tone: "bg-info text-info-foreground",
    icon: <Clock className="size-3.5" />,
  },
  pending_confirmation: {
    label: "Awaiting confirmation",
    tone: "bg-warning text-warning-foreground",
    icon: <CircleDashed className="size-3.5" />,
  },
  confirmed: {
    label: "Confirmed",
    tone: "bg-success text-success-foreground",
    icon: <CalendarCheck className="size-3.5" />,
  },
  checked_in: {
    label: "Checked in",
    tone: "bg-info text-info-foreground",
    icon: <LogIn className="size-3.5" />,
  },
  completed: {
    label: "Completed",
    tone: "bg-neutral-state text-neutral-state-foreground",
    icon: <CircleCheck className="size-3.5" />,
  },
  no_show: {
    label: "No show",
    tone: "bg-neutral-state text-neutral-state-foreground",
    icon: <UserX className="size-3.5" />,
  },
  cancelled: {
    label: "Cancelled",
    tone: "bg-neutral-state text-neutral-state-foreground",
    icon: <Ban className="size-3.5" />,
  },
  expired: {
    label: "Expired",
    tone: "bg-neutral-state text-neutral-state-foreground",
    icon: <Clock className="size-3.5" />,
  },
  payment_exception: {
    label: "Needs review",
    tone: "bg-warning text-warning-foreground",
    icon: <AlertTriangle className="size-3.5" />,
  },
};

const paymentMap: Record<PaymentState, { label: string; tone: string; icon: ReactNode }> = {
  unpaid: {
    label: "Unpaid",
    tone: "bg-warning text-warning-foreground",
    icon: <CreditCard className="size-3.5" />,
  },
  pending: {
    label: "Payment pending",
    tone: "bg-info text-info-foreground",
    icon: <CircleDashed className="size-3.5" />,
  },
  paid: {
    label: "Paid",
    tone: "bg-success text-success-foreground",
    icon: <CircleCheck className="size-3.5" />,
  },
  failed: {
    label: "Payment failed",
    tone: "bg-neutral-state text-neutral-state-foreground",
    icon: <AlertTriangle className="size-3.5" />,
  },
  refunded: {
    label: "Refunded",
    tone: "bg-neutral-state text-neutral-state-foreground",
    icon: <CircleCheck className="size-3.5" />,
  },
};

function Pill({ tone, icon, label }: { tone: string; icon: ReactNode; label: string }) {
  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-medium ${tone}`}
    >
      {icon}
      {label}
    </span>
  );
}

export function BookingStatusBadge({ state }: { state: BookingState }) {
  const s = bookingMap[state];
  return <Pill tone={s.tone} icon={s.icon} label={s.label} />;
}

export function PaymentStatusBadge({ state }: { state: PaymentState }) {
  const s = paymentMap[state];
  return <Pill tone={s.tone} icon={s.icon} label={s.label} />;
}

export function DraftBadge({ reason }: { reason?: string | undefined }) {
  return (
    <span
      title={reason}
      className="inline-flex items-center gap-1.5 rounded-full bg-neutral-state px-2.5 py-1 text-xs font-medium text-neutral-state-foreground"
    >
      <CircleDashed className="size-3.5" />
      Draft — not bookable
    </span>
  );
}
