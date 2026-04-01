"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useTransition } from "react";

export function ArticleFilters() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [isPending, startTransition] = useTransition();

  const handleSearch = (term: string) => {
    const params = new URLSearchParams(searchParams);
    if (term) {
      params.set("q", term);
    } else {
      params.delete("q");
    }
    startTransition(() => {
      router.push(`/articles?${params.toString()}`);
    });
  };

  const handleStatus = (status: string) => {
    const params = new URLSearchParams(searchParams);
    if (status !== "ALL") {
      params.set("status", status);
    } else {
      params.delete("status");
    }
    startTransition(() => {
      router.push(`/articles?${params.toString()}`);
    });
  };

  return (
    <div className="flex flex-col sm:flex-row gap-4 mb-6">
      <div className="flex-1 max-w-sm">
        <Input
          placeholder="Search keywords or topics..."
          defaultValue={searchParams.get("q")?.toString()}
          onChange={(e) => {
            // Debounce in a real app, direct for MVP simplicity
            handleSearch(e.target.value);
          }}
          className={isPending ? "opacity-50" : ""}
        />
      </div>
      <div className="w-[180px]">
        <Select 
          defaultValue={searchParams.get("status")?.toString() || "ALL"} 
          onValueChange={handleStatus}
        >
          <SelectTrigger>
            <SelectValue placeholder="Filter Status" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="ALL">All Status</SelectItem>
            <SelectItem value="SCHEDULED">Scheduled</SelectItem>
            <SelectItem value="DRAFTING">Drafting</SelectItem>
            <SelectItem value="PENDING_REVIEW">Pending Review</SelectItem>
            <SelectItem value="PUBLISHED">Published</SelectItem>
            <SelectItem value="FAILED">Failed</SelectItem>
            <SelectItem value="UPDATING">Updating (Refresh)</SelectItem>
          </SelectContent>
        </Select>
      </div>
    </div>
  );
}
