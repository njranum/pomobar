# pomobar-temp

An Electron application with React and TypeScript

## Recommended IDE Setup

- [VSCode](https://code.visualstudio.com/) + [ESLint](https://marketplace.visualstudio.com/items?itemName=dbaeumer.vscode-eslint) + [Prettier](https://marketplace.visualstudio.com/items?itemName=esbenp.prettier-vscode)

## Project Setup

### Install

```bash
$ npm install
```

### Development

```bash
$ npm run dev
```

### Build

```bash
# For windows
$ npm run build:win

# For macOS
$ npm run build:mac
macOS notifications will FAIL on a fresh build - requires build to be signed, for now relying on adhoc signing with `codesign --force --dep --sign - release/mac-arm64/pomobar.app`

# For Linux
$ npm run build:linux
```
