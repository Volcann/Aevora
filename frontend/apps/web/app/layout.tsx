import { AppToaster, TooltipProvider, TopLoader } from "@repo/ui";
import "@repo/ui/styles.css";
import type { Metadata } from "next";
import { StoreProvider } from "../components/store-provider";
import "./globals.css";

export const metadata: Metadata = {
  title: "Aevora Agent Hub",
  description: "Enterprise AI Agent Hub - Gemini AI & Distributed Tool Automation",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body
        className="bg-background text-foreground min-h-screen font-sans antialiased"
        suppressHydrationWarning
      >
        <StoreProvider>
          <TopLoader />
          <TooltipProvider>{children}</TooltipProvider>
          <AppToaster />
        </StoreProvider>
      </body>
    </html>
  );
}
