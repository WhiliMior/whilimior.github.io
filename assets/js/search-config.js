/**
 * 自定义搜索配置优化
 * 这个文件可以用来增强 Fuse.js 的搜索性能和准确性
 */

// Fuse.js 高级配置示例
// 如果需要在网站中手动调用,可以修改以下参数

const fuseOptions = {
  // 匹配阈值 (0-1),越低越严格
  // 0.0: 完全匹配
  // 0.3: 较严格匹配 (推荐)
  // 0.5: 中等匹配
  // 1.0: 模糊匹配
  threshold: 0.3,

  // 要搜索的字段及其权重
  keys: [
    {
      name: 'title',
      weight: 0.7  // 标题权重高
    },
    {
      name: 'content',
      weight: 0.3  // 内容权重低
    },
    {
      name: 'tags',
      weight: 0.5  // 标签权重中等
    },
    {
      name: 'categories',
      weight: 0.5  // 分类权重中等
    }
  ],

  // 是否包含位置信息
  includeMatches: false,

  // 是否包含评分信息
  includeScore: true,

  // 最小匹配字符数
  minMatchCharLength: 2,

  // 是否忽略位置和大小写
  ignoreLocation: true,
  ignoreFieldNorm: true,

  // 扩展搜索模式
  useExtendedSearch: true,

  // 间距设置
  distance: 100,

  // 词干提取模式
  // 'full': 完整单词
  // 'reverse': 反向
  // 'strict': 严格
  tokenize: true
  matchAllTokens: true
};

// 搜索预处理函数
function preprocessData(data) {
  return data.map(item => {
    // 转换为小写以进行不区分大小写的搜索
    const lowerCaseTitle = item.title ? item.title.toLowerCase() : '';
    const lowerCaseContent = item.content ? item.content.toLowerCase() : '';
    const lowerCaseTags = item.tags ? item.tags.map(tag => tag.toLowerCase()) : [];
    const lowerCaseCategories = item.categories ? item.categories.map(cat => cat.toLowerCase()) : [];

    return {
      ...item,
      title: lowerCaseTitle,
      content: lowerCaseContent,
      tags: lowerCaseTags,
      categories: lowerCaseCategories
    };
  });
}

// 搜索结果排序函数
function sortResults(results) {
  return results.sort((a, b) => {
    // 优先考虑标题匹配,然后是内容和标签
    if (a.score !== b.score) {
      return b.score - a.score;
    }
    return 0;
  });
}

// 导出配置
if (typeof module !== 'undefined' && module.exports) {
  module.exports = { fuseOptions, preprocessData, sortResults };
}
