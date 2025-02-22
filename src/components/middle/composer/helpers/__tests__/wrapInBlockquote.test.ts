import { wrapSelectionInBlockquote } from '../wrapInBlockquote';

describe('wrapSelectionInBlockquote', () => {
  let container: HTMLElement;
  let textNode: Node | null;
  let range :Range;
  let selection: Selection;

  beforeEach(() => {
    document.body.innerHTML = `
        <div id="test-container">
          <p id="test-paragraph">Hello, this is a test paragraph.</p>
        </div>
      `;

    container = document.getElementById('test-container')!;
    const paragraph = document.getElementById('test-paragraph');
    textNode = paragraph!.firstChild!;

    range = document.createRange();
    range.selectNodeContents(textNode);

    selection = window.getSelection()!;
    selection.removeAllRanges();
    selection.addRange(range);
  });

  afterEach(() => {
    document.body.innerHTML = '';
    selection.removeAllRanges();
  });

  test('should remove the selection after applying blockquote', () => {
    wrapSelectionInBlockquote();
    expect(selection.rangeCount).toBe(0);
  });

  test('should not modify the DOM if there is no selection', () => {
    selection.removeAllRanges();
    wrapSelectionInBlockquote();
    expect(container.querySelector('blockquote')).toBeNull();
  });

  test('should not modify the DOM if selection range count is zero', () => {
    selection.removeAllRanges();
    wrapSelectionInBlockquote();
    expect(container.innerHTML).toContain('<p id="test-paragraph">Hello, this is a test paragraph.</p>');
  });

  test('should preserve text content inside blockquote', () => {
    wrapSelectionInBlockquote();
    const blockquote = container.querySelector('blockquote')!;
    expect(blockquote).not.toBeNull();
    expect(blockquote.textContent).toBe('Hello, this is a test paragraph.');
  });

  describe('wrapSelectionInBlockquote - Additional Tests', () => {
    beforeEach(() => {
      document.body.innerHTML = '<div id="test-container">'
      + '<p id="test-paragraph">Hello, <strong>this</strong> is a <em>test</em> paragraph.</p></div>';

      container = document.getElementById('test-container')!;
      const paragraph = document.getElementById('test-paragraph')!;
      range = document.createRange();
      range.selectNodeContents(paragraph);

      selection = window.getSelection()!;
      selection.removeAllRanges();
      selection.addRange(range);
    });

    afterEach(() => {
      document.body.innerHTML = '';
      selection.removeAllRanges();
    });

    test('should expand selection to include existing surrounding blockquote', () => {
      document.body.innerHTML = '<div id="test-container">'
      + '<blockquote><p id="test-paragraph">Existing blockquote content.</p></blockquote></div>';

      container = document.getElementById('test-container')!;
      const paragraph = document.getElementById('test-paragraph')!;
      range = document.createRange();
      range.selectNodeContents(paragraph);

      selection.removeAllRanges();
      selection.addRange(range);

      wrapSelectionInBlockquote();
      const blockquote = container.querySelector('blockquote')!;
      expect(blockquote).not.toBeNull();
      expect(blockquote.textContent).toBe('Existing blockquote content.');
    });

    test('should unwrap nested blockquotes while keeping content', () => {
      document.body.innerHTML = '<div id="test-container">'
      + '<blockquote><p id="test-paragraph">Outer blockquote <blockquote>Inner blockquote content'
      + '</blockquote></p></blockquote> </div>';

      container = document.getElementById('test-container')!;
      const paragraph = document.getElementById('test-paragraph')!;
      range = document.createRange();
      range.selectNodeContents(paragraph);

      selection.removeAllRanges();
      selection.addRange(range);

      wrapSelectionInBlockquote();
      const blockquote = container.querySelector('blockquote')!;
      expect(blockquote).not.toBeNull();
      expect(blockquote.textContent).toBe('Outer blockquote Inner blockquote content');
    });

    test('should not create duplicate blockquotes if selection is already inside a blockquote', () => {
      document.body.innerHTML = '<div id="test-container"><blockquote>'
      + '<p id="test-paragraph">Already inside blockquote</p></blockquote></div>';

      container = document.getElementById('test-container')!;
      const paragraph = document.getElementById('test-paragraph')!;
      range = document.createRange();
      range.selectNodeContents(paragraph);

      selection.removeAllRanges();
      selection.addRange(range);

      wrapSelectionInBlockquote();
      const blockquotes = container.querySelectorAll('blockquote');
      expect(blockquotes.length).toBe(1);
      expect(blockquotes[0].textContent).toBe('Already inside blockquote');
    });

    test('should correctly wrap multiple paragraphs within a blockquote', () => {
      document.body.innerHTML = '<div id="test-container">'
      + '<p id="p1">First paragraph.</p><p id="p2">Second paragraph.</p></div>';

      container = document.getElementById('test-container')!;
      const p1 = document.getElementById('p1')!;
      const p2 = document.getElementById('p2')!;
      range = document.createRange();
      range.setStartBefore(p1);
      range.setEndAfter(p2);

      selection.removeAllRanges();
      selection.addRange(range);

      wrapSelectionInBlockquote();
      const blockquote = container.querySelector('blockquote')!;
      expect(blockquote).not.toBeNull();
      expect(blockquote.innerHTML).toContain('<p id="p1">First paragraph.</p>');
      expect(blockquote.innerHTML).toContain('<p id="p2">Second paragraph.</p>');
    });
  });
});
