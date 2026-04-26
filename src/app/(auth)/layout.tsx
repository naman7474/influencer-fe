export default function AuthLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-background px-4">
      <div className="mb-8 flex flex-col items-center gap-2">
        <div
          className="flex h-11 w-11 items-center justify-center rounded-2xl text-white shadow-md"
          style={{ background: "var(--gradient-canva)" }}
        >
          <span className="font-heading text-lg font-extrabold">G</span>
        </div>
        <h1 className="font-heading text-xl font-extrabold text-foreground">
          CreatorGoose
        </h1>
        <p className="text-sm text-muted-foreground">
          Data-driven creator partnerships
        </p>
      </div>
      <div className="w-full max-w-sm">{children}</div>
    </div>
  );
}
