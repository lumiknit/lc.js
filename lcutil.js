/* lcutil.js */

import lc from './lc.js';

let lcutil = function() {
  let lcutil = {};

  let grade = (src, injectBody, output, timeLimit) => {
    let startTime = Date.now();
    let out = lc.run('<SUBMIT>', src, {
      predefined: true,
      timeLimit: timeLimit,
      injectBody: injectBody
    });
    let dt = Date.now() - startTime;
    let gradeResult = false;
    if(output.constructor === RegExp) {
      gradeResult = output.test(out);
    } else {
      gradeResult = out === output;
    }
    return {
      result: gradeResult,
      injected: injectBody,
      expected: output,
      out: out,
      time: dt
    };
  };
  lcutil.grade = grade;

  let reportToString = function() {
    let o = "";
    for(var i = 0; i < this.result.length; i++) {
      o += (i + 1) + ". ";
      if(this.result[i].result) o += 'Correct\n';
      else o += 'Wrong\n';
      o += ' - Input: ' + this.result[i].injected + '\n';
      o += ' - Your: ' + this.result[i].out + '\n\n';
    }
    return o;
  }

  let gradeAll = (src, problemSet) => {
    let report = {};
    let result = [];
    let time = Date.now();
    let score = 0;
    let n = 0;
    if(problemSet.problems) {
      let p = problemSet.problems;
      n = p.length;
      for(var i = 0; i < n; i++) {
        result.push(grade(src, p[i].injectBody, p[i].output, p[i].timeLimit));
        if(result[i].result) score++;
      }
      
    } else if(problemSet.n > 0) {
      n = problemSet.n;
      for(var i = 0; i < n; i++) {
        let p = problemSet.generate(i, n);
        result.push(grade(src, p.injectBody, p.output, p.timeLimit));
        if(result[i].result) score++;
      }
    }
    report.time = Date.now() - time;
    report.result = result;
    report.toString = reportToString;
    return report;
  }
  lcutil.gradeAll = gradeAll;

  lcutil.problems = {
    sum: {
      title: '1부터 n까지의 합',
      description: '숫자 n을 인자로 받아서 1부터 n까지의 정수의 합을 반환하는 함수 sum을 작성하세요.',
      n: 10,
      generate: (i, n) => {
        let p = {};
        let input = 5 + Math.floor(Math.random() * 995);
        p.injectBody = 'sum ' + input;
        p.output = '=> ' + (input * (input + 1) / 2);
        p.timeLimit = 1;
        return p;
      }
    }
  };

  return lcutil;
}();

export default lcutil;