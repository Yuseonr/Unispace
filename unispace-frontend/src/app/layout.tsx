import type { Metadata } from "next";
import "./globals.css";
import { AuthProvider } from "@/features/auth/auth-provider";

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
    <html lang="id" className="h-full antialiased" data-scroll-behavior="smooth">
      <body className="min-h-full flex flex-col">
        <AuthProvider>{children}</AuthProvider>
      </body>
    </html>
  );
}
