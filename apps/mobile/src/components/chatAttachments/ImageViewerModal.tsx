import Lucide from '@react-native-vector-icons/lucide';
import React, { useCallback, useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
    ActivityIndicator,
    FlatList,
    Modal,
    StyleSheet,
    Text,
    TouchableOpacity,
    useWindowDimensions,
    View,
} from 'react-native';
import { Gesture, GestureDetector, GestureHandlerRootView } from 'react-native-gesture-handler';
import Animated, {
    runOnJS,
    useAnimatedStyle,
    useSharedValue,
    withTiming,
} from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { getAttachmentUrl } from '../../api/chatAttachments.api';
import { colors } from '../../public/assets/colors';
import { globalStyles } from '../../public/styles';
import { IMessageAttachment } from '../../types/chat.types';

interface IImageViewerModalProps {
    visible: boolean;
    images: IMessageAttachment[];
    initialIndex: number;
    onClose: () => void;
}

const MAX_SCALE = 4;

/** Resolve what to show: the local file from this session, else a fresh short-lived link. */
const useImageSource = (image: IMessageAttachment) => {
    const [uri, setUri] = useState<string | null>(image.localUri ?? null);
    const [state, setState] = useState<'ready' | 'loading' | 'expired' | 'error'>(
        image.localUri ? 'ready' : 'loading',
    );

    const fetchRemote = useCallback(async () => {
        setState('loading');
        try {
            const { url } = await getAttachmentUrl(image.id);
            setUri(url);
            setState('ready');
        } catch (error: any) {
            setState(error?.response?.status === 410 ? 'expired' : 'error');
        }
    }, [image.id]);

    useEffect(() => {
        if (!image.localUri) fetchRemote();
    }, [image.localUri, fetchRemote]);

    // The local file can be gone (cache cleared): fall back to the server copy once.
    const onError = useCallback(() => {
        if (uri === image.localUri) fetchRemote();
        else setState('error');
    }, [uri, image.localUri, fetchRemote]);

    return { uri, state, onError, retry: fetchRemote };
};

const ZoomableImage = ({
    image,
    width,
    height,
    onZoomChange,
    onDismiss,
}: {
    image: IMessageAttachment;
    width: number;
    height: number;
    onZoomChange: (zoomed: boolean) => void;
    onDismiss: () => void;
}) => {
    const { t } = useTranslation();
    const { uri, state, onError, retry } = useImageSource(image);
    const scale = useSharedValue(1);
    const savedScale = useSharedValue(1);
    const tx = useSharedValue(0);
    const ty = useSharedValue(0);
    const savedTx = useSharedValue(0);
    const savedTy = useSharedValue(0);

    const reset = () => {
        'worklet';
        scale.value = withTiming(1);
        savedScale.value = 1;
        tx.value = withTiming(0);
        ty.value = withTiming(0);
        savedTx.value = 0;
        savedTy.value = 0;
        runOnJS(onZoomChange)(false);
    };

    const pinch = Gesture.Pinch()
        .onUpdate(e => {
            scale.value = Math.min(MAX_SCALE, Math.max(1, savedScale.value * e.scale));
        })
        .onEnd(() => {
            savedScale.value = scale.value;
            if (scale.value <= 1.01) reset();
            else runOnJS(onZoomChange)(true);
        });

    const pan = Gesture.Pan()
        .averageTouches(true)
        .onUpdate(e => {
            if (savedScale.value > 1) {
                tx.value = savedTx.value + e.translationX;
                ty.value = savedTy.value + e.translationY;
            } else {
                // Not zoomed: a downward drag dismisses, like every photo viewer.
                ty.value = Math.max(0, e.translationY);
            }
        })
        .onEnd(e => {
            if (savedScale.value > 1) {
                savedTx.value = tx.value;
                savedTy.value = ty.value;
            } else if (e.translationY > 120) {
                runOnJS(onDismiss)();
            } else {
                ty.value = withTiming(0);
            }
        });

    const doubleTap = Gesture.Tap()
        .numberOfTaps(2)
        .onEnd(() => {
            if (savedScale.value > 1) {
                reset();
            } else {
                scale.value = withTiming(2.5);
                savedScale.value = 2.5;
                runOnJS(onZoomChange)(true);
            }
        });

    const style = useAnimatedStyle(() => ({
        transform: [{ translateX: tx.value }, { translateY: ty.value }, { scale: scale.value }],
    }));

    return (
        <View style={{ width, height, alignItems: 'center', justifyContent: 'center' }}>
            {state === 'ready' && uri ? (
                <GestureDetector gesture={Gesture.Simultaneous(pinch, pan, doubleTap)}>
                    <Animated.Image
                        source={{ uri }}
                        style={[{ width, height }, style]}
                        resizeMode="contain"
                        onError={onError}
                        accessibilityLabel={t('chat.attachments.a11y.photoYouShared')}
                    />
                </GestureDetector>
            ) : state === 'loading' ? (
                <ActivityIndicator color={colors.white} size="large" />
            ) : (
                <View style={styles.message}>
                    <Lucide name="image-off" size={32} color={colors.white} />
                    <Text style={[styles.messageText, globalStyles.fontRegular]}>
                        {state === 'expired' ? t('chat.attachments.expired') : t('chat.attachments.couldNotLoad')}
                    </Text>
                    {state === 'error' && (
                        <TouchableOpacity onPress={retry} accessibilityRole="button" style={styles.retry}>
                            <Text style={[styles.retryText, globalStyles.fontSemiBold]}>{t('common.retry')}</Text>
                        </TouchableOpacity>
                    )}
                </View>
            )}
        </View>
    );
};

/** Full-screen photo viewer: pinch or double-tap to zoom, swipe down to close. */
const ImageViewerModal = ({ visible, images, initialIndex, onClose }: IImageViewerModalProps) => {
    const { t } = useTranslation();
    const { width, height } = useWindowDimensions();
    const insets = useSafeAreaInsets();
    const [index, setIndex] = useState(initialIndex);
    const [zoomed, setZoomed] = useState(false);

    useEffect(() => {
        if (visible) {
            setIndex(initialIndex);
            setZoomed(false);
        }
    }, [visible, initialIndex]);

    return (
        <Modal visible={visible} animationType="fade" onRequestClose={onClose} statusBarTranslucent>
            <GestureHandlerRootView style={styles.root}>
                <FlatList
                    data={images}
                    keyExtractor={item => item.id}
                    horizontal
                    pagingEnabled
                    scrollEnabled={!zoomed && images.length > 1}
                    initialScrollIndex={initialIndex}
                    getItemLayout={(_, i) => ({ length: width, offset: width * i, index: i })}
                    showsHorizontalScrollIndicator={false}
                    onMomentumScrollEnd={e => setIndex(Math.round(e.nativeEvent.contentOffset.x / width))}
                    renderItem={({ item }) => (
                        <ZoomableImage
                            image={item}
                            width={width}
                            height={height}
                            onZoomChange={setZoomed}
                            onDismiss={onClose}
                        />
                    )}
                />
                <View style={[styles.topBar, { paddingTop: insets.top + 8 }]}>
                    {images.length > 1 ? (
                        <Text style={[styles.counter, globalStyles.fontMedium]}>
                            {t('chat.attachments.a11y.position', { index: index + 1, total: images.length })}
                        </Text>
                    ) : (
                        <View />
                    )}
                    <TouchableOpacity
                        onPress={onClose}
                        style={styles.close}
                        accessibilityRole="button"
                        accessibilityLabel={t('common.close')}
                        hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                    >
                        <Lucide name="x" size={24} color={colors.white} />
                    </TouchableOpacity>
                </View>
            </GestureHandlerRootView>
        </Modal>
    );
};

const styles = StyleSheet.create({
    root: { flex: 1, backgroundColor: colors.black },
    topBar: {
        position: 'absolute',
        top: 0,
        left: 0,
        right: 0,
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        paddingHorizontal: 16,
    },
    counter: { color: colors.white, fontSize: 14 },
    close: {
        width: 44,
        height: 44,
        borderRadius: 22,
        backgroundColor: 'rgba(0,0,0,0.4)',
        alignItems: 'center',
        justifyContent: 'center',
    },
    message: { alignItems: 'center', gap: 12, paddingHorizontal: 32 },
    messageText: { color: colors.white, fontSize: 14, textAlign: 'center' },
    retry: { paddingHorizontal: 20, paddingVertical: 10, borderRadius: 20, backgroundColor: 'rgba(255,255,255,0.2)' },
    retryText: { color: colors.white },
});

export default ImageViewerModal;
