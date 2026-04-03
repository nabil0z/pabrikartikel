import { prisma } from "@/lib/prisma";
import { ArticleFilters } from "@/components/articles/ArticleFilters";
import { AddKeywordDialog } from "@/components/articles/AddKeywordDialog";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";

export const dynamic = "force-dynamic";

export default async function ArticlesPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; status?: string }>;
}) {
  const params = await searchParams;
  const q = params.q || "";
  const statusFilter = params.status || undefined;

  const whereClause: any = {};
  if (q) {
    whereClause.keyword = { contains: q };
  }
  if (statusFilter) {
    whereClause.status = statusFilter;
  }

  // Fetch from DB using Prisma
  const [articles, tenants] = await Promise.all([
    prisma.article.findMany({
      where: whereClause,
      orderBy: { targetDate: "asc" },
      include: { tenant: true },
      take: 50,
    }),
    prisma.tenant.findMany({
      select: { id: true, name: true },
      orderBy: { name: "asc" },
    }),
  ]);

  const getStatusColor = (status: string) => {
    switch(status) {
      case "PUBLISHED": return "bg-green-500/10 text-green-700 hover:bg-green-500/20 shadow-none border-green-200";
      case "FAILED": return "bg-red-500/10 text-red-700 hover:bg-red-500/20 shadow-none border-red-200";
      case "SCHEDULED": return "bg-blue-500/10 text-blue-700 hover:bg-blue-500/20 shadow-none border-blue-200";
      case "UPDATING": return "bg-purple-500/10 text-purple-700 hover:bg-purple-500/20 shadow-none border-purple-200";
      default: return "bg-yellow-500/10 text-yellow-700 hover:bg-yellow-500/20 shadow-none border-yellow-200";
    }
  };

  return (
    <div className="flex-1 space-y-4 p-8 pt-6">
      <div className="flex items-center justify-between mb-2">
        <div>
          <h2 className="text-3xl font-bold tracking-tight">Article Queue</h2>
          <p className="text-muted-foreground">Monitor the multi-pass AI generation pipeline & SERP scraping status.</p>
        </div>
        <AddKeywordDialog tenants={tenants} />
      </div>

      <ArticleFilters />

      <div className="rounded-md border bg-card">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Target SEO Keyword</TableHead>
              <TableHead>Blog (Tenant)</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Jadwal / Error Log</TableHead>
              <TableHead className="text-right">QDF Protection</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {articles.map((art) => (
              <TableRow key={art.id}>
                <TableCell className="font-medium max-w-xs truncate" title={art.keyword}>
                  {art.keyword}
                </TableCell>
                <TableCell>{art.tenant.name}</TableCell>
                <TableCell>
                  <Badge className={getStatusColor(art.status)}>{art.status}</Badge>
                </TableCell>
                <TableCell>
                  {art.status === "FAILED" && art.errorLog ? (
                    <span className="text-xs text-red-600 font-mono bg-red-50 px-1 py-0.5 rounded">{art.errorLog} (Retry: {art.retryCount})</span>
                  ) : (
                    <span className="text-sm text-muted-foreground">{art.targetDate?.toLocaleDateString("id-ID") || "-"}</span>
                  )}
                </TableCell>
                <TableCell className="text-right">
                  {art.isEvergreen ? (
                    art.isLockedFromRefresh ? (
                      <Badge variant="outline" className="border-orange-200 text-orange-700 bg-orange-50">🔒 Locked (Perfect)</Badge>
                    ) : (
                      <Badge variant="outline" className="border-blue-200 text-blue-700 bg-blue-50">♻️ Auto-Refresh</Badge>
                    )
                  ) : (
                    <span className="text-muted-foreground text-xs">-</span>
                  )}
                </TableCell>
              </TableRow>
            ))}
            {articles.length === 0 && (
              <TableRow>
                <TableCell colSpan={5} className="h-32 text-center text-muted-foreground">
                  Tidak ada artikel dalam antrean yang cocok dengan filter.
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
