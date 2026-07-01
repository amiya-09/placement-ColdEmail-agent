import "./globals.css";
import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = {
  title: "Placement Agent",
  description: "Personal cold-outreach tracker",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body className="font-body bg-paper text-ink min-h-screen">
        <header className="border-b border-line">
          <div className="max-w-5xl mx-auto px-6 py-5 flex items-center justify-between">
            <Link href="/" className="font-display text-xl tracking-tight">
              Placement Agent
            </Link>
            <nav className="flex gap-6 text-sm font-mono uppercase tracking-wide text-muted">
              <Link href="/" className="hover:text-ink transition-colors">
                Queue
              </Link>
              <Link href="/new" className="hover:text-ink transition-colors">
                New
              </Link>
              <Link href="/discover" className="hover:text-ink transition-colors">
                Discover
              </Link>
              <Link href="/setup" className="hover:text-ink transition-colors">
                Setup
              </Link>
            </nav>
          </div>
        </header>
        <main className="max-w-5xl mx-auto px-6 py-10">{children}</main>
      </body>
    </html>
  );
}
