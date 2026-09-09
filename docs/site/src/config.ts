// Single place for repo-level constants referenced by the UI.
//
// Note: this is the *actual* remote. The root README, CONTRIBUTING.md and
// package.json `repository.url` still point at github.com/NexaNeura/vivamama,
// which no longer resolves — see the "Clone the repository" page.
export const REPO_URL = 'https://github.com/VivaNari/viva-mama-hq';

/** Blob URL for a path in the default branch, used by the "edit this page" link. */
export const editUrl = (contentFile: string) =>
  `${REPO_URL}/edit/main/docs/site/content/${contentFile}`;
