import { createHash } from "crypto";
import { ContentBodyTypeEnum, IContent } from "../../types/content.types";
import { EContentMediaType } from "../../types/content-search-profile.types";

type TContentSource = Pick<IContent, "featuredTitle" | "contentBody">;

const TEXT_TYPES: string[] = [
    ContentBodyTypeEnum.HEADING,
    ContentBodyTypeEnum.SUBHEADING,
    ContentBodyTypeEnum.PARAGRAPH,
];

/** The blocks a search profile is written from. Images carry nothing to search. */
function sourceBlocks(content: TContentSource) {
    return (content.contentBody ?? [])
        .map((block) => ({ type: block.contentType as string, body: (block.body ?? "").trim() }))
        .filter(
            (block) =>
                block.body &&
                (TEXT_TYPES.includes(block.type) || block.type === ContentBodyTypeEnum.VIDEO),
        );
}

export function contentText(content: TContentSource): string {
    return sourceBlocks(content)
        .filter((block) => TEXT_TYPES.includes(block.type))
        .map((block) => block.body)
        .join("\n");
}

export function contentVideoUrls(content: TContentSource): string[] {
    return sourceBlocks(content)
        .filter((block) => block.type === ContentBodyTypeEnum.VIDEO)
        .map((block) => block.body);
}

export function contentMediaType(content: TContentSource): EContentMediaType {
    const hasVideo = contentVideoUrls(content).length > 0;
    if (!hasVideo) return EContentMediaType.ARTICLE;
    return contentText(content) ? EContentMediaType.MIXED : EContentMediaType.VIDEO;
}

/**
 * Changes whenever the title, text or videos change, however the edit was made, so a
 * content edited straight in the database still loses its approval.
 */
export function contentSourceHash(content: TContentSource): string {
    const source = JSON.stringify([
        (content.featuredTitle ?? "").trim(),
        sourceBlocks(content).map((block) => [block.type, block.body]),
    ]);
    return createHash("sha256").update(source).digest("hex");
}
