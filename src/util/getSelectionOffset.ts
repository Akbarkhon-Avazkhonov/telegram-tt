export function getSelectionOffset() {
  const selection = window.getSelection();
  if (!selection?.rangeCount) return -1; // No selection

  const range = selection.getRangeAt(0);
  const selectedNode = range.startContainer;
  let offset = range.startOffset;

  // Traverse previous nodes to calculate the absolute index
  let currentNode: Node | null = selectedNode;

  while (currentNode) {
    // Move to the previous sibling if exists
    while (currentNode.previousSibling) {
      currentNode = currentNode.previousSibling;
      offset += currentNode.textContent?.length || 0;
    }

    // Move up to the parent if necessary
    currentNode = currentNode.parentNode;
    if (!currentNode || !currentNode.previousSibling) break;
    currentNode = currentNode.previousSibling;
    offset += currentNode.textContent?.length || 0;
  }

  return offset;
}
