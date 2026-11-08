/**
 * Global Browser AutoFill & Autocomplete Suppressor
 * Prevents Safari, Chrome, Edge, and password managers from displaying
 * intrusive contact, address, or credential suggestions across the entire application.
 */

export function initializeGlobalAutofillSuppressor(): void {
  if (typeof window === 'undefined') return;

  const suppress = (el: HTMLElement) => {
    if (el.tagName === 'INPUT' || el.tagName === 'TEXTAREA') {
      const input = el as HTMLInputElement | HTMLTextAreaElement;
      
      if (input.type !== 'password') {
        input.setAttribute('autocomplete', 'new-password');
      } else {
        input.setAttribute('autocomplete', 'current-password');
      }
      input.setAttribute('autocorrect', 'off');
      input.setAttribute('autocapitalize', 'off');
      input.setAttribute('spellcheck', 'false');
      input.setAttribute('data-lpignore', 'true');
      input.setAttribute('data-1p-ignore', 'true');
      input.setAttribute('data-form-type', 'other');

      input.setAttribute('aria-autocomplete', 'none');

      // Strip heuristic contact attributes that trigger Safari Contact AutoFill card
      const curName = input.getAttribute('name') || '';
      if (!curName || /phone|tel|mobile|name|cust|contact|email|address/i.test(curName)) {
        input.setAttribute('name', `erp_f_${Math.random().toString(36).substring(2, 8)}`);
      }

      const curId = input.getAttribute('id') || '';
      if (/phone|tel|mobile|name|cust|contact|email|address|ph|nm/i.test(curId)) {
        // Disassociate any linked label
        try {
          const linkedLabel = document.querySelector(`label[for="${curId}"]`);
          if (linkedLabel) {
            linkedLabel.removeAttribute('for');
          }
        } catch (_) {}
        input.removeAttribute('id');
      }

      // Neutralize aggressive phone placeholder heuristics
      const curPlaceholder = input.getAttribute('placeholder') || '';
      if (/07XXXXXXXX|\+964|77X/i.test(curPlaceholder)) {
        input.setAttribute('placeholder', '+1 (555) 000-0000');
      }
    }
  };

  // 1. Initial pass on existing inputs
  try {
    document.querySelectorAll('input, textarea, form').forEach(node => {
      if (node.tagName === 'FORM') {
        node.setAttribute('autocomplete', 'off');
      } else {
        suppress(node as HTMLElement);
      }
    });
  } catch (_) {
    // Ignore early DOM query errors
  }

  // 2. Capture focus before Safari/Chrome triggers autofill popup
  document.addEventListener('focusin', (e) => {
    const target = e.target as HTMLElement;
    if (target) suppress(target);
  }, true);

  // 3. MutationObserver for dynamically rendered inputs (modals, dialogs, route views)
  if (typeof MutationObserver !== 'undefined') {
    const observer = new MutationObserver((mutations) => {
      for (const mutation of mutations) {
        for (const node of mutation.addedNodes) {
          if (node instanceof HTMLElement) {
            if (node.tagName === 'FORM') {
              node.setAttribute('autocomplete', 'off');
            }
            if (node.tagName === 'INPUT' || node.tagName === 'TEXTAREA') {
              suppress(node);
            }
            node.querySelectorAll?.('input, textarea, form').forEach(child => {
              if (child.tagName === 'FORM') {
                child.setAttribute('autocomplete', 'off');
              } else {
                suppress(child as HTMLElement);
              }
            });
          }
        }
      }
    });

    observer.observe(document.documentElement, {
      childList: true,
      subtree: true
    });
  }
}

