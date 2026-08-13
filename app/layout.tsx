import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "ISMS Knowledge Portal",
  description: "Search 24 draft ISMS policies and get answers with page-level evidence.",
  icons: { icon: "/favicon.svg" },
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
