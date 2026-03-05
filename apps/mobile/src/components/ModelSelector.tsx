import React from 'react';
import {
    Modal,
    StyleSheet,
    Text,
    TouchableOpacity,
    TouchableWithoutFeedback,
    View,
    FlatList,
} from 'react-native';
import Lucide from '@react-native-vector-icons/lucide';
import { colors } from '../public/assets/colors';
import { globalStyles } from '../public/styles';

export const MODELS = [
    { id: 'llama-3.3-70b-versatile', label: 'Llama 3.3 70B' },
    { id: 'openai/gpt-oss-20b', label: 'GPT OSS 20B' },
    { id: 'qwen/qwen3-32b', label: 'Qwen 3-32B' },
    { id: 'meta-llama/llama-4-maverick-17b-128e-instruct', label: 'Llama 4 Maverick' },
];

interface ModelSelectorProps {
    visible: boolean;
    onClose: () => void;
    onSelect: (modelId: string) => void;
    selectedModelId: string;
}

const ModelSelector: React.FC<ModelSelectorProps> = ({
    visible,
    onClose,
    onSelect,
    selectedModelId,
}) => {
    return (
        <Modal
            visible={visible}
            transparent={true}
            animationType="fade"
            onRequestClose={onClose}
        >
            <TouchableWithoutFeedback onPress={onClose}>
                <View style={styles.overlay}>
                    <TouchableWithoutFeedback>
                        <View style={styles.modalContainer}>
                            <View style={styles.header}>
                                <Text style={[styles.headerText, globalStyles.fontBold]}>Select AI Model</Text>
                                <TouchableOpacity onPress={onClose}>
                                    <Lucide name="x" size={20} color={colors.black} />
                                </TouchableOpacity>
                            </View>
                            <FlatList
                                data={MODELS}
                                keyExtractor={(item) => item.id}
                                renderItem={({ item }) => (
                                    <TouchableOpacity
                                        style={[
                                            styles.modelItem,
                                            selectedModelId === item.id && styles.selectedItem
                                        ]}
                                        onPress={() => {
                                            onSelect(item.id);
                                            onClose();
                                        }}
                                    >
                                        <View style={styles.modelInfo}>
                                            <Text style={[
                                                styles.modelLabel,
                                                globalStyles.fontMedium,
                                                selectedModelId === item.id && styles.selectedText
                                            ]}>
                                                {item.label}
                                            </Text>
                                            <Text style={styles.modelId}>{item.id}</Text>
                                        </View>
                                        {selectedModelId === item.id && (
                                            <Lucide name="check" size={20} color={colors.darkPurple} />
                                        )}
                                    </TouchableOpacity>
                                )}
                            />
                        </View>
                    </TouchableWithoutFeedback>
                </View>
            </TouchableWithoutFeedback>
        </Modal>
    );
};

const styles = StyleSheet.create({
    overlay: {
        flex: 1,
        backgroundColor: 'rgba(0, 0, 0, 0.5)',
        justifyContent: 'center',
        alignItems: 'center',
        padding: 20
    },
    modalContainer: {
        backgroundColor: colors.white,
        borderRadius: 16,
        width: '100%',
        maxHeight: '60%',
        padding: 16,
        shadowColor: "#000",
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.3,
        shadowRadius: 4.65,
        elevation: 8,
    },
    header: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: 16,
        paddingBottom: 12,
        borderBottomWidth: 1,
        borderBottomColor: colors.lightGray,
    },
    headerText: {
        fontSize: 18,
        color: colors.black,
    },
    modelItem: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        paddingVertical: 12,
        paddingHorizontal: 12,
        borderRadius: 8,
        marginBottom: 8,
    },
    selectedItem: {
        backgroundColor: colors.lightPurple,
    },
    modelInfo: {
        flex: 1,
    },
    modelLabel: {
        fontSize: 16,
        color: colors.text,
    },
    modelId: {
        fontSize: 12,
        color: colors.gray,
        marginTop: 2,
        ...globalStyles.fontRegular
    },
    selectedText: {
        color: colors.darkPurple,
    },
});

export default ModelSelector;
