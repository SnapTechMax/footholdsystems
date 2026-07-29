import type { Metadata } from "next";
import { Source_Serif_4, Inter, JetBrains_Mono, Archivo } from "next/font/google";
import Script from "next/script";
import { Header } from "@/components/Header";
import { Footer } from "@/components/Footer";
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

// GA4 Measurement ID for THIS domain (footholdsystems.com), its own GA4
// property — kept separate from snaptechrepair.com's property so the two
// domains' traffic is never merged. Env var overrides the default if set.
const GA_MEASUREMENT_ID =
  process.env.NEXT_PUBLIC_GA_MEASUREMENT_ID || "G-3G72HMB7VK";

export const metadata: Metadata = {
  metadataBase: new URL("https://footholdsystems.com"),
  title: {
    default: "AI Integration for Small Business | Foothold Systems",
    template: "%s | Foothold Systems",
  },
  description:
    "Foothold Systems sets up AI for small businesses, in plain English. The right tool, built for how your shop really runs, and looked after once it's live. Start with our free guide, The 5 Levels of AI.",
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
  verification: {
    other: {
      "facebook-domain-verification": "py2hzh8r29da4ahuedxx8v15jjsk05",
    },
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
        <Header />
        {children}
        <Footer />
        {/* Google Analytics 4 — footholdsystems.com property only */}
        {GA_MEASUREMENT_ID && (
          <>
            <Script
              src={`https://www.googletagmanager.com/gtag/js?id=${GA_MEASUREMENT_ID}`}
              strategy="afterInteractive"
            />
            <Script id="ga4" strategy="afterInteractive">
              {`
                window.dataLayer = window.dataLayer || [];
                function gtag(){dataLayer.push(arguments);}
                gtag('js', new Date());
                gtag('config', '${GA_MEASUREMENT_ID}');
              `}
            </Script>
          </>
        )}
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
