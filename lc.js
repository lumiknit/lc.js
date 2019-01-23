/* lc.js */
let lc = {}
module.exports = lc;

/* --- Source --- */
function Source(name, src) {
  this.name = name;
  this.src = src;
  this.length = src.length;
}
lc.Source = Source;
Source.prototype.calculatePosition = function(p) {
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
}

/* --- Utility Functions --- */
function CompileError(src, p, msg) {
  this.src = src;
  this.p = p;
  this.msg = msg;
}
lc.CompileError = CompileError;
CompileError.prototype.toString = function() {
  let pos = this.src.calculatePosition(this.p);
  return this.src.name + ":" + pos[0] + ":" + pos[1] + ": " + this.msg;
}

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
}

let unescape = (s) => {
  let res = "";
  for(let i = 0; i < s.length; i++) {
    if(s[i] == '\\') {
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
}

let opPriority = (op) => {
  switch(op[0]) {
  case '*': case '/': case '%': return 8;
  case '+': case '-': return 7;
  case '!': case '=': case '<': case '>': return 6;
  case '&': return 5;
  case '|': return 4;
  case ':': case '^': return 3;
  case '~': return 2;
  case '$': return 1;
  default: return 10;
  }
}

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
}

/* --- Preprocess for Parsing --- */
let preprocess = (src) => {
  let l = src.length;
  let res = String();
  for(let i = 0; i < l; i++) {
    switch(src[i]) {
    case '#': // Remove Line Comments
      while(src[i] != '\n' && i < l) {
        res += ' ';
        i++;
      }
      break;
    case '\n': // Remove White Characters
    case '\r':
    case '\t':
    case '\v': res += ' '; break;
    default:
      res += src[i];
    }
  }
  return res;
}
lc.preprocess = preprocess;

/* --- Parser --- */
/* Token
   :NUM, :STR, :ID, :BUILTIN, :OP, :LAM, :APP */
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
  case 'op': return this.data;
  case 'lam':
    return '\\' + this.data[0] + ".(" + this.data[1].toString() + ")";
  case 'app':
    a = this.data[1].toString();
    if(this.data[1].type == 'app') a = '(' + a + ')';
    return this.data[0].toString() + " " + a;
  }
}

function ParseState(name, src) {
  this.src = new Source(name, src);
  this.preprocessed = preprocess(src);
  this.p = 0;
  this.l = 1;
  this.c = 1;
  this.stack = [];
}
lc.ParseState = ParseState;
ParseState.prototype.push = function() {
  this.stack.push({p: this.p, l: this.l, c: this.c});
}
ParseState.prototype.restore = function() {
  let o = this.stack.pop();
  if(o != undefined) {
    this.p = o.p;
    this.l = o.l;
    this.c = o.c;
  }
  return null;
}
ParseState.prototype.pop = function() { return this.stack.pop(); }
ParseState.prototype.cur = function(n) {
  if(n == undefined) n = 1;
  if(this.p >= this.preprocessed.length) return undefined;
  return this.preprocessed.substring(this.p, this.p + n);
}
ParseState.prototype.sub = function(p, n) {
  if(p == undefined) p = this.p;
  if(n == undefined) n = 1;
  return this.preprocessed.substring(p, p + n);
}
ParseState.prototype.pass = function(n) { /* Pass n characters */
  if(n == undefined) n = 1;
  for(let i = 0; i < n; i++) {
    if(this.src.src[this.p] !== undefined) {
      if(this.src.src[this.p] === '\n') {
        this.l++;
        this.c = 1;
      } else this.c++;
      this.p++;
    }
  }
}
ParseState.prototype.passSpaces = function() { /* Pass All Spaces */
  while(this.p < this.preprocessed.length &&
        this.preprocessed[this.p] === ' ') this.p++;
}
ParseState.prototype.is = function(c) { return this.cur() === c; }
ParseState.prototype.isInRange = function(from, to) {
  let c = this.cur();
  return from <= c && c <= to;
}
ParseState.prototype.isDigit = function() {
  return this.isInRange('0', '9');
}
ParseState.prototype.isIdChar = function() {
  let d = this.isDigit();
  let u = this.isInRange('A', 'Z');
  let l = this.isInRange('a', 'z');
  let s = this.is('_');
  return d || u || l || s;
}
ParseState.prototype.isOpChar = function() {
  let i = "~!$%^&*-+=|:<>/?,".indexOf(this.cur());
  return i >= 0;
}
ParseState.prototype.unexpectedMsg = function(p) {
  if(p >= this.src.src.length) {
    return "unexpected EOF";
  } else {
    return "unexpected '" + this.src.src[p] + "'";
  }
}

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
  return new Token(S.src, b, 'num', Number(n));
}

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
    throw new CompileError(src, S.p, "wrong string format");
  } else S.pass();
  S.pop();
  return new Token(S.src, b, 'str', unescape(S.sub(p, e - p)));
}

let tryParseId = (S) => {
  S.push();
  let b = S.p;
  while(S.isIdChar()) S.pass();
  if(S.p - b <= 0) return S.restore();
  S.pop();
  return new Token(S.src, b, 'id', S.sub(b, S.p - b));
}

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
}

let tryParseBuiltin = (S) => {
  S.push();
  let b = S.p;
  if(!S.is('@')) return S.restore();
  else S.pass();
  let p = S.p;
  let id = tryParseId(S);
  if(id == null) {
    throw new CompileError(S.src, p, "expect :ID");
  }
  id.p -= 1;
  id.type = 'builtin';
  return id;
}

let tryParseOp = (S) => {
  S.push();
  let b = S.p;
  while(S.isOpChar()) {
    S.pass();
  }
  if(S.p - b <= 0) return S.restore();
  S.pop();
  return new Token(S.src, b, 'op', S.sub(b, S.p - b));
}

let tryParseParen = (S) => {
  S.push();
  let b = S.p;
  if(!S.is('(')) return S.restore();
  else S.pass();
  let c = parseLine(S);
  if(c == null) {
    throw new CompileError(S.src, S.p,
                           S.unexpectedMsg(S.p) + ", incorrect paren body");
  }
  S.passSpaces();
  if(!S.is(')')) {
    throw new CompileError(S.src, S.p,
                           S.unexpectedMsg(S.p) + ", expect ')'");
  } else S.pass();
  S.pop();
  return c;
}

let tryParseLambda = (S) => {
  S.push();
  let b = S.p;
  if(!S.is('\\')) return S.restore();
  else S.pass();
  S.passSpaces();
  let id = tryParseOpId(S) || tryParseId(S);
  if(id == null) {
    throw new CompileError(S.src, S.p,
                           S.unexpectedMsg(S.p) + ", expect :OP_ID or :ID");
  }
  S.passSpaces();
  if(S.is('.')) {
    S.pass();
    S.passSpaces();
    let x = parseLine(S);
    if(x == null) {
      throw new CompileError(S.src, S.p,
                             S.unexpectedMsg(S.p) + ", expect body of lambda");
    }
    S.pop();
    return new Token(S.src, b, 'lam', [id, x]);
  } else {
    let op = tryParseOp(S);
    if(op == null) {
      throw new CompileError(S.src, S.p,
                             S.unexpectedMsg(S.p) + ", expect '.' or operator");
    }
    op.data = reverseOp(op.data);
    let x = parseLine(S);
    if(x == null) {
      throw new CompileError(S.src, S.p,
                             S.unexpectedMsg(S.p) + ", expect correct RHS");
    } else if(!S.is(';')) {
      throw new CompileError(S.src, S.p,
                             S.unexpectedMsg(S.p) + ", expect ';'");
    }
    S.pass();
    let y = parseLine(S);
    if(y == null) {
      throw new CompileError(S.src, S.p,
                             S.unexpectedMsg(S.p) + ", expect correct body");
    }
    S.pop();
    let l = new Token(S.src, b, 'lam', [id, y]);
    let o = new Token(S.src, b, 'app', [op, l]);
    return new Token(S.src, b, 'app', [o, x]);
  }
}

let parseOne = (S) => {
  S.passSpaces();
  return tryParseOpId(S) ||
    tryParseParen(S) ||
    tryParseBuiltin(S) ||
    tryParseLambda(S) ||
    tryParseNumber(S) ||
    tryParseString(S) ||
    tryParseId(S);
}

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
}

let parseLine = (S) => {
  let stack = [];
  stack.push(parseOne(S));
  while(true) {
    S.passSpaces();
    let o = tryParseOp(S);
    let z = parseOne(S);
    if(z == null) {
      if(o != null) {
        throw new CompileError(S.src, S.p,
                               S.unexpectedMsg(S.p) +
                               ", expect RHS of operator");
      } else break;
    } else if(o == null) o = new Token(S.src, z.p, 'op', '');
    while(stack.length > 1) {
      let p = stack[stack.length - 2];
      let p_o = opPriority(o.data);
      let p_p = opPriority(p.data);
      if(p_o <= p_p) {
        packOp(S, stack);
      } else break;
    }
    stack.push(o);
    stack.push(z);
  }
  while(stack.length > 1) packOp(S, stack);
  return stack[0];
}

let parse = (name, src) => {
  let S = new ParseState(name, src);
  let result = parseLine(S);
  S.passSpaces();
  if(S.p < S.src.length) {
    throw new CompileError(S.src, S.p, S.unexpectedMsg(S.p));
  }
  return result;
}
lc.parse = parse;

/* --- Name Checker --- */
let getDefaultNames = () => { return {
  '@print': 1,
  '@add': 2,
  '@sub': 2,
  '@mul': 2,
  '@div': 2,
  '@mod': 2,
  '@length': 1,
  '@true': 0,
  '@false': 0,
  '@if': 3,
  '@not': 1,
  '@and': 2,
  '@or': 2,
  '@eq': 2,
  '@lt': 2,
  '@le': 2,
}; };

let findName = (names, name) => names[name] > 0;

let namecheckOne = (names, tk) => {
  var name;
  var i;
  var j;
  switch(tk.type) {
  case 'id':
  case 'op':
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
    if(i > 0) {
      throw new CompileError(tk.src, tk.p,
                             "wrong number of arguments for builtin");
    }
    names[name]--;
    break;
  case 'app':
    i = namecheckOne(names, tk.data[0]);
    j = namecheckOne(names, tk.data[1]);
    if(j > 0) {
      throw new CompileError(tk.src, tk.p,
                             "wrong number of arguments for builtin");
    }
    return i - 1;
  default: return -1;
  }
}

let namecheck = (tk) => {
  let x = namecheckOne(getDefaultNames(), tk);
  if(x > 0) {
    throw new CompileError(tk.src, tk.p,
                             "wrong number of arguments for builtin");
  }
  return true;
}
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
}
let encodeNameForJS = (s) => {
  let res = "";
  for(let i = 0; i < s.length; i++) {
    let t = encodeNameForJSTable[s[i]];
    if(t) res += t;
    else res += s[i];
  }
  return res;
}

let compile = (tk) => {
  switch(tk.type) {
  case 'num': return String(tk.data);
  case 'str': return '\'' + escape(tk.data) + '\'';
  case 'id':
  case 'op':
    return encodeNameForJS(tk.data);
  case 'builtin':
    switch(tk.data) {
    case 'print': return 'console.log';
    case 'add': return '(x => y => x + y)';
    case 'sub': return '(x => y => x - y)';
    case 'mul': return '(x => y => x * y)';
    case 'div': return '(x => y => Math.floor(x / y))';
    case 'mod': return '(x => y => x % y)';
    case 'length': return '(x => x.length)';
    case 'true': return '(x => y => x)';
    case 'false': return '(x => y => y)';
    case 'not': return '(x => x(x=>y=>y)(x=>y=>x))';
    case 'and': return '(x => y => x(y)(x=>y=>y))';
    case 'or': return '(x => y => x(x=>y=>x)(y))';
    case 'if': return '(f => x => y => f(x)(y))';
    case 'eq': return '(x => y => x == y ? x=>y=>x : x=>y=>y)';
    case 'lt': return '(x => y => x < y ? x=>y=>x : x=>y=>y)';
    case 'le': return '(x => y => x <= y ? x=>y=>x : x=>y=>y)';
    }
  case 'lam':
    return "(" + compile(tk.data[0]) + ")=>(" +
      compile(tk.data[1]) + ")";
  case 'app':
    return compile(tk.data[0]) + "(" + compile(tk.data[1]) + ")";
  }
}

/* --- Runner --- */
let run = (name, src) => {
  try {
    let tk = parse(name, src);
    namecheck(tk);
    let res = compile(tk);
    let ret = eval(res);
    console.log("=> " + ret);
  } catch(e) {
    if(e.constructor == CompileError) {
      console.log("Compile Error");
      console.log(e.toString());
    } else {
      throw e;
    }
  }
}
lc.run = run;
