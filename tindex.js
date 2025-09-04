function summarizeNumber(num) {
    if (typeof num !== 'number' || isNaN(num)) return 'Invalid input';
    
    const suffixes = [
      { threshold: 1e9, suffix: 'B' },
      { threshold: 1e6, suffix: 'M' },
      { threshold: 1e3, suffix: 'k' },
      { threshold: 1, suffix: '' }
    ];
  
    for (let { threshold, suffix } of suffixes) {
      if (Math.abs(num) >= threshold) {
        const value = (num / threshold).toFixed(1).replace(/\.0$/, '');
        return `${value}${suffix}`;
      }
    }
  }
  
  summarizeNumber(10000)