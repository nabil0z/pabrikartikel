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
import { Calendar as CalendarIcon, Wand2 } from "lucide-react";
import { generateSeasonalPlan, approveKeyword, rejectKeyword, approveAllKeywords } from "./actions";
import { GenerateButton } from "@/components/calendar/GenerateButton";
import { ApproveAllButton, ApproveButton, RejectButton } from "@/components/calendar/ActionButtons";

interface TenantBasic {
  id: string;
  name: string;
  niche: string;
  articleTypes: string;
}

interface SeasonalEventWithTenant {
  id: string;
  eventName: string;
  eventDate: Date;
  targetGenDate: Date;
  keywords: string | null;
  isProcessed: boolean;
  tenantId: string;
  tenant: { name: string };
}

function parseKeywords(keywordsJson: string | null): { relevance?: string; suggestions?: string[] } {
  if (!keywordsJson) return {};
  try { return JSON.parse(keywordsJson); } catch { return {}; }
}

export const dynamic = "force-dynamic";

export default async function CalendarPage() {
  const events: SeasonalEventWithTenant[] = await prisma.seasonalEvent.findMany({
    orderBy: { eventDate: "asc" },
    include: { tenant: { select: { name: true } } },
  }) as any;

  const tenants: TenantBasic[] = await prisma.tenant.findMany({ 
    select: { id: true, name: true, niche: true, articleTypes: true }
  });

  return (
    <div className="flex-1 space-y-4 p-8 pt-6">
      <div className="flex items-center justify-between mb-2">
        <div>
          <h2 className="text-3xl font-bold tracking-tight">Seasonal Calendar & AI Planner</h2>
          <p className="text-muted-foreground">AI merencanakan konten seasonal 1 tahun ke depan. Anda approve/reject setiap keyword.</p>
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        {/* Card 1: Auto-Generate 1 Tahun */}
        <div className="lg:col-span-1 space-y-4">
          <Card className="border-2 border-dashed border-primary/30 bg-primary/5">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Wand2 className="h-5 w-5 text-primary" />
                Auto-Generate 1 Tahun
              </CardTitle>
              <CardDescription>
                Claude 4.6 akan menganalisis niche & kategori blog → menghasilkan rencana event + keyword untuk 12 bulan ke depan.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <form action={generateSeasonalPlan} className="space-y-4">
                <div className="space-y-1">
                  <Label>Target Blog</Label>
                  <select name="tenantId" className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm" required>
                    <option value="">-- Pilih Blog --</option>
                    {tenants.map((t: TenantBasic) => <option key={t.id} value={t.id}>{t.name} ({t.niche})</option>)}
                  </select>
                </div>
                <p className="text-xs text-muted-foreground">
                  AI akan cek hari besar, tren musiman, dan peluang konten sesuai niche yang dipilih.
                </p>
                <GenerateButton />
              </form>
            </CardContent>
          </Card>

          {/* Summary */}
          <Card>
            <CardContent className="pt-6">
              <div className="grid grid-cols-2 gap-4 text-center">
                <div>
                  <p className="text-2xl font-bold">{events.length}</p>
                  <p className="text-xs text-muted-foreground">Total Event</p>
                </div>
                <div>
                  <p className="text-2xl font-bold">{events.filter((e: SeasonalEventWithTenant) => e.isProcessed).length}</p>
                  <p className="text-xs text-muted-foreground">Sudah Approved</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
        
        {/* Event List with Keywords (Scrollable) */}
        <div className="lg:col-span-2 space-y-4 pb-10">
          {events.length === 0 ? (
            <Card>
              <CardContent className="pt-6">
                <p className="text-center text-muted-foreground py-8">
                  Belum ada rencana seasonal. Pilih blog lalu klik &quot;Generate Rencana 1 Tahun&quot; untuk memulai.
                </p>
              </CardContent>
            </Card>
          ) : (
            events.map((ev: SeasonalEventWithTenant) => {
              const kw = parseKeywords(ev.keywords);
              const suggestions = kw.suggestions || [];
              return (
                <Card key={ev.id} className={ev.isProcessed ? "opacity-60" : ""}>
                  <CardHeader className="pb-2">
                    <div className="flex items-center justify-between">
                      <div>
                        <CardTitle className="text-base">{ev.eventName}</CardTitle>
                        <CardDescription className="flex items-center gap-2 mt-1">
                          <CalendarIcon className="h-3 w-3" />
                          {ev.eventDate.toLocaleDateString("id-ID", { day: "numeric", month: "long", year: "numeric" })}
                          <span>•</span>
                          <span>{ev.tenant.name}</span>
                        </CardDescription>
                      </div>
                      <div className="flex items-center gap-2">
                        {ev.isProcessed ? (
                          <Badge className="bg-green-100 text-green-700 border-green-200 shadow-none">✅ Approved</Badge>
                        ) : (
                          <form action={approveAllKeywords}>
                            <input type="hidden" name="eventId" value={ev.id} />
                            <input type="hidden" name="tenantId" value={ev.tenantId} />
                            <input type="hidden" name="targetDate" value={ev.targetGenDate.toISOString()} />
                            <ApproveAllButton />
                          </form>
                        )}
                      </div>
                    </div>
                    {kw.relevance && (
                      <p className="text-xs text-muted-foreground mt-1 italic">{kw.relevance}</p>
                    )}
                  </CardHeader>
                  {suggestions.length > 0 && !ev.isProcessed && (
                    <CardContent>
                      <p className="text-xs font-medium text-muted-foreground mb-2">Keyword Suggestions:</p>
                      <div className="space-y-2">
                        {suggestions.map((keyword: string, i: number) => (
                          <div key={i} className="flex items-center justify-between gap-2 p-2 rounded-md bg-muted/50 text-sm">
                            <span className="flex-1">{keyword}</span>
                            <div className="flex gap-1">
                              <form action={approveKeyword}>
                                <input type="hidden" name="eventId" value={ev.id} />
                                <input type="hidden" name="keyword" value={keyword} />
                                <input type="hidden" name="tenantId" value={ev.tenantId} />
                                <input type="hidden" name="targetDate" value={ev.targetGenDate.toISOString()} />
                                <ApproveButton />
                              </form>
                              <form action={rejectKeyword}>
                                <input type="hidden" name="eventId" value={ev.id} />
                                <input type="hidden" name="keyword" value={keyword} />
                                <RejectButton />
                              </form>
                            </div>
                          </div>
                        ))}
                      </div>
                    </CardContent>
                  )}
                </Card>
              );
            })
          )}
        </div>
      </div>
    </div>
  );
}
