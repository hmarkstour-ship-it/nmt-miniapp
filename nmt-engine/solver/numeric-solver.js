export function solveNumeric({ operation, values }) {
  if (!Array.isArray(values) || values.some((value) => !Number.isFinite(Number(value)))) {
    throw new Error('numeric solver requires finite numeric values');
  }
  const nums = values.map(Number);

  switch (operation) {
    case 'sum': return nums.reduce((a, b) => a + b, 0);
    case 'product': return nums.reduce((a, b) => a * b, 1);
    case 'difference':
      if (nums.length !== 2) throw new Error('difference requires exactly 2 values');
      return nums[0] - nums[1];
    case 'quotient':
      if (nums.length !== 2 || nums[1] === 0) throw new Error('quotient requires [a, nonzero b]');
      return nums[0] / nums[1];
    case 'percent':
      if (nums.length !== 2) throw new Error('percent requires [whole, percent]');
      return nums[0] * nums[1] / 100;
    default: throw new Error(`Unsupported numeric operation: ${operation}`);
  }
}
