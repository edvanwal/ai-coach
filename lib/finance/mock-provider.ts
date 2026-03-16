import type { FinanceProvider, FinanceAccountDTO, FinanceTransactionDTO } from "./provider";

function daysAgoISO(days: number): string {
  const d = new Date();
  d.setDate(d.getDate() - days);
  return d.toISOString();
}

export const mockFinanceProvider: FinanceProvider = {
  id: "mock",
  displayName: "Demo bank (mock)",

  async fetchAccounts(_profileId: string): Promise<FinanceAccountDTO[]> {
    return [
      {
        externalId: "acc_main",
        name: "Betaalrekening",
        ibanMasked: "NL** **** **** 1234",
        currency: "EUR",
        balanceCents: 245_320,
      },
      {
        externalId: "acc_save",
        name: "Spaarrekening",
        ibanMasked: "NL** **** **** 9876",
        currency: "EUR",
        balanceCents: 1_250_000,
      },
    ];
  },

  async fetchTransactions(_profileId: string, sinceISO: string): Promise<FinanceTransactionDTO[]> {
    const since = new Date(sinceISO).getTime();
    const all: FinanceTransactionDTO[] = [
      {
        externalId: "tx_salary_1",
        accountExternalId: "acc_main",
        bookedAtISO: daysAgoISO(25),
        description: "Salaris",
        amountCents: 3_250_00,
        currency: "EUR",
        merchant: "Werkgever",
        category: "Inkomen",
      },
      {
        externalId: "tx_rent_1",
        accountExternalId: "acc_main",
        bookedAtISO: daysAgoISO(20),
        description: "Huur",
        amountCents: -1_150_00,
        currency: "EUR",
        merchant: "Woningcorporatie",
        category: "Wonen",
      },
      {
        externalId: "tx_grocery_1",
        accountExternalId: "acc_main",
        bookedAtISO: daysAgoISO(3),
        description: "Boodschappen",
        amountCents: -68_90,
        currency: "EUR",
        merchant: "Supermarkt",
        category: "Boodschappen",
      },
      {
        externalId: "tx_sub_1",
        accountExternalId: "acc_main",
        bookedAtISO: daysAgoISO(2),
        description: "Streaming abonnement",
        amountCents: -13_99,
        currency: "EUR",
        merchant: "Streaming",
        category: "Abonnementen",
      },
      {
        externalId: "tx_coffee_1",
        accountExternalId: "acc_main",
        bookedAtISO: daysAgoISO(1),
        description: "Koffie",
        amountCents: -4_50,
        currency: "EUR",
        merchant: "Koffietent",
        category: "Kleine uitgaven",
      },
      {
        externalId: "tx_saving_1",
        accountExternalId: "acc_save",
        bookedAtISO: daysAgoISO(5),
        description: "Overboeking sparen",
        amountCents: 200_00,
        currency: "EUR",
        merchant: "Eigen rekening",
        category: "Sparen",
      },
    ];

    return all.filter((t) => new Date(t.bookedAtISO).getTime() >= since);
  },
};

