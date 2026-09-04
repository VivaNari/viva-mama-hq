import React from 'react';
import { StyleProp, Text, TextStyle, View } from 'react-native';

import { globalStyles } from '../../public/styles/globalStyles';
import { bubbleStyles } from './styles';

interface MarkdownTextProps {
    /** Raw text from the AI, may contain markdown (**bold**, `*  ` bullets, \n). */
    text: string;
    /** Base text styles applied to every span (color, size, font, etc.). */
    baseStyle: StyleProp<TextStyle>;
}

// Matches a bullet line: optional leading spaces, a single `*` or `-` marker,
// then at least one space. `**bold**` is NOT matched because `*` is followed by
// another `*`, not whitespace.
const BULLET_RE = /^\s*[*-]\s+/;

// Splits a line into bold (**...**) / italic (*...*) / plain runs.
const INLINE_RE = /(\*\*[^*]+\*\*|\*[^*]+\*)/g;

const renderInline = (
    text: string,
    keyPrefix: string,
): React.ReactNode[] => {
    const parts = text.split(INLINE_RE).filter((p) => p !== '');

    return parts.map((part, i) => {
        const key = `${keyPrefix}-${i}`;

        if (part.startsWith('**') && part.endsWith('**') && part.length > 4) {
            return (
                <Text key={key} style={globalStyles.fontBold}>
                    {part.slice(2, -2)}
                </Text>
            );
        }

        if (part.startsWith('*') && part.endsWith('*') && part.length > 2) {
            return (
                <Text key={key} style={{ fontStyle: 'italic' }}>
                    {part.slice(1, -1)}
                </Text>
            );
        }

        return <Text key={key}>{part}</Text>;
    });
};

/**
 * Renders the small subset of markdown the VivaMama chatbot emits — bold,
 * italic, bullet lists and line breaks — as native Text. Anything unrecognised
 * falls through as plain text, so it is safe for partially-streamed content.
 */
export const MarkdownText: React.FC<MarkdownTextProps> = ({ text, baseStyle }) => {
    if (!text) {
        return null;
    }

    const lines = text.split('\n');
    const blocks: React.ReactNode[] = [];

    lines.forEach((line, index) => {
        // Preserve intentional blank lines as vertical spacing between paragraphs.
        if (line.trim() === '') {
            blocks.push(<View key={`gap-${index}`} style={bubbleStyles.mdGap} />);
            return;
        }

        if (BULLET_RE.test(line)) {
            const content = line.replace(BULLET_RE, '');
            blocks.push(
                <View key={`bullet-${index}`} style={bubbleStyles.mdBulletRow}>
                    <Text style={[baseStyle, bubbleStyles.mdBulletDot]}>{'•'}</Text>
                    <Text style={[baseStyle, bubbleStyles.mdBulletText]}>
                        {renderInline(content, `bullet-${index}`)}
                    </Text>
                </View>,
            );
            return;
        }

        blocks.push(
            <Text key={`line-${index}`} style={baseStyle}>
                {renderInline(line, `line-${index}`)}
            </Text>,
        );
    });

    return <View>{blocks}</View>;
};
