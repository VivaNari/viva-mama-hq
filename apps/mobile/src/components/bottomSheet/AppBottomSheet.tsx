import {
    BottomSheetModal,
    BottomSheetModalProvider,
} from '@gorhom/bottom-sheet'
import React, {
    createContext,
    useContext,
    useMemo,
    useRef,
    useState
} from 'react'
import { View } from 'react-native'

type BottomSheetContextType = {
    open: (content: React.ReactNode) => void
    close: () => void
}

const BottomSheetContext = createContext<BottomSheetContextType | null>(null)

export const BottomSheetProvider = ({
    children,
}: {
    children: React.ReactNode
}) => {
    const bottomSheetRef = useRef<BottomSheetModal>(null)
    const [content, setContent] = useState<React.ReactNode>(null)

    const snapPoints = useMemo(() => ['60%', '85%'], [])

    const open = (node: React.ReactNode) => {
        setContent(node)
        // present on next frame to avoid race conditions
        requestAnimationFrame(() => {
            bottomSheetRef.current?.present()
        })
    }

    const close = () => {
        bottomSheetRef.current?.dismiss()
    }

    return (
        <BottomSheetContext.Provider value={{ open, close }}>
            {children}

            <BottomSheetModal
                ref={bottomSheetRef}
                snapPoints={snapPoints}
                enablePanDownToClose
                keyboardBehavior="interactive"
                keyboardBlurBehavior="restore"
                onDismiss={() => setContent(null)}
            >
                <View style={{ padding: 20 }}>
                    {content}
                </View>
            </BottomSheetModal>
        </BottomSheetContext.Provider>
    )
}

export const useBottomSheet = () => {
    const ctx = useContext(BottomSheetContext)
    if (!ctx) {
        throw new Error('useBottomSheet must be used inside BottomSheetProvider')
    }
    return ctx
}

// BottomSheetModalProvider must wrap the app
export { BottomSheetModalProvider }
