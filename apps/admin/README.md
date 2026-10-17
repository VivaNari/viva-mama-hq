## VivaMama Admin

Admin console for the **VivaMama** postpartum care platform — the operations surface for
`viva_nari_app` (mobile FE) and `vivamama_core_server` (BE).

![preview](public/assets/viva-logo-full.png)

## Screens

| Route      | Screen          | Notes                                                        |
| ---------- | --------------- | ------------------------------------------------------------ |
| `/`        | Overview        | Postpartum KPIs, stage breakdown, check-ins, care team tasks  |
| `/mothers` | Mothers         | Roster with care team, postpartum stage, verification, status |
| `/content` | Content library | Postpartum articles and resources                             |
| `/sign-in` | Sign in         | Staff-only login                                              |
| `/404`     | Not found       |                                                               |

Every screen currently runs on mock data in [`src/_mock`](src/_mock) — swap those imports for
`vivamama_core_server` API calls when the endpoints land.

## Branding

| Token     | Value                                                   |
| --------- | ------------------------------------------------------- |
| Primary   | `#6814DB` (sampled from the VivaMama logo)              |
| Secondary | `#FF6B9D`                                               |
| Font      | Poppins (`@fontsource/poppins`)                         |
| Logo      | `public/assets/viva-logo-full.png`, `viva-logo-mark.png` |

Theme tokens live in [`src/theme/theme-config.ts`](src/theme/theme-config.ts); the base radius is in
[`src/theme/create-theme.ts`](src/theme/create-theme.ts).

## Quick start

Requires `Node.js v20.x` or newer.

```sh
yarn install
yarn dev      # http://localhost:3039
yarn build
yarn fix:all  # eslint --fix + prettier
```

## Credits

Built on the [Minimal UI Kit](https://free.minimals.cc/) free template, distributed under the
[MIT](LICENSE.md) license.
