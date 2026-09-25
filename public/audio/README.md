# Internationale (Quiet Piano) / 国际歌 · 安静钢琴版

三个 Ogg 文件为本项目背景音乐的同步循环声部（旋律 / 和声 / 低音），由源谱脚本程序合成：72 BPM、32 小节 4/4、106.67 秒循环（主歌 16 小节 + 副歌 16 小节），安静毡音钢琴音色，无人声、无采样、无外部录音。

旋律为欧仁·鲍狄埃 1871 年作词、皮埃尔·狄盖特 1888 年作曲的《国际歌》（L'Internationale），词曲已进入公有领域；转录自 Digital Tradition ABC 集（INTERNAT）。本项目仅作安静钢琴编配，编配、电平与合成实现为原创，随仓库采用 LICENSE。MP3 为带首尾淡变的独立试听版（`internationale-preview.mp3`）。

源谱及合成：`scripts/render-audio.mjs`；音效合成：`src/audio.ts`。
生成数据：`score.json`。

## 逐字输入短音

`typing-preview.wav` 及 `src/typing-samples.ts` 使用用户提供的《明日方舟》特别映像 [莱茵生命：访问] 中约 6.864–6.986 秒的三个短音，各 38ms。`typing-source.json` 保留精确时间、源文件校验与处理参数。原音及其衍生片段的权利归原作者，不纳入上文原创配乐的 MIT 授权声明。

提取脚本：`scripts/extract-typing-audio.mjs`。原片短音仅去直流、做边缘淡变和统一增益，没有变调、变速或合成替换。`reference/typing-original.wav` 为本地对照片段，不属于生产配乐。
