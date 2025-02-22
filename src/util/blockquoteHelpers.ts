export function findClosestBlockquote(node: Node | null): HTMLQuoteElement | undefined {
  let current: Node | null = node;
  while (current) {
    if (current.nodeName === 'BLOCKQUOTE') {
      return current as HTMLQuoteElement;
    }
    current = current.parentNode;
  }
  return undefined;
}

export function isCaretAtLineBoundaryInBlockquote(
  range: Range,
  blockquote: HTMLQuoteElement,
  direction: 'first' | 'last',
): boolean {
  const tempRange = document.createRange();
  tempRange.selectNodeContents(blockquote);

  if (direction === 'last') {
    tempRange.setStart(range.endContainer, range.endOffset);
    const contentAfterCaretInBlockquote = tempRange.toString().trim();

    let sibling = blockquote.nextSibling;
    while (sibling && sibling.nodeType === Node.TEXT_NODE && !/\S/.test(sibling.textContent || '')) {
      sibling = sibling.nextSibling;
    }

    if (contentAfterCaretInBlockquote.length === 0 && !sibling) {
      return true;
    }

    return false;
  } else {
    tempRange.setEnd(range.startContainer, range.startOffset);
    const contentBeforeCaretInBlockquote = tempRange.toString().trim();

    let sibling = blockquote.previousSibling;
    while (sibling && sibling.nodeType === Node.TEXT_NODE && !/\S/.test(sibling.textContent || '')) {
      sibling = sibling.previousSibling;
    }

    if (contentBeforeCaretInBlockquote.length === 0 && !sibling) {
      return true;
    }

    return false;
  }
}

export function moveCursorAroundBlockquote(
  blockquote: HTMLQuoteElement,
  position: 'before' | 'after',
): void {
  const br = document.createElement('br');
  if (position === 'after') {
    blockquote.insertAdjacentElement('afterend', br);
  } else {
    blockquote.insertAdjacentElement('beforebegin', br);
  }

  const selection = window.getSelection();
  if (!selection) return;

  const range = document.createRange();
  if (position === 'after') {
    range.setStartAfter(br);
  } else {
    range.setStartBefore(br);
  }
  range.collapse(true);

  selection.removeAllRanges();
  selection.addRange(range);
}
