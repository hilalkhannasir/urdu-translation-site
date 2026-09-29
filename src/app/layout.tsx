import type { Metadata } from "next";
import { Fraunces, Manrope, Noto_Nastaliq_Urdu } from "next/font/google";
import "./globals.css";

const fraunces = Fraunces({
  subsets: ["latin"],
  variable: "--font-fraunces",
  display: "swap",
});

const manrope = Manrope({
  subsets: ["latin"],
  variable: "--font-manrope",
  display: "swap",
});

const notoNastaliq = Noto_Nastaliq_Urdu({
  subsets: ["arabic"],
  variable: "--font-noto-nastaliq",
  weight: ["400", "700"],
  display: "swap",
});

export const metadata: Metadata = {
  title: "Qalam — English to Urdu Translation",
  description:
    "Upload a PDF or text file, or paste English, then translate to Urdu with selectable models.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body
        className={`${fraunces.variable} ${manrope.variable} ${notoNastaliq.variable} antialiased`}
        style={
          {
            "--font-display": "var(--font-fraunces), serif",
            "--font-body": "var(--font-manrope), sans-serif",
            "--font-urdu": "var(--font-noto-nastaliq), serif",
          } as React.CSSProperties
        }
      >
        {children}
      </body>
    </html>
  );
}
