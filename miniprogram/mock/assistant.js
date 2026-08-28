const replyRules = [
  {
    keywords: ['发布', '出售', '卖东西', '上传'],
    reply: '点击底部导航栏的“发布”，填写商品信息并上传图片后就可以发布。',
  },
  {
    keywords: ['搜索', '查找', '找商品', '教材', '书籍', '数码'],
    reply: '你可以使用首页顶部的搜索框输入关键词，也可以进入“分类”按资源类型查找。',
  },
  {
    keywords: ['收藏', '喜欢'],
    reply: '进入商品详情页后可以收藏商品，之后在“我的-我的收藏”中统一查看。',
  },
  {
    keywords: ['下架', '售出', '已卖'],
    reply: '进入“我的-我的发布”，找到对应商品后就可以进行下架或标记已售出的操作。',
  },
  {
    keywords: ['消息', '联系', '卖家', '聊天'],
    reply: '打开商品详情页并联系发布者，后续对话可以在底部“消息”页面中查看。',
  },
  {
    keywords: ['你好', '嗨', '在吗'],
    reply: '你好，我在。你可以问我如何搜索、发布、收藏或管理校园资源。',
  },
];

function getMockAssistantReply(question) {
  const normalizedQuestion = String(question || '').trim().toLowerCase();
  const matchedRule = replyRules.find(rule => (
    rule.keywords.some(keyword => normalizedQuestion.includes(keyword))
  ));

  if (matchedRule) return matchedRule.reply;

  return '我目前可以帮你了解商品搜索、发布、收藏和商品管理。你可以换个说法再问问我。';
}

module.exports = { getMockAssistantReply };
