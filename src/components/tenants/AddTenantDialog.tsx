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
              <Input id="niche" name="niche" className="col-span-3" placeholder="Technology & Gadgets" required />
            </div>
            <div className="grid grid-cols-4 items-center gap-4">
              <Label htmlFor="telegramTopicId" className="text-right">Telegram Topic ID</Label>
              <Input id="telegramTopicId" name="telegramTopicId" className="col-span-3" placeholder="e.g. 192837" />
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
