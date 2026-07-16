import type { AccountState } from "@/shared/account-states";
export const ambassadorCopy = {
  brand: "Stena Content Portal", heading: "Ambassadörer", detailHeading: "Ambassadör", navigationLabel: "Adminnavigation", mobileNavigationLabel: "Adminmeny", rosterLink: "Ambassadörer",
  emptyHeading: "Inga ambassadörer än", emptyBody: "När ambassadörer har bjudits in visas de här.", missingName: "Namn saknas", missingValue: "Saknas", never: "Aldrig",
  name: "Namn", email: "E-post", mobile: "Mobil", state: "Kontostatus", activity: "Senaste inloggning", nextPage: "Nästa sida", invalidPage: "Sidan kunde inte visas. Gå tillbaka till ambassadörslistan.", backToRoster: "Till ambassadörslistan",
  stalePage: "Det finns inga ambassadörer kvar på den här sidan. Gå tillbaka till början av listan.",
  inviteHeading: "Bjud in ambassadör", inviteBody: "Skicka en lösenordsfri inbjudan. Vi visar när utskicket har accepterats för leverans, inte när det har levererats.",
  fullName: "Fullständigt namn", mobileOptional: "Mobil (valfritt)", inviteSubmit: "Skicka inbjudan", invitePending: "Skickar inbjudan…",
  inviteAccepted: "Inbjudan har accepterats för leverans. Leveransen är ännu inte bekräftad.", inviteFailed: "Inbjudan kunde inte skickas. Uppgifterna finns kvar så att du kan försöka igen.",
  inviteConflict: "Det finns redan ett konto med den e-postadressen.", required: "Fältet måste fyllas i.", invalidEmail: "Ange en giltig e-postadress.", invalidMobile: "Ange ett giltigt mobilnummer.", tooLong: "Värdet är för långt.",
  validationFailed: "Kontrollera uppgifterna och försök igen.",
  today: "I dag", yesterday: "I går", future: "Framtida tid", daysAgo: (days: number) => `${days} dagar sedan`,
} as const;
export const accountStateCopy: Record<AccountState, string> = { invited: "Inbjuden", active: "Aktiv", inactive_declined: "Har avböjt villkor", inactive_withdrawn: "Har återkallat samtycke", deactivated: "Avaktiverad" };
export function displayOptional(value: string | null): string | null { return value?.trim() ? value : null; }
