import type { Metadata } from "next";
import { Outfit } from "next/font/google";
import "./globals.css";
import { cn } from "@/lib/utils";
import { TooltipProvider } from "@/components/ui/tooltip";

const fontSans = Outfit({
  subsets: ["latin"],
  variable: "--font-outfit",
});

export const metadata: Metadata = {
  title: "Dispatch",
  description: "Agent Dispatch Pentester",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className="dark">
      <body className={cn(fontSans.variable, "font-sans antialiased")}>
        <TooltipProvider delay={300}>{children}</TooltipProvider>
      </body>
    </html>
  );
}
