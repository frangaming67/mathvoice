import { create, all } from 'mathjs';
export const math = create(all);
export const exactMath = create(all, { number: 'Fraction' });
