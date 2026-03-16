import { mockFinanceProvider } from "./mock-provider";
import type { FinanceProvider, FinanceProviderId } from "./provider";

const providers: Record<FinanceProviderId, FinanceProvider> = {
  mock: mockFinanceProvider,
};

export function getFinanceProvider(id: FinanceProviderId): FinanceProvider {
  return providers[id];
}

export { type FinanceProviderId } from "./provider";

