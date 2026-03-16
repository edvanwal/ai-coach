export type FinanceProviderId = "mock";

export interface FinanceAccountDTO {
  externalId: string;
  name: string;
  ibanMasked?: string;
  currency: string;
  balanceCents: number;
}

export interface FinanceTransactionDTO {
  externalId: string;
  accountExternalId: string;
  bookedAtISO: string;
  description: string;
  amountCents: number;
  currency: string;
  merchant?: string;
  category?: string;
}

export interface FinanceProvider {
  id: FinanceProviderId;
  displayName: string;

  // Read-only MVP: haal accounts + transacties op (sinds datum)
  fetchAccounts(profileId: string): Promise<FinanceAccountDTO[]>;
  fetchTransactions(profileId: string, sinceISO: string): Promise<FinanceTransactionDTO[]>;
}

