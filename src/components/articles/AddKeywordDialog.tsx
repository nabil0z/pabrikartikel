"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Plus, AlertTriangle } from "lucide-react";
import { addManualKeyword } from "@/app/articles/actions";

interface Tenant {
  id: string;
  name: string;
}

export function AddKeywordDialog({ tenants }: { tenants: Tenant[] }) {
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(formData: FormData) {
    setLoading(true);
    setError(null);
    try {
      const result = await addManualKeyword(formData);
      if (result.success) {
        setOpen(false);
        setError(null);
      } else {
        setError(result.error || "Gagal menambahkan keyword.");
      }
    } catch (e) {
      setError("Terjadi error sistem.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={(v) => { setOpen(v); setError(null); }}>
      <DialogTrigger render={<Button />}>
        <Plus className="h-4 w-4 mr-2" />
        Input Keyword Manual
      </DialogTrigger>
      <DialogContent className="sm:max-w-[480px]">
        <form action={handleSubmit}>
          <DialogHeader>
            <DialogTitle>Tambah Keyword Manual</DialogTitle>
            <DialogDescription>
              Masukkan keyword target SEO. Artikel akan masuk antrean dan diproses otomatis oleh mesin AI.
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="grid grid-cols-4 items-center gap-4">
              <Label htmlFor="tenantId" className="text-right">Blog *</Label>
              <select
                id="tenantId"
                name="tenantId"
                required
                className="col-span-3 flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm"
              >
                <option value="">-- Pilih Blog --</option>
                {tenants.map((t) => (
                  <option key={t.id} value={t.id}>{t.name}</option>
                ))}
              </select>
            </div>
            <div className="grid grid-cols-4 items-center gap-4">
              <Label htmlFor="keyword" className="text-right">Keyword *</Label>
              <Input
                id="keyword"
                name="keyword"
                className="col-span-3"
                placeholder="contoh: HP Gaming Murah 2026"
                required
              />
            </div>
            <div className="grid grid-cols-4 items-center gap-4">
              <Label htmlFor="targetDate" className="text-right">Jadwal Proses</Label>
              <Input
                id="targetDate"
                name="targetDate"
                type="date"
                className="col-span-3"
                defaultValue={new Date().toISOString().split("T")[0]}
              />
            </div>

            {error && (
              <div className="flex items-start gap-2 rounded-md border border-red-200 bg-red-50 p-3 text-sm text-red-700">
                <AlertTriangle className="h-4 w-4 mt-0.5 shrink-0" />
                <span>{error}</span>
              </div>
            )}
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setOpen(false)}>Batal</Button>
            <Button type="submit" disabled={loading}>
              {loading ? "Mengecek..." : "Tambah ke Antrean"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
