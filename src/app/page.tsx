import { redirect } from "next/navigation";
import Link from "next/link";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { Button } from "@/components/ui/button";
import { ArrowRight, BarChart3, Search, Users } from "lucide-react";

export default async function Home() {
  const supabase = await createServerSupabaseClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (user) {
    redirect("/dashboard");
  }

  return (
    <div className="flex min-h-screen flex-col bg-background">
      {/* Navigation */}
      <header className="sticky top-0 z-50 border-b border-border bg-background/80 backdrop-blur-sm">
        <div className="mx-auto flex h-14 max-w-5xl items-center justify-between px-4 sm:px-6">
          <div className="flex items-center gap-2">
            <div className="flex size-8 items-center justify-center rounded-lg bg-primary text-primary-foreground font-bold text-sm">
              I
            </div>
            <span className="font-heading text-lg font-semibold tracking-tight">
              Influencer Intel
            </span>
          </div>
          <div className="flex items-center gap-2">
            <Button variant="ghost" size="sm" render={<Link href="/login" />}>
              Sign In
            </Button>
            <Button size="sm" render={<Link href="/signup" />}>
              Get Started
            </Button>
          </div>
        </div>
      </header>

      {/* Hero */}
      <main className="flex flex-1 flex-col">
        <section className="mx-auto flex max-w-5xl flex-col items-center px-4 pt-20 pb-16 text-center sm:px-6 sm:pt-32 sm:pb-24">
          <div className="mb-4 inline-flex items-center gap-1.5 rounded-full border border-border bg-muted/60 px-3 py-1 text-xs font-medium text-muted-foreground">
            <span className="size-1.5 rounded-full bg-success" />
            AI-Powered Influencer Discovery
          </div>
          <h1 className="max-w-3xl text-4xl font-bold tracking-tight text-foreground sm:text-5xl lg:text-6xl">
            Find the perfect creators for your{" "}
            <span className="text-primary">brand</span>
          </h1>
          <p className="mt-6 max-w-xl text-base leading-relaxed text-muted-foreground sm:text-lg">
            Discover, evaluate, and manage influencer partnerships with
            data-driven intelligence. Score creators on engagement quality,
            audience authenticity, and brand fit.
          </p>
          <div className="mt-8 flex flex-col gap-3 sm:flex-row">
            <Button size="lg" render={<Link href="/signup" />}>
              Start Free
              <ArrowRight className="size-4" />
            </Button>
            <Button
              variant="outline"
              size="lg"
              render={<Link href="/login" />}
            >
              Sign In
            </Button>
          </div>
        </section>

        {/* Features */}
        <section className="border-t border-border bg-muted/30">
          <div className="mx-auto grid max-w-5xl gap-8 px-4 py-16 sm:grid-cols-3 sm:px-6 sm:py-20">
            <div className="flex flex-col items-center gap-3 text-center sm:items-start sm:text-left">
              <div className="flex size-10 items-center justify-center rounded-lg bg-primary/10">
                <Search className="size-5 text-primary" />
              </div>
              <h3 className="font-heading text-base font-semibold">
                Smart Discovery
              </h3>
              <p className="text-sm leading-relaxed text-muted-foreground">
                Search across thousands of creators with advanced filters for
                niche, engagement, audience, and location.
              </p>
            </div>
            <div className="flex flex-col items-center gap-3 text-center sm:items-start sm:text-left">
              <div className="flex size-10 items-center justify-center rounded-lg bg-primary/10">
                <BarChart3 className="size-5 text-primary" />
              </div>
              <h3 className="font-heading text-base font-semibold">
                Deep Analytics
              </h3>
              <p className="text-sm leading-relaxed text-muted-foreground">
                Go beyond vanity metrics with content intelligence, audience
                authenticity scoring, and engagement quality analysis.
              </p>
            </div>
            <div className="flex flex-col items-center gap-3 text-center sm:items-start sm:text-left">
              <div className="flex size-10 items-center justify-center rounded-lg bg-primary/10">
                <Users className="size-5 text-primary" />
              </div>
              <h3 className="font-heading text-base font-semibold">
                Campaign Management
              </h3>
              <p className="text-sm leading-relaxed text-muted-foreground">
                Create campaigns, auto-match creators, generate UTM links, and
                track performance all in one place.
              </p>
            </div>
          </div>
        </section>
      </main>

      {/* Footer */}
      <footer className="border-t border-border">
        <div className="mx-auto flex max-w-5xl items-center justify-between px-4 py-6 sm:px-6">
          <p className="text-xs text-muted-foreground">
            Influencer Intelligence Platform
          </p>
          <p className="text-xs text-muted-foreground">
            Built with Next.js and Supabase
          </p>
        </div>
      </footer>
    </div>
  );
}
