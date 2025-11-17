import { StyleSheet } from 'react-native';
import { colors } from '../assets/colors';
import { globalStyles } from './globalStyles';

export const styles = StyleSheet.create({
  headerContainer: {
    backgroundColor: 'red',
  },
  headerTitle: {
    color: 'green',
  },
  headerText: {
    color: 'blue',
  },
  hyperlink: {
    color: colors.primary,
    textDecorationLine: 'underline',
  },
  messageContainer: {
    maxWidth: '80%',
    paddingVertical: 10,
    paddingHorizontal: 15,
    borderRadius: 20,
    marginBottom: 12,
  },
  userMessage: {
    alignSelf: 'flex-end',
    backgroundColor: colors.secondary,
    borderBottomRightRadius: 0,
  },
  aiMessage: {
    alignSelf: 'flex-start',
    backgroundColor: colors.purple,
    borderBottomLeftRadius: 0,
  },
  messageText: {
    color: '#fff',
    fontSize: 14,
    ...globalStyles.fontRegular,
  },
  inputContainer: {
    flexDirection: 'row',
    padding: 10,
    backgroundColor: '#fff',
    borderTopWidth: 1,
    borderColor: '#ccc',
  },
  textInput: {
    flex: 1,
    borderWidth: 1,
    borderColor: '#ddd',
    borderRadius: 20,
    paddingHorizontal: 15,
    marginRight: 10,
  },
  sendButton: {
    backgroundColor: colors.primary,
    borderRadius: 25,
    height: 50,
    width: 50,
    justifyContent: 'center',
    alignItems: 'center',
  },
  sendButtonText: {
    color: '#fff',
    fontWeight: 'bold',
  },
  initialViewContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  initialHelpText: { fontSize: 24, ...globalStyles.fontRegular },
  initialPromptsContainer: {
    flexDirection: 'row',
    gap: 10,
    padding: 30,
    justifyContent: 'center',
    flexWrap: 'wrap',
  },
  promptButton: {
    borderWidth: 1,
    borderColor: colors.purple,
    paddingVertical: 4,
    paddingHorizontal: 10,
    borderRadius: 20,
  },
  promptText: { fontSize: 14, ...globalStyles.fontRegular },
  optionsInMessageContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    justifyContent: 'flex-start',
    width: '80%',
  },
  optionButton: {
    backgroundColor: colors.white,
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 20,
    borderWidth: 1.5,
    borderColor: '#bdbdbd',
  },
  optionButtonText: {
    color: colors.primary,
    ...globalStyles.fontRegular,
    fontSize: 14,
  },
});
