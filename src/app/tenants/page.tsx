import { prisma } from "@/lib/prisma";
import { AddTenantDialog } from "@/components/tenants/AddTenantDialog";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";

export default async function TenantsPage() {
  const tenants = await prisma.tenant.findMany({
    orderBy: { createdAt: "desc" },
  });

  return (
    <div className="flex-1 space-y-4 p-8 pt-6">
      <div className="flex items-center justify-between space-y-2">
        <div>
          <h2 className="text-3xl font-bold tracking-tight">Manajemen Blog / Tenant</h2>
          <p className="text-muted-foreground">Kelola profile SEO, E-E-A-T, dan target integrasi ke repo Astro.</p>
        </div>
        <div className="flex items-center space-x-2">
          <AddTenantDialog />
        </div>
      </div>

      <div className="rounded-md border bg-card">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Nama Web</TableHead>
              <TableHead>Niche</TableHead>
              <TableHead>Topic Telegram</TableHead>
              <TableHead>Profile E-E-A-T / Tone</TableHead>
              <TableHead>Dibuat</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {tenants.map(t => (
              <TableRow key={t.id}>
                <TableCell className="font-semibold">{t.name}</TableCell>
                <TableCell>{t.niche}</TableCell>
                <TableCell>
                  {t.telegramTopicId ? 
                    <Badge variant="outline">ID: {t.telegramTopicId}</Badge> 
                    : <span className="text-muted-foreground text-xs">Belum di-Set</span>
                  }
                </TableCell>
                <TableCell>
                  <div className="text-sm">
                    {t.toneOfVoice ? <span className="font-medium mr-1">{t.toneOfVoice}</span> : <span className="text-muted-foreground mr-1">No Tone |</span>}
                    {t.writingExample ? <Badge className="bg-green-500/10 text-green-600 hover:bg-green-500/20 border-green-500/20">Few-Shot Injected ✨</Badge> : <Badge variant="secondary">Standard Gen</Badge>}
                  </div>
                </TableCell>
                <TableCell className="text-muted-foreground text-sm">
                  {t.createdAt.toLocaleDateString("id-ID")}
                </TableCell>
              </TableRow>
            ))}
            {tenants.length === 0 && (
              <TableRow>
                <TableCell colSpan={5} className="h-24 text-center">
                  Belum ada blog yang didaftarkan. Klik "Add Tenant / Blog".
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
