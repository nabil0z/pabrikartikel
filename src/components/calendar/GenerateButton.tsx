"use client";

import { Button } from "@/components/ui/button";
import { Sparkles, Loader2 } from "lucide-react";
import { useFormStatus } from "react-dom";

function SubmitButton() {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" className="w-full" disabled={pending}>
      {pending ? (
        <>
          <Loader2 className="h-4 w-4 mr-2 animate-spin" />
          AI sedang bekerja... (30-60 detik)
        </>
      ) : (
        <>
          <Sparkles className="h-4 w-4 mr-2" />
          Generate Rencana 1 Tahun
        </>
      )}
    </Button>
  );
}

export { SubmitButton as GenerateButton };
