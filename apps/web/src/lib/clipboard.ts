'use client';

export async function copyTextToClipboard(value: string): Promise<boolean> {
  if (!value) {
    return false;
  }

  if (
    typeof navigator !== 'undefined' &&
    typeof window !== 'undefined' &&
    navigator.clipboard?.writeText &&
    window.isSecureContext
  ) {
    try {
      await navigator.clipboard.writeText(value);
      return true;
    } catch (error) {
      console.warn('Clipboard API copy failed, falling back to document.execCommand.', error);
    }
  }

  if (typeof document === 'undefined') {
    return false;
  }

  const textarea = document.createElement('textarea');
  textarea.value = value;
  textarea.setAttribute('readonly', '');
  textarea.style.position = 'fixed';
  textarea.style.top = '-9999px';
  textarea.style.opacity = '0';

  document.body.appendChild(textarea);
  textarea.focus();
  textarea.select();
  textarea.setSelectionRange(0, textarea.value.length);

  try {
    return document.execCommand('copy');
  } catch (error) {
    console.error('Fallback clipboard copy failed:', error);
    return false;
  } finally {
    document.body.removeChild(textarea);
  }
}
