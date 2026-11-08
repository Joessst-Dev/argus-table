let region: HTMLElement | undefined;

/**
 * Says something to screen readers through a polite live region. The region
 * lives in the document body, not in the table: a grid may only own rows, so a
 * status element inside it would break the grid's structure. One region serves
 * every table on the page. It is visually hidden with inline styles, so page
 * CSS can't reveal it.
 */
export function announce(doc: Document, message: string): void {
  if (!region?.isConnected || region.ownerDocument !== doc) {
    region = doc.createElement('div');
    region.setAttribute('aria-live', 'polite');
    region.setAttribute('aria-atomic', 'true');
    region.dataset.argusAnnouncer = '';
    region.style.cssText =
      'position:absolute;width:1px;height:1px;overflow:hidden;clip-path:inset(50%);white-space:nowrap';
    doc.body.append(region);
  }
  const target = region;
  // A new text node each time, so the same message twice is still announced.
  target.textContent = '';
  setTimeout(() => {
    target.textContent = message;
  }, 50);
}
