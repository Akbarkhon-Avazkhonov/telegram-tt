function wrapSelectionInElement(
  tagName: 'code' | 'blockquote',
  classList: string[],
  attributes: Record<string, string> = {},
): void {
  const selection = window.getSelection();
  if (!selection || selection.rangeCount === 0) {
    return;
  }

  const range = selection.getRangeAt(0);

  function getHighestAncestor(node: Node, tag: string): HTMLElement | undefined {
    let current: Node | null = node;
    let highestAncestor: HTMLElement | undefined;
    while (current && current.parentNode) {
      if (
        current.parentNode instanceof HTMLElement
                && current.parentNode.tagName.toLowerCase() === tag.toLowerCase()
      ) {
        highestAncestor = current.parentNode;
        current = current.parentNode;
      } else {
        break;
      }
    }
    return highestAncestor;
  }

  const startAncestor = getHighestAncestor(range.startContainer, tagName);
  const endAncestor = getHighestAncestor(range.endContainer, tagName);

  if (startAncestor) {
    range.setStartBefore(startAncestor);
  }
  if (endAncestor) {
    range.setEndAfter(endAncestor);
  }

  const extractedContent = range.extractContents();

  extractedContent.querySelectorAll(tagName).forEach((nestedElement) => {
    while (nestedElement.firstChild) {
      nestedElement.parentNode?.insertBefore(nestedElement.firstChild, nestedElement);
    }
    nestedElement.remove();
  });

  const surroundingAncestor = getHighestAncestor(range.commonAncestorContainer, tagName);

  if (surroundingAncestor) {
    surroundingAncestor.appendChild(extractedContent);
  } else {
    const wrapper = document.createElement(tagName);
    classList.forEach((cls) => wrapper.classList.add(cls));
    Object.entries(attributes).forEach(([key, value]) => wrapper.setAttribute(key, value));

    wrapper.appendChild(extractedContent);
    range.insertNode(wrapper);
  }

  selection.removeAllRanges();
}

export function wrapSelectionInCode(): void {
  wrapSelectionInElement('code', ['text-entity-code'], { dir: 'auto' });
}

export function wrapSelectionInBlockquote(): void {
  wrapSelectionInElement('blockquote',
    ['Blockquote-module__blockquote', 'blockquite-width-auto'],
    { 'data-entity-type': 'MessageEntityBlockquote' });
}
