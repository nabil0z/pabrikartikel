import { prisma } from "@/lib/prisma";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Calendar as CalendarIcon, Sparkles } from "lucide-react";
import { revalidatePath } from "next/cache";

export default async function CalendarPage() {
  const events = await prisma.seasonalEvent.findMany({
    orderBy: { eventDate: "asc" },
    include: { tenant: true },
  });

  const tenants = await prisma.tenant.findMany({ select: { id: true, name: true }});

  async function addEventAction(formData: FormData) {
    "use server";
    const name = formData.get("name") as string;
    const dateStr = formData.get("eventDate") as string;
    const tenantId = formData.get("tenantId") as string;

    if (!name || !dateStr || !tenantId) return;

    await prisma.seasonalEvent.create({
      data: {
        eventName: name,
        eventDate: new Date(dateStr),
        targetGenDate: new Date(new Date(dateStr).getTime() - 60 * 24 * 60 * 60 * 1000), // H-60
        tenantId,
      }
    });
    // Di Tahap 3: panggil Claude untuk men-generate 100 keywords dan menyimpannya ke antrean Article
    revalidatePath("/calendar");
  }

  return (
    <div className="flex-1 space-y-4 p-8 pt-6">
      <div className="flex items-center justify-between space-y-2 mb-2">
        <div>
          <h2 className="text-3xl font-bold tracking-tight">Seasonal Calendar & AI Clustering</h2>
          <p className="text-muted-foreground">Otomatisasi riset ratusan long-tail keyword untuk H-60 event besar.</p>
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        <div className="lg:col-span-1">
          <Card>
            <CardHeader>
              <CardTitle>Rencana Event Baru</CardTitle>
              <CardDescription>
                Masukkan 1 event besar (misal: "Pemilu 2029"). AI akan memecahnya jadi 100+ artikel turunan.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <form action={addEventAction} className="space-y-4">
                <div className="space-y-1">
                  <Label>Target Blog (Tenant)</Label>
                  <select name="tenantId" className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm transition-colors" required>
                    <option value="">-- Pilih Blog --</option>
                    {tenants.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
                  </select>
                </div>
                <div className="space-y-1">
                  <Label>Nama Event</Label>
                  <Input name="name" placeholder="Misal: Ramadhan 2026" required />
                </div>
                <div className="space-y-1">
                  <Label>Tanggal Puncak (Hari H)</Label>
                  <Input type="date" name="eventDate" required />
                </div>
                <p className="text-xs text-muted-foreground pt-2">
                  * Sistem otomatis mencicil artikel mulai 60 hari sebelum hari H.
                </p>
                <Button type="submit" className="w-full">
                  <Sparkles className="h-4 w-4 mr-2" />
                  Cluster dengan Claude
                </Button>
              </form>
            </CardContent>
          </Card>
        </div>
        
        <div className="lg:col-span-2">
          <Card>
            <CardHeader>
              <CardTitle>Daftar Perayaan / Event</CardTitle>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Event</TableHead>
                    <TableHead>Tanggal Target</TableHead>
                    <TableHead>Blog</TableHead>
                    <TableHead>Status AI Modul</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {events.map(ev => (
                    <TableRow key={ev.id}>
                      <TableCell className="font-semibold">{ev.eventName}</TableCell>
                      <TableCell>
                        <div className="flex items-center text-sm">
                          <CalendarIcon className="h-3 w-3 mr-1 text-muted-foreground"/>
                          {ev.eventDate.toLocaleDateString("id-ID")}
                        </div>
                      </TableCell>
                      <TableCell>{ev.tenant.name}</TableCell>
                      <TableCell>
                        <Badge variant="secondary" className="bg-blue-100 text-blue-700 hover:bg-blue-100 shadow-none border-blue-200">
                          100 Keywrods Mapped
                        </Badge>
                      </TableCell>
                    </TableRow>
                  ))}
                  {events.length === 0 && (
                     <TableRow>
                       <TableCell colSpan={4} className="h-24 text-center text-muted-foreground">
                         Tidak ada agenda aktif.
                       </TableCell>
                     </TableRow>
                  )}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
