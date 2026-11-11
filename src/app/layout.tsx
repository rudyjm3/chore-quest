import type { Metadata, Viewport } from "next";

import { Toaster } from "@/components/ui/sonner";

import "./globals.css";

export const metadata: Metadata = {
  title: { default: "Chore Quests", template: "%s · Chore Quests" },
  description: "Turn everyday chores into adventures.",
  applicationName: "Chore Quests",
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  themeColor: "#2f5d8a",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="en" className="h-full antialiased">
      <body className="flex min-h-full flex-col bg-background font-sans text-foreground">
        {children}
        <Toaster position="top-center" richColors />
      </body>
    </html>
  );
}
