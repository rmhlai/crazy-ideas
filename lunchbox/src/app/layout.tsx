import type { Metadata, Viewport } from "next";
import "./globals.css";
import { Nav } from "@/components/Nav";
import { pendingFeedbackCount } from "@/lib/services/orders";

export const metadata: Metadata = {
  title: "LunchBox",
  description: "School lunch order tracker",
  appleWebApp: { capable: true, title: "LunchBox", statusBarStyle: "default" },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  themeColor: "#ea580c",
};

export const dynamic = "force-dynamic";

export default function RootLayout({ children }: { children: React.ReactNode }) {
  const pending = pendingFeedbackCount();
  return (
    <html lang="en">
      <body className="min-h-screen antialiased">
        <div className="md:flex">
          <Nav pending={pending} />
          <main className="mx-auto w-full max-w-4xl flex-1 px-4 pb-28 pt-5 md:px-8 md:pb-10">{children}</main>
        </div>
      </body>
    </html>
  );
}
