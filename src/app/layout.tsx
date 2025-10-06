import type { Metadata } from "next";
import { Inter, Poppins } from "next/font/google";
import "./globals.css";

const inter = Inter({
  variable: "--font-inter",
  subsets: ["latin"],
});

const poppins = Poppins({
  variable: "--font-poppins",
  subsets: ["latin"],
  weight: ["300", "400", "500", "600", "700"],
});

export const metadata: Metadata = {
  title: "Equalizagro",
  description: "Desde 2015, convertemos pulverizações em aplicações. Consultoria especializada, pesquisa e treinamentos para maximizar a rentabilidade no campo.",
  keywords: "consultoria agrícola, pulverização, aplicação, treinamento agrícola, pesquisa agrícola",
  authors: [{ name: "Equalizagro" }],
  icons: {
    icon: '/images/EQUALIZAGRO logo.png',
    shortcut: '/images/EQUALIZAGRO logo.png',
    apple: '/images/EQUALIZAGRO logo.png',
  },
  openGraph: {
    title: "Equalizagro - Consultoria Agrícola Especializada",
    description: "Desde 2015, convertemos pulverizações em aplicações. Consultoria especializada, pesquisa e treinamentos para maximizar a rentabilidade no campo.",
    type: "website",
    locale: "pt_BR",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="pt-BR" className="scroll-smooth">
      <body
        className={`${inter.variable} ${poppins.variable} antialiased bg-white text-gray-900`}
      >
        {children}
      </body>
    </html>
  );
}
