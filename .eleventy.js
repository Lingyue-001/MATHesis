module.exports = function(eleventyConfig) {
  // 静态资源复制
  eleventyConfig.addPassthroughCopy("src/js");
  eleventyConfig.addPassthroughCopy("src/css");
  eleventyConfig.addPassthroughCopy("assets/fonts");
  eleventyConfig.addPassthroughCopy("static");
  eleventyConfig.addPassthroughCopy("src/data.json");
  eleventyConfig.addPassthroughCopy("assets");
  return {
    dir: {
      input: "src",     // 如果你是用 src/ 放内容
      includes: "layouts",  // ✅ 告诉它 layouts 在哪
      data: "data",
      output: "dist"    // 或者 "_site"，根据你的设置
    }
  };
};


  return {
    dir: {
      input: "src",
      output: "dist",
      includes: "layouts"  // ✅ 告诉 Eleventy 用 layouts 作为模板路径
    }
  };
