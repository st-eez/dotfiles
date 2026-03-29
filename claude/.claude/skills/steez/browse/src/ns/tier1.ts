/**
 * Tier 1: Universal NetSuite platform constants.
 *
 * Admission criteria: must be true across ALL NS accounts and versions.
 * These are the only hardcoded NS behaviors — everything else is discovered
 * at runtime via introspectField / DOM inspection.
 *
 * Each constant includes a `reason` explaining WHY it's safe to hardcode.
 */

// ─── 1. Entity-Ref Sourcing Cascades ────────────────────────
//
// When an entity-ref field (customer, vendor, employee, etc.) is set,
// NetSuite fires a sourcing cascade that auto-populates dependent fields
// (address, terms, currency, tax code, etc.). This is fundamental to
// how NS record forms work — it's the platform's core data-binding mechanism.

export const ENTITY_REF_SOURCING = {
  reason: 'Entity-ref cascading is the core NS data-binding mechanism — always fires on set',
  /** Setting an entity-ref MUST use fireSlavingWhenever = false (don't suppress sourcing) */
  suppressCascade: false,
  /** Expected settle time range (ms) — cascades take 500ms-3s depending on network/complexity */
  settleRange: { minMs: 500, maxMs: 5000 },
  /** Fields that commonly trigger cascading (not exhaustive — runtime detection is authoritative) */
  commonTriggers: ['entity', 'customer', 'vendor', 'employee', 'contact', 'subsidiary'] as const,
} as const;

// ─── 2. Rate/Pricing Independence ───────────────────────────
//
// The `rate` field on transaction lines is NOT always sourced from item pricing.
// Custom pricing, price levels, quantity breaks, and manual overrides all mean
// the rate can diverge from the item's base price. NS commands must never assume
// rate == item price.

export const RATE_PRICING = {
  reason: 'Rate can be manually overridden, use custom pricing, or come from price levels',
  /** Rate field may differ from item base price — always read the actual value */
  alwaysReadActual: true,
  /** After setting an item, rate may be sourced — wait for settle before reading */
  requiresSettleAfterItemSet: true,
} as const;

// ─── 3. PO Line Location Independence ──────────────────────
//
// Purchase Order line items have their own `location` field that is
// independent of the header-level location. Setting header location
// does NOT cascade to existing lines (only new lines may inherit it).

export const PO_LINE_LOCATION = {
  reason: 'PO line locations are independent of header — platform design for multi-location receiving',
  /** Header location changes do NOT cascade to existing line locations */
  headerCascadesToLines: false,
  /** Each line must be set individually */
  lineFieldId: 'location',
} as const;

// ─── 4. Dialog Patterns ─────────────────────────────────────
//
// NetSuite uses two categories of dialogs with very different semantics:
// - Informational: alerts/warnings that don't block the operation
// - Blocking: confirms that require a decision before proceeding
//
// The command layer must handle these differently — informational dialogs
// should be captured but not interrupt flow; blocking dialogs need explicit handling.

export const DIALOG_PATTERNS = {
  reason: 'NS uses both informational alerts and blocking confirms — must handle differently',

  /** Informational dialogs: capture and continue */
  informational: {
    /** These dialog types are informational — auto-accept and continue */
    types: ['alert'] as const,
    /** Common message patterns for informational dialogs */
    messagePatterns: [
      /has been updated/i,
      /successfully/i,
      /saved/i,
      /created/i,
    ],
  },

  /** Blocking dialogs: require explicit handling */
  blocking: {
    /** These dialog types may block — pause for decision */
    types: ['confirm', 'beforeunload'] as const,
    /** Common message patterns for blocking dialogs */
    messagePatterns: [
      /are you sure/i,
      /record has been changed/i,
      /unsaved changes/i,
      /do you want to/i,
      /will be lost/i,
    ],
  },

  /** DOM-based error selectors (not native dialogs) */
  domErrorSelectors: [
    '#_err_alert',
    '.uir-message-error',
    '.uir-message-warning',
    '.x-window',
  ] as const,
} as const;

// ─── 5. Standard Sublists Per Record Type ───────────────────
//
// While custom sublists can be added via SuiteScript, these standard sublists
// exist on every account for their respective record types. Runtime discovery
// (DOM-based) is authoritative, but these constants provide a baseline for
// validation and fallback.

export const STANDARD_SUBLISTS = {
  reason: 'Standard sublists are part of the NS platform — present on all accounts',
  byRecordType: {
    salesorder:       ['item', 'partners', 'salesteam', 'links'],
    purchaseorder:    ['item', 'expense', 'links'],
    invoice:          ['item', 'partners', 'salesteam', 'links'],
    vendorbill:       ['item', 'expense', 'links'],
    customer:         ['addressbook', 'contactroles', 'currency', 'submachine'],
    vendor:           ['addressbook', 'contactroles', 'currency'],
    employee:         ['addressbook', 'roles', 'hcmposition'],
    journalentry:     ['line'],
    creditmemo:       ['item', 'apply'],
    returnauthorization: ['item'],
    transferorder:    ['item'],
    itemfulfillment:  ['item', 'package'],
    itemreceipt:      ['item'],
    estimate:         ['item', 'partners', 'salesteam'],
    opportunity:      ['item', 'partners', 'salesteam'],
  } as const,
} as const;

/** All known record types with standard sublists */
export type NsRecordType = keyof typeof STANDARD_SUBLISTS.byRecordType;

// ─── 6. Record Type URL Map ─────────────────────────────────
//
// NetSuite uses a consistent URL pattern for record pages:
//   /app/accounting/transactions/<type>.nl  (transactions)
//   /app/common/entity/<type>.nl            (entities)
//   /app/common/custom/<type>.nl            (custom records)
//
// The record type identifiers in URLs are stable across NS versions.

export const RECORD_URL_MAP = {
  reason: 'NS URL structure is a stable platform convention across all accounts',

  /** URL path segments for transaction record types */
  transactions: {
    salesorder:        'salesord',
    purchaseorder:     'purchord',
    invoice:           'custinvc',
    vendorbill:        'vendbill',
    journalentry:      'journal',
    creditmemo:        'credmemo',
    returnauthorization: 'rtnauth',
    transferorder:     'trnfrord',
    itemfulfillment:   'itemship',
    itemreceipt:       'itemrcpt',
    estimate:          'estimate',
    opportunity:       'opprtnty',
    cashsale:          'cashsale',
    check:             'check',
    deposit:           'deposit',
    expensereport:     'exprept',
  } as const,

  /** URL path segments for entity record types */
  entities: {
    customer:  'custjob',
    vendor:    'vendor',
    employee:  'employee',
    contact:   'contact',
    partner:   'partner',
    lead:      'lead',
    prospect:  'prospect',
  } as const,

  /** Build a URL for navigating to a record */
  buildUrl(type: string, id?: number | string, edit?: boolean): string {
    const txnSlug = (RECORD_URL_MAP.transactions as Record<string, string>)[type];
    const entitySlug = (RECORD_URL_MAP.entities as Record<string, string>)[type];

    let path: string;
    if (txnSlug) {
      path = `/app/accounting/transactions/${txnSlug}.nl`;
    } else if (entitySlug) {
      path = `/app/common/entity/${entitySlug}.nl`;
    } else {
      // Fallback: try custom record pattern
      path = `/app/common/custom/custrecord${type}.nl`;
    }

    const params: string[] = [];
    if (id !== undefined) params.push(`id=${id}`);
    if (edit) params.push('e=T');

    return params.length > 0 ? `${path}?${params.join('&')}` : path;
  },
} as const;
