import type { Metadata } from "next";
import { Outfit, Inter } from "next/font/google";
import "./globals.css";

const outfit = Outfit({
  variable: "--font-outfit",
  subsets: ["latin"],
  weight: ["300", "400", "500", "600", "700", "800"],
});

const inter = Inter({
  variable: "--font-inter",
  subsets: ["latin"],
  weight: ["300", "400", "500", "600", "700"],
});

export const metadata: Metadata = {
  title: "ALGO-RHYTHM | CSE Fresher Party 2026 🎉",
  description: "Official registration and digital ticket portal for ALGO-RHYTHM - School of Computing and Artificial Intelligence annual Fresher Party 2026. Register now to secure your entry!",
  openGraph: {
    title: "ALGO-RHYTHM | CSE Fresher Party 2026 🎉",
    description: "Official registration and digital ticket portal for ALGO-RHYTHM - CSE Fresher Party 2026. Baldev Raj Mittal Unipolis, 9 September 2026.",
    type: "website",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className={`${outfit.variable} ${inter.variable} h-full antialiased`}>
      <body className="min-h-full flex flex-col font-sans bg-[#060214] text-[#f8fafc] selection:bg-purple-500/30 selection:text-purple-200">
        
        {/* Deep background ambient glowing blobs */}
        <div className="fixed inset-0 -z-50 overflow-hidden bg-[#060214]">
          <div className="absolute top-[-10%] left-[-10%] h-[500px] w-[500px] rounded-full bg-purple-900/20 blur-[120px] pointer-events-none" />
          <div className="absolute bottom-[10%] right-[-10%] h-[600px] w-[600px] rounded-full bg-pink-900/10 blur-[150px] pointer-events-none" />
          <div className="absolute top-[45%] right-[10%] h-[400px] w-[400px] rounded-full bg-blue-900/15 blur-[100px] pointer-events-none" />
        </div>

        {children}
      </body>
    </html>
  );
}
