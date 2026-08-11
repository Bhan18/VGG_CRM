
"use client";

import { createContext, useContext, type ReactNode } from "react";
import { useSupabaseData } from "@/hooks/use-supabase-data";

type DataState = ReturnType<typeof useSupabaseData>;

const DataContext = createContext<DataState | undefined>(undefined);

export function DataProvider({ children }: { children: ReactNode }) {
  const data = useSupabaseData();
  return <DataContext.Provider value={data}>{children}</DataContext.Provider>;
}

export function useData(): DataState {
  const ctx = useContext(DataContext);
  if (!ctx) throw new Error("useData must be used within DataProvider");
  return ctx;
}


