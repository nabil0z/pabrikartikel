"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Plus } from "lucide-react";
import { addTenantAction } from "../../app/tenants/actions";

export function AddTenantDialog() {
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);

  async function handleSubmit(formData: FormData) {
    setLoading(true);
    try {
      await addTenantAction(formData);
      setOpen(false);
    } catch (e) {
      alert("Error adding tenant");
    } finally {
      setLoading(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger render={<Button />}>
          <Plus className="h-4 w-4 mr-2" />
          Add Tenant / Blog
      </DialogTrigger>
      <DialogContent className="sm:max-w-[600px] max-h-[90vh] overflow-y-auto">
        <form action={handleSubmit}>
          <DialogHeader>
            <DialogTitle>Register New Blog</DialogTitle>
            <DialogDescription>
              Setup the E-E-A-T persona, niche, and Telegram destination for this blog.
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="grid grid-cols-4 items-center gap-4">
              <Label htmlFor="name" className="text-right">Name *</Label>
              <Input id="name" name="name" className="col-span-3" placeholder="hanyut.com" required />
            </div>
            <div className="grid grid-cols-4 items-center gap-4">
              <Label htmlFor="niche" className="text-right">Niche *</Label>
              <Input id="niche" name="niche" className="col-span-3" placeholder="Blog Umum Indonesia / Teknologi & Gadget" required />
            </div>
            <div className="grid grid-cols-4 items-start gap-4">
              <Label htmlFor="articleTypes" className="text-right mt-2">Kategori Blog</Label>
              <Input id="articleTypes" name="articleTypes" className="col-span-3" placeholder="Teknologi, Keuangan, Kesehatan, Gaya Hidup" />
            </div>
            <div className="grid grid-cols-4 items-start gap-4">
              <Label htmlFor="localPath" className="text-right mt-2">Local Path (VPS)</Label>
              <Input id="localPath" name="localPath" className="col-span-3" placeholder="/mnt/hanyut-posts" />
            </div>
            <div className="grid grid-cols-4 items-center gap-4">
              <Label htmlFor="language" className="text-right">Bahasa Artikel</Label>
              <select id="language" name="language" className="col-span-3 flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm">
                <option value="id">🇮🇩 Bahasa Indonesia</option>
                <option value="en">🇺🇸 English</option>
                <option value="ms">🇲🇾 Bahasa Melayu</option>
              </select>
            </div>
            <div className="grid grid-cols-4 items-center gap-4">
              <Label htmlFor="targetCountry" className="text-right">Negara Target</Label>
              <select id="targetCountry" name="targetCountry" className="col-span-3 flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm">
                <option value="ID">🇮🇩 Indonesia</option>
                <option value="US">🇺🇸 United States</option>
                <option value="MY">🇲🇾 Malaysia</option>
                <option value="SG">🇸🇬 Singapore</option>
                <option value="AU">🇦🇺 Australia</option>
                <option value="GB">🇬🇧 United Kingdom</option>
              </select>
            </div>
            <div className="grid grid-cols-4 items-center gap-4">
              <Label htmlFor="telegramTopicId" className="text-right">Telegram Topic ID</Label>
              <Input id="telegramTopicId" name="telegramTopicId" className="col-span-3" placeholder="e.g. 2" />
            </div>
            <div className="grid grid-cols-4 items-center gap-4">
              <Label htmlFor="cdnUrl" className="text-right">Custom CDN URL</Label>
              <Input id="cdnUrl" name="cdnUrl" className="col-span-3" placeholder="e.g. https://img.hanyut.com" />
            </div>
            <div className="grid grid-cols-4 items-start gap-4">
              <Label htmlFor="toneOfVoice" className="text-right mt-2">Tone of Voice</Label>
              <Input id="toneOfVoice" name="toneOfVoice" className="col-span-3" placeholder="Santai, lucu, seperti Vice" />
            </div>
            <div className="grid grid-cols-4 items-start gap-4">
              <Label htmlFor="targetAudience" className="text-right mt-2">Target Audience</Label>
              <Input id="targetAudience" name="targetAudience" className="col-span-3" placeholder="Anak muda Gen-Z usia 18-25" />
            </div>
            <div className="grid grid-cols-4 items-start gap-4">
              <Label htmlFor="writingExample" className="text-right mt-2">Writing Example</Label>
              <Textarea 
                id="writingExample" 
                name="writingExample" 
                className="col-span-3 h-32" 
                placeholder="Paste an exact 2 paragraphs here for the AI to clone (Few-Shot Style Injection)..." 
              />
            </div>
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setOpen(false)}>Cancel</Button>
            <Button type="submit" disabled={loading}>{loading ? "Saving..." : "Save Config"}</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
