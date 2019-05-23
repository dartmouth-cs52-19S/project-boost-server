// adopted from: https://stackoverflow.com/questions/14696326/break-array-of-objects-into-separate-arrays-based-on-a-property
const groupBy = (arr, property) => {
  return arr.reduce((memo, x) => {
    if (!memo[x[property]]) { memo[x[property]] = []; }
    memo[x[property]].push(x);
    return memo;
  }, {});
};

export default groupBy;
