declare module 'jstat' {
  const jStat: {
    normal: {
      pdf(x: number, mean: number, sd: number): number;
      cdf(x: number, mean: number, sd: number): number;
      inv(p: number, mean: number, sd: number): number;
    };
    binomial: {
      pdf(k: number, n: number, p: number): number;
      cdf(k: number, n: number, p: number): number;
    };
    poisson: { pdf(k: number, lambda: number): number; cdf(k: number, lambda: number): number };
    covariance(a: number[], b: number[]): number;
    corrcoeff(a: number[], b: number[]): number;
  };
  export default jStat;
}
