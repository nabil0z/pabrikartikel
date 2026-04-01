import { prisma } from "@/lib/prisma";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { FileText, Users, Clock, AlertTriangle, CheckCircle } from "lucide-react";

export default async function DashboardPage() {
  const tenantsCount = await prisma.tenant.count();
  
  const articles = await prisma.article.groupBy({
    by: ['status'],
    _count: {
      status: true
    }
  });

  const getStatusCount = (statusName: string) => {
    return articles.find(a => a.status === statusName)?._count.status || 0;
  };

  const scheduled = getStatusCount("SCHEDULED");
  const drafting = getStatusCount("DRAFTING") + getStatusCount("PENDING_REVIEW");
  const published = getStatusCount("PUBLISHED");
  const failed = getStatusCount("FAILED");

  return (
    <div className="flex-1 space-y-4 p-8 pt-6">
      <div className="flex items-center justify-between space-y-2">
        <h2 className="text-3xl font-bold tracking-tight">Dashboard Overview</h2>
      </div>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Aktif Tenant (Blog)</CardTitle>
            <Users className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{tenantsCount}</div>
            <p className="text-xs text-muted-foreground">Website terhubung</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Antrean (Scheduled)</CardTitle>
            <Clock className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{scheduled}</div>
            <p className="text-xs text-muted-foreground">Menunggu dieksekusi cron</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Sedang Diproses</CardTitle>
            <FileText className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{drafting}</div>
            <p className="text-xs text-muted-foreground">AI Drafting & Telegram Review</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Berhasil Terbit</CardTitle>
            <CheckCircle className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{published}</div>
            <p className="text-xs text-muted-foreground">Termasuk hasil Auto-Refresh</p>
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-7">
        <Card className="col-span-4 flex flex-col items-center justify-center p-6 text-center text-muted-foreground bg-muted/20 border-dashed">
          <AlertTriangle className="h-8 w-8 mb-2 opacity-50 text-destructive" />
          <h3 className="font-semibold text-foreground">Artikel Gagal: {failed}</h3>
          <p className="text-sm">Buka menu "Article Queue" untuk melihat log error Serper/Gemini.</p>
        </Card>
        
        <Card className="col-span-3 flex flex-col items-center justify-center p-6 text-center bg-primary/5 border-primary/20">
          <h3 className="font-semibold text-primary">Sistem Normal 🟢</h3>
          <p className="text-sm text-muted-foreground">Pabrik Artikel beroperasi secara otonom.</p>
        </Card>
      </div>
    </div>
  );
}
