/* lc.js - 20190126 */

let lc = function() {
  let lc = {};
  /* --- Source --- */
  function Source(name, src) {
    this.name = name;
    this.src = src;
    this.length = src.length;
  }
  lc.Source = Source;
  Source.prototype.calculatePosition = function(p) {
    if(p < 0 || p > this.src.length) {
      return null;
    }
    let l = 1;
    let c = 1;
    for(let i = 0; i < p; i++) {
      if(this.src[i] == '\n') {
        l += 1;
        c = 1;
      } else {
        c += 1;
      }
    }
    return [l, c];
  };

  /* --- Utility Functions --- */
  function CompileError(src, p, msg) {
    this.src = src;
    this.p = p;
    this.msg = msg;
  }
  lc.CompileError = CompileError;
  CompileError.prototype.toString = function() {
    let pos = this.src.calculatePosition(this.p);
    let posMark = "";
    if(pos == null) {
      posMark = "<PREDEF>";
    } else {
      posMark = this.src.name + ":" + pos[0] + ":" + pos[1];
    }
    return posMark + ": " + this.msg;
  };

  let escape = (s) => {
    let res = "";
    for(let i = 0; i < s.length; i++) {
      switch(s[i]) {
      case '\0': res += "\\0"; break;
      case '\t': res += "\\t"; break;
      case '\r': res += "\\r"; break;
      case '\n': res += "\\n"; break;
      case '\'': res += "\\'"; break;
      case '\"': res += '\\"'; break;
      case '\\': res += "\\\\"; break;
      default: res += s[i];
      }
    }
    return res;
  };

  let unescape = (s) => {
    let res = "";
    for(let i = 0; i < s.length; i++) {
      if(s[i] == '\\' || s[i] == 'λ') {
        i++;
        switch(s[i]) {
        case '0': res += "\0"; break;
        case 't': res += "\t"; break;
        case 'r': res += "\r"; break;
        case 'n': res += "\n"; break;
        default: res += s[i]; break;
        }
      } else res += s[i];
    }
    return res;
  };

  let opPriority = (op) => {
    switch(op[0]) {
    case '*': case '/': case '%': return 8;
    case '+': case '-': return 7;
    case '!': case '=': case '<': case '>': return 6;
    case '&': return 5;
    case '|': return 4;
    case '^': return 3;
    case ':': case ',': return 2.5;
    case '~': return 2;
    case '$': return 0.5;
    default: return 10;
    }
  };

  let reverseOp = (op) => {
    let res = '';
    for(let i = op.length - 1; i >= 0; i--) {
      switch(op[i]) {
      case '<': res += '>'; break;
      case '>': res += '<'; break;
      default: res += op[i];
      }
    }
    return res;
  };

  /* --- Preprocess for Parsing --- */
  let preprocess = (src, predefined) => {
    // Make predefined
    let prefix = "";
    let suffix = "";
    for(var i = 0; i < predefined.length; i++) {
      prefix = prefix + "(\\" + predefined[i].name + ".(";
      suffix = "))(" + predefined[i].body + ")" + suffix;
    }
    let s = prefix + src + suffix;
    let off = prefix.length;
    let l = s.length;
    let res = String();
    for(let i = 0; i < l; i++) {
      switch(s[i]) {
      case '#': // Remove Line Comments
        while(s[i] != '\n' && i < l) {
          res += ' ';
          i++;
        }
        break;
      case '\n': // Remove White Characters
      case '\r':
      case '\t':
      case '\v': res += ' '; break;
      default:
        res += s[i];
      }
    }
    return {
      result: res,
      offset: off,
      length: src.length
    };
  };
  lc.preprocess = preprocess;

  /* --- Parser --- */
  /* Token
    :NUM, :STR, :ID, :BUILTIN, :LAM, :APP */
  function Token(src, p, type, data) {
    this.src = src;
    this.p = p;
    this.type = type;
    this.data = data;
  }
  lc.Token = Token;
  Token.prototype.toString = function() {
    var a = "";
    switch(this.type) {
    case 'num': return String(this.data);
    case 'str': return '"' + escape(this.data) + '"';
    case 'id': return this.data;
    case 'builtin': return '@' + this.data;
    case 'lam':
      return '\\' + this.data[0] + ".(" + this.data[1].toString() + ")";
    case 'app':
      a = this.data[1].toString();
      if(this.data[1].type == 'app') a = '(' + a + ')';
      return this.data[0].toString() + " " + a;
    }
  };

  function ParseState(name, src, predefined) {
    this.src = new Source(name, src);
    let pp = preprocess(src, predefined);
    this.preprocessed = pp.result;
    this.predefOff = pp.offset;
    this.p = 0;
    this.l = 1;
    this.c = 1;
    this.stack = [];
  }
  lc.ParseState = ParseState;
  ParseState.prototype.push = function() {
    this.stack.push({p: this.p, l: this.l, c: this.c});
  };
  ParseState.prototype.restore = function() {
    let o = this.stack.pop();
    if(o != undefined) {
      this.p = o.p;
      this.l = o.l;
      this.c = o.c;
    }
    return null;
  };
  ParseState.prototype.pop = function() { return this.stack.pop(); };
  ParseState.prototype.cur = function(n) {
    if(n == undefined) n = 1;
    if(this.p >= this.preprocessed.length) return undefined;
    return this.preprocessed.substring(this.p, this.p + n);
  };
  ParseState.prototype.sub = function(p, n) {
    if(p == undefined) p = this.p;
    if(n == undefined) n = 1;
    return this.preprocessed.substring(p, p + n);
  };
  ParseState.prototype.pass = function(n) { /* Pass n characters */
    if(n == undefined) n = 1;
    this.p += n;
    if(this.p >= this.preprocessed.length) this.p = this.preprocessed.length;
  };
  ParseState.prototype.passSpaces = function() { /* Pass All Spaces */
    while(this.p < this.preprocessed.length &&
          this.preprocessed[this.p] === ' ') this.p++;
  };
  ParseState.prototype.is = function(c) { return this.cur() === c; };
  ParseState.prototype.isInRange = function(from, to) {
    let c = this.cur();
    return from <= c && c <= to;
  };
  ParseState.prototype.isDigit = function() {
    return this.isInRange('0', '9');
  };
  ParseState.prototype.isIdChar = function() {
    let d = this.isDigit();
    let u = this.isInRange('A', 'Z');
    let l = this.isInRange('a', 'z');
    let s = this.is('_');
    return d || u || l || s;
  };
  ParseState.prototype.isOpChar = function() {
    let i = "~!$%^&*-+=|:<>/?,".indexOf(this.cur());
    return i >= 0;
  };
  ParseState.prototype.unexpectedMsg = function(p) {
    if(p >= this.preprocessed.length || this.src.src[p] == undefined) {
      return "unexpected EOF";
    } else {
      return "unexpected '" + this.src.src[p] + "'";
    }
  };

  let tryParseNumber = (S) => {
    S.push();
    let b = S.p;
    if(S.is('+') || S.is('-')) S.pass();
    let t = S.p;
    while(S.isDigit()) {
      S.pass();
    }
    if(S.p - t <= 0) return S.restore();
    let n = S.sub(b, S.p - b);
    S.pop();
    return new Token(S.src, b - S.predefOff, 'num', Number(n));
  };

  let tryParseString = (S) => {
    S.push();
    let b = S.p;
    if(!S.is('"')) return S.restore();
    else S.pass();
    let p = S.p;
    while(S.cur() && !S.is('"')) {
      if(S.is('\\')) S.pass();
      S.pass();
    }
    let e = S.p;
    if(!S.is('"')) {
      throw new CompileError(S.src, S.p - S.predefOff,
        "wrong string format");
    } else S.pass();
    S.pop();
    return new Token(S.src, b - S.predefOff, 'str', unescape(S.sub(p, e - p)));
  };

  let tryParseId = (S) => {
    S.push();
    let b = S.p;
    while(S.isIdChar()) S.pass();
    if(S.p - b <= 0) return S.restore();
    S.pop();
    return new Token(S.src, b - S.predefOff, 'id', S.sub(b, S.p - b));
  };

  let tryParseOpId = (S) => {
    S.push();
    if(!S.is('(')) return S.restore();
    else S.pass();
    S.passSpaces();
    let id = tryParseOp(S);
    if(id == null) return S.restore();
    S.passSpaces();
    if(!S.is(')')) return S.restore();
    else S.pass();
    S.pop();
    id.type = 'id';
    return id;
  };

  let tryParseBuiltin = (S) => {
    S.push();
    let b = S.p;
    if(!S.is('@')) return S.restore();
    else S.pass();
    let p = S.p;
    let id = tryParseId(S);
    if(id == null) {
      throw new CompileError(S.src, p - S.predefOff, "expect :ID");
    }
    id.p -= 1;
    id.type = 'builtin';
    return id;
  };

  let tryParseOp = (S) => {
    S.push();
    let b = S.p;
    while(S.isOpChar()) {
      S.pass();
    }
    if(S.p - b <= 0) return S.restore();
    S.pop();
    return new Token(S.src, b - S.predefOff, 'id', S.sub(b, S.p - b));
  };

  let tryParseParen = (S) => {
    S.push();
    let b = S.p;
    if(!S.is('(')) return S.restore();
    else S.pass();
    let c = parseLine(S);
    if(c == null) {
      throw new CompileError(S.src, S.p - S.predefOff,
                            S.unexpectedMsg(S.p) + ", incorrect paren body");
    }
    S.passSpaces();
    if(!S.is(')')) {
      throw new CompileError(S.src, S.p - S.predefOff,
                            S.unexpectedMsg(S.p) + ", expect ')'");
    } else S.pass();
    S.pop();
    return c;
  };

  let tryParseLambda = (S) => {
    S.push();
    let b = S.p;
    if(!S.is('\\') && !S.is('λ')) return S.restore();
    else S.pass();
    let p = S.p;
    S.passSpaces();
    let id = tryParseOpId(S) || tryParseId(S);
    if(id == null) {
      id = new Token(S.src, p, 'id', '_');
    }
    S.passSpaces();
    if(S.is('.')) {
      S.pass();
      S.passSpaces();
      let x = parseLine(S);
      if(x == null) {
        throw new CompileError(S.src, S.p - S.predefOff,
                              S.unexpectedMsg(S.p) + ", expect body of lambda");
      }
      S.pop();
      return new Token(S.src, b - S.predefOff, 'lam', [id, x]);
    } else {
      let op = tryParseOp(S);
      if(op == null) {
        throw new CompileError(S.src, S.p - S.predefOff,
                              S.unexpectedMsg(S.p) + ", expect '.' or operator");
      }
      op.data = reverseOp(op.data);
      let x = parseLine(S);
      if(x == null) {
        throw new CompileError(S.src, S.p - S.predefOff,
                              S.unexpectedMsg(S.p) + ", expect correct RHS");
      } else if(!S.is(';')) {
        throw new CompileError(S.src, S.p - S.predefOff,
                              S.unexpectedMsg(S.p) + ", expect ';'");
      }
      S.pass();
      let y = parseLine(S);
      if(y == null) {
        throw new CompileError(S.src, S.p - S.predefOff,
                              S.unexpectedMsg(S.p) + ", expect correct body");
      }
      S.pop();
      let l = new Token(S.src, b - S.predefOff, 'lam', [id, y]);
      let o = new Token(S.src, b - S.predefOff, 'app', [op, l]);
      return new Token(S.src, b - S.predefOff, 'app', [o, x]);
    }
  };

  let parseOne = (S) => {
    S.passSpaces();
    return tryParseOpId(S) ||
      tryParseParen(S) ||
      tryParseBuiltin(S) ||
      tryParseLambda(S) ||
      tryParseNumber(S) ||
      tryParseString(S) ||
      tryParseId(S);
  };

  let packOp = (S, stack) => {
    let y = stack.pop();
    let p = stack.pop();
    let x = stack.pop();
    if(x == null) {
      x = new Token(S.src, y.p, 'app', [p, y]);
    } else if(p.data === '') {
      x = new Token(S.src, y.p, 'app', [x, y]);
    } else {
      y = new Token(S.src, y.p, 'app', [p, y]);
      x = new Token(S.src, x.p, 'app', [y, x]);
    }
    stack.push(x);
  };

  let parseLine = (S) => {
    let stack = [];
    stack.push(parseOne(S));
    while(true) {
      S.passSpaces();
      let o = tryParseOp(S);
      let z = parseOne(S);
      if(z == null) {
        if(o != null) {
          throw new CompileError(S.src, S.p - S.predefOff,
                                S.unexpectedMsg(S.p) +
                                ", expect RHS of operator");
        } else break;
      } else if(o == null) o = new Token(S.src, z.p, 'id', '');
      while(stack.length > 1) {
        let p = stack[stack.length - 2];
        let p_o = opPriority(o.data);
        let p_p = Math.floor(opPriority(p.data));
        if(p_o <= p_p) {
          packOp(S, stack);
        } else break;
      }
      stack.push(o);
      stack.push(z);
    }
    while(stack.length > 1) packOp(S, stack);
    return stack[0];
  };

  let parse = (name, src, predefined) => {
    let S = new ParseState(name, src, predefined || []);
    let result = parseLine(S);
    S.passSpaces();
    if(S.p < S.preprocessed.length) {
      throw new CompileError(S.src, S.p - S.predefOff, S.unexpectedMsg(S.p));
    }
    return result;
  };
  lc.parse = parse;

  /* --- Injector --- */
  let getDefinitionCont = (tk) => {
    if(tk.type === 'app') {
      if(tk.data[0].type === 'lam') {
        return tk.data[0].data;
      } else if(tk.data[0].type == 'app') {
        let op = tk.data[0].data[0];
        let l = tk.data[0].data[1];
        if(op.type === 'id' && op.data === '=:' &&
          l.type === 'lam') {
          return l.data;
        }
      }
    }
    return null;
  }

  let injectIntoBody = (dst, src) => {
    let tk = dst;
    if(tk.type !== 'app') {
      return src;
    } else {
      let t = [null, tk];
      let a = t;
      let last;
      do {
        last = a;
        a = getDefinitionCont(a[1]);
      } while(a !== null);
      last[1] = src;
      return t[1];
    }
  };
  lc.injectIntoBody =injectIntoBody;

  /* --- Name Checker --- */
  let getDefaultNames = () => { return {
    '@print': 1,
    '@true': 0,
    '@false': 0,
    '@addr': 2,
    '@subr': 2,
    '@mulr': 2,
    '@divr': 2,
    '@modr': 2,
    '@length': 1,
    '@eqr': 2,
    '@ltr': 2,
    '@ler': 2
  }; };

  let findName = (names, name) => names[name] > 0;

  let namecheckOne = (names, tk) => {
    var name;
    var i;
    var j;
    switch(tk.type) {
    case 'id':
      if(!findName(names, tk.data)) {
        throw new CompileError(tk.src, tk.p,
                              "name " + tk.data + " is not bound");
      }
      return -1;
    case 'builtin':
      i = names['@' + tk.data];
      if(i == undefined) {
        throw new CompileError(tk.src, tk.p,
                              "name @" + tk.data + " is not bound");
      }
      return i;
    case 'lam':
      name = tk.data[0].data;
      if(!names[name]) names[name] = 1;
      else names[name]++;
      i = namecheckOne(names, tk.data[1]);
      names[name]--;
      break;
    case 'app':
      i = namecheckOne(names, tk.data[0]);
      j = namecheckOne(names, tk.data[1]);
      return i - 1;
    default: return -1;
    }
  };

  let namecheck = (tk) => {
    let x = namecheckOne(getDefaultNames(), tk);
    return true;
  };
  lc.namecheck = namecheck;

  /* --- Simple Compiler --- */
  let encodeNameForJSTable = {
    '_': '__',
    '~': '_t',
    '!': '_x',
    '$': '_d',
    '%': '_p',
    '^': '_h',
    '&': '_n',
    '*': '_a',
    '+': '_P',
    '-': '_m',
    '|': '_o',
    ':': '_c',
    '<': '_l',
    '>': '_g',
    ',': '_C',
    '/': '_s',
    '=': '_e'
  };
  let jsKeywords = {
    'if': true, 'else': true,
    'return': true, 'for': true, 'while': true, 'do': true,
    'let': true, 'var': true, 'const': true, 'function': true,
    'true': true, 'false': true,
  };
  let encodeNameForJS = (s) => {
    let res = "";
    if(jsKeywords[s]) {
      return "_j" + s;
    }
    for(let i = 0; i < s.length; i++) {
      let t = encodeNameForJSTable[s[i]];
      if(t) res += t;
      else res += s[i];
    }
    return res;
  };

  let compileToken = (tk) => {
    switch(tk.type) {
    case 'num': return 'Number(' + String(tk.data) + ')';
    case 'str': return '\'' + escape(tk.data) + '\'';
    case 'id':
      return encodeNameForJS(tk.data);
    case 'builtin': return '_Q' + tk.data;
    case 'lam':
      return "((" + compileToken(tk.data[0]) + ")=>(" +
        compileToken(tk.data[1]) + "))";
    case 'app':
      return "new _qLB(() => _qapp(" + compileToken(tk.data[0]) + ", " + compileToken(tk.data[1]) + "))";
    }
  };

  let LazyBox = function(f) {
    this._ = undefined;
    this.f = f;
  };
  LazyBox.prototype.value = function(_0) {
    if(this._ == undefined) {
      let x = _0.stack.length;
      let temp = this.f();
      if(_0.stack.length > x) {
        _0.stack[x].box = this;
      }
      return temp;
    } else {
      this.value = this.constructor.prototype.retValue;
      return this._;
    }
  };
  LazyBox.prototype.retValue = function() {
    return this._;
  };
  LazyBox.prototype.toString = function() {
    if(this._ === undefined) {
      return "<<" + String(this.f) + ">>";
    } else return String(this._);
  };

  let compile = (tk) => {
    let pre = `
      function _qcont(v) {
        this.box._ = v(this.val, this);
        return this.box._;
      }
      function _qcontr(v) {
        this.box._ = this.val(v, this);
        return this.box._;
      }
      function _qapp(f, a) {
        _0.stack.push({box: _0, val: a, cont: _qcont});
        return f;
      }
      let _qLB = _0.LazyBox;
      let _Qprint = x => {
        _0.stack.push({box: _0, val: x => { _0.out += x + "\\n"; return x; }, cont: _qcontr});
        return x;
      };
      let _Qtrue = x => y => x;
      let _Qfalse = x => y => y;
      let _Qaddr = (x, p) => {
        _0.stack.push({box: p.box, cont: _qcontr,
          val: x => (y, p) => {
            _0.stack.push({box: p.box, cont: _qcontr,
              val: y => y + x});
            return y;
          }});
        return x;
      };
      let _Qsubr = (x, p) => {
        _0.stack.push({box: p.box, cont: _qcontr,
          val: x => (y, p) => {
            _0.stack.push({box: p.box, cont: _qcontr,
              val: y => y - x});
            return y;
          }});
        return x;
      };
      let _Qmulr = (x, p) => {
        _0.stack.push({box: p.box, cont: _qcontr,
          val: x => (y, p) => {
            _0.stack.push({box: p.box, cont: _qcontr,
              val: y => y * x});
            return y;
          }});
        return x;
      };
      let _Qdivr = (x, p) => {
        _0.stack.push({box: p.box, cont: _qcontr,
          val: x => (y, p) => {
            _0.stack.push({box: p.box, cont: _qcontr,
              val: y => Math.floor(y / x)});
            return y;
          }});
        return x;
      };
      let _Qmodr = (x, p) => {
        _0.stack.push({box: p.box, cont: _qcontr,
          val: x => (y, p) => {
            _0.stack.push({box: p.box, cont: _qcontr,
              val: y => y % x});
            return y;
          }});
        return x;
      };
      let _Qeqr = (x, p) => {
        _0.stack.push({box: p.box, cont: _qcontr,
          val: x => (y, p) => {
            _0.stack.push({box: p.box, cont: _qcontr,
              val: y => y === x ? _Qtrue : _Qfalse});
            return y;
          }});
        return x;
      };
      let _Qltr = (x, p) => {
        _0.stack.push({box: p.box, cont: _qcontr,
          val: x => (y, p) => {
            _0.stack.push({box: p.box, cont: _qcontr,
              val: y => y < x ? _Qtrue : _Qfalse});
            return y;
          }});
        return x;
      };
      let _Qler = (x, p) => {
        _0.stack.push({box: p.box, cont: _qcontr,
          val: x => (y, p) => {
            _0.stack.push({box: p.box, cont: _qcontr,
              val: y => y <= x ? _Qtrue : _Qfalse});
            return y;
          }});
        return x;
      };
    `;
    let body = 'return (' + compileToken(tk) + ');';
    return pre + body;
  };

  let evaluate = (_0, val, finishTime) => {
    let st = _0.stack;
    while(true) {
      if(Date.now() >= finishTime) return "Timeout";
      while(val.constructor === LazyBox) {
        val = val.value(_0);
      }
      if(st.length <= 0) break;
      val = st.pop().cont(val);
    }
    return val;
  };

  let new_0 = () => {
    return {
      LazyBox: LazyBox,
      out: "",
      stack: []
    };
  };

  /* --- Runner --- */
  let run = (name, src, opt) => {
    var predef = {};
    if(opt.predefined) {
      if(opt.predefined === true) predef = stdPredefined;
      else predef = opt.predefined;
    }
    var timeLimit = opt.timeLimit || 600;
    var finishTime = Date.now() + (timeLimit * 1000);
    //
    var _0 = new_0();
    try {
      let tk = parse(name, src, predef);
      if(typeof opt.injectBody === 'string') {
        let b = parse('<INJECT>', opt.injectBody);
        tk = injectIntoBody(tk, b);
      }
      namecheck(tk);
      let res = compile(tk);
      let fn = Function('_0', res)(_0);
      let ret = evaluate(_0, fn, finishTime);
      _0.out += "=> " + lc.valueToString(ret);
    } catch(e) {
      if(e.constructor == CompileError) {
        _0.out += "Compile Error\n";
        _0.out += e.toString();
      } else {
        _0.out += "JS Error(" + e + ')\n';
        _0.out += "It may be caused by trying to call number or string.";
      }
    }
    return _0.out;
  };
  lc.run = run;

  let stdPredefined = [
    {name: '(=:)', body: '\\f.\\x.f x'},
    {name: '(|>)', body: '\\f.\\x.f x'},
    {name: '(<|)', body: '\\x.\\f.f x'},
    {name: '($)', body: '\\x.\\f.f x'},
    {name: '(+)', body: '@addr'},
    {name: '(-)', body: '@subr'},
    {name: '(*)', body: '@mulr'},
    {name: '(/)', body: '@divr'},
    {name: '(%)', body: '@modr'},
    {name: '(**)', body: '\\g.\\f.\\x.f (g x)'},
    {name: 'true', body: '@true'},
    {name: 'false', body: '@false'},
    {name: 'if', body: '\\b.\\t.\\f.b t f'},
    {name: '(!)', body: '\\f.f true false'},
    {name: '(&)', body: '\\r.\\l. l r false'},
    {name: '(|)', body: '\\r.\\l. l true r'},
    {name: '(==)', body: '@eqr'},
    {name: '(!=)', body: '\\y.\\x.!(@eqr x y)'},
    {name: '(<=)', body: '@ler'},
    {name: '(<)', body: '@ltr'},
    {name: '(>=)', body: '\\r.\\l. @ler l r'},
    {name: '(>)', body: '\\r.\\l. @ltr l r'},
    {name: 'print', body: '@print'},
    {name: '(,)', body: '\\r.\\l. \\f. f l r'},
    {name: 'first', body: '\\p.p true'},
    {name: 'second', body: '\\p.p false'},
    {name: 'nil', body: 'false'},
    {name: '(:)', body: '\\r.\\l. \\f.\\x.f l (r f x)'},
    {name: 'head', body: '\\l.l true false'},
    {name: 'tail', body: '\\l.first (l (\\a.\\b.(second b, a : second b)) (nil, nil))'},
    {name: 'isEmpty', body: '\\l.l (\\a.\\b.false) true'},
    {name: 'I', body: '\\x.x'},
    {name: 'K', body: '\\x.\\y.x'},
    {name: 'S', body: '\\x.\\y.\\z.x z (y z)'},
    {name: 'U', body: '\\f.f f'},
    {name: 'Y', body: '\\f.U \\y.\\a.f (y y) a'},
    {name: 'Z', body: '\\f.U \\z.f \\v.z z v'},
  ];
  lc.stdPredefined = stdPredefined;
  

  lc.reduceParen = (s) => {
    let stack = [{s: 0, e: 0, x: ''}];
    for(var i = 0; i < s.length; i++) {
      if(s[i] === '(') {
        stack.push({s: i + 1, e: i + 1, x: ''});
      } else if(s[i] === ')') {
        let t = stack.pop();
        let x = t.x;
        if(s[i + 1] !== ')' && s[i + 1] !== undefined || t.s - 1 !== stack[stack.length - 1].s) {
          x = '(' + x + ')';
        }
        stack[stack.length - 1].x += x;
        stack[stack.length - 1].e = i;
      } else {
        stack[stack.length - 1].e++;
        stack[stack.length - 1].x += s[i];
      }
    }
    while(stack.length > 1) {
      let t = stack.pop();
      stack[stack.length - 1].x += '(' + t.x;
    }
    return stack[0].x;
  }

  lc.valueToString = (val) => {
    if(val.constructor === Number) {
      return val.toString();
    } else if(val.constructor === String) {
      return '"' + escape(val) + '"';
    } else {
      let x = val.toString();
      let arrow = /\(([^()]+)\)=>/g;
      x = x.replace(arrow, "λ$1.");
      let qapp = /new _qLB\(\(\) => _qapp\(/g;
      x = x.replace(qapp, "((");
      x = x.replace(/,/g, '');
      return lc.reduceParen(x);
    }
  }

  return lc;
}();

export default lc;