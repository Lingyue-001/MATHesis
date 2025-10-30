module.exports = function(eleventyConfig) {
  // === 静态资源复制 ===
  eleventyConfig.addPassthroughCopy("src/js");
  eleventyConfig.addPassthroughCopy("src/css");
  eleventyConfig.addPassthroughCopy("assets/fonts");
  eleventyConfig.addPassthroughCopy("static");
  eleventyConfig.addPassthroughCopy("src/data.json");
  eleventyConfig.addPassthroughCopy("assets");

  // === 环境变量判断 ===
  // GitHub Actions 会自动注入 NODE_ENV=production
  const isProduction = process.env.NODE_ENV === "production";

  // === 目录结构设置 ===
  return {
    dir: {
      input: "src",          // 源文件夹
      includes: "layouts",   // 模板所在位置
      data: "data",          // 数据目录（可选）
      output: isProduction ? "dist" : "_site" // 🧩 动态切换输出路径
    }
  };
};