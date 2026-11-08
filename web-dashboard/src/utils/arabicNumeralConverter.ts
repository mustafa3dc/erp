/**
 * Global Arabic to Western/English Numeral Converter
 * Converts Eastern Arabic numerals (٠-٩) and Persian numerals (۰-۹) to standard English numerals (0-9)
 * seamlessly across all input, textarea, and editable elements in the entire application.
 */

export const ARABIC_TO_ENGLISH_DIGIT_MAP: Record<string, string> = {
  '٠': '0', '١': '1', '٢': '2', '٣': '3', '٤': '4',
  '٥': '5', '٦': '6', '٧': '7', '٨': '8', '٩': '9',
  '۰': '0', '۱': '1', '۲': '2', '۳': '3', '۴': '4',
  '۵': '5', '۶': '6', '۷': '7', '۸': '8', '۹': '9',
  '٫': '.'
};

export function convertArabicToEnglishNumerals(input: string): string {
  if (!input) return input;
  return input
    .replace(/[٠۰]/g, '0')
    .replace(/[١۱]/g, '1')
    .replace(/[٢۲]/g, '2')
    .replace(/[٣۳]/g, '3')
    .replace(/[٤۴]/g, '4')
    .replace(/[٥۵]/g, '5')
    .replace(/[٦۶]/g, '6')
    .replace(/[٧۷]/g, '7')
    .replace(/[٨۸]/g, '8')
    .replace(/[٩۹]/g, '9')
    .replace(/٫/g, '.');
}

/**
 * Safely sets value on input/textarea triggering React synthetic onChange handlers
 */
function setNativeValue(element: HTMLInputElement | HTMLTextAreaElement, value: string) {
  const isInput = element instanceof HTMLInputElement;
  const isTextarea = element instanceof HTMLTextAreaElement;
  
  if (!isInput && !isTextarea) return;

  const prototype = isInput 
    ? window.HTMLInputElement.prototype 
    : window.HTMLTextAreaElement.prototype;

  const descriptor = Object.getOwnPropertyDescriptor(prototype, 'value');
  if (descriptor && descriptor.set) {
    descriptor.set.call(element, value);
  } else {
    element.value = value;
  }
  
  element.dispatchEvent(new Event('input', { bubbles: true }));
}

function insertTextAtCursor(target: HTMLElement, text: string) {
  if (target instanceof HTMLInputElement || target instanceof HTMLTextAreaElement) {
    let executed = false;
    try {
      executed = document.execCommand('insertText', false, text);
    } catch {
      executed = false;
    }

    if (!executed) {
      let start: number | null = null;
      let end: number | null = null;
      try {
        start = target.selectionStart;
        end = target.selectionEnd;
      } catch {
        start = null;
        end = null;
      }

      const val = target.value || '';
      if (start === null || end === null) {
        const newVal = val + text;
        setNativeValue(target, newVal);
      } else {
        const newVal = val.slice(0, start) + text + val.slice(end);
        setNativeValue(target, newVal);
        try {
          target.setSelectionRange(start + text.length, start + text.length);
        } catch {}
      }
    }
  } else if (target.isContentEditable) {
    try {
      document.execCommand('insertText', false, text);
    } catch {}
  }
}

/**
 * Initializes global event interceptors for all inputs in the DOM.
 */
export function initializeGlobalNumeralConverter(): () => void {
  // 1. KeyDown Listener (Physical keyboard with Arabic layout)
  const handleKeyDown = (e: KeyboardEvent) => {
    if (e.defaultPrevented || e.ctrlKey || e.metaKey || e.altKey) return;

    const target = e.target as HTMLElement | null;
    if (!target) return;
    const isInput = target instanceof HTMLInputElement || target instanceof HTMLTextAreaElement || target.isContentEditable;
    if (!isInput) return;

    if (target instanceof HTMLInputElement && target.type === 'password') {
      return; // Never interfere with passwords
    }

    if (e.key in ARABIC_TO_ENGLISH_DIGIT_MAP) {
      e.preventDefault();
      const englishChar = ARABIC_TO_ENGLISH_DIGIT_MAP[e.key];
      insertTextAtCursor(target, englishChar);
    }
  };

  // 2. BeforeInput Listener (Virtual keyboards, mobile soft keyboard, IME)
  const handleBeforeInput = (e: InputEvent) => {
    if (e.defaultPrevented) return;
    const data = e.data;
    if (!data) return;

    const target = e.target as HTMLElement | null;
    if (!target) return;
    const isInput = target instanceof HTMLInputElement || target instanceof HTMLTextAreaElement || target.isContentEditable;
    if (!isInput) return;

    if (target instanceof HTMLInputElement && target.type === 'password') {
      return;
    }

    const converted = convertArabicToEnglishNumerals(data);
    if (converted !== data) {
      e.preventDefault();
      insertTextAtCursor(target, converted);
    }
  };

  // 3. Paste Listener
  const handlePaste = (e: ClipboardEvent) => {
    if (e.defaultPrevented) return;
    const target = e.target as HTMLElement | null;
    if (!target) return;
    const isInput = target instanceof HTMLInputElement || target instanceof HTMLTextAreaElement || target.isContentEditable;
    if (!isInput) return;

    if (target instanceof HTMLInputElement && target.type === 'password') {
      return;
    }

    const pastedText = e.clipboardData?.getData('text');
    if (!pastedText) return;

    const converted = convertArabicToEnglishNumerals(pastedText);
    if (converted !== pastedText) {
      e.preventDefault();
      insertTextAtCursor(target, converted);
    }
  };

  // 4. Input fallback Listener (Ensures nothing with Arabic numerals remains in input value)
  const handleInput = (e: Event) => {
    const target = e.target as HTMLInputElement | HTMLTextAreaElement | null;
    if (!target || !(target instanceof HTMLInputElement || target instanceof HTMLTextAreaElement)) return;
    if (target.type === 'password') return;

    const val = target.value;
    if (!val) return;

    const converted = convertArabicToEnglishNumerals(val);
    if (converted !== val) {
      let start: number | null = null;
      let end: number | null = null;
      try {
        start = target.selectionStart;
        end = target.selectionEnd;
      } catch {}

      setNativeValue(target, converted);

      if (start !== null && end !== null) {
        try {
          target.setSelectionRange(start, end);
        } catch {}
      }
    }
  };

  window.addEventListener('keydown', handleKeyDown, true);
  window.addEventListener('beforeinput', handleBeforeInput as EventListener, true);
  window.addEventListener('paste', handlePaste, true);
  window.addEventListener('input', handleInput, true);

  return () => {
    window.removeEventListener('keydown', handleKeyDown, true);
    window.removeEventListener('beforeinput', handleBeforeInput as EventListener, true);
    window.removeEventListener('paste', handlePaste, true);
    window.removeEventListener('input', handleInput, true);
  };
}
