const { createCtextSearchMiddleware } = require("./server/ctextSearchMiddleware");

module.exports = function(eleventyConfig) {
  // === 静态资源复制 ===
  eleventyConfig.addPassthroughCopy("src/js");
  eleventyConfig.addPassthroughCopy("src/css");
  eleventyConfig.addPassthroughCopy("assets/fonts");
  eleventyConfig.addPassthroughCopy("static");
  eleventyConfig.addPassthroughCopy("src/transcriptions/tei_hanshu");
  eleventyConfig.addPassthroughCopy("src/transcriptions/tei_brhat");
  eleventyConfig.addPassthroughCopy("src/data.json");
  eleventyConfig.addPassthroughCopy("simp_to_trad_map.json");
  eleventyConfig.addPassthroughCopy("assets");

  // === 环境变量判断 ===
  // 生产构建目录仍由 NODE_ENV 控制；pathPrefix 仅在 GitHub Pages 构建时启用。
  const isProduction = process.env.NODE_ENV === "production";
  const isGitHubPagesBuild = process.env.GITHUB_ACTIONS === "true";
  const pathPrefix = isGitHubPagesBuild ? "/MATHesis/" : "/";

  const ctextMiddleware = createCtextSearchMiddleware();

  // Eleventy v3 dev server path
  if (typeof eleventyConfig.setServerOptions === "function") {
    eleventyConfig.setServerOptions({
      middleware: [ctextMiddleware]
    });
  }

  // Eleventy v2 BrowserSync path (fallback/compat)
  if (typeof eleventyConfig.setBrowserSyncConfig === "function") {
    eleventyConfig.setBrowserSyncConfig({
      middleware: [ctextMiddleware]
    });
  }

  // === 目录结构设置 ===
  return {
    pathPrefix,
    dir: {
      input: "src",          // 源文件夹
      includes: "layouts",   // 模板所在位置
      data: "data",          // 数据目录（可选）
      output: isProduction ? "dist" : "_site" // 🧩 动态切换输出路径
    }
  };
};
