import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { createTRPCClient, httpBatchLink } from "@trpc/client";
import { Stack } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { useState } from "react";
import type { AppRouter } from "@pip/api";
import { TRPCProvider } from "@/trpc/client";

// In development, point to the local web app's API.
// In production, set EXPO_PUBLIC_API_URL to your deployed URL.
const API_URL = process.env.EXPO_PUBLIC_API_URL ?? "http://localhost:3000";

const queryClient = new QueryClient({
  defaultOptions: {
    queries: { staleTime: 60 * 1000 },
  },
});

export default function RootLayout() {
  const [trpcClient] = useState(() =>
    createTRPCClient<AppRouter>({
      links: [httpBatchLink({ url: `${API_URL}/api/trpc` })],
    }),
  );

  return (
    <QueryClientProvider client={queryClient}>
      <TRPCProvider trpcClient={trpcClient} queryClient={queryClient}>
        <StatusBar style="light" />
        <Stack
          screenOptions={{
            headerStyle: { backgroundColor: "#111827" },
            headerTintColor: "#f9fafb",
            contentStyle: { backgroundColor: "#030712" },
          }}
        />
      </TRPCProvider>
    </QueryClientProvider>
  );
}
