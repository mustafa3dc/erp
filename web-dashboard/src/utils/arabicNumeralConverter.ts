import { toLatinDigits } from '../lib/formatters';

/**
 * Global utility to normalize Eastern Arabic-Indic (٠١٢٣٤٥٦٧٨٩) and
 * Extended Arabic-Indic / Persian / Kurdish (۰۱۲۳۴۵۶۷۸۹) numerals to standard ASCII 0-9.
 */

export const ARABIC_TO_ENGLISH_DIGIT_MAP: Record<string, string> = {
  // Eastern Arabic-Indic (Iraq, Egypt, Levant, Gulf)
  '٠': '0',
  '١': '1',
  '٢': '2',
  '٣': '3',
  '٤': '4',
  '٥': '5',
  '٦': '6',
  '٧': '7',
  '٨': '8',
  '٩': '9',
  // Extended Arabic-Indic (Persian, Kurdish, Urdu)
  '۰': '0',
  '۱': '1',
  '۲': '2',
  '۳': '3',
  '۴': '4',
  '۵': '5',
  '۶': '6',
  '۷': '7',
  '۸': '8',
  '۹': '9',
  // Arabic decimal separator
  '٫': '.',
};

export function convertArabicToEnglishNumerals(input: string): string {
  return toLatinDigits(input);
}

/**
 * Helper to trigger React synthetic onChange/input cleanly by calling the native value setter
 */
function setNativeValue(element: HTMLInputElement | HTMLTextAreaElement, value: string): void {
  const valueDescriptor = Object.getOwnPropertyDescriptor(element, 'value');
  const prototype = Object.getPrototypeOf(element);
  const prototypeValueDescriptor = Object.getOwnPropertyDescriptor(prototype, 'value');

  if (prototypeValueDescriptor && prototypeValueDescriptor.set && valueDescriptor !== prototypeValueDescriptor) {
    prototypeValueDescriptor.set.call(element, value);
  } else {
    element.value = value;
  }
}

/**
 * Computes adjusted caret index after normalizing the text before the caret.
 */
export function computeLatinCaretPosition(rawValue: string, caretIndex: number | null): number | null {
  if (caretIndex === null || caretIndex < 0) return caretIndex;
  const clamped = Math.min(caretIndex, rawValue.length);
  return toLatinDigits(rawValue.slice(0, clamped)).length;
}

/**
 * Returns true if the target input is a password field (masked or visibility-toggled to text)
 * so global digit normalization NEVER alters passwords.
 */
export function isPasswordField(target: EventTarget | null | undefined): boolean {
  if (!(target instanceof HTMLInputElement)) return false;
  if (target.type === 'password') return true;
  if (target.dataset?.noDigitNormalize === 'true' || target.getAttribute('data-no-digit-normalize') === 'true') {
    return true;
  }
  const ac = (target.getAttribute('autocomplete') || '').toLowerCase();
  return ac === 'current-password';
}

/**
 * Normalizes an HTMLInputElement or HTMLTextAreaElement value in-place while preserving selectionStart/selectionEnd.
 * Returns true if the value changed.
 */
export function normalizeElementDigitsInPlace(
  target: HTMLInputElement | HTMLTextAreaElement
): boolean {
  if (isPasswordField(target)) {
    return false;
  }
  const raw = target.value;
  const converted = toLatinDigits(raw);
  if (converted === raw) return false;

  let start: number | null = null;
  let end: number | null = null;
  try {
    start = target.selectionStart;
    end = target.selectionEnd;
  } catch {
    // Elements like <input type="number"> do not expose selectionStart/selectionEnd in some browsers
  }

  const nextStart = computeLatinCaretPosition(raw, start);
  const nextEnd = computeLatinCaretPosition(raw, end);

  setNativeValue(target, converted);

  if (nextStart !== null && nextEnd !== null) {
    try {
      target.setSelectionRange(nextStart, nextEnd);
    } catch {
      // Ignore for input types that disallow selection manipulation
    }
  }

  return true;
}

/**
 * Inserts converted text at the current cursor position in an input/textarea
 * and dispatches an input event so React state stays synchronized.
 */
function insertTextAtCursor(
  element: HTMLInputElement | HTMLTextAreaElement,
  textToInsert: string
): void {
  let start = element.value.length;
  let end = element.value.length;

  try {
    start = element.selectionStart ?? element.value.length;
    end = element.selectionEnd ?? element.value.length;
  } catch {
    // Fallback for input types without selection API
  }

  const currentVal = element.value || '';
  const before = currentVal.slice(0, start);
  const after = currentVal.slice(end);
  const nextVal = toLatinDigits(before + textToInsert + after);

  setNativeValue(element, nextVal);

  const newCursorPos = toLatinDigits(before + textToInsert).length;
  try {
    element.setSelectionRange(newCursorPos, newCursorPos);
  } catch {
    // Some input types (e.g., number) reject setSelectionRange
  }

  element.dispatchEvent(new Event('input', { bubbles: true }));
}

function isEditableElement(target: EventTarget | null | undefined): target is HTMLInputElement | HTMLTextAreaElement {
  return target instanceof HTMLInputElement || target instanceof HTMLTextAreaElement;
}

function isNumericOrBarcodeField(el: HTMLInputElement | HTMLTextAreaElement): boolean {
  if (el instanceof HTMLTextAreaElement) return false;
  const type = (el.type || '').toLowerCase();
  const inputMode = (el.getAttribute('inputmode') || '').toLowerCase();
  if (type === 'number' || type === 'tel' || inputMode === 'numeric' || inputMode === 'decimal') {
    return true;
  }
  const descriptor = `${el.name || ''} ${el.id || ''} ${el.className || ''} ${el.getAttribute('placeholder') || ''}`;
  return /barcode|sku|scanner|code|phone|mobile|otp|pin|price|amount|qty|quantity/i.test(descriptor);
}

/**
 * Resolves physical key events (Digit0-9, Numpad0-9, or Arabic/Kurdish/Persian digit keys)
 * into standard ASCII '0'-'9' / '.' regardless of active OS keyboard layout.
 */
export function resolveLatinDigitFromKeyboardEvent(
  e: KeyboardEvent,
  target?: EventTarget | null
): string | null {
  if (e.ctrlKey || e.metaKey || e.altKey) return null;

  if (e.key in ARABIC_TO_ENGLISH_DIGIT_MAP) {
    return ARABIC_TO_ENGLISH_DIGIT_MAP[e.key];
  }

  // Physical Numpad digits should always emit ASCII 0-9 even when OS layout remaps them
  if (/^Numpad([0-9])$/.test(e.code)) {
    const asciiDigit = e.code.slice(6);
    if (e.key !== asciiDigit) {
      return asciiDigit;
    }
    return null;
  }

  if (e.code === 'NumpadDecimal' && e.key !== '.' && (e.key === '٫' || e.key === ',')) {
    return '.';
  }

  // Physical top-row Digit0-Digit9 without Shift (preserves Shift symbols like @ # $ %)
  if (!e.shiftKey && /^Digit([0-9])$/.test(e.code)) {
    const asciiDigit = e.code.slice(5);
    if (e.key !== asciiDigit) {
      const isNonAscii = e.key.length === 1 && !/^[\x20-\x7E]$/.test(e.key);
      if (isNonAscii) {
        return asciiDigit;
      }
      if (isEditableElement(target) && isNumericOrBarcodeField(target) && !/^[0-9]$/.test(e.key)) {
        return asciiDigit;
      }
    }
  }

  return null;
}

const GLOBAL_CONVERTER_KEY = '__ziloxGlobalLatinDigitConverter';

interface ConverterSingletonState {
  refCount: number;
  cleanup: (() => void) | null;
}

/**
 * Initializes global capture-phase listeners to intercept non-Latin digits (typing, scanning, pasting)
 * across all inputs, textareas, and contentEditable elements.
 * Idempotent & ref-counted so calling from both main.tsx and root providers attaches one listener set.
 */
export function initializeGlobalNumeralConverter(): () => void {
  if (typeof window === 'undefined' || typeof document === 'undefined') {
    return () => {};
  }

  const win = window as unknown as Record<string, ConverterSingletonState | undefined>;
  const existing = win[GLOBAL_CONVERTER_KEY];
  if (existing && existing.refCount > 0 && existing.cleanup) {
    existing.refCount += 1;
    return () => {
      existing.refCount -= 1;
      if (existing.refCount <= 0) {
        existing.cleanup?.();
        delete win[GLOBAL_CONVERTER_KEY];
      }
    };
  }

  // 1. Intercept keydown BEFORE browsers reject Arabic digits in type="number" inputs
  const handleKeyDown = (e: KeyboardEvent) => {
    const target = e.target;
    if (!isEditableElement(target)) return;
    if (isPasswordField(target)) return;
    if (target.readOnly || target.disabled) return;

    const asciiChar = resolveLatinDigitFromKeyboardEvent(e, target);
    if (asciiChar !== null) {
      e.preventDefault();
      insertTextAtCursor(target, asciiChar);
    }
  };

  // 2. Intercept beforeinput for IME, virtual mobile keyboards, and hardware barcode scanners
  const handleBeforeInput = (e: InputEvent) => {
    const target = e.target;
    if (!isEditableElement(target)) return;
    if (isPasswordField(target)) return;
    if (target.readOnly || target.disabled) return;

    if (e.data && /[\u0660-\u0669\u06F0-\u06F9\u066B]/.test(e.data)) {
      const converted = toLatinDigits(e.data);
      e.preventDefault();
      insertTextAtCursor(target, converted);
    }
  };

  // 3. Intercept paste events to sanitize copied Arabic/Persian/Kurdish numbers cleanly
  const handlePaste = (e: ClipboardEvent) => {
    const target = e.target;
    if (!isEditableElement(target)) return;
    if (isPasswordField(target)) return;
    if (target.readOnly || target.disabled) return;

    const pastedText = e.clipboardData?.getData('text');
    if (pastedText && /[\u0660-\u0669\u06F0-\u06F9\u066B]/.test(pastedText)) {
      e.preventDefault();
      const converted = toLatinDigits(pastedText);
      insertTextAtCursor(target, converted);
    }
  };

  // 4. Fallback capture-phase input listener to catch any missed IME / composition mutations
  const handleInput = (e: Event) => {
    const target = e.target;
    if (!isEditableElement(target)) return;
    if (isPasswordField(target)) return;
    if (normalizeElementDigitsInPlace(target)) {
      // Re-dispatch synchronously so downstream React/custom listeners read normalized value
      target.dispatchEvent(new Event('input', { bubbles: true }));
    }
  };

  document.addEventListener('keydown', handleKeyDown, { capture: true });
  document.addEventListener('beforeinput', handleBeforeInput as EventListener, { capture: true });
  document.addEventListener('paste', handlePaste as EventListener, { capture: true });
  document.addEventListener('input', handleInput, { capture: true });

  const state: ConverterSingletonState = {
    refCount: 1,
    cleanup: () => {
      document.removeEventListener('keydown', handleKeyDown, { capture: true });
      document.removeEventListener('beforeinput', handleBeforeInput as EventListener, { capture: true });
      document.removeEventListener('paste', handlePaste as EventListener, { capture: true });
      document.removeEventListener('input', handleInput, { capture: true });
    },
  };

  win[GLOBAL_CONVERTER_KEY] = state;

  return () => {
    state.refCount -= 1;
    if (state.refCount <= 0) {
      state.cleanup?.();
      delete win[GLOBAL_CONVERTER_KEY];
    }
  };
}
