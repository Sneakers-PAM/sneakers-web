import { ApiError, GraphQLRequestError } from "@sneakers-web/api-client";
import { QueryClient } from "@tanstack/react-query";

export const createQueryClient = (): QueryClient => {
  return new QueryClient({
    defaultOptions: {
      mutations: { retry: false },
      queries: { refetchOnWindowFocus: false, retry: shouldRetry, staleTime: 5000 },
    },
  });
};

/** Retry once for a blip, never for an answer the gateway meant (auth, permission, bad input). */
const shouldRetry = (failures: number, error: unknown): boolean => {
  if (failures >= 1) return false;
  if (error instanceof ApiError) return error.status >= 500;
  if (error instanceof GraphQLRequestError) {
    return error.grpcCode === "Unavailable" || error.grpcCode === "DeadlineExceeded";
  }
  return true;
};
