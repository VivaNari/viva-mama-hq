/**
 * Drafts search profiles for contents that have none. Never touches an existing one and
 * never approves anything.
 *
 *   npx ts-node scripts/draft-content-profiles.ts                    list what would run
 *   npx ts-node scripts/draft-content-profiles.ts --apply --limit 3  draft three
 *   npx ts-node scripts/draft-content-profiles.ts --apply --ids a,b  draft these
 *
 * One at a time: each video costs roughly 100k input tokens. Safe to run again after a
 * failure, since finished items are skipped. Connects the way
 * the server does (MONGO_URI or MONGODB_*), and needs LLM_SERVER_URL and LLM_API_KEY.
 */
// First: config/env reads process.env as it is imported.
import "dotenv/config";
import mongoose from "mongoose";
import connectDb from "../src/config/db";
import { contentSearchProfileService } from "../src/services/contents/content-search-profile.service";
import { EContentProfileState } from "../src/types/content-search-profile.types";

async function main() {
    const args = process.argv.slice(2);
    const apply = args.includes("--apply");
    const limitArg = args.indexOf("--limit");
    const limit = limitArg >= 0 ? Number(args[limitArg + 1]) : Infinity;
    const idsArg = args.indexOf("--ids");
    const ids = idsArg >= 0 ? (args[idsArg + 1] ?? "").split(",") : null;
    if (!(limit > 0)) throw new Error("--limit must be a positive number");

    await connectDb();
    console.log(`Database: ${mongoose.connection.host}/${mongoose.connection.name}`);

    const pending = (await contentSearchProfileService.list())
        .filter((item) => item.state === EContentProfileState.NO_SUMMARY)
        .filter((item) => !ids || ids.includes(item.contentId))
        .slice(0, limit);
    console.log(`${pending.length} to draft${apply ? "" : " (dry run, pass --apply)"}`);

    let failed = 0;
    for (const item of pending) {
        if (!apply) {
            console.log(`- ${item.mediaType} ${item.title}`);
            continue;
        }
        try {
            const result = await contentSearchProfileService.generate(item.contentId, 0);
            console.log(
                `- ${result.state} videoChecked=${result.profile?.videoChecked} ${item.title}`,
            );
        } catch (err) {
            failed += 1;
            console.error(`- FAILED ${item.title}: ${(err as Error).message}`);
        }
    }
    if (failed) process.exitCode = 1;
}

main()
    .catch((err) => {
        console.error(err);
        process.exitCode = 1;
    })
    .finally(() => mongoose.disconnect());
