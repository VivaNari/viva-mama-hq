import type { Storage } from "@google-cloud/storage";

/**
 * An in-memory stand-in for the parts of @google-cloud/storage the attachment code
 * uses. Objects are keyed "bucket/name". `failNext` makes the next matching call
 * throw, to exercise the storage-outage paths.
 */
export type FakeGcs = {
    storage: Storage;
    objects: Map<string, { data: Buffer; contentType?: string }>;
    signed: string[];
    failNext: (op: "save" | "delete" | "deleteFiles" | "sign") => void;
    keys: () => string[];
};

export function createFakeGcs(): FakeGcs {
    const objects = new Map<string, { data: Buffer; contentType?: string }>();
    const signed: string[] = [];
    const failures = new Set<string>();
    const maybeFail = (op: string) => {
        if (failures.has(op)) {
            failures.delete(op);
            throw new Error(`fake gcs: ${op} failed`);
        }
    };

    const bucket = (bucketName: string) => ({
        name: bucketName,
        file: (name: string) => {
            const key = `${bucketName}/${name}`;
            return {
                name,
                save: async (data: Buffer, opts?: { contentType?: string }) => {
                    maybeFail("save");
                    objects.set(key, { data: Buffer.from(data), contentType: opts?.contentType });
                },
                delete: async (opts?: { ignoreNotFound?: boolean }) => {
                    maybeFail("delete");
                    if (!objects.has(key) && !opts?.ignoreNotFound) {
                        throw Object.assign(new Error("Not Found"), { code: 404 });
                    }
                    objects.delete(key);
                },
                exists: async () => [objects.has(key)],
                getSignedUrl: async (opts: { expires: Date }) => {
                    maybeFail("sign");
                    const url = `https://storage.example/${key}?X-Goog-Expires=${opts.expires.getTime()}`;
                    signed.push(url);
                    return [url];
                },
            };
        },
        deleteFiles: async ({ prefix }: { prefix: string }) => {
            maybeFail("deleteFiles");
            for (const key of [...objects.keys()]) {
                if (key.startsWith(`${bucketName}/${prefix}`)) objects.delete(key);
            }
        },
    });

    return {
        storage: { bucket } as unknown as Storage,
        objects,
        signed,
        failNext: (op) => failures.add(op),
        keys: () => [...objects.keys()],
    };
}
