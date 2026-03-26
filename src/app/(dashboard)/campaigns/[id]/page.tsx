import { notFound } from "next/navigation";
import { Badge } from "@/components/ui/badge";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { createClient } from "@/lib/supabase/server";
import { requireBrandContext } from "@/lib/queries/brand";
import { getCampaignDetail } from "@/lib/queries/campaigns";
import { getOutreachMessages, getOutreachTemplates } from "@/lib/queries/outreach";
import { getCampaignAttribution } from "@/lib/queries/attribution";
import {
  getCampaignCreatorPerformance,
  getCampaignPerformance,
  getCampaignPerformanceTimeSeries,
  getCampaignRegionalPerformance,
} from "@/lib/queries/performance";
import { OutreachTab } from "./outreach-tab";
import { PerformanceTab } from "./performance-tab";
import { UtmLinkCell } from "./utm-link-cell";

function formatCurrency(value: number | null | undefined) {
  return new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    maximumFractionDigits: 0,
  }).format(Number(value ?? 0));
}

export default async function CampaignDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const supabase = await createClient();
  const brand = await requireBrandContext(supabase);
  const pageData = await Promise.all([
    getCampaignDetail(supabase, brand.brand_id, id),
    getOutreachTemplates(supabase, brand.brand_id),
    getOutreachMessages(supabase, brand.brand_id, {
      campaignId: id,
      page: 1,
      pageSize: 50,
    }),
    getCampaignAttribution(supabase, brand.brand_id, id),
    getCampaignPerformance(supabase, brand.brand_id, id),
    getCampaignCreatorPerformance(supabase, brand.brand_id, id),
    getCampaignRegionalPerformance(supabase, brand.brand_id, id),
    getCampaignPerformanceTimeSeries(supabase, brand.brand_id, id),
  ]).catch(() => null);

  if (!pageData) {
    notFound();
  }

  const [detail, templates, outreach, attribution, summary, creatorPerformance, regions, timeSeries] =
    pageData;
  const campaign = detail.campaign;

  return (
    <div className="space-y-6">
      <section>
        <div className="flex flex-col gap-4 xl:flex-row xl:items-end xl:justify-between">
          <div>
            <p className="text-xs font-medium text-muted-foreground">Campaign</p>
            <h1 className="mt-1 text-2xl font-semibold tracking-tight text-foreground">
              {campaign.name}
            </h1>
            <p className="mt-1 text-sm text-muted-foreground">
              Move from discovery to outreach, deal flow, attribution, and ROI.
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <Badge variant="secondary">{campaign.goal}</Badge>
            <Badge variant="outline">{campaign.status}</Badge>
          </div>
        </div>
      </section>

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <Card className="border bg-card">
          <CardHeader className="pb-2">
            <CardDescription>Creators</CardDescription>
            <CardTitle>{detail.creators.length}</CardTitle>
          </CardHeader>
        </Card>
        <Card className="border bg-card">
          <CardHeader className="pb-2">
            <CardDescription>Revenue</CardDescription>
            <CardTitle>{formatCurrency(summary.total_revenue_attributed)}</CardTitle>
          </CardHeader>
        </Card>
        <Card className="border bg-card">
          <CardHeader className="pb-2">
            <CardDescription>Orders</CardDescription>
            <CardTitle>{summary.total_orders_attributed ?? 0}</CardTitle>
          </CardHeader>
        </Card>
        <Card className="border bg-card">
          <CardHeader className="pb-2">
            <CardDescription>ROI</CardDescription>
            <CardTitle>
              {summary.overall_roi != null ? `${summary.overall_roi.toFixed(2)}x` : "N/A"}
            </CardTitle>
          </CardHeader>
        </Card>
      </div>

      <Tabs defaultValue="creators" className="space-y-5">
        <TabsList>
          <TabsTrigger value="creators">Creators</TabsTrigger>
          <TabsTrigger value="outreach">Outreach</TabsTrigger>
          <TabsTrigger value="performance">Performance</TabsTrigger>
        </TabsList>

        <TabsContent value="creators" className="space-y-6">
          <Card className="border bg-card">
            <CardHeader>
              <CardTitle>Campaign creators</CardTitle>
              <CardDescription>
                Confirmed creators can be assigned UTM links for attribution.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Creator</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Rate</TableHead>
                    <TableHead>UTM link</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {detail.creators.length ? (
                    detail.creators.map((row) => (
                      <TableRow key={row.id}>
                        <TableCell>
                          <div>
                            <p className="font-medium text-foreground">
                              {row.creator?.display_name ?? row.creator?.handle ?? "Unknown"}
                            </p>
                            {row.creator?.handle ? (
                              <p className="text-xs text-muted-foreground">
                                @{row.creator.handle}
                              </p>
                            ) : null}
                          </div>
                        </TableCell>
                        <TableCell>
                          <Badge variant="outline">{row.status}</Badge>
                        </TableCell>
                        <TableCell>{formatCurrency(row.agreed_rate)}</TableCell>
                        <TableCell>
                          <UtmLinkCell
                            campaignId={campaign.id}
                            creatorId={row.creator_id}
                            initialLink={Array.isArray(row.utm) ? row.utm[0] : null}
                          />
                        </TableCell>
                      </TableRow>
                    ))
                  ) : (
                    <TableRow>
                      <TableCell colSpan={4} className="py-10 text-center text-sm text-muted-foreground">
                        No creators assigned to this campaign yet.
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            </CardContent>
          </Card>

          <Card className="border bg-card">
            <CardHeader>
              <CardTitle>Attribution snapshot</CardTitle>
              <CardDescription>
                UTM links and attributed orders for this campaign.
              </CardDescription>
            </CardHeader>
            <CardContent className="grid gap-3 md:grid-cols-3">
              <div className="rounded-xl bg-muted/40 px-4 py-4">
                <p className="text-xs text-muted-foreground">UTM links</p>
                <p className="mt-2 text-xl font-semibold text-foreground">
                  {attribution.links.length}
                </p>
              </div>
              <div className="rounded-xl bg-muted/40 px-4 py-4">
                <p className="text-xs text-muted-foreground">Attributed orders</p>
                <p className="mt-2 text-xl font-semibold text-foreground">
                  {attribution.summary.orders}
                </p>
              </div>
              <div className="rounded-xl bg-muted/40 px-4 py-4">
                <p className="text-xs text-muted-foreground">Attributed revenue</p>
                <p className="mt-2 text-xl font-semibold text-foreground">
                  {formatCurrency(attribution.summary.revenue)}
                </p>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="outreach">
          <OutreachTab
            campaignId={campaign.id}
            campaignName={campaign.name}
            brandName={brand.brand_name}
            creators={detail.creators.map((row) => ({
              id: row.creator_id,
              handle: row.creator?.handle ?? "",
              display_name: row.creator?.display_name ?? null,
              contact_email: row.creator?.contact_email ?? null,
            }))}
            templates={templates}
            messages={outreach.items}
          />
        </TabsContent>

        <TabsContent value="performance">
          <PerformanceTab
            campaignId={campaign.id}
            summary={summary}
            creators={creatorPerformance}
            regions={regions}
            timeSeries={timeSeries}
          />
        </TabsContent>
      </Tabs>
    </div>
  );
}
