// Tutte le stringhe dell'interfaccia, in italiano.
export const it = {
  appName: 'Finanze',
  tabs: {
    envelopes: 'Buste',
    movements: 'Movimenti',
    add: 'Aggiungi spesa',
    history: 'Storico',
    settings: 'Imposta',
  },
  nav: {
    main: 'Navigazione principale',
    close: 'Chiudi',
  },
  screens: {
    home: { title: 'Buste', placeholder: 'Qui arriveranno le buste del mese (M2).' },
    entry: { title: 'Nuova spesa', placeholder: 'Qui arriverà l’inserimento rapido (M2).' },
    movements: { title: 'Movimenti', placeholder: 'Qui arriverà la lista dei movimenti (M2).' },
    history: { title: 'Storico', placeholder: 'Qui arriveranno grafico e tabella dei mesi passati (M7).' },
    settings: { title: 'Buste', placeholder: 'Qui arriveranno tetti, giorno di inizio mese e backup (M7).' },
    closing: { title: 'Chiudi il mese', placeholder: 'Qui arriverà la chiusura del mese (M3).' },
    opening: { title: 'Inizia il mese', placeholder: 'Qui arriverà l’inizio del mese con i giroconti (M3).' },
    loans: { title: 'Prestiti', placeholder: 'Qui arriveranno i prestiti da riavere (M6).' },
    recurring: { title: 'Abbonamenti', placeholder: 'Qui arriveranno gli abbonamenti (M5).' },
  },
} as const;
