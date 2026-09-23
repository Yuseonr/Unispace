import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Unispace",
  description:
    "Temukan ruang, peralatan, dan fasilitas kampus untuk mendukung ide berikutnya.",
  icons: {
    icon: [{ type: "image/svg+xml", url: "/Unispace_Logo.svg" }],
  },
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="id" className="h-full antialiased">
      <body className="min-h-full flex flex-col">{children}</body>
    </html>
  );
}
