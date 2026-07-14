import "server-only";

export interface ConsentStatusProvider {
  hasCurrentConsent(userId: string): Promise<boolean>;
}

/** Story 3.1 replaces this fail-closed placeholder with the acceptance-record query. */
export const productionConsentStatusProvider: ConsentStatusProvider = {
  async hasCurrentConsent() {
    return false;
  },
};
