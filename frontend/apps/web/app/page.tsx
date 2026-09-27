import { Button } from "@repo/ui";

export default function HomePage() {
  return (
    <main className="flex min-h-screen flex-col items-center justify-center p-8 bg-background text-foreground">
      <div className="max-w-md w-full space-y-6 text-center">
        <div className="space-y-2">
          <h1 className="text-3xl font-bold tracking-tight">Aevora Hub</h1>
          <p className="text-muted-foreground text-sm">
            Enterprise MCP Agent Hub - Frontend base setup is ready.
          </p>
        </div>
        <div className="flex justify-center gap-3">
          <Button variant="default">Get Started</Button>
          <Button variant="outline">Documentation</Button>
        </div>
      </div>
    </main>
  );
}
