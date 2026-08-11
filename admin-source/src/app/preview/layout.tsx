
import type { Metadata } from "next";
import { Toaster } from "@/components/ui/toaster";
import { ThemeProvider } from "@/components/theme-provider";

export const metadata: Metadata = {
  title: "Preview — VGG CRM Fixes",
  description: "Preview mode for verifying sqyd pricing, edit-restore, corner config, and booking advance fixes.",
};

export default function PreviewLayout({ children }: { children: React.ReactNode }) {
  return (
    <ThemeProvider attribute="class" defaultTheme="light" enableSystem disableTransitionOnChange>
      {children}
      <Toaster />
    </ThemeProvider>
  );
}


