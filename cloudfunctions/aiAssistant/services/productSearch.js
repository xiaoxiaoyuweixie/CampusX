const PRODUCT_RESULT_LIMIT = 5;
const PRODUCT_CANDIDATE_LIMIT = 100;
const NO_PRODUCT_REPLY = '暂未找到相关在售商品';

const DEFAULT_CATEGORIES = [
  {
    id: 'digital',
    name: '数码电子',
    aliases: ['数码', '电子', '手机', '电脑', '平板', '耳机', 'ipad', 'iphone', '相机', '键盘', '鼠标'],
  },
  {
    id: 'kaoyan',
    name: '考研资料',
    aliases: ['考研', '真题', '考研笔记', '复习资料'],
  },
  {
    id: 'book',
    name: '教材书籍',
    aliases: ['教材', '课本', '书籍', '二手书', '辅导书'],
  },
  {
    id: 'skill',
    name: '技能服务',
    aliases: ['技能服务', '摄影', '设计', '维修', '代取快递'],
  },
  {
    id: 'dorm',
    name: '宿舍用品',
    aliases: ['宿舍', '台灯', '收纳', '生活用品', '宿舍电器'],
  },
];

const RULE_QUERY_PATTERN = /(规则|发布|下架|售出|售后|退款|纠纷|聊天|联系|违规|禁止|限制|多少字|几张|怎么处理|如何处理|能不能卖|可以卖)/i;
const SEARCH_ACTION_PATTERN = /(帮我找|给我找|我想找|我要找|想找|找一下|搜索|搜一下|推荐|想买|我要买|需要买|求购|有没有|有什么|有哪些|哪里有|谁有|看看.*(商品|二手))/i;
const PRODUCT_HINT_PATTERN = /(商品|二手|数码|手机|电脑|平板|耳机|ipad|iphone|相机|键盘|鼠标|考研|教材|课本|书籍|真题|笔记|宿舍|台灯|收纳|摄影|设计|维修)/i;
const PRICE_PATTERN = /(\d+(?:\.\d+)?)\s*(?:元|块)?\s*(以内|以下|不超过|最多|以上|起)/;
const GENERIC_SEARCH_TOKENS = new Set(['商品', '二手', '资料', '用品', '服务']);

function normalizeText(value) {
  return String(value || '')
    .toLowerCase()
    .replace(/\s+/g, '')
    .replace(/[，。！？、；：,.!?;:'"“”‘’（）()【】\[\]{}<>《》·\-_/\\]/g, '');
}

function isProductSearchQuery(question) {
  const text = String(question || '').trim();
  if (!text || RULE_QUERY_PATTERN.test(text)) return false;
  if (SEARCH_ACTION_PATTERN.test(text)) return true;
  if (PRICE_PATTERN.test(text) && PRODUCT_HINT_PATTERN.test(text)) return true;

  const normalized = normalizeText(text);
  return normalized.length <= 14 && DEFAULT_CATEGORIES.some(category => (
    [category.name, ...category.aliases].some(alias => normalized.includes(normalizeText(alias)))
  ));
}

function normalizeCategories(categoryList = []) {
  const dynamicCategories = categoryList
    .filter(category => category && (category.categoryId || category.id) && category.name)
    .map(category => ({
      id: category.categoryId || category.id,
      name: category.name,
      aliases: [category.name],
    }));

  const categoryMap = new Map();
  [...DEFAULT_CATEGORIES, ...dynamicCategories].forEach(category => {
    const existed = categoryMap.get(category.id);
    categoryMap.set(category.id, existed
      ? { ...existed, name: category.name, aliases: [...new Set([...existed.aliases, ...category.aliases])] }
      : category);
  });
  return [...categoryMap.values()];
}

function resolveCategory(question, categories) {
  const normalizedQuestion = normalizeText(question);
  const candidates = categories.flatMap(category => (
    [category.name, ...category.aliases].map(alias => ({
      category,
      alias,
      normalizedAlias: normalizeText(alias),
    }))
  )).filter(item => item.normalizedAlias && normalizedQuestion.includes(item.normalizedAlias));

  candidates.sort((a, b) => b.normalizedAlias.length - a.normalizedAlias.length);
  return candidates[0] || null;
}

function parsePriceRange(question) {
  const text = String(question || '');
  const rangeMatch = text.match(/(\d+(?:\.\d+)?)\s*(?:元|块)?\s*(?:-|~|至|到|—)\s*(\d+(?:\.\d+)?)\s*(?:元|块)?/);
  if (rangeMatch) {
    const first = Number(rangeMatch[1]);
    const second = Number(rangeMatch[2]);
    return { minPrice: Math.min(first, second), maxPrice: Math.max(first, second) };
  }

  const budgetMatch = text.match(/(?:预算|价格)\s*(?:是|为|：|:)?\s*(\d+(?:\.\d+)?)\s*(?:元|块)?/);
  if (budgetMatch) return { minPrice: null, maxPrice: Number(budgetMatch[1]) };

  const singleMatch = text.match(PRICE_PATTERN);
  if (!singleMatch) return { minPrice: null, maxPrice: null };
  const price = Number(singleMatch[1]);
  return /(以上|起)/.test(singleMatch[2])
    ? { minPrice: price, maxPrice: null }
    : { minPrice: null, maxPrice: price };
}

function parseLocation(question) {
  const text = String(question || '');
  const match = text.match(/[一-龥A-Za-z0-9·]{2,12}(?:校区|栋|舍|园|楼|食堂|公寓)/);
  if (!match) return '';
  return match[0]
    .replace(/^(请|帮我|给我|我想|我要|想在|要在|在|找)+/, '')
    .replace(/^西南大学/, '')
    .trim();
}

function removeSearchNoise(question, matchedCategory, location) {
  let keyword = String(question || '').toLowerCase();
  keyword = keyword
    .replace(/\d+(?:\.\d+)?\s*(?:元|块)?\s*(?:-|~|至|到|—)\s*\d+(?:\.\d+)?\s*(?:元|块)?/g, ' ')
    .replace(/\d+(?:\.\d+)?\s*(?:元|块)?\s*(?:以内|以下|不超过|最多|以上|起)/g, ' ')
    .replace(/(?:预算|价格)\s*(?:是|为|：|:)?\s*\d+(?:\.\d+)?\s*(?:元|块)?/g, ' ');

  if (matchedCategory) {
    const aliases = [matchedCategory.category.name, ...matchedCategory.category.aliases]
      .sort((a, b) => b.length - a.length);
    aliases.forEach(alias => {
      keyword = keyword.replace(new RegExp(alias.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'ig'), ' ');
    });
  }
  if (location) keyword = keyword.replace(location.toLowerCase(), ' ');

  const noise = [
    '帮我找', '给我找', '我想找', '我要找', '想找', '找一下', '搜索', '搜一下', '推荐一下', '推荐', '我想买',
    '我要买', '想买', '需要买', '求购', '有没有', '有什么', '有哪些', '哪里有', '谁有', '帮我', '给我', '请问',
    '看看', '校园', '二手', '在售', '商品', '便宜的', '便宜', '低价', '最新',
    '一本', '一套', '一台', '一个', '一件', '一份', '的', '吗', '呢',
  ];
  noise.sort((a, b) => b.length - a.length).forEach(word => {
    keyword = keyword.split(word).join(' ');
  });

  return keyword.replace(/[，。！？、；：,.!?;:'"“”‘’（）()【】\[\]{}<>《》·_/\\-]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function buildSearchTokens(keyword) {
  const tokens = new Set();
  String(keyword || '').split(/\s+/).filter(Boolean).forEach(part => {
    const normalized = normalizeText(part);
    if (!normalized) return;
    tokens.add(normalized);
    if (/^[\u4e00-\u9fa5]+$/.test(normalized) && normalized.length > 2) {
      for (let index = 0; index < normalized.length - 1; index += 1) {
        tokens.add(normalized.slice(index, index + 2));
      }
    }
  });
  return [...tokens].filter(token => token.length >= 2 && !GENERIC_SEARCH_TOKENS.has(token));
}

function parseProductSearchQuery(question, categoryList = []) {
  const categories = normalizeCategories(categoryList);
  const matchedCategory = resolveCategory(question, categories);
  const { minPrice, maxPrice } = parsePriceRange(question);
  const location = parseLocation(question);
  const keyword = removeSearchNoise(question, matchedCategory, location);
  const text = String(question || '');
  const sort = /(便宜|低价|价格低)/.test(text)
    ? 'price_asc'
    : /(最新|刚发布|新发布)/.test(text) ? 'newest' : 'relevance';

  return {
    keyword,
    tokens: buildSearchTokens(keyword),
    categoryId: matchedCategory ? matchedCategory.category.id : '',
    categoryName: matchedCategory ? matchedCategory.category.name : '',
    minPrice,
    maxPrice,
    location,
    sort,
  };
}

function toTimestamp(value) {
  if (!value) return 0;
  if (value instanceof Date) return value.getTime();
  if (typeof value === 'number') return value;
  if (typeof value === 'string') {
    const timestamp = new Date(value).getTime();
    return Number.isNaN(timestamp) ? 0 : timestamp;
  }
  if (typeof value.toDate === 'function') return value.toDate().getTime();
  return 0;
}

function normalizeProduct(product = {}) {
  const images = Array.isArray(product.images) ? product.images.filter(Boolean) : [];
  return {
    id: product.productId || product._id || '',
    title: String(product.title || '').trim(),
    cover: product.cover || images[0] || '',
    price: Number(product.price || 0),
    location: String(product.location || product.campus || '').trim(),
    campus: String(product.campus || '').trim(),
    categoryId: product.categoryId || product.category || '',
    categoryName: product.categoryName || product.category || '',
    description: String(product.description || product.desc || '').trim(),
    viewCount: Number(product.viewCount || product.views || 0),
    favoriteCount: Number(product.favoriteCount || product.favorites || 0),
    createdAt: product.createdAt || product.updatedAt || null,
  };
}

function scoreProduct(product, criteria) {
  const title = normalizeText(product.title);
  const description = normalizeText(product.description);
  const category = normalizeText(`${product.categoryName}${product.categoryId}`);
  const location = normalizeText(`${product.location}${product.campus}`);
  let score = 0;
  let tokenMatches = 0;

  criteria.tokens.forEach(token => {
    if (title.includes(token)) {
      score += 35;
      tokenMatches += 1;
    } else if (description.includes(token)) {
      score += 18;
      tokenMatches += 1;
    } else if (category.includes(token)) {
      score += 14;
      tokenMatches += 1;
    } else if (location.includes(token)) {
      score += 10;
      tokenMatches += 1;
    }
  });

  if (criteria.categoryId && product.categoryId === criteria.categoryId) score += 30;
  if (criteria.location && location.includes(normalizeText(criteria.location))) score += 25;
  score += Math.min(Math.log1p(product.favoriteCount) * 2, 8);
  score += Math.min(Math.log1p(product.viewCount), 6);

  return { score, tokenMatches };
}

function matchesFilters(product, criteria) {
  if (criteria.categoryId && product.categoryId !== criteria.categoryId) return false;
  if (criteria.minPrice != null && product.price < criteria.minPrice) return false;
  if (criteria.maxPrice != null && product.price > criteria.maxPrice) return false;
  if (criteria.location) {
    const productLocation = normalizeText(`${product.location}${product.campus}`);
    if (!productLocation.includes(normalizeText(criteria.location))) return false;
  }
  return true;
}

function rankProducts(productList, criteria) {
  const ranked = productList
    .map(normalizeProduct)
    .filter(product => product.id && product.title && matchesFilters(product, criteria))
    .map(product => ({ ...product, ...scoreProduct(product, criteria) }))
    .filter(product => !criteria.tokens.length || product.tokenMatches > 0);

  ranked.sort((a, b) => {
    if (criteria.sort === 'price_asc' && a.price !== b.price) return a.price - b.price;
    if (criteria.sort === 'newest') return toTimestamp(b.createdAt) - toTimestamp(a.createdAt);
    if (Math.abs(b.score - a.score) > 0.001) return b.score - a.score;
    return toTimestamp(b.createdAt) - toTimestamp(a.createdAt);
  });

  return ranked.slice(0, PRODUCT_RESULT_LIMIT).map(product => ({
    id: product.id,
    title: product.title,
    cover: product.cover,
    price: product.price,
    location: product.location,
    campus: product.campus,
    categoryId: product.categoryId,
    categoryName: product.categoryName,
    description: product.description,
  }));
}

async function getEnabledCategories(db) {
  try {
    const result = await db.collection('categories').where({ status: 'enabled' }).get();
    return result.data || [];
  } catch (error) {
    return [];
  }
}

async function searchProducts(db, question) {
  const categories = await getEnabledCategories(db);
  const criteria = parseProductSearchQuery(question, categories);
  const result = await db.collection('products')
    .where({ status: 'on_sale' })
    .orderBy('createdAt', 'desc')
    .limit(PRODUCT_CANDIDATE_LIMIT)
    .get();
  return {
    criteria: {
      keyword: criteria.keyword,
      categoryId: criteria.categoryId,
      categoryName: criteria.categoryName,
      minPrice: criteria.minPrice,
      maxPrice: criteria.maxPrice,
      location: criteria.location,
      sort: criteria.sort,
    },
    products: rankProducts(result.data || [], criteria),
  };
}

module.exports = {
  NO_PRODUCT_REPLY,
  PRODUCT_RESULT_LIMIT,
  isProductSearchQuery,
  parseProductSearchQuery,
  rankProducts,
  searchProducts,
};
