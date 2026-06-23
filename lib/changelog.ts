export const APP_VERSION = "1.1.0";

export interface ChangelogEntry {
  version: string;
  date: string;
  title: string;
  items: { type: "new" | "fix" | "improve"; text: string }[];
}

export const CHANGELOG: ChangelogEntry[] = [
  {
    version: "1.1.0",
    date: "23 giu 2025",
    title: "Tour guidato e sessione persistente",
    items: [
      { type: "new", text: "Tour interattivo al primo accesso: ti guida attraverso dashboard, piano e profilo" },
      { type: "new", text: "Accesso persistente — puoi scegliere «Ricordami» nel login per non inserire la password ogni volta" },
      { type: "new", text: "Pagina di registrazione: avviso sui prerequisiti (account Intervals.icu e dispositivi collegati)" },
      { type: "improve", text: "Il tour viene mostrato una sola volta per account, non per dispositivo" },
    ],
  },
];

export const LATEST = CHANGELOG[0];
