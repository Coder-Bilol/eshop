import "./globals.css";
import type { ReactNode } from "react";
import { CartProvider } from "../components/cart-provider";

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
      <body>
        <CartProvider restoreOnMount={false}>{children}</CartProvider>
      </body>
    </html>
  );
}
