import { Badge } from "@/components/ui/badge";
import { STATUS_LABELS, type LeadStatus } from "@/lib/types";

type Variant = "default" | "secondary" | "destructive" | "outline";

const VARIANT: Record<LeadStatus, Variant> = {
  new: "secondary",
  analyzed: "secondary",
  build_queued: "outline",
  site_built: "default",
  approved: "default",
  contacted: "default",
  viewed: "default",
  booked: "default",
  won: "default",
  rejected: "destructive",
  lost: "destructive",
  nurture: "outline",
};

export function StatusBadge({ status }: { status: LeadStatus }) {
  return (
    <Badge variant={VARIANT[status] ?? "secondary"}>
      {STATUS_LABELS[status] ?? status}
    </Badge>
  );
}
