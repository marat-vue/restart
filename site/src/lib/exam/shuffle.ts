/**
 * Перемешивание вариантов ответа. Без него запоминается «третий сверху»,
 * а не сам ответ. Составные варианты («Варианты 1 и 2», «Верны все ответы»)
 * остаются в конце, а номера в них пересчитываются под новый порядок.
 */
const REF = /^(вариант|верн|правильн|одновременно|включен вариант)/i;
const FIXED = /^(верн[ыо]?\s+(все|любые)|все\s+(вариант|ответ|перечисл|указ|утвержд)|нет\s+(правильн|верн)|ни\s+од|правильн\w*\s+все|любой\s+из|все\s+вышеперечисл)/i;
const NUM = /(?<![\d.,])\d{1,2}(?![\d.,]?\d|[\wА-Яа-яЁё])/g;

export const isCompound = (option: string) => FIXED.test(option.trim()) || (REF.test(option.trim()) && /\d/.test(option));

export interface Shuffled {
  /** Тексты вариантов в порядке показа */
  options: string[];
  /** order[i] — исходный индекс варианта, показанного i-м */
  order: number[];
}

export function shuffleOptions(options: string[], random: () => number = Math.random): Shuffled {
  const identity = { options, order: options.map((_, i) => i) };
  const atomic = options.findIndex(isCompound);
  const n = atomic === -1 ? options.length : atomic;
  // составные варианты должны идти единым хвостом, иначе порядок не трогаем
  if (n < 2 || options.slice(n).some((o) => !isCompound(o))) return identity;
  if (options.slice(0, n).every((o) => /^[\d\s.,:%-]+$/.test(o))) return identity; // числа логичнее по возрастанию

  const head = Array.from({ length: n }, (_, i) => i);
  for (let i = n - 1; i > 0; i--) {
    const j = Math.floor(random() * (i + 1));
    [head[i], head[j]] = [head[j], head[i]];
  }
  const position = new Map(head.map((orig, shown) => [orig + 1, shown + 1]));
  const tail = options.slice(n).map((o) => {
    const nums = [...o.matchAll(NUM)].map((m) => Number(m[0]));
    if (!nums.length || nums.some((x) => !position.has(x))) return o;
    const mapped = nums.map((x) => position.get(x)!).sort((a, b) => a - b);
    let k = 0;
    return o.replace(NUM, () => String(mapped[k++]));
  });
  return {
    options: [...head.map((i) => options[i]), ...tail],
    order: [...head, ...options.slice(n).map((_, i) => n + i)],
  };
}
