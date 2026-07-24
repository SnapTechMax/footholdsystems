import type { Metadata } from "next";
import { Source_Serif_4, Inter, JetBrains_Mono, Archivo } from "next/font/google";
import Script from "next/script";
import "./globals.css";

const sourceSerif = Source_Serif_4({
  variable: "--font-source-serif",
  subsets: ["latin"],
  weight: ["400", "600", "700"],
  display: "swap",
});

const inter = Inter({
  variable: "--font-inter",
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
  display: "swap",
});

const jetbrainsMono = JetBrains_Mono({
  variable: "--font-jetbrains-mono",
  subsets: ["latin"],
  weight: ["400", "500"],
  display: "swap",
});

const archivo = Archivo({
  variable: "--font-archivo",
  subsets: ["latin"],
  weight: ["700", "800", "900"],
  display: "swap",
});

export const metadata: Metadata = {
  metadataBase: new URL("https://footholdsystems.com"),
  title: {
    default: "The 5 Levels of AI for Small Business | Foothold Systems",
    template: "%s | Foothold Systems",
  },
  description:
    "If you run a small business, everybody says you should use AI. Nobody says what that means. The plain-English version for owners: five levels, find yours in ten minutes, then find out what staying there is costing you. A free guide from Foothold Systems.",
  openGraph: {
    type: "website",
    locale: "en_US",
    siteName: "Foothold Systems",
    title: "The 5 Levels of AI | Foothold Systems",
    description:
      "The plain-English version. Five levels. Find yours in ten minutes. Free guide.",
    url: "/",
    images: [
      {
        url: "/images/foothold-mark.png",
        width: 1080,
        height: 1080,
        alt: "Foothold Systems",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
  },
  robots: {
    index: true,
    follow: true,
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body
        className={`${sourceSerif.variable} ${inter.variable} ${jetbrainsMono.variable} ${archivo.variable} antialiased`}
      >
        {children}
        {/* Meta (Facebook) Pixel base code */}
        <Script id="meta-pixel" strategy="afterInteractive">
          {`!function(f,b,e,v,n,t,s){if(f.fbq)return;n=f.fbq=function(){n.callMethod?n.callMethod.apply(n,arguments):n.queue.push(arguments)};if(!f._fbq)f._fbq=n;n.push=n;n.loaded=!0;n.version='2.0';n.queue=[];t=b.createElement(e);t.async=!0;t.src=v;s=b.getElementsByTagName(e)[0];s.parentNode.insertBefore(t,s)}(window,document,'script','https://connect.facebook.net/en_US/fbevents.js');fbq('init','1460434995827375');fbq('track','PageView');`}
        </Script>
        <noscript>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            height="1"
            width="1"
            style={{ display: "none" }}
            src="https://www.facebook.com/tr?id=1460434995827375&ev=PageView&noscript=1"
            alt=""
          />
        </noscript>
      </body>
    </html>
  );
}
