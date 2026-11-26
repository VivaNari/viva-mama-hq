import type { AxiosError } from "axios";
import { StatusCodes } from "http-status-codes";
import contentModel from "../../models/content.model";
import contentSearchProfileModel from "../../models/content-search-profile.model";
import { IContent } from "../../types/content.types";
import {
    EContentProfileState,
    EContentProfileStatus,
    IContentProfileFields,
    IContentSearchProfile,
} from "../../types/content-search-profile.types";
import logger, { createModuleLogger } from "../../utils/logger";
import LLMService, { TContentDraftResult } from "../llm/llm.service";
import {
    contentMediaType,
    contentSourceHash,
    contentText,
    contentVideoUrls,
} from "./content-source";

const log = createModuleLogger(logger, "content-search-profile");

export class ContentProfileError extends Error {
    constructor(
        public code: string,
        message: string,
        public statusCode: number,
    ) {
        super(message);
    }
}

const CONFLICT = () =>
    new ContentProfileError(
        "REVISION_CONFLICT",
        "Someone else changed this summary. Reload it and try again.",
        StatusCodes.CONFLICT,
    );

const isDuplicateKey = (err: unknown) => (err as { code?: number })?.code === 11000;

export function profileState(
    content: IContent,
    profile: Pick<IContentSearchProfile, "status" | "sourceHash"> | null,
): EContentProfileState {
    if (!profile) return EContentProfileState.NO_SUMMARY;
    if (profile.status === EContentProfileStatus.NEEDS_MANUAL) {
        return EContentProfileState.NEEDS_MANUAL;
    }
    if (profile.sourceHash !== contentSourceHash(content)) {
        return EContentProfileState.NEEDS_REVIEW;
    }
    return profile.status as unknown as EContentProfileState;
}

const EMPTY_FIELDS: IContentProfileFields = {
    summary: "",
    oneLiner: "",
    keywordsEn: [],
    keywordsHi: [],
    exampleQuestions: [],
    suitableFor: [],
};

export class ContentSearchProfileService {
    private llm = new LLMService();

    /** Every content, whether or not it has a profile, so nothing is quietly missed. */
    list = async () => {
        const [contents, profiles] = await Promise.all([
            contentModel.find().sort({ contentGroup: 1, sortOrder: 1, _id: 1 }).lean<IContent[]>(),
            contentSearchProfileModel.find().lean<IContentSearchProfile[]>(),
        ]);
        const byContent = new Map(profiles.map((p) => [String(p.contentId), p]));
        return contents.map((content) => {
            const profile = byContent.get(String(content._id)) ?? null;
            return {
                contentId: String(content._id),
                title: content.featuredTitle,
                mediaType: contentMediaType(content),
                state: profileState(content, profile),
                videoChecked: profile?.videoChecked ?? false,
                suitableFor: profile?.suitableFor ?? [],
                updatedAt: profile?.updatedAt ?? null,
            };
        });
    };

    get = async (contentId: string) => {
        const content = await this.requireContent(contentId);
        const profile = await contentSearchProfileModel
            .findOne({ contentId })
            .lean<IContentSearchProfile>();
        return this.view(content, profile);
    };

    /** Draft (or redraft) with Gemini. `revision` is what the caller last saw, 0 for none. */
    generate = async (contentId: string, revision: number) => {
        const content = await this.requireContent(contentId);
        const existing = await contentSearchProfileModel
            .findOne({ contentId })
            .select("revision")
            .lean<{ revision: number }>();
        // Checked before the model call as well as on write: it is slow and costs money.
        if ((existing?.revision ?? 0) !== revision) throw CONFLICT();

        let result: TContentDraftResult;
        try {
            result = await this.llm.draftContentProfile({
                content_id: contentId,
                title: content.featuredTitle,
                text: contentText(content),
                video_urls: contentVideoUrls(content),
            });
        } catch (err) {
            // Not the whole axios error: its config carries the chatbot's API key.
            const { message, code, response } = err as AxiosError;
            log.error(
                { contentId, code, status: response?.status, reason: message },
                "Content profile draft failed",
            );
            throw new ContentProfileError(
                "DRAFT_FAILED",
                "The summary could not be generated. Please try again.",
                StatusCodes.BAD_GATEWAY,
            );
        }

        const drafted = result.status === "DRAFTED" ? result.profile : null;
        const fields: IContentProfileFields = drafted
            ? {
                  summary: drafted.summary,
                  oneLiner: drafted.one_liner,
                  keywordsEn: drafted.keywords_en,
                  keywordsHi: drafted.keywords_hi,
                  exampleQuestions: drafted.example_questions,
                  suitableFor: drafted.suitable_for,
              }
            : EMPTY_FIELDS;

        return this.write(content, revision, {
            ...fields,
            status: drafted ? EContentProfileStatus.DRAFT : EContentProfileStatus.NEEDS_MANUAL,
            videoChecked: Boolean(drafted) && result.video_checked === true,
            // The content as it was sent to the model, not as it may be by now.
            sourceHash: contentSourceHash(content),
        });
    };

    /**
     * Save an admin's edits. Always back to DRAFT, so an edit is never live unapproved.
     * `sourceHash` is the content version the admin was looking at.
     */
    save = async (
        contentId: string,
        revision: number,
        sourceHash: string,
        fields: IContentProfileFields,
    ) => {
        const content = await this.requireContent(contentId);
        this.requireSameSource(content, sourceHash);
        const existing = await contentSearchProfileModel
            .findOne({ contentId })
            .select("sourceHash videoChecked")
            .lean<Pick<IContentSearchProfile, "sourceHash" | "videoChecked">>();
        return this.write(content, revision, {
            ...fields,
            status: EContentProfileStatus.DRAFT,
            sourceHash,
            // The model read the earlier version, which says nothing about this one.
            videoChecked:
                existing?.sourceHash === sourceHash ? (existing?.videoChecked ?? false) : false,
        });
    };

    /** The only way a content becomes suggestible. */
    approve = async (contentId: string, revision: number, sourceHash: string, adminId: string) => {
        const content = await this.requireContent(contentId);
        this.requireSameSource(content, sourceHash);
        const profile = await contentSearchProfileModel
            .findOne({ contentId })
            .lean<IContentSearchProfile>();
        if (!profile || profile.revision !== revision) throw CONFLICT();
        if (profile.sourceHash !== sourceHash) {
            throw new ContentProfileError(
                "PROFILE_OUTDATED",
                "The content changed after this summary was written. Review and save it first.",
                StatusCodes.CONFLICT,
            );
        }
        if (
            profile.status === EContentProfileStatus.NEEDS_MANUAL ||
            !profile.summary ||
            !profile.oneLiner ||
            !profile.suitableFor.length
        ) {
            throw new ContentProfileError(
                "PROFILE_INCOMPLETE",
                "Add a summary, a one-line description and at least one suitable stage first.",
                StatusCodes.BAD_REQUEST,
            );
        }
        return this.write(content, revision, {
            status: EContentProfileStatus.APPROVED,
            approvedAt: new Date(),
            approvedBy: adminId as unknown as IContentSearchProfile["approvedBy"],
        });
    };

    private requireContent = async (contentId: string): Promise<IContent> => {
        const content = await contentModel.findById(contentId).lean<IContent>();
        if (!content) {
            throw new ContentProfileError(
                "CONTENT_NOT_FOUND",
                "Content not found",
                StatusCodes.NOT_FOUND,
            );
        }
        return content;
    };

    private requireSameSource = (content: IContent, sourceHash: string) => {
        if (contentSourceHash(content) !== sourceHash) {
            throw new ContentProfileError(
                "CONTENT_CHANGED",
                "This content changed while you were reviewing it. Reload it and try again.",
                StatusCodes.CONFLICT,
            );
        }
    };

    private write = async (
        content: IContent,
        revision: number,
        update: Partial<IContentSearchProfile>,
    ) => {
        const approval =
            update.status === EContentProfileStatus.APPROVED
                ? {}
                : { approvedAt: null, approvedBy: null };
        const set = { ...update, ...approval, revision: revision + 1 };
        let profile: IContentSearchProfile | null;
        if (revision === 0) {
            try {
                const created = await contentSearchProfileModel.create({
                    ...set,
                    contentId: content._id,
                });
                profile = created.toObject() as IContentSearchProfile;
            } catch (err) {
                if (isDuplicateKey(err)) throw CONFLICT();
                throw err;
            }
        } else {
            profile = await contentSearchProfileModel
                .findOneAndUpdate(
                    { contentId: content._id, revision },
                    { $set: set },
                    { new: true, runValidators: true },
                )
                .lean<IContentSearchProfile>();
        }
        if (!profile) throw CONFLICT();
        return this.view(content, profile);
    };

    private view = (content: IContent, profile: IContentSearchProfile | null) => ({
        content: {
            contentId: String(content._id),
            title: content.featuredTitle,
            mediaType: contentMediaType(content),
            text: contentText(content),
            videoUrls: contentVideoUrls(content),
            category: content.category,
            validWeekStart: content.validWeekStart,
            validWeekEnd: content.validWeekEnd,
            sourceHash: contentSourceHash(content),
        },
        state: profileState(content, profile),
        profile: profile
            ? {
                  revision: profile.revision,
                  summary: profile.summary,
                  oneLiner: profile.oneLiner,
                  keywordsEn: profile.keywordsEn,
                  keywordsHi: profile.keywordsHi,
                  exampleQuestions: profile.exampleQuestions,
                  suitableFor: profile.suitableFor,
                  videoChecked: profile.videoChecked,
                  approvedAt: profile.approvedAt,
              }
            : null,
    });
}

export const contentSearchProfileService = new ContentSearchProfileService();
