/**
 * ns inspect — Full form graph inspection.
 *
 * Usage:
 *   ns inspect                    → inspect all fields + form mode
 *   ns inspect --field companyname → inspect single field
 *   ns inspect --sublists         → include sublist discovery from DOM
 *
 * Introspects fields via nlapiGetField / nlapiGetFieldValue / nlapiGetFieldText,
 * detects form mode from URL, and optionally discovers sublists from the DOM
 * (table headers, line counts, line values).
 */

import type { BrowserManager } from '../../core/browser-manager';
import type { NsCommandOutput } from '../format';
import { formatNsError, truncateValue } from '../format';
import type { NsResult } from '../errors';
import type { NsFieldMetadata, NsFormMode } from '../utils/introspect-field';
import { guardNsApi } from '../errors';
import { introspectField, introspectAllFields, detectFormMode } from '../utils/introspect-field';
import { withMutex, nsMutex } from '../mutex';

// ─── Types ──────────────────────────────────────────────────

export interface NsSublistColumn {
  id: string;
  label: string;
}

export interface NsSublistLine {
  line: number;
  values: Record<string, string>;
}

export interface NsSublistData {
  id: string;
  columns: NsSublistColumn[];
  lineCount: number;
  lines: NsSublistLine[];
}

export interface NsInspectData {
  mode: NsFormMode;
  fields: NsFieldMetadata[];
  sublists?: NsSublistData[];
}

// ─── Field Filtering ───────────────────────────────────────

/** Prefix patterns — always internal NetSuite plumbing */
const FILTERED_PREFIXES = [
  'hddn_', 'indx_', 'inpt_', 'custpage_',
  // payment/CC processor internals (gateway handshake, not settable record fields)
  'payment', 'cc',
  // shipping rate engine coefficients (you set shipmethod/shippingcost, not these)
  'byweight', 'handling',
];

/** Exact IDs — UI state, session context, navigation, internal scaffolding */
const FILTERED_IDS = new Set([
  // search widget
  'quickfind-field',
  // button container (individual buttons are tagged, not filtered)
  'multibuttonsubmit',
  // UI state
  'selectedtab', 'nsbrowserenv', 'formdisplayview',
  'activitiesloaded', 'activitiesdotted', 'clickedback', 'submitted', 'bulk',
  // session context
  'nluser', 'nlrole', 'nldept', 'nlloc', 'nlsub',
  // navigation plumbing
  'whence', 'customwhence', 'entryformquerystring',
  'extraurlparams', 'wfinstances', 'dbstrantype',
  // address subrecord scaffolding
  'previous_billaddresslist', 'previous_shipaddresslist',
  'billingaddress2_set', 'billingaddress_key', 'billingaddress_type', 'billingaddress_defaultvalue',
  'shippingaddress2_set', 'shippingaddress_key', 'shippingaddress_type', 'shippingaddress_defaultvalue',
  // payment/CC (non-prefix catches)
  'cardswipe', 'maskedcard', 'customercode', 'ispurchasecard',
  'ispaymethundepfunds', 'paymethacct', 'paymethtype',
  'allowemptycards', 'profilesupportslineleveldata', 'methodrequireslineleveldata',
  'ignoreavs', 'ignoreavsvis', 'ignorecsc', 'ignorecscvis',
  'carddataprovided', 'signaturerequired', 'isrecurringpayment',
  'authorizedamount', 'collectedamount', 'reimbursedamount',
  'inputpnrefnum', 'overridehold', 'overrideholdchecked',
  'debitpinblock', 'debitksn',
  'request', 'response', 'redirecturl', 'returnurl', 'datafromredirect',
  'shopperprintblock', 'merchantprintblock',
  // shipping calc engine
  'doshippingrecalc', 'fedexservicename', 'hasfedexfreightservice',
  'shipping_rate', 'shipping_cost_function', 'flatrateamt',
  'peritemdefaultprice', 'percentoftotalamt', 'shippingerrormsg',
  'shipping_btaxable', 'handling_btaxable',
  'shandlingcostfunction', 'shandlingaccount',
  'bfreeifoveractive', 'rfreeifoveramt',
  'bminshipcostactive', 'rminshipamt', 'bmaxshipcostactive', 'rmaxshipcost',
  'shipitemhasfreeshippingitems', 'binclallitemsforfreeshipping',
  'itemshippingcostfxrate', 'shippingcostoverridden', 'overrideshippingcost',
  // discount/tax internals
  'disctax1', 'disctax2', 'disctax1amt', 'disctax2amt',
  'discountistaxable', 'discountastotal',
  'tax_affecting_address_fields_before_recalc',
  'taxamountoverride', 'taxamount2override',
  'shippingtax1amt', 'shippingtax2amt', 'handlingtax1amt', 'handlingtax2amt',
  // boolean state flags (read-only form scaffolding)
  'templatestored', 'isonlinetransaction', 'oldrevenuecommitment', 'iseitf81on',
  'checkcommitted', 'haslines', 'canbeunapproved', 'canhavestackable',
  'suppressusereventsandemails', 'updatedropshiporderqty', 'isdefaultshippingrequest',
  'locationusesbins', 'inventorydetailuitype',
  'shadow_shipaddress', 'address_country_state_map', 'bnopostmain',
]);

/** Button IDs — tagged [button] instead of filtered */
const BUTTON_IDS = new Set([
  'btn_multibutton_submitter', 'submitter', 'submitfulfill', 'submitnew',
  'saveprint', 'saveemail', 'memorize', 'gotoregister',
]);

function isFiltered(id: string): boolean {
  if (FILTERED_IDS.has(id)) return true;
  for (const prefix of FILTERED_PREFIXES) {
    if (id.startsWith(prefix)) return true;
  }
  return false;
}

/** Bucket labels shown as section headers in output */
const BUCKET_LABELS: Record<number, string> = {
  1: 'Must fill',
  2: 'Can fill',
  3: 'Buttons',
  4: 'Read-only',
  5: 'Other',
  6: 'Other',
};

function fieldBucket(f: NsFieldMetadata): number {
  const isButton = BUTTON_IDS.has(f.id);
  const hasLabel = !!f.label;
  const editable = !f.disabled;
  if (isButton) return 3;
  if (hasLabel && editable && f.mandatory) return 1;
  if (hasLabel && editable) return 2;
  if (hasLabel && !editable) return 4;
  if (!hasLabel && editable) return 5;
  return 6;
}

/**
 * Group fields by actionability bucket, preserving DOM order within each bucket.
 * Returns groups in bucket order, each with a label and field list.
 */
function groupByBucket(fields: NsFieldMetadata[]): Array<{ label: string; fields: NsFieldMetadata[] }> {
  const buckets = new Map<number, NsFieldMetadata[]>();
  for (const f of fields) {
    const b = fieldBucket(f);
    if (!buckets.has(b)) buckets.set(b, []);
    buckets.get(b)!.push(f);
  }
  // Merge buckets 5+6 into a single "Other" group
  const b5 = buckets.get(5) ?? [];
  const b6 = buckets.get(6) ?? [];
  const merged = [...b5, ...b6];
  buckets.delete(5);
  buckets.delete(6);
  if (merged.length > 0) buckets.set(5, merged);

  const groups: Array<{ label: string; fields: NsFieldMetadata[] }> = [];
  for (const key of [1, 2, 3, 4, 5]) {
    const items = buckets.get(key);
    if (items && items.length > 0) {
      groups.push({ label: BUCKET_LABELS[key], fields: items });
    }
  }
  return groups;
}

// ─── Arg Parsing ────────────────────────────────────────────

function parseInspectArgs(args: string[]): { fieldId: string | null; sublists: boolean; all: boolean } {
  let fieldId: string | null = null;
  let sublists = false;
  let all = false;

  for (let i = 0; i < args.length; i++) {
    const arg = args[i];
    if (arg === '--field') {
      fieldId = args[++i] ?? null;
    } else if (arg === '--sublists') {
      sublists = true;
    } else if (arg === '--all') {
      all = true;
    }
  }

  return { fieldId, sublists, all };
}

// ─── ns inspect ─────────────────────────────────────────────

export async function nsInspect(args: string[], bm: BrowserManager): Promise<NsCommandOutput> {
  const result = await withMutex(nsMutex, async (): Promise<NsResult<NsInspectData>> => {
    const target = bm.getActiveFrameOrPage();

    // Guard: must be on a NS page with client API
    const guardErr = await guardNsApi(target);
    if (guardErr) {
      return { ok: false as const, error: guardErr };
    }

    const { fieldId, sublists: includeSublists, all: showAll } = parseInspectArgs(args);

    // Detect form mode
    const mode = await detectFormMode(target);

    // Introspect fields
    let fields: NsFieldMetadata[];
    if (fieldId) {
      const single = await introspectField(target, fieldId);
      fields = single ? [single] : [];
    } else {
      fields = await introspectAllFields(target);
    }

    // Optionally discover sublists from DOM
    let sublists: NsSublistData[] | undefined;
    if (includeSublists) {
      sublists = await discoverSublists(bm);
    }

    const data: NsInspectData = {
      mode,
      fields,
      ...(sublists ? { sublists } : {}),
    };

    return { ok: true as const, data };
  }, { label: 'ns inspect', operationTimeoutMs: 10000 });

  if (!result.ok) {
    return { display: formatNsError('ns inspect', result.error!), ok: false };
  }

  const d = result.data!;
  const { all: showAll } = parseInspectArgs(args);

  // Filter plumbing fields unless --all or --field (single-field lookup is never filtered)
  const visible = (showAll || parseInspectArgs(args).fieldId)
    ? d.fields
    : d.fields.filter(f => !isFiltered(f.id));
  const filtered = d.fields.length - visible.length;

  // Group by actionability bucket, preserve DOM order within each bucket
  const groups = groupByBucket(visible);

  const header = filtered > 0
    ? `INSPECT OK | Mode: ${d.mode} | ${visible.length} fields (${filtered} internal hidden, use --all to show)`
    : `INSPECT OK | Mode: ${d.mode} | ${visible.length} fields`;
  const lines = [header];

  for (const group of groups) {
    lines.push('');
    lines.push(`── ${group.label} (${group.fields.length}) ──`);
    for (const f of group.fields) {
      const flags: string[] = [];
      if (f.mandatory) flags.push('mandatory');
      if (f.disabled) flags.push('disabled');
      if (f.isEntityRef) flags.push('entityRef');
      const prefix = BUTTON_IDS.has(f.id) ? '[button] ' : '';
      lines.push(`${prefix}${f.id} | ${f.label || '-'} | ${truncateValue(f.value)} | ${f.type} | ${flags.join(',') || '-'}`);
    }
  }

  if (d.sublists) {
    for (const sub of d.sublists) {
      lines.push(`Sublist: ${sub.id} (${sub.lineCount} lines, ${sub.columns.length} columns)`);
      for (const line of sub.lines) {
        const vals = sub.columns.map(c => `${c.id}=${truncateValue(line.values[c.id])}`).join(', ');
        lines.push(`  ${line.line}: ${vals}`);
      }
    }
  }

  return { display: lines.join('\n'), ok: true };
}

// ─── Sublist Discovery ──────────────────────────────────────

/**
 * Discover sublists from the DOM by finding sublist containers
 * (div[id$="_splits"], table.uir-machine-table), extract column
 * headers, then read line values via nlapi sublist APIs.
 */
async function discoverSublists(bm: BrowserManager): Promise<NsSublistData[]> {
  const page = bm.getPage();

  // Step 1: Discover sublist IDs and their column headers from the DOM
  const discovered = await page.evaluate(() => {
    const results: Array<{
      id: string;
      columns: Array<{ id: string; label: string }>;
    }> = [];

    const seen = new Set<string>();

    // Strategy A: div[id$="_splits"] containers (e.g. "item_splits" → sublist "item")
    const splitDivs = document.querySelectorAll('div[id$="_splits"]');
    for (const div of splitDivs) {
      const sublistId = div.id.replace(/_splits$/, '');
      if (seen.has(sublistId)) continue;
      seen.add(sublistId);

      // Extract column headers from the table inside the splits container
      const columns: Array<{ id: string; label: string }> = [];
      const headerCells = div.querySelectorAll('thead tr td.listheadertd, thead tr th.listheadertd');
      for (const cell of headerCells) {
        const headerDiv = cell.querySelector('.listheadertextb, .listheadertext');
        const label = headerDiv?.textContent?.trim() ?? cell.textContent?.trim() ?? '';
        if (label) {
          // Derive column ID from label (lowercase, no spaces) as best-effort
          const id = label.toLowerCase().replace(/[^a-z0-9]/g, '');
          columns.push({ id, label });
        }
      }

      results.push({ id: sublistId, columns });
    }

    // Strategy B: table.uir-machine-table not inside a _splits div
    const machineTables = document.querySelectorAll('table.uir-machine-table');
    for (const table of machineTables) {
      // Check if this table is already inside a discovered _splits container
      const parentSplits = table.closest('div[id$="_splits"]');
      if (parentSplits) continue; // Already discovered above

      // Try to derive a sublist ID from the table's parent or id
      const tableId = table.id || table.closest('[id]')?.id || '';
      const sublistId = tableId.replace(/_[a-z]+$/, '') || `unknown_${seen.size}`;
      if (seen.has(sublistId)) continue;
      seen.add(sublistId);

      const columns: Array<{ id: string; label: string }> = [];
      const headerCells = table.querySelectorAll('thead tr td.listheadertd, thead tr th.listheadertd');
      for (const cell of headerCells) {
        const headerDiv = cell.querySelector('.listheadertextb, .listheadertext');
        const label = headerDiv?.textContent?.trim() ?? cell.textContent?.trim() ?? '';
        if (label) {
          const id = label.toLowerCase().replace(/[^a-z0-9]/g, '');
          columns.push({ id, label });
        }
      }

      results.push({ id: sublistId, columns });
    }

    return results;
  });

  // Step 2: For each discovered sublist, read line counts and values via nlapi
  const sublists: NsSublistData[] = [];

  for (const sub of discovered) {
    const { lineCount, lines } = await page.evaluate(
      ({ sublistId, columnIds }: { sublistId: string; columnIds: string[] }) => {
        /* eslint-disable @typescript-eslint/no-explicit-any */
        const w = window as any;
        const count: number = typeof w.nlapiGetLineItemCount === 'function'
          ? (w.nlapiGetLineItemCount(sublistId) ?? 0)
          : 0;

        const lines: Array<{ line: number; values: Record<string, string> }> = [];
        if (typeof w.nlapiGetLineItemValue === 'function' && count > 0) {
          for (let i = 1; i <= count; i++) {
            const values: Record<string, string> = {};
            for (const colId of columnIds) {
              values[colId] = w.nlapiGetLineItemValue(sublistId, colId, i) ?? '';
            }
            lines.push({ line: i, values });
          }
        }

        return { lineCount: count, lines };
        /* eslint-enable @typescript-eslint/no-explicit-any */
      },
      { sublistId: sub.id, columnIds: sub.columns.map(c => c.id) },
    );

    sublists.push({
      id: sub.id,
      columns: sub.columns,
      lineCount,
      lines,
    });
  }

  return sublists;
}
