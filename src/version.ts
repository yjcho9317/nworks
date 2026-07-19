import { createRequire } from "node:module";

// 이 모듈은 src 루트(그리고 번들 후 dist 루트)에 위치하므로
// dev(tsx)와 빌드(dist) 양쪽에서 "../package.json"이 패키지 루트로 동일하게 해석된다.
const require = createRequire(import.meta.url);
const pkg = require("../package.json") as { version: string };

export const VERSION = pkg.version;
