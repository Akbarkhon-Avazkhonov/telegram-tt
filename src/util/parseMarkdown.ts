export type MarkdownAstNode =
  | TextNode
  | BoldNode
  | ItalicNode
  | UnderlineNode
  | PreNode
  | StrikeNode
  | SpoilerNode
  | LinkNode
  | CodeNode
  | QuoteNode;

export interface TextNode {
  type: 'text';
  content: string;
}

export interface BoldNode {
  type: 'bold';
  children: MarkdownAstNode[];
}

export interface ItalicNode {
  type: 'italic';
  children: MarkdownAstNode[];
}

export interface UnderlineNode {
  type: 'underline';
  children: MarkdownAstNode[];
}

export interface StrikeNode {
  type: 'strike';
  children: MarkdownAstNode[];
}

export interface SpoilerNode {
  type: 'spoiler';
  children: MarkdownAstNode[];
}

export interface LinkNode {
  type: 'link';
  url: string;
  children: MarkdownAstNode[];
}

export interface PreNode {
  type: 'pre';
  language?: string;
  content: string;
}

export interface CodeNode {
  type: 'code';
  content: string;
}

export interface QuoteNode {
  type: 'quote';
  children: MarkdownAstNode[];
}

interface TokenDefinition {
  open: string;
  close: string;
  type: 'bold' | 'italic' | 'strike' | 'spoiler' | 'underline' | 'quote';
}

interface ParserState {
  input: string;
  pos: number;
  len: number;
  cursorIndex?: number;
}

interface ParseResult {
  nodes: MarkdownAstNode[];
  closed: boolean;
}

const tokens: TokenDefinition[] = [
  { open: '<strong>', close: '</strong>', type: 'bold' },
  { open: '<em>', close: '</em>', type: 'italic' },
  { open: '<b>', close: '</b>', type: 'bold' },
  { open: '<i>', close: '</i>', type: 'italic' },
  { open: '**', close: '**', type: 'bold' },
  { open: '~~', close: '~~', type: 'strike' },
  { open: '*', close: '*', type: 'italic' },
  { open: '||', close: '||', type: 'spoiler' },
  { open: '<u>', close: '</u>', type: 'underline' },
  { open: '__', close: '__', type: 'underline' },
  { open: '&gt;&gt;', close: '&lt;&lt;', type: 'quote' },
];

const markdownMapping: { [key in TokenDefinition['type']]: { open: string; close: string } } = {
  bold: { open: '**', close: '**' },
  italic: { open: '*', close: '*' },
  underline: { open: '__', close: '__' },
  strike: { open: '~~', close: '~~' },
  spoiler: { open: '||', close: '||' },
  quote: { open: '&gt;&gt;', close: '&lt;&lt;' },
};

function createParserState(input: string, rawCursorIndex?: number): ParserState {
  return {
    input,
    pos: 0,
    len: input.length,
    cursorIndex: rawCursorIndex,
  };
}

function appendTextNode(nodes: MarkdownAstNode[], text: string) {
  if (!text) return;
  const lastNode = nodes[nodes.length - 1];
  if (lastNode && lastNode.type === 'text') {
    (lastNode as TextNode).content += text;
  } else {
    nodes.push({ type: 'text', content: text });
  }
}

function flattenNodes(nodes: MarkdownAstNode[]): string {
  return nodes
    .map((node) => {
      if (node.type === 'text') {
        return node.content;
      } else if ('children' in node && Array.isArray(node.children)) {
        return flattenNodes(node.children);
      } else if (node.type === 'pre') {
        return node.content;
      } else if (node.type === 'code') {
        return node.content;
      } else {
        return '';
      }
    })
    .join('');
}

export function nodesToMarkdown(nodes: MarkdownAstNode[]): string {
  return nodes
    .map((node) => {
      switch (node.type) {
        case 'text':
          return node.content;
        case 'bold': {
          const mapping = markdownMapping.bold;
          return mapping.open + nodesToMarkdown(node.children) + mapping.close;
        }
        case 'italic': {
          const mapping = markdownMapping.italic;
          return mapping.open + nodesToMarkdown(node.children) + mapping.close;
        }
        case 'underline': {
          const mapping = markdownMapping.underline;
          return mapping.open + nodesToMarkdown(node.children) + mapping.close;
        }
        case 'strike': {
          const mapping = markdownMapping.strike;
          return mapping.open + nodesToMarkdown(node.children) + mapping.close;
        }
        case 'spoiler': {
          const mapping = markdownMapping.spoiler;
          return mapping.open + nodesToMarkdown(node.children) + mapping.close;
        }
        case 'quote': {
          const mapping = markdownMapping.quote;
          return mapping.open + nodesToMarkdown(node.children) + mapping.close;
        }
        case 'link': {
          return `[${nodesToMarkdown(node.children)}](${node.url})`;
        }
        case 'pre': {
          return `\`\`\`${node.language ? `${node.language}\n` : '\n'}${node.content}\`\`\``;
        }
        case 'code': {
          return `\`${node.content}\``;
        }
        default:
          return '';
      }
    })
    .join('');
}

function parseBacktickCodeBlock(
  state: ParserState,
  nodes: MarkdownAstNode[],
  textBuffer: { current: string },
): boolean {
  const marker = '```';
  if (!state.input.startsWith(marker, state.pos)) {
    return false;
  }
  const blockStart = state.pos;
  appendTextNode(nodes, textBuffer.current);
  textBuffer.current = '';
  state.pos += marker.length;
  const closingIndex = state.input.indexOf(marker, state.pos);
  if (closingIndex === -1) {
    const blockEndIfNoClose = state.len;
    if (
      state.cursorIndex !== undefined
      && state.cursorIndex >= blockStart
      && state.cursorIndex <= blockEndIfNoClose
    ) {
      textBuffer.current += state.input.slice(blockStart, blockEndIfNoClose);
      state.pos = blockEndIfNoClose;
      return true;
    }
    const codeContent = state.input.slice(state.pos);
    state.pos = state.len;
    nodes.push({ type: 'pre', language: undefined, content: codeContent });
    return true;
  }
  const blockEnd = closingIndex + marker.length;
  if (
    state.cursorIndex !== undefined
    && state.cursorIndex >= blockStart
    && state.cursorIndex <= blockEnd
  ) {
    textBuffer.current += state.input.slice(blockStart, blockEnd);
    state.pos = blockEnd;
    return true;
  }
  const inner = state.input.slice(state.pos, closingIndex);
  let language: string | undefined;
  let codeContent: string;
  const newlineIndex = inner.indexOf('\n');
  if (newlineIndex !== -1) {
    language = inner.slice(0, newlineIndex).trim() || undefined;
    codeContent = inner.slice(newlineIndex + 1);
  } else {
    codeContent = inner;
  }
  state.pos = blockEnd;
  if (inner.trim() === '') {
    appendTextNode(nodes, state.input.substring(blockStart, state.pos));
  } else {
    nodes.push({ type: 'pre', language, content: codeContent });
  }
  return true;
}

function parseHtmlPreBlock(
  state: ParserState,
  nodes: MarkdownAstNode[],
  textBuffer: { current: string },
): boolean {
  const openTag = '<pre';
  if (!state.input.startsWith(openTag, state.pos)) {
    return false;
  }
  const blockStart = state.pos;
  appendTextNode(nodes, textBuffer.current);
  textBuffer.current = '';
  const tagEnd = state.input.indexOf('>', state.pos);
  if (tagEnd === -1) {
    textBuffer.current += state.input[state.pos];
    state.pos++;
    return true;
  }
  const tagContent = state.input.slice(state.pos, tagEnd + 1);
  let language: string | undefined;
  const langMatch = tagContent.match(/data-language\s*=\s*["']([^"']+)["']/);
  if (langMatch) {
    language = langMatch[1];
  }
  state.pos = tagEnd + 1;
  const closingTag = '</pre>';
  const closingIndex = state.input.indexOf(closingTag, state.pos);
  if (closingIndex === -1) {
    const blockEndIfNoClose = state.len;
    if (
      state.cursorIndex !== undefined
      && state.cursorIndex >= blockStart
      && state.cursorIndex <= blockEndIfNoClose
    ) {
      textBuffer.current += state.input.slice(blockStart, blockEndIfNoClose);
      state.pos = blockEndIfNoClose;
      return true;
    }
    textBuffer.current += tagContent;
    return true;
  }
  const blockEnd = closingIndex + closingTag.length;
  if (
    state.cursorIndex !== undefined
    && state.cursorIndex >= blockStart
    && state.cursorIndex <= blockEnd
  ) {
    textBuffer.current += state.input.slice(blockStart, blockEnd);
    state.pos = blockEnd;
    return true;
  }
  const codeContent = state.input.slice(state.pos, closingIndex);
  state.pos = blockEnd;
  if (codeContent.trim() === '') {
    appendTextNode(nodes, state.input.substring(blockStart, state.pos));
  } else {
    nodes.push({ type: 'pre', language, content: codeContent });
  }
  return true;
}

function parseMarkdownLink(
  state: ParserState,
  nodes: MarkdownAstNode[],
  textBuffer: { current: string },
): boolean {
  if (state.input[state.pos] !== '[') {
    return false;
  }
  const linkStart = state.pos;
  const closingBracketIndex = state.input.indexOf(']', state.pos);
  if (
    closingBracketIndex === -1
    || closingBracketIndex + 1 >= state.len
    || state.input[closingBracketIndex + 1] !== '('
  ) {
    return false;
  }
  appendTextNode(nodes, textBuffer.current);
  textBuffer.current = '';
  state.pos++;
  const linkTextResult = parseNodes(state, ']');
  if (state.pos < state.len && state.input[state.pos] === '(') {
    state.pos++;
    const closingParenIndex = state.input.indexOf(')', state.pos);
    if (closingParenIndex !== -1) {
      const url = state.input.slice(state.pos, closingParenIndex);
      const linkEnd = closingParenIndex + 1;
      const overallStart = linkStart;
      const overallEnd = linkEnd;
      if (
        state.cursorIndex !== undefined
        && state.cursorIndex >= overallStart
        && state.cursorIndex <= overallEnd
      ) {
        textBuffer.current += state.input.slice(overallStart, overallEnd);
        state.pos = overallEnd;
        return true;
      }
      state.pos = linkEnd;
      const innerText = nodesToMarkdown(linkTextResult.nodes);
      if (innerText.trim() === '') {
        appendTextNode(nodes, state.input.substring(linkStart, state.pos));
      } else {
        nodes.push({ type: 'link', url, children: linkTextResult.nodes });
      }
      return true;
    } else {
      const literal = state.input.slice(linkStart);
      appendTextNode(nodes, literal);
      state.pos = state.len;
      return true;
    }
  } else {
    textBuffer.current += '[';
    return true;
  }
}

function parseInlineToken(
  state: ParserState,
  nodes: MarkdownAstNode[],
  textBuffer: { current: string },
): boolean {
  if (state.input.startsWith('<blockquote', state.pos)) {
    const tokenStart = state.pos;
    const blockquoteOpenRegex = /^<blockquote\s+([^>]+)>/i;
    const sub = state.input.slice(state.pos);
    const match = blockquoteOpenRegex.exec(sub);
    if (match) {
      const attrs = match[1];
      if (/\bdata-entity-type\s*=\s*["']MessageEntityBlockquote["']/i.test(attrs)) {
        appendTextNode(nodes, textBuffer.current);
        textBuffer.current = '';
        const tagEnd = state.input.indexOf('>', state.pos);
        if (tagEnd === -1) {
          textBuffer.current += state.input[state.pos];
          state.pos++;
          return true;
        }
        state.pos = tagEnd + 1;
        const innerResult = parseNodes(state, '</blockquote>');
        const tokenEnd = state.pos;
        const innerText = nodesToMarkdown(innerResult.nodes);
        if (innerText.trim() === '') {
          appendTextNode(nodes, state.input.substring(tokenStart, tokenEnd));
        } else if (
          state.cursorIndex !== undefined
          && state.cursorIndex >= tokenStart
          && state.cursorIndex <= tokenEnd
        ) {
          const markdownQuote = markdownMapping.quote.open + innerText + markdownMapping.quote.close;
          appendTextNode(nodes, markdownQuote);
        } else {
          nodes.push({ type: 'quote', children: innerResult.nodes });
        }
        return true;
      }
    }
  }

  if (state.input.startsWith('<a', state.pos)) {
    const aTagOpenRegex = /^<a\s+([^>]+)>/i;
    const sub = state.input.slice(state.pos);
    const match = aTagOpenRegex.exec(sub);
    if (match) {
      const attrs = match[1];
      const hrefMatch = /href\s*=\s*["']([^"']+)["']/i.exec(attrs);
      if (hrefMatch) {
        const url = hrefMatch[1];
        const tokenStart = state.pos;
        appendTextNode(nodes, textBuffer.current);
        textBuffer.current = '';
        state.pos += match[0].length;
        const innerResult = parseNodes(state, '</a>');
        const tokenEnd = state.pos;
        const innerText = nodesToMarkdown(innerResult.nodes);
        if (innerText.trim() === '') {
          appendTextNode(nodes, state.input.substring(tokenStart, tokenEnd));
        } else if (
          state.cursorIndex !== undefined
          && state.cursorIndex >= tokenStart
          && state.cursorIndex <= tokenEnd
        ) {
          appendTextNode(nodes, `[${innerText}](${url})`);
        } else {
          nodes.push({ type: 'link', url, children: innerResult.nodes });
        }
        return true;
      }
    }
  }

  if (state.input.startsWith('<code', state.pos)) {
    const codeTagOpenRegex = /^<code\s+([^>]+)>/i;
    const sub = state.input.slice(state.pos);
    const match = codeTagOpenRegex.exec(sub);
    if (match) {
      const tokenStart = state.pos;
      const attrs = match[1];
      if (/\bclass\s*=\s*["']text-entity-code["']/i.test(attrs)) {
        appendTextNode(nodes, textBuffer.current);
        textBuffer.current = '';
        state.pos += match[0].length;
        const innerResult = parseNodes(state, '</code>');
        const tokenEnd = state.pos;
        const innerText = flattenNodes(innerResult.nodes);
        if (innerText.trim() === '') {
          appendTextNode(nodes, state.input.substring(tokenStart, tokenEnd));
        } else if (
          state.cursorIndex !== undefined
          && state.cursorIndex >= tokenStart
          && state.cursorIndex <= tokenEnd
        ) {
          appendTextNode(nodes, `\`${innerText}\``);
        } else {
          nodes.push({ type: 'code', content: innerText });
        }
        return true;
      }
    }
  }
  if (state.input.startsWith('`', state.pos)) {
    const tokenStart = state.pos;
    appendTextNode(nodes, textBuffer.current);
    textBuffer.current = '';
    state.pos++;
    const closingIndex = state.input.indexOf('`', state.pos);
    if (closingIndex === -1) {
      appendTextNode(nodes, state.input.substring(tokenStart));
      state.pos = state.len;
      return true;
    }
    const innerContent = state.input.slice(state.pos, closingIndex);
    state.pos = closingIndex + 1;
    const tokenEnd = state.pos;
    if (innerContent.trim() === '') {
      appendTextNode(nodes, state.input.substring(tokenStart, tokenEnd));
    } else if (
      state.cursorIndex !== undefined
      && state.cursorIndex >= tokenStart
      && state.cursorIndex <= tokenEnd
    ) {
      appendTextNode(nodes, state.input.substring(tokenStart, tokenEnd));
    } else {
      nodes.push({ type: 'code', content: innerContent });
    }
    return true;
  }
  if (state.input.startsWith('<del', state.pos)) {
    const delOpenRegex = /^<del\s*>/i;
    const sub = state.input.slice(state.pos);
    const match = delOpenRegex.exec(sub);
    if (match) {
      const tokenStart = state.pos;
      appendTextNode(nodes, textBuffer.current);
      textBuffer.current = '';
      state.pos += match[0].length;
      const innerResult = parseNodes(state, '</del>');
      const tokenEnd = state.pos;
      const innerText = nodesToMarkdown(innerResult.nodes);
      if (innerText.trim() === '') {
        appendTextNode(nodes, state.input.substring(tokenStart, tokenEnd));
      } else if (
        state.cursorIndex !== undefined
        && state.cursorIndex >= tokenStart
        && state.cursorIndex <= tokenEnd
      ) {
        appendTextNode(nodes, `~~${innerText}~~`);
      } else {
        nodes.push({ type: 'strike', children: innerResult.nodes });
      }
      return true;
    }
  }
  if (state.input.startsWith('<span', state.pos)) {
    const spanOpenRegex = /^<span\s+([^>]+)>/i;
    const sub = state.input.slice(state.pos);
    const match = spanOpenRegex.exec(sub);
    if (match) {
      const attrs = match[1];
      if (
        /\bclass\s*=\s*["']spoiler["']/i.test(attrs)
        && /\bdata-entity-type\s*=\s*["']MessageEntitySpoiler["']/i.test(attrs)
      ) {
        const tokenStart = state.pos;
        appendTextNode(nodes, textBuffer.current);
        textBuffer.current = '';
        state.pos += match[0].length;
        const innerResult = parseNodes(state, '</span>');
        const tokenEnd = state.pos;
        const innerText = nodesToMarkdown(innerResult.nodes);
        if (innerText.trim() === '') {
          appendTextNode(nodes, state.input.substring(tokenStart, tokenEnd));
        } else if (
          state.cursorIndex !== undefined
          && state.cursorIndex >= tokenStart
          && state.cursorIndex <= tokenEnd
        ) {
          appendTextNode(nodes, `||${innerText}||`);
        } else {
          nodes.push({ type: 'spoiler', children: innerResult.nodes });
        }
        return true;
      }
    }
  }

  for (const token of tokens) {
    if (state.input.startsWith(token.open, state.pos)) {
      const tokenStart = state.pos;
      appendTextNode(nodes, textBuffer.current);
      textBuffer.current = '';
      state.pos += token.open.length;
      const innerResult = parseNodes(state, token.close);
      if (!innerResult.closed) {
        appendTextNode(nodes, state.input.slice(tokenStart, state.pos));
      } else {
        const tokenEnd = state.pos;
        const innerText = nodesToMarkdown(innerResult.nodes);
        if (innerText.trim() === '') {
          appendTextNode(nodes, state.input.substring(tokenStart, tokenEnd));
        } else if (
          state.cursorIndex !== undefined
          && state.cursorIndex >= tokenStart
          && state.cursorIndex <= tokenEnd
        ) {
          if (!token.open.startsWith('<')) {
            appendTextNode(nodes, state.input.substring(tokenStart, tokenEnd));
          } else {
            const mapping = markdownMapping[token.type];
            appendTextNode(nodes, mapping.open + innerText + mapping.close);
          }
        } else {
          nodes.push({
            type: token.type,
            children: innerResult.nodes,
          } as any);
        }
      }
      return true;
    }
  }
  return false;
}

function parseNodes(
  state: ParserState,
  stopToken: string | undefined = undefined,
): ParseResult {
  const nodes: MarkdownAstNode[] = [];
  const textBuffer = { current: '' };
  while (state.pos < state.len) {
    if (stopToken && state.input.startsWith(stopToken, state.pos)) {
      appendTextNode(nodes, textBuffer.current);
      textBuffer.current = '';
      state.pos += stopToken.length;
      return { nodes, closed: true };
    }
    if (stopToken === undefined) {
      if (parseBacktickCodeBlock(state, nodes, textBuffer)) continue;
      if (parseHtmlPreBlock(state, nodes, textBuffer)) continue;
    }
    if (parseMarkdownLink(state, nodes, textBuffer)) continue;
    if (parseInlineToken(state, nodes, textBuffer)) continue;
    textBuffer.current += state.input[state.pos];
    state.pos++;
  }
  appendTextNode(nodes, textBuffer.current);
  return { nodes, closed: stopToken === undefined };
}

function mapCursorToRawIndex(html: string, cursorPos: number): number {
  let rawIndex = 0;
  let visibleCount = 0;
  const length = html.length;
  while (rawIndex < length && visibleCount < cursorPos) {
    if (html[rawIndex] === '<') {
      const closeTag = html.indexOf('>', rawIndex);
      if (closeTag === -1) {
        visibleCount++;
        rawIndex++;
      } else {
        rawIndex = closeTag + 1;
      }
    } else if (html[rawIndex] === '&') {
      const semicolonIndex = html.indexOf(';', rawIndex);
      if (semicolonIndex !== -1) {
        visibleCount++;
        rawIndex = semicolonIndex + 1;
      } else {
        visibleCount++;
        rawIndex++;
      }
    } else {
      visibleCount++;
      rawIndex++;
    }
  }
  return rawIndex;
}

export function parseStringToMarkdownAst(
  inputStr: string,
  cursorPosition?: number,
): MarkdownAstNode[] {
  let rawCursorIndex: number | undefined;
  if (cursorPosition !== undefined && cursorPosition >= 0) {
    rawCursorIndex = mapCursorToRawIndex(inputStr, cursorPosition);
  }
  const state = createParserState(inputStr, rawCursorIndex);
  return parseNodes(state, undefined).nodes;
}

export function parseASTtoHTML(ast: MarkdownAstNode[]): string {
  let html = '';
  for (const node of ast) {
    switch (node.type) {
      case 'text':
        html += node.content;
        break;
      case 'bold':
        html += `<strong>${parseASTtoHTML(node.children)}</strong>`;
        break;
      case 'italic':
        html += `<em>${parseASTtoHTML(node.children)}</em>`;
        break;
      case 'strike':
        html += `<del>${parseASTtoHTML(node.children)}</del>`;
        break;
      case 'spoiler':
        html += `<span class="spoiler" data-entity-type="MessageEntitySpoiler">${parseASTtoHTML(node.children)}</span>`;
        break;
      case 'link':
        html += `<a href="${node.url}">${parseASTtoHTML(node.children)}</a>`;
        break;
      case 'pre':
        if (node.language) {
          html += `<pre data-language="${node.language}">${node.content}</pre>`;
        } else {
          html += `<pre>${node.content}</pre>`;
        }
        break;
      case 'underline':
        html += `<u>${parseASTtoHTML(node.children)}</u>`;
        break;
      case 'code':
        html += '<code class="text-entity-code" role="textbox" tabindex="0"'
          + ` data-entity-type="MessageEntityCode">${node.content}</code>`;
        break;
      case 'quote':
        html += '<blockquote class="Blockquote-module__blockquote blockquite-width-auto" '
          + `data-entity-type="MessageEntityBlockquote">${parseASTtoHTML(node.children)}</blockquote>`;
        break;
      default:
        break;
    }
  }
  return html;
}
