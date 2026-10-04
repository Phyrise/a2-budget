/**
 * Types du Calendrier commun (V3.2) : les événements partagés du couple
 * (dîner prévu, repas chez des amis, anniversaire…).
 *
 * UNITÉS / CONVENTIONS :
 * - `date` : clé locale « YYYY-MM-DD » (fuseau de l'utilisateur, jamais UTC).
 * - `time` / `endTime` : heure locale « HH:MM » sur 24 h (00:00..23:59).
 * - `createdAt` : horodatage ISO 8601 (new Date().toISOString()).
 * Sémantique et cas limites : docs/DOMAIN_CONTRACTS.md §12.
 */

/** Nature d'un événement (sert à l'icône et à la couleur douce). */
export type CalendarEventKind =
  | 'repas'
  | 'sortie'
  | 'anniversaire'
  | 'rdv'
  | 'voyage'
  | 'maison'
  | 'autre';

/** Pour qui est l'événement : A, B ou les deux. */
export type CalendarWho = 'a' | 'b' | 'both';

/** Un événement du calendrier commun. */
export interface CalendarEvent {
  /** Identifiant stable, unique dans le calendrier. */
  id: string;
  /** Titre (nettoyé, non vide, au plus CALENDAR_TITLE_MAX caractères). */
  title: string;
  /** Jour « YYYY-MM-DD » (pour un événement annuel : la date d'origine). */
  date: string;
  /**
   * Heure de début « HH:MM ». Requise si `allDay` est faux, absente sinon.
   */
  time?: string;
  /**
   * Heure de fin « HH:MM » (seulement avec `time`, différente de `time`).
   * Une fin antérieure au début signifie « se termine après minuit ».
   */
  endTime?: string;
  /** Journée entière (sans heure). */
  allDay: boolean;
  kind: CalendarEventKind;
  who: CalendarWho;
  /** Lieu (facultatif, nettoyé). */
  place?: string;
  /** Petite note (facultative, retours à la ligne conservés). */
  note?: string;
  /**
   * Se répète chaque année à la même date (anniversaires). Un 29 février
   * tombe le 28 février les années non bissextiles. Jamais avant l'année
   * d'origine.
   */
  yearly?: boolean;
  /**
   * L'année d'origine est-elle réellement connue ? Vrai : anniversaire saisi
   * avec l'année de naissance (un âge peut être affiché). Faux : seuls le
   * mois et le jour comptent (aucun âge, même si l'année d'origine est
   * passée, ex. un 29 février rangé sur la dernière année bissextile).
   * Absent (données d'avant) : déduit, connue si l'année d'origine précède
   * l'année de création.
   */
  yearKnown?: boolean;
  /** Horodatage ISO de création. */
  createdAt: string;
}

/** État du calendrier (optionnel dans AppState). Au plus CALENDAR_EVENTS_MAX. */
export interface CalendarState {
  events: CalendarEvent[];
}

/**
 * Une occurrence datée d'un événement (un événement annuel produit une
 * occurrence par année, à partir de l'année d'origine).
 */
export interface CalendarOccurrence {
  event: CalendarEvent;
  /** Jour de l'occurrence « YYYY-MM-DD ». */
  date: string;
  /**
   * Événements annuels seulement : nombre d'années depuis la date d'origine
   * (0 l'année d'origine). Ex. : un anniversaire de rencontre → « 5 ans ».
   */
  years?: number;
}
