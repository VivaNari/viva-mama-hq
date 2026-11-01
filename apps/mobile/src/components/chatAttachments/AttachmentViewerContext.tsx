import { createContext, useContext } from 'react';
import { IMessageAttachment } from '../../types/chat.types';

/**
 * How a bubble opens the files on it. Provided by the chat screen, which owns the
 * viewer; a bubble rendered anywhere else (bookmarks) shows the files but opens nothing.
 */
export interface IAttachmentViewer {
    openImages: (images: IMessageAttachment[], index: number) => void;
    openPdf: (attachment: IMessageAttachment) => void;
}

const noop: IAttachmentViewer = { openImages: () => {}, openPdf: () => {} };

export const AttachmentViewerContext = createContext<IAttachmentViewer>(noop);

export const useAttachmentViewer = () => useContext(AttachmentViewerContext);
