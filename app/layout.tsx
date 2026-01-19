import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Migración PACS - Informes Radiológicos",
  description: "Sistema de migración de informes radiológicos a PACS",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="es">
      <body className="antialiased">
        {children}
      </body>
    </html>
  );
}
