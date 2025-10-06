import { Linking, StyleSheet, Text } from 'react-native';
import { styles as chatStyles } from '../public/styles/chatWithVivaAiStyles';
import { globalStyles } from '../public/styles';

// This is our new component for parsing and rendering links
const MessageWithLinks = ({ text }: { text: string }) => {
    // A regular expression to find URLs
    const urlRegex = /(https?:\/\/[^\s]+)/g;

    const parts = text.split(urlRegex);

    return (
        <Text selectable style={[chatStyles.messageText, globalStyles.fontRegular]}>
            {parts.map((part, index) => {
                if (part.match(urlRegex)) {
                    return (
                        <Text
                            key={index}
                            style={chatStyles.hyperlink}
                            onPress={() => Linking.openURL(part)}
                        >
                            {part}
                        </Text>
                    );
                }
                return part;
            })}
        </Text>
    );
};

export default MessageWithLinks;