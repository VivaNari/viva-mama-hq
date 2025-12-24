import BottomSheet, {
    BottomSheetBackdrop,
    BottomSheetView,
} from '@gorhom/bottom-sheet'
import React, { createContext, useContext, useMemo, useRef, useState } from 'react'

type BottomSheetContextType = {
    open: (content: React.ReactNode) => void
    close: () => void
}

const BottomSheetContext = createContext<BottomSheetContextType | null>(null)

export const BottomSheetProvider = ({ children }: { children: React.ReactNode }) => {
    const bottomSheetRef = useRef<BottomSheet>(null)
    const [content, setContent] = useState<React.ReactNode>(null)
    const snapPoints = useMemo(() => ['50%', '85%'], [])

    const open = (node: React.ReactNode) => {
        setContent(node)
        requestAnimationFrame(() => {
            bottomSheetRef.current?.snapToIndex(0)
        })
    }

    const close = () => bottomSheetRef.current?.close()

    return (
        <BottomSheetContext.Provider value={{ open, close }}>
            {children}

            <BottomSheet
                ref={bottomSheetRef}
                index={-1}
                snapPoints={snapPoints}

                enablePanDownToClose
                enableContentPanningGesture={false}
                enableHandlePanningGesture={true}

                backdropComponent={(props) => (
                    <BottomSheetBackdrop
                        {...props}
                        appearsOnIndex={0}
                        disappearsOnIndex={-1}
                    />
                )}
            >
                <BottomSheetView style={{ padding: 20 }}>
                    {content}
                </BottomSheetView>
            </BottomSheet>
        </BottomSheetContext.Provider>
    )
}

export const useBottomSheet = () => {
    const ctx = useContext(BottomSheetContext)
    if (!ctx) throw new Error('useBottomSheet must be used inside BottomSheetProvider')
    return ctx
}
