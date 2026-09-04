import {
    BottomSheetModal,
    BottomSheetBackdrop,
    BottomSheetScrollView,
} from '@gorhom/bottom-sheet'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import React, {
    createContext,
    useContext,
    useMemo,
    useRef,
    useState,
    useCallback
} from 'react'

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
    const insets = useSafeAreaInsets()

    const snapPoints = useMemo(() => ['50%', '75%'], [])

    const open = useCallback((node: React.ReactNode) => {
        console.log('[BottomSheet] open() called')
        console.log('[BottomSheet] bottomSheetRef.current:', bottomSheetRef.current)

        // Set content first
        setContent(node)

        // Present with a small delay to ensure content is ready
        setTimeout(() => {
            console.log('[BottomSheet] Attempting to present...')
            try {
                const ref = bottomSheetRef.current
                if (ref) {
                    ref.present()
                    console.log('[BottomSheet] present() called successfully')

                    // Force snap to first position
                    setTimeout(() => {
                        ref.snapToIndex(0)
                        console.log('[BottomSheet] snapToIndex(0) called')
                    }, 100)
                } else {
                    console.error('[BottomSheet] bottomSheetRef.current is null')
                }
            } catch (error) {
                console.error('[BottomSheet] Error presenting:', error)
            }
        }, 50)
    }, [])

    const close = useCallback(() => {
        console.log('[BottomSheet] close() called')
        bottomSheetRef.current?.dismiss()
    }, [])

    // Add backdrop component
    const renderBackdrop = useCallback(
        (props: any) => (
            <BottomSheetBackdrop
                {...props}
                appearsOnIndex={0}
                disappearsOnIndex={-1}
                opacity={0.5}
                pressBehavior="close"
            />
        ),
        []
    )

    return (
        <BottomSheetContext.Provider value={{ open, close }}>
            {children}

            <BottomSheetModal
                ref={bottomSheetRef}
                snapPoints={snapPoints}
                enablePanDownToClose={true}
                backdropComponent={renderBackdrop}
                enableDynamicSizing={false}
                containerStyle={{
                    zIndex: 999999,
                }}
                backgroundStyle={{
                    backgroundColor: '#ffffff',
                }}
                handleIndicatorStyle={{
                    backgroundColor: '#cccccc',
                    width: 40,
                    height: 4,
                }}
                onDismiss={() => {
                    console.log('[BottomSheet] onDismiss called')
                    setContent(null)
                }}
                onChange={(index) => {
                    console.log('[BottomSheet] onChange:', index)
                }}
            >
                {/* A sheet snapped to 50%/75% still reaches the bottom of the window, so
                    its last content sits under the gesture bar without insets.bottom.
                    20 is the design padding; the inset is added on top of it. */}
                <BottomSheetScrollView
                    contentContainerStyle={{
                        padding: 20,
                        paddingBottom: 20 + insets.bottom,
                        minHeight: 200,
                    }}
                >
                    {content}
                </BottomSheetScrollView>
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