# Novecento 开场字体

本项目**不分发授权 Novecento 字体**。`public/fonts/novecento` 有意不进入 Git，构建脚本也不再从任何远程主机恢复它（`scripts/prepare-webfonts.mjs` 只校验本机已放入的文件，无主机或项目名判断）。

- 授权 kit 由持有者自行放入 `public/fonts/novecento`：三份 `webFonts/NovecentoSansWide{Normal,DemiBold,Bold}/font.woff2` 与 `RhineLabNovecento.css`，构建时逐文件对照 `verification/boot-lettering/webfont-sources.json` 记录的 SHA-256，不匹配即中止。
- 未放入 kit 时构建正常完成，开场沿用既有的固定文字图形（`src/boot-lettering-art.json` 的短语字形）。
- 哈希与三份 WOFF2 的字节数（合计 119,732 字节）来自固定的 kit 版本；更换 kit 需同步更新该记录。
- 本地验证：`npm run build` 通过即可；原生浏览器字体回归见 `scripts/` 中相关检查。

授权原文件与订单不提交到公共仓库。网页年度许可不等于内容包分发许可，本项目不以此字体做任何再分发。
