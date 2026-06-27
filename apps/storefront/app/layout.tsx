import "./globals.css";
import type { ReactNode } from "react";

export const metadata = {
  title: "Eshop",
  description: "MVP internet shop storefront.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: ReactNode;
}>) {
  return (
    <html lang="ru">
      <body>{children}</body>
    </html>
  );
}
