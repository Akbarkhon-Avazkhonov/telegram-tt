export function getCurrentCursorPosition(editableElement: Element) {
  let caretOffset = 0;
  const selection = window.getSelection();
  if (selection && selection.rangeCount > 0) {
    const range = selection.getRangeAt(0);
    const preCaretRange = range.cloneRange();
    // Select all content from the beginning of the element up to the caret
    preCaretRange.selectNodeContents(editableElement);
    preCaretRange.setEnd(range.startContainer, range.startOffset);
    caretOffset = preCaretRange.toString().length;
  }
  return caretOffset;
}

export function setCursorPosition(editableElement:HTMLElement, charIndex:number) {
  editableElement.focus();

  const range = document.createRange();
  const selection = window.getSelection();
  if (!selection) return;

  function traverse(node:Node, remaining:number):{ node:Node | undefined; offset:number; found:boolean } {
    if (node.nodeType === Node.TEXT_NODE) {
      if ((node.textContent?.length || 0) >= remaining) {
        return { node, offset: remaining, found: true };
      }
      // Return the remaining offset after consuming this text node.
      return { node: undefined, offset: remaining - (node.textContent?.length || 0), found: false };
    }

    // If it is an element node, iterate through its child nodes.
    for (let i = 0; i < node.childNodes.length; i++) {
      const result = traverse(node.childNodes[i], remaining);
      if (result.found) {
        return result;
      }
      // Update remaining offset for subsequent siblings.
      remaining = result.offset;
    }
    return { node: undefined, offset: remaining, found: false };
  }

  const result = traverse(editableElement, charIndex);

  if (result.found && result.node) {
    range.setStart(result.node, result.offset);
    range.collapse(true);
    selection.removeAllRanges();
    selection.addRange(range);
  } else {
    range.selectNodeContents(editableElement);
    range.collapse(false);
    selection.removeAllRanges();
    selection.addRange(range);
  }
}

export function selectPartialText(container:Element | undefined, startOffset:number, endOffset:number) {
  const selection = window.getSelection();
  if (!container || !selection) return;

  const range = document.createRange();

  selection.removeAllRanges();

  let charCount = 0;
  let startNode:Node | undefined;
  let startCharIndex = 0;
  let endNode:Node | undefined;
  let endCharIndex = 0;

  function findTextNodes(node:Node) {
    if (node.nodeType === Node.TEXT_NODE) {
      const textLength = node.textContent?.length || 0;
      if (!startNode && charCount + textLength >= startOffset) {
        startNode = node;
        startCharIndex = startOffset - charCount;
      }
      if (!endNode && charCount + textLength >= endOffset) {
        endNode = node;
        endCharIndex = endOffset - charCount;
      }
      charCount += textLength;
    } else {
      for (const child of node.childNodes) {
        findTextNodes(child);
      }
    }
  }

  findTextNodes(container);

  if (startNode && endNode) {
    range.setStart(startNode, startCharIndex);
    range.setEnd(endNode, endCharIndex);
    selection.addRange(range);
  }
}

/**
 * isCursorInsideTags.ts
 */
export const isCursorInsideTags = (): boolean => {
  const selection = document.getSelection();

  if (!selection || selection.rangeCount === 0) {
    return false;
  }

  const range = selection.getRangeAt(0);
  let node = range.startContainer;

  // Move to the parent element if the cursor is in a text node
  if (node.nodeType === Node.TEXT_NODE) {
    node = node.parentNode as HTMLElement;
  }

  const validTags = ['strong', 'b', 'i', 'em', 'u', 'del'];

  while (node && node !== document.body) {
    if (node instanceof HTMLElement) {
      const tagName = node.tagName.toLowerCase();

      // Check if the tag is one of the valid inline tags
      if (validTags.includes(tagName)) {
        return true;
      }

      // Check if it's a <span> with class="spoiler" and data-entity-type="MessageEntitySpoiler"
      if (
        tagName === 'span'
        && node.classList.contains('spoiler')
        && node.getAttribute('data-entity-type') === 'MessageEntitySpoiler'
      ) {
        return true;
      }
    }

    node = node.parentNode as HTMLElement;
  }

  return false;
};

export function getCaretCharacterOffsetWithin(element: HTMLElement) {
  const selection = window.getSelection();
  if (!selection || selection.rangeCount === 0) {
    return 0;
  }
  const range = selection.getRangeAt(0);
  const preCaretRange = range.cloneRange();
  preCaretRange.selectNodeContents(element);
  preCaretRange.setEnd(range.endContainer, range.endOffset);
  return preCaretRange.toString().length;
}

export function setCaretPosition(element: ChildNode, offset:number) {
  let currentOffset = 0;
  let nodeStack = [element];
  let node;

  while (nodeStack.length) {
    node = nodeStack.shift();
    if (node?.nodeType === Node.TEXT_NODE) {
      const nextOffset = currentOffset + (node.textContent?.length || 0);
      if (nextOffset >= offset) {
        const range = document.createRange();
        const selection = window.getSelection();
        range.setStart(node, offset - currentOffset);
        range.collapse(true);
        selection?.removeAllRanges();
        selection?.addRange(range);
        return;
      }
      currentOffset = nextOffset;
    } else {
      nodeStack = Array.from(node?.childNodes || []).concat(nodeStack);
    }
  }
}
