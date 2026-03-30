/**
 * Shared field introspection via NetSuite client-side APIs.
 *
 * Runs page.evaluate() to call nlapiGetField / nlapiGetFieldValue / etc.
 * Detects entity-ref fields by checking for `_display` companion element.
 * Extracts dropdown options via getSelectOptions() on select/multiselect fields.
 *
 * Used by: ns inspect (all fields), ns set (type detection for cascading decision).
 */

import type { Page, Frame } from 'playwright';

// ─── Types ──────────────────────────────────────────────────

export interface NsFieldMetadata {
  id: string;
  label: string;
  type: string;
  mandatory: boolean;
  disabled: boolean;
  value: string | null;
  displayValue: string | null;
  isEntityRef: boolean;
  options?: Array<{ value: string; text: string }>;
}

// ─── Single-field introspection ─────────────────────────────

/**
 * Introspect a single field by ID. Returns null if the field doesn't exist
 * in the current form (nlapiGetField returns null for unknown IDs).
 */
export async function introspectField(
  target: Page | Frame,
  fieldId: string,
): Promise<NsFieldMetadata | null> {
  return target.evaluate((fid: string) => {
    /* eslint-disable @typescript-eslint/no-explicit-any */
    const w = window as any;
    const field = w.nlapiGetField?.(fid);
    if (!field) return null;

    const type: string = field.getType?.() ?? 'unknown';
    const label: string = field.getLabel?.() ?? '';
    const mandatory: boolean = !!field.isMandatory?.();
    const disabled: boolean = !!field.isDisabled?.();
    // Subrecord fields (billingaddress, shippingaddress) throw nlobjError on value access
    let value: string | null = null;
    let displayValue: string | null = null;
    try { value = w.nlapiGetFieldValue?.(fid) ?? null; } catch {}
    try { displayValue = w.nlapiGetFieldText?.(fid) ?? null; } catch {}

    // Entity-ref detection: NetSuite creates a hidden _display companion element
    const displayEl = document.getElementById(fid + '_display');
    const isEntityRef = displayEl !== null;

    // Dropdown options for select/multiselect fields
    let options: Array<{ value: string; text: string }> | undefined;
    if (type === 'select' || type === 'multiselect') {
      try {
        const raw = field.getSelectOptions?.() ?? [];
        options = raw.map((opt: any) => ({
          value: String(opt.id ?? opt.value ?? ''),
          text: String(opt.text ?? ''),
        }));
      } catch {
        // getSelectOptions can throw on certain field types — skip
      }
    }

    return {
      id: fid,
      label,
      type,
      mandatory,
      disabled,
      value,
      displayValue,
      isEntityRef,
      ...(options ? { options } : {}),
    };
    /* eslint-enable @typescript-eslint/no-explicit-any */
  }, fieldId);
}

// ─── Batch introspection (all fields on the page) ───────────

/**
 * Discover and introspect all fields currently on the form.
 * Uses the NetSuite field array (nlapiGetLineItemField is separate — sublists).
 *
 * Strategy: enumerate fields from the form's hidden `__FIELD_NAMES__` input,
 * falling back to scanning the DOM for elements with `id` attributes that
 * have corresponding nlapiGetField results.
 */
export async function introspectAllFields(
  target: Page | Frame,
): Promise<NsFieldMetadata[]> {
  // Step 1: Discover field IDs in-page
  const fieldIds = await target.evaluate(() => {
    /* eslint-disable @typescript-eslint/no-explicit-any */
    const w = window as any;
    const ids = new Set<string>();

    // Strategy A: nlapiGetFieldIds() — available in some NS versions
    if (typeof w.nlapiGetFieldIds === 'function') {
      const raw = w.nlapiGetFieldIds() ?? [];
      for (const id of raw) ids.add(id);
    }

    // Strategy B: scan form fields via DOM (catches fields missing from API)
    const form = document.getElementById('main_form');
    if (form) {
      const els = form.querySelectorAll('[id]');
      for (const el of els) {
        const id = el.id;
        // Skip internal NetSuite elements (_fs, _display, _arrow, etc.)
        if (id.startsWith('_') || id.includes('_fs_') || id.endsWith('_arrow')) continue;
        // Validate: does nlapiGetField recognize it?
        if (w.nlapiGetField?.(id)) ids.add(id);
      }
    }

    return [...ids];
    /* eslint-enable @typescript-eslint/no-explicit-any */
  });

  // Step 2: Introspect each discovered field
  const results: NsFieldMetadata[] = [];
  for (const id of fieldIds) {
    const meta = await introspectField(target, id);
    if (meta) results.push(meta);
  }
  return results;
}

// ─── Form mode detection ────────────────────────────────────

export type NsFormMode = 'create' | 'edit' | 'view' | 'unknown';

/**
 * Detect the current form mode by inspecting the URL and DOM state.
 */
export async function detectFormMode(target: Page | Frame): Promise<NsFormMode> {
  return target.evaluate(() => {
    const url = window.location.href;
    // URL-based detection (most reliable)
    if (/[?&]e=T/i.test(url)) return 'edit' as const;
    if (/[?&]id=\d+/i.test(url) && !/[?&]e=T/i.test(url)) return 'view' as const;
    // No id param → likely create mode
    if (!/[?&]id=\d+/i.test(url)) return 'create' as const;
    return 'unknown' as const;
  });
}
