const Tokenizer = require('./Tokenizer.js');
const { defaults } = require('./defaults.js');
const { block, inline } = require('./rules.js');
const { repeatString } = require('./helpers.js');

/**
 * smartypants text replacement
 */
function smartypants(text) {
  return text
    // em-dashes
    .replace(/---/g, '\u2014')
    // en-dashes
    .replace(/--/g, '\u2013')
    // opening singles
    .replace(/(^|[-\u2014/(\[{"\s])'/g, '$1\u2018')
    // closing singles & apostrophes
    .replace(/'/g, '\u2019')
    // opening doubles
    .replace(/(^|[-\u2014/(\[{\u2018\s])"/g, '$1\u201c')
    // closing doubles
    .replace(/"/g, '\u201d')
    // ellipses
    .replace(/\.{3}/g, '\u2026');
}

/**
 * mangle email addresses
 */
function mangle(text) {
  let out = '',
    i,
    ch;

  const l = text.length;
  for (i = 0; i < l; i++) {
    ch = text.charCodeAt(i);
    if (Math.random() > 0.5) {
      ch = 'x' + ch.toString(16);
    }
    out += '&#' + ch + ';';
  }

  return out;
}

/**
 * Block Lexer
 */
module.exports = class Lexer {
  constructor(options) {
    this.tokens = [];
    this.tokens.links = Object.create(null);
    this.options = options || defaults;
    this.options.tokenizer = this.options.tokenizer || new Tokenizer();
    this.tokenizer = this.options.tokenizer;
    this.tokenizer.options = this.options;

    const rules = {
      block: block.normal,
      inline: inline.normal
    };

    if (this.options.pedantic) {
      rules.block = block.pedantic;
      rules.inline = inline.pedantic;
    } else if (this.options.gfm) {
      rules.block = block.gfm;
      if (this.options.breaks) {
        rules.inline = inline.breaks;
      } else {
        rules.inline = inline.gfm;
      }
    }
    this.tokenizer.rules = rules;

    // TOO SLOW
    // this.blockTokenizers = new Map([
    //   ['newline', this.newline],
    //   ['code', this.code],
    //   ['fences', this.fences],
    //   ['nptable', this.nptable],
    //   ['heading', this.heading],
    //   ['hr', this.hr],
    //   ['blockquote', this.blockquote],
    //   ['list', this.list],
    //   ['html', this.html],
    //   ['def', this.def],
    //   ['table', this.table],
    //   ['lheading', this.lheading],
    //   ['paragraph', this.paragraph],
    //   ['text', this.text]
    // ]);

    // this.blockTokenizers = [
    //   this.newline,
    //   this.code,
    //   this.fences,
    //   this.nptable,
    //   this.heading,
    //   this.hr,
    //   this.blockquote,
    //   this.list,
    //   this.html,
    //   this.def,
    //   this.table,
    //   this.lheading,
    //   this.paragraph,
    //   this.text
    // ];

    // Array of objects only slightly slower than raw array (~4720 -> ~4750 ms)
    this.blockTokenizers = [
      { name: 'newline', func: this.newline },
      { name: 'code', func: this.code },
      { name: 'fences', func: this.fences },
      { name: 'nptable', func: this.nptable },
      { name: 'heading', func: this.heading },
      { name: 'hr', func: this.hr },
      { name: 'blockquote', func: this.blockquote },
      { name: 'list', func: this.list },
      { name: 'html', func: this.html },
      { name: 'def', func: this.def },
      { name: 'table', func: this.table },
      { name: 'lheading', func: this.lheading },
      { name: 'paragraph', func: this.paragraph },
      { name: 'text', func: this.text }
    ];

    // TOO SLOW
    // this.inlineTokenizers = new Map([
    //   ['escape', this.escape],
    //   ['tag', this.tag],
    //   ['link', this.link],
    //   ['reflink', this.reflink],
    //   ['strong', this.strong],
    //   ['em', this.em],
    //   ['codespan', this.codespan],
    //   ['br', this.br],
    //   ['del', this.del],
    //   ['autolink', this.autolink],
    //   ['url', this.url],
    //   ['inlineText', this.inlineText]
    // ]);

    // this.inlineTokenizers = [
    //   this.escape,
    //   this.tag,
    //   this.link,
    //   this.reflink,
    //   this.strong,
    //   this.em,
    //   this.codespan,
    //   this.br,
    //   this.del,
    //   this.autolink,
    //   this.url,
    //   this.inlineText
    // ];

    this.inlineTokenizers = [
      { name: 'escape', func: this.escape },
      { name: 'tag', func: this.tag },
      { name: 'link', func: this.link },
      { name: 'reflink', func: this.reflink },
      { name: 'strong', func: this.strong },
      { name: 'em', func: this.em },
      { name: 'codespan', func: this.codespan },
      { name: 'br', func: this.br },
      { name: 'del', func: this.del },
      { name: 'autolink', func: this.autolink },
      { name: 'url', func: this.url },
      { name: 'inlineText', func: this.inlineText }
    ];
  }

  /**
   * Expose Rules
   */
  static get rules() {
    return {
      block,
      inline
    };
  }

  /**
   * Static Lex Method
   */
  static lex(src, options) {
    const lexer = new Lexer(options);
    return lexer.lex(src);
  }

  /**
   * Static Lex Inline Method
   */
  static lexInline(src, options) {
    const lexer = new Lexer(options);
    return lexer.inlineTokens(src);
  }

  /**
   * Preprocessing
   */
  lex(src) {
    src = src
      .replace(/\r\n|\r/g, '\n')
      .replace(/\t/g, '    ');

    this.blockTokens(src, this.tokens, true);

    this.inline(this.tokens);

    return this.tokens;
  }

  /**
   * Lexing
   */

  // newline
  newline(src, params) {
    let token;
    if (token = this.tokenizer.space(src)) {
      return token;
    }
  }

  // code
  code(src, params) {
    let token;
    if (token = this.tokenizer.code(src, params.lastToken)) {
      return token;
    }
  }

  // fences
  fences(src, params) {
    let token;
    if (token = this.tokenizer.fences(src)) {
      return token;
    }
  }

  // table no leading pipe (gfm)
  nptable(src, params) {
    let token;
    if (token = this.tokenizer.nptable(src)) {
      return token;
    }
  }

  // heading
  heading(src, params) {
    let token;
    if (token = this.tokenizer.heading(src)) {
      return token;
    }
  }

  // hr
  hr(src, params) {
    let token;
    if (token = this.tokenizer.hr(src)) {
      return token;
    }
  }

  // blockquote
  blockquote(src, params) {
    let token;
    if (token = this.tokenizer.blockquote(src)) {
      token.tokens = this.blockTokens(token.text, [], params.top);
      return token;
    }
  }

  // list
  list(src, params) {
    let token;
    if (token = this.tokenizer.list(src)) {
      const l = token.items.length;
      let i;
      for (i = 0; i < l; i++) {
        token.items[i].tokens = this.blockTokens(token.items[i].text, [], false);
      }
      return token;
    }
  }

  // html
  html(src, params) {
    let token;
    if (token = this.tokenizer.html(src)) {
      return token;
    }
  }

  // def
  def(src, params) {
    let token;
    if (params.top && (token = this.tokenizer.def(src))) {
      if (!this.tokens.links[token.tag]) {
        this.tokens.links[token.tag] = {
          href: token.href,
          title: token.title
        };
      }
      return token;
    }
  }

  // table (gfm)
  table(src, params) {
    let token;
    if (token = this.tokenizer.table(src)) {
      return token;
    }
  }

  // lheading
  lheading(src, params) {
    let token;
    if (token = this.tokenizer.lheading(src, params)) {
      return token;
    }
  }

  // top-level paragraph
  paragraph(src, params) {
    let token;
    if (params.top && (token = this.tokenizer.paragraph(src))) {
      return token;
    }
  }

  // text
  text(src, params) {
    let token;
    if (token = this.tokenizer.text(src, params.lastToken)) {
      return token;
    }
  }

  blockTokens(src, tokens = [], top = true) {
    let token;
    src = src.replace(/^ +$/gm, '');

    const blockParams = {
      top: top,
      lastToken: null
    };

    while (src) {
      if (this.blockTokenizers.some(fn => token = fn.func.call(this, src, blockParams))) {
        src = src.substring(token.raw.length);
        if (token.type) {
          if (token.type === 'continue') {
            blockParams.lastToken.raw += '\n' + token.raw;
            blockParams.lastToken.text += '\n' + token.text;
          } else {
            tokens.push(token);
            blockParams.lastToken = token;
          }
        }
        continue;
      }

      if (src) {
        const errMsg = 'Infinite loop on byte: ' + src.charCodeAt(0);
        if (this.options.silent) {
          console.error(errMsg);
          break;
        } else {
          throw new Error(errMsg);
        }
      }
    }

    return tokens;
  }

  inline(tokens) {
    let i,
      j,
      k,
      l2,
      row,
      token;

    const l = tokens.length;
    for (i = 0; i < l; i++) {
      token = tokens[i];
      switch (token.type) {
        case 'paragraph':
        case 'text':
        case 'heading': {
          token.tokens = [];
          this.inlineTokens(token.text, token.tokens);
          break;
        }
        case 'table': {
          token.tokens = {
            header: [],
            cells: []
          };

          // header
          l2 = token.header.length;
          for (j = 0; j < l2; j++) {
            token.tokens.header[j] = [];
            this.inlineTokens(token.header[j], token.tokens.header[j]);
          }

          // cells
          l2 = token.cells.length;
          for (j = 0; j < l2; j++) {
            row = token.cells[j];
            token.tokens.cells[j] = [];
            for (k = 0; k < row.length; k++) {
              token.tokens.cells[j][k] = [];
              this.inlineTokens(row[k], token.tokens.cells[j][k]);
            }
          }

          break;
        }
        case 'blockquote': {
          this.inline(token.tokens);
          break;
        }
        case 'list': {
          l2 = token.items.length;
          for (j = 0; j < l2; j++) {
            this.inline(token.items[j].tokens);
          }
          break;
        }
        default: {
          // do nothing
        }
      }
    }

    return tokens;
  }

  // escape
  escape(src, params) {
    let token;
    if (token = this.tokenizer.escape(src)) {
      return token;
    }
  }

  // tag
  tag(src, params) {
    let token;
    if (token = this.tokenizer.tag(src, params.inLink, params.inRawBlock)) {
      params.inLink = token.inLink;
      params.inRawBlock = token.inRawBlock;
      return token;
    }
  }

  // link
  link(src, params) {
    let token;
    if (token = this.tokenizer.link(src)) {
      if (token.type === 'link') {
        token.tokens = this.inlineTokens(token.text, [], true, params.inRawBlock);
      }
      return token;
    }
  }

  // reflink, nolink
  reflink(src, params) {
    let token;
    if (token = this.tokenizer.reflink(src, this.tokens.links)) {
      if (token.type === 'link') {
        token.tokens = this.inlineTokens(token.text, [], true, params.inRawBlock);
      }
      return token;
    }
  }

  // strong
  strong(src, params) {
    let token;
    if (token = this.tokenizer.strong(src, params.maskedSrc, params.prevChar)) {
      token.tokens = this.inlineTokens(token.text, [], params.inLink, params.inRawBlock);
      return token;
    }
  }

  // em
  em(src, params) {
    let token;
    if (token = this.tokenizer.em(src, params.maskedSrc, params.prevChar)) {
      token.tokens = this.inlineTokens(token.text, [], params.inLink, params.inRawBlock);
      return token;
    }
  }

  // code
  codespan(src, params) {
    let token;
    if (token = this.tokenizer.codespan(src)) {
      return token;
    }
  }

  // br
  br(src, params) {
    let token;
    if (token = this.tokenizer.br(src)) {
      return token;
    }
  }

  // del (gfm)
  del(src, params) {
    let token;
    if (token = this.tokenizer.del(src)) {
      token.tokens = this.inlineTokens(token.text, [], params.inLink, params.inRawBlock);
      return token;
    }
  }

  // autolink
  autolink(src, params) {
    let token;
    if (token = this.tokenizer.autolink(src, params.mangle)) {
      return token;
    }
  }

  // url (gfm)
  url(src, params) {
    let token;
    if (!params.inLink && (token = this.tokenizer.url(src, params.mangle))) {
      return token;
    }
  }

  // text
  inlineText(src, params) {
    let token;
    if (token = this.tokenizer.inlineText(src, params.inRawBlock, params.smartypants)) {
      params.prevChar = token.raw.slice(-1);
      params.keepPrevChar = true;
      return token;
    }
  }

  /**
   * Lexing/Compiling
   */
  inlineTokens(src, tokens = [], inLink = false, inRawBlock = false) {
    let match, token;
    let maskedSrc = src;

    // Mask out reflinks to avoid interference with em and strong
    if (this.tokens.links) {
      const links = Object.keys(this.tokens.links);
      if (links.length > 0) {
        while ((match = this.tokenizer.rules.inline.reflinkSearch.exec(maskedSrc)) != null) {
          if (links.includes(match[0].slice(match[0].lastIndexOf('[') + 1, -1))) {
            maskedSrc = maskedSrc.slice(0, match.index) + '[' + repeatString('a', match[0].length - 2) + ']' + maskedSrc.slice(this.tokenizer.rules.inline.reflinkSearch.lastIndex);
          }
        }
      }
    }
    // Mask out other blocks
    while ((match = this.tokenizer.rules.inline.blockSkip.exec(maskedSrc)) != null) {
      maskedSrc = maskedSrc.slice(0, match.index) + '[' + repeatString('a', match[0].length - 2) + ']' + maskedSrc.slice(this.tokenizer.rules.inline.blockSkip.lastIndex);
    }

    const inlineParams = {
      inLink: inLink,
      inRawBlock: inRawBlock,
      maskedSrc: maskedSrc,
      prevChar: false,
      keepPrevChar: false,

      mangle: mangle,
      smartypants: smartypants
    };

    while (src) {
      if (!inlineParams.keepPrevChar) {
        inlineParams.prevChar = '';
      }
      inlineParams.keepPrevChar = false;

      if (this.inlineTokenizers.some(fn => token = fn.func.call(this, src, inlineParams))) {
        src = src.substring(token.raw.length);
        tokens.push(token);
        continue;
      }

      if (src) {
        const errMsg = 'Infinite loop on byte: ' + src.charCodeAt(0);
        if (this.options.silent) {
          console.error(errMsg);
          break;
        } else {
          throw new Error(errMsg);
        }
      }
    }

    return tokens;
  }
};
