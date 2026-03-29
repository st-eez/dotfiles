/**
 * Scoped dialog handler for NS operations.
 *
 * BrowserManager handles dialogs globally (auto-accept/dismiss), but NS commands
 * need to capture *which* dialogs fired during a specific operation. This wrapper:
 *
 *   1. Saves the current dialog state (auto-accept, prompt text)
 *   2. Installs a scoped listener to capture dialogs during the operation
 *   3. Runs the operation
 *   4. Restores the previous dialog state
 *   5. Returns both the operation result and any captured dialogs
 *
 * Used by: ns save (detect validation alerts vs success), ns set (detect sourcing warnings),
 * ns cancel (detect unsaved-changes confirmation).
 */

import type { Page } from 'playwright';
import type { BrowserManager } from '../../core/browser-manager';

// ─── Types ──────────────────────────────────────────────────

export interface CapturedDialog {
  type: string;        // 'alert' | 'confirm' | 'prompt' | 'beforeunload'
  message: string;
  action: 'accepted' | 'dismissed';
}

export interface DialogHandlerOptions {
  /** Accept dialogs during this operation? Default: true */
  accept?: boolean;
  /** Text to provide for prompt dialogs. Default: undefined */
  promptText?: string;
}

export interface DialogResult<T> {
  result: T;
  dialogs: CapturedDialog[];
}

// ─── withDialogHandler ──────────────────────────────────────

/**
 * Run an async operation with scoped dialog capture.
 *
 * Configures BrowserManager's dialog auto-accept for the duration of `fn`,
 * captures all dialogs that fire, then restores the previous state.
 */
export async function withDialogHandler<T>(
  bm: BrowserManager,
  fn: () => Promise<T>,
  opts?: DialogHandlerOptions,
): Promise<DialogResult<T>> {
  const accept = opts?.accept ?? true;
  const promptText = opts?.promptText ?? null;

  // Save previous state
  const prevAccept = bm.getDialogAutoAccept();
  const prevPromptText = bm.getDialogPromptText();

  // Configure for this operation
  bm.setDialogAutoAccept(accept);
  bm.setDialogPromptText(promptText);

  // Install scoped listener
  const captured: CapturedDialog[] = [];
  const page: Page = bm.getPage();

  const handler = (dialog: { type: () => string; message: () => string }) => {
    captured.push({
      type: dialog.type(),
      message: dialog.message(),
      action: accept ? 'accepted' : 'dismissed',
    });
  };
  page.on('dialog', handler);

  try {
    const result = await fn();
    return { result, dialogs: captured };
  } finally {
    // Restore previous state — always, even on error
    page.off('dialog', handler);
    bm.setDialogAutoAccept(prevAccept);
    bm.setDialogPromptText(prevPromptText);
  }
}

// ─── DOM modal detection (NetSuite-specific) ────────────────

/**
 * Detect NetSuite DOM-based modals (not native browser dialogs).
 *
 * NetSuite uses several patterns for in-page error/warning display:
 *   - N/ui/dialog containers
 *   - .uir-message-error elements
 *   - #_err_alert elements
 *   - .x-window (ExtJS dialog windows)
 *
 * Returns null if no modal is detected, or the modal info if found.
 */
export interface DomModal {
  type: 'error' | 'warning' | 'info' | 'confirm';
  message: string;
  selector: string;
}

export async function detectDomModal(
  target: Page | import('playwright').Frame,
): Promise<DomModal | null> {
  return target.evaluate(() => {
    // N/ui/dialog error containers
    const errAlert = document.getElementById('_err_alert');
    if (errAlert && errAlert.offsetParent !== null) {
      return {
        type: 'error' as const,
        message: errAlert.textContent?.trim() ?? '',
        selector: '#_err_alert',
      };
    }

    // .uir-message-error (server-side validation messages)
    const uirError = document.querySelector('.uir-message-error');
    if (uirError && (uirError as HTMLElement).offsetParent !== null) {
      return {
        type: 'error' as const,
        message: uirError.textContent?.trim() ?? '',
        selector: '.uir-message-error',
      };
    }

    // .uir-message-warning
    const uirWarning = document.querySelector('.uir-message-warning');
    if (uirWarning && (uirWarning as HTMLElement).offsetParent !== null) {
      return {
        type: 'warning' as const,
        message: uirWarning.textContent?.trim() ?? '',
        selector: '.uir-message-warning',
      };
    }

    // ExtJS dialog windows (used by N/ui/dialog)
    const extDialog = document.querySelector('.x-window');
    if (extDialog && (extDialog as HTMLElement).offsetParent !== null) {
      const body = extDialog.querySelector('.x-window-body');
      return {
        type: 'info' as const,
        message: body?.textContent?.trim() ?? '',
        selector: '.x-window',
      };
    }

    return null;
  });
}
