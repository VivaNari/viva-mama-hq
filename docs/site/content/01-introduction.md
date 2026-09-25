---
title: Introduction
section: Overview
description: What VivaMama is, what lives in this monorepo, and how to use this guide.
---

VivaMama is an open-source postpartum and maternal-health platform. This repository is a
**polyglot monorepo**: TypeScript and Python, five workspaces, one lockfile per language,
one task graph.

This guide takes you from a fresh clone to a running local stack. It documents what the
repository *actually does* — every command, version and port here was read out of the
repo's own configuration rather than assumed.

## What's in the box

| Workspace | Package | Stack | Port |
| --- | --- | --- | --- |
| `apps/mobile` | `@vivamama/mobile` | React Native + TypeScript | Metro `8081` |
| `apps/admin` | `@vivamama/admin` | React + Vite | `3039` |
| `services/backend` | `@vivamama/backend` | Node + Express 5 + TypeScript | `4000` |
| `services/chatbot` | `vivamama-chatbot` | Python + FastAPI + LangChain | `8001` |
| `packages/contracts` | `@vivamama/contracts` | Shared TypeScript types | — |

Backing services in the Docker stack: **MongoDB** `27017`, **Redis** `6379`, and an
**OpenTelemetry collector** on `4318`.

## How to read this guide

The **Getting started** pages are written to be followed in order. Each one ends with a
check you can run to confirm that step worked before moving on.

If you only want one service running, you can skip ahead — [Running locally](/running)
covers each service independently. You do **not** need Python, Docker or the Android
toolchain to work on the backend or the admin console.

## Conventions

Blocks like this flag something that needs a decision or a value you must supply:

> 🚧 **Needs filling in** — items marked this way are project-specific and cannot be
> derived from the repository. Ask a maintainer, or check the deployment environment.

Blocks like this flag a known discrepancy between the repo's own docs and its actual state:

> ⚠️ **Known issue** — the repository currently contradicts itself here. The guide
> documents what works, and links the fix.

## Before you start

Read [`CONTRIBUTING.md`](https://github.com/VivaNari/viva-mama-hq/blob/main/CONTRIBUTING.md)
and [`CODE_OF_CONDUCT.md`](https://github.com/VivaNari/viva-mama-hq/blob/main/CODE_OF_CONDUCT.md).
For anything security-related, **do not open a public issue** — follow
[`SECURITY.md`](https://github.com/VivaNari/viva-mama-hq/blob/main/SECURITY.md).

Ready? Start with [Prerequisites →](/prerequisites)
