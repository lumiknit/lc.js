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
    return {
      result: out === output,
      injected: injectBody,
      expected: output,
      out: out,
      time: dt
    };
  };
  lcutil.grade = grade;

  let gradeAll = (src, problemSet) => {
    let result = [];
    if(problemSet.problems) {
      let p = problemSet.problems;
      for(var i = 0; i < p.length; i++) {
        result.push(grade(src, p.injectBody, p.output, p.timeLimit));
      }
    } else if(problemSet.n > 0) {
      let n = problemSet.n;
      for(var i = 0; i < n; i++) {
        let p = problemSet.generate(i, n);
        result.push(grade(src, p.injectBody, p.output, p.timeLimit));
      }
    }
    return result;
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
    },
  };

  return lcutil;
}();

export default lcutil;