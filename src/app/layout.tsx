import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "CampusConnect | University Events",
  description: "Discover and register for campus events.",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
