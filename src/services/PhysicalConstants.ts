// NIST, CODATA 2022: https://physics.nist.gov/cuu/Constants/Table/allascii.txt
export const physicalConstants = [
  {
    symbol: 'c_luz',
    label: 'Velocidad de la luz',
    value: 299792458,
    unit: 'metros por segundo',
    note: 'Exacta en el SI',
  },
  {
    symbol: 'G',
    label: 'Constante gravitacional',
    value: 6.6743e-11,
    unit: 'metros cúbicos por kilogramo por segundo al cuadrado',
    note: 'Incertidumbre estándar: 0.00015 × 10⁻¹¹',
  },
  {
    symbol: 'h_P',
    label: 'Constante de Planck',
    value: 6.62607015e-34,
    unit: 'julio segundo',
    note: 'Exacta en el SI',
  },
  {
    symbol: 'N_A',
    label: 'Número de Avogadro',
    value: 6.02214076e23,
    unit: 'por mol',
    note: 'Exacta en el SI',
  },
  {
    symbol: 'k_B',
    label: 'Constante de Boltzmann',
    value: 1.380649e-23,
    unit: 'julios por kelvin',
    note: 'Exacta en el SI',
  },
];
export const physicalScope = Object.fromEntries(physicalConstants.map((c) => [c.symbol, c.value]));
