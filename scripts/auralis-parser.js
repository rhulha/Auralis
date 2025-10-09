export class AuralisParser {
  constructor() {
    this.tokens = [];
    this.current = 0;
  }

  tokenize(source) {
    const tokens = [];
    const lines = source.split('\n');

    for (let lineNum = 0; lineNum < lines.length; lineNum++) {
      const line = lines[lineNum];
      const indent = line.match(/^(\s*)/)[0].length;
      const trimmed = line.trim();

      if (!trimmed || trimmed.startsWith('#')) continue;

      tokens.push({ type: 'INDENT', value: indent, line: lineNum });

      let i = indent;
      while (i < line.length) {
        const char = line[i];

        if (/\s/.test(char)) {
          i++;
          continue;
        }

        if (char === '→') {
          tokens.push({ type: 'ARROW', value: '→', line: lineNum });
          i++;
        } else if (char === '+') {
          tokens.push({ type: 'PLUS', value: '+', line: lineNum });
          i++;
        } else if (char === '=') {
          tokens.push({ type: 'EQUALS', value: '=', line: lineNum });
          i++;
        } else if (char === ':') {
          tokens.push({ type: 'COLON', value: ':', line: lineNum });
          i++;
        } else if (char === ',') {
          tokens.push({ type: 'COMMA', value: ',', line: lineNum });
          i++;
        } else if (char === '(') {
          tokens.push({ type: 'LPAREN', value: '(', line: lineNum });
          i++;
        } else if (char === ')') {
          tokens.push({ type: 'RPAREN', value: ')', line: lineNum });
          i++;
        } else if (char === '#') {
          break;
        } else if (/[a-zA-Z_]/.test(char)) {
          let word = '';
          while (i < line.length && /[a-zA-Z0-9_]/.test(line[i])) {
            word += line[i++];
          }
          const keywords = ['sound', 'mix'];
          const type = keywords.includes(word) ? word.toUpperCase() : 'IDENTIFIER';
          tokens.push({ type, value: word, line: lineNum });
        } else if (/[0-9]/.test(char) || char === '-') {
          let num = '';
          while (i < line.length && /[0-9.\-]/.test(line[i])) {
            num += line[i++];
          }
          let unit = '';
          while (i < line.length && /[a-zA-Z]/.test(line[i])) {
            unit += line[i++];
          }
          tokens.push({
            type: 'NUMBER',
            value: parseFloat(num),
            unit: unit || null,
            line: lineNum
          });
        } else {
          throw new Error(`Unexpected character '${char}' at line ${lineNum + 1}`);
        }
      }

      tokens.push({ type: 'NEWLINE', value: '\n', line: lineNum });
    }

    tokens.push({ type: 'EOF', value: null, line: lines.length });
    return tokens;
  }

  parse(source) {
    this.tokens = this.tokenize(source);
    this.current = 0;

    const sounds = [];

    while (!this.isAtEnd()) {
      if (this.check('SOUND')) {
        sounds.push(this.parseSoundDef());
      } else {
        this.advance();
      }
    }

    return { type: 'Program', sounds };
  }

  parseSoundDef() {
    this.consume('SOUND', "Expected 'sound'");
    const name = this.consume('IDENTIFIER', 'Expected sound name').value;

    let params = [];
    if (this.check('LPAREN')) {
      this.advance();
      params = this.parseParameters();
      this.consume('RPAREN', "Expected ')'");
    }

    this.consume('COLON', "Expected ':'");
    this.consumeNewlines();

    const baseIndent = this.peek().value;
    const body = [];

    while (!this.isAtEnd() && this.check('INDENT') && this.peek().value >= baseIndent) {
      if (this.peek().value === baseIndent) {
        this.advance();
        const stmt = this.parseStatement();
        if (stmt) body.push(stmt);
      } else {
        break;
      }
    }

    return {
      type: 'SoundDef',
      name,
      params,
      body
    };
  }

  parseParameters() {
    const params = [];

    if (!this.check('RPAREN')) {
      do {
        const name = this.consume('IDENTIFIER', 'Expected parameter name').value;
        let defaultValue = null;

        if (this.match('EQUALS')) {
          defaultValue = this.parseExpression();
        }

        params.push({ name, defaultValue });
      } while (this.match('COMMA'));
    }

    return params;
  }

  parseStatement() {
    if (this.check('IDENTIFIER')) {
      const ident = this.peek();
      this.advance();

      if (this.match('EQUALS')) {
        const value = this.parseExpression();
        this.consumeNewlines();
        return {
          type: 'Assignment',
          name: ident.value,
          value
        };
      }
    }

    if (this.check('MIX') || this.check('IDENTIFIER') || this.check('NUMBER')) {
      const expr = this.parseExpression();
      this.consumeNewlines();
      return {
        type: 'Expression',
        value: expr
      };
    }

    this.consumeNewlines();
    return null;
  }

  parseExpression() {
    return this.parsePipeline();
  }

  parsePipeline() {
    let left = this.parseMix();

    while (this.match('ARROW')) {
      const right = this.parseMix();
      left = {
        type: 'Pipeline',
        left,
        right
      };
    }

    return left;
  }

  parseMix() {
    let left = this.parsePrimary();

    while (this.match('PLUS')) {
      const right = this.parsePrimary();
      left = {
        type: 'Mix',
        left,
        right
      };
    }

    return left;
  }

  parsePrimary() {
    if (this.match('MIX')) {
      return this.parseMix();
    }

    if (this.check('NUMBER')) {
      const token = this.advance();
      return {
        type: 'Literal',
        value: token.value,
        unit: token.unit
      };
    }

    if (this.check('IDENTIFIER')) {
      const name = this.advance().value;

      if (this.match('LPAREN')) {
        const args = this.parseArguments();
        this.consume('RPAREN', "Expected ')'");
        return {
          type: 'FunctionCall',
          name,
          args
        };
      }

      return {
        type: 'Identifier',
        name
      };
    }

    if (this.match('LPAREN')) {
      const expr = this.parseExpression();
      this.consume('RPAREN', "Expected ')'");
      return expr;
    }

    throw new Error(`Unexpected token: ${this.peek().type}`);
  }

  parseArguments() {
    const args = [];

    if (!this.check('RPAREN')) {
      do {
        const isNamedArg = (this.check('IDENTIFIER') || this.check('MIX')) &&
                           this.tokens[this.current + 1]?.type === 'EQUALS';

        if (isNamedArg) {
          const name = this.advance().value;
          this.consume('EQUALS', "Expected '='");
          const value = this.parseArgumentExpression();
          args.push({ name, value });
        } else {
          args.push({ value: this.parseArgumentExpression() });
        }
      } while (this.match('COMMA'));
    }

    return args;
  }

  parseArgumentExpression() {
    return this.parseArgumentPipeline();
  }

  isAtArgumentBoundary() {
    if (this.check('COMMA') || this.check('RPAREN') || this.isAtEnd()) {
      return true;
    }
    return false;
  }

  parseArgumentPipeline() {
    let left = this.parseArgumentMix();

    while (this.check('ARROW') && !this.isAtArgumentBoundary()) {
      this.advance();
      const right = this.parseArgumentMix();
      left = {
        type: 'Pipeline',
        left,
        right
      };
    }

    return left;
  }

  parseArgumentMix() {
    let left = this.parseArgumentPrimary();

    while (this.check('PLUS') && !this.isAtArgumentBoundary()) {
      this.advance();
      const right = this.parseArgumentPrimary();
      left = {
        type: 'Mix',
        left,
        right
      };
    }

    return left;
  }

  parseArgumentPrimary() {
    if (this.match('MIX')) {
      return this.parseArgumentMix();
    }

    if (this.check('NUMBER')) {
      const token = this.advance();
      return {
        type: 'Literal',
        value: token.value,
        unit: token.unit
      };
    }

    if (this.check('IDENTIFIER')) {
      const lookahead = this.tokens[this.current + 1];

      if (lookahead?.type === 'EQUALS') {
        throw new Error(`Named argument '${this.peek().value}=' found in expression context. This should be handled by parseArguments.`);
      }

      const name = this.advance().value;

      if (this.match('LPAREN')) {
        const args = this.parseArguments();
        this.consume('RPAREN', "Expected ')'");
        return {
          type: 'FunctionCall',
          name,
          args
        };
      }

      return {
        type: 'Identifier',
        name
      };
    }

    if (this.match('LPAREN')) {
      const expr = this.parseArgumentExpression();
      this.consume('RPAREN', "Expected ')'");
      return expr;
    }

    throw new Error(`Unexpected token in argument: ${this.peek().type}`);
  }

  match(...types) {
    for (const type of types) {
      if (this.check(type)) {
        this.advance();
        return true;
      }
    }
    return false;
  }

  check(type) {
    if (this.isAtEnd()) return false;
    return this.peek().type === type;
  }

  advance() {
    if (!this.isAtEnd()) this.current++;
    return this.previous();
  }

  isAtEnd() {
    return this.peek().type === 'EOF';
  }

  peek() {
    return this.tokens[this.current];
  }

  previous() {
    return this.tokens[this.current - 1];
  }

  consume(type, message) {
    if (this.check(type)) return this.advance();
    throw new Error(`${message} at line ${this.peek().line + 1}`);
  }

  consumeNewlines() {
    while (this.match('NEWLINE')) {}
  }
}
