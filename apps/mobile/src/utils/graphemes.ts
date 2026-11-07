const ZERO_WIDTH_JOINER = 0x200d;
const ZERO_WIDTH_NON_JOINER = 0x200c;
const DEVANAGARI_VIRAMA = 0x094d;

/** Devanagari vowel signs and other marks, which draw onto the letter before them. */
const isDevanagariMark = (code: number): boolean =>
    (code >= 0x0900 && code <= 0x0903) ||
    (code >= 0x093a && code <= 0x093c) ||
    (code >= 0x093e && code <= 0x094f) ||
    (code >= 0x0951 && code <= 0x0957) ||
    (code >= 0x0962 && code <= 0x0963);

/**
 * Split text into the units a reader sees as one letter, so a typing animation never
 * shows half of one. Slicing Hindi by character would strand a matra or break a
 * conjunct: "क्ष" is three characters but one letter.
 *
 * Hand-written because Hermes does not provide Intl.Segmenter. It covers the scripts the
 * app ships (Latin and Devanagari), not the whole of Unicode.
 */
export const splitGraphemes = (text: string): string[] => {
    const graphemes: string[] = [];
    let joinNext = false;

    for (const char of Array.from(text)) {
        const code = char.codePointAt(0) ?? 0;
        const isJoiner = code === ZERO_WIDTH_JOINER || code === ZERO_WIDTH_NON_JOINER;
        const attaches = joinNext || isDevanagariMark(code) || isJoiner;

        if (attaches && graphemes.length > 0) {
            graphemes[graphemes.length - 1] += char;
        } else {
            graphemes.push(char);
        }

        joinNext = code === DEVANAGARI_VIRAMA || code === ZERO_WIDTH_JOINER;
    }

    return graphemes;
};
