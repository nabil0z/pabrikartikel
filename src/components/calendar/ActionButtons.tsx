"use client";

import { Button } from "@/components/ui/button";
import { Check, X, CheckCheck, Loader2 } from "lucide-react";
import { useFormStatus } from "react-dom";

export function ApproveAllButton() {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" size="sm" variant="default" disabled={pending}>
      {pending ? <Loader2 className="h-3 w-3 mr-1 animate-spin" /> : <CheckCheck className="h-3 w-3 mr-1" />}
      {pending ? "Memproses..." : "Approve Semua"}
    </Button>
  );
}

export function ApproveButton() {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" size="sm" variant="ghost" disabled={pending} className="h-7 w-7 p-0 text-green-600 hover:text-green-700 hover:bg-green-50">
      {pending ? <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" /> : <Check className="h-4 w-4" />}
    </Button>
  );
}

export function RejectButton() {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" size="sm" variant="ghost" disabled={pending} className="h-7 w-7 p-0 text-red-500 hover:text-red-600 hover:bg-red-50">
      {pending ? <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" /> : <X className="h-4 w-4" />}
    </Button>
  );
}
