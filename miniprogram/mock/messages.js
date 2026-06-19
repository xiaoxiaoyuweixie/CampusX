// 消息 Mock
const systemNotices = [
  { id: 's1', title: '欢迎来到校易通 🎉', desc: '校园资源共享，从这里开始。', time: '今天' },
  { id: 's2', title: '发布须知', desc: '请遵守校规校纪，文明交易。', time: '昨天' },
];

const chats = [
  { id: 'u001', name: '小桂', avatar: '', lastMessage: '可以面交吗？', time: '12:30', unread: 2 },
  { id: 'u002', name: '阿榆', avatar: '', lastMessage: '书还在的，明天可以约', time: '昨天', unread: 0 },
  { id: 'u005', name: '设计的肥肥', avatar: '', lastMessage: '可以的呢，把需求发我看看', time: '周一', unread: 0 },
];

const chatHistory = {
  u001: [
    { from: 'other', text: '你好，看到你发的 iPad', time: '12:20' },
    { from: 'me', text: '在的，还在出哦', time: '12:25' },
    { from: 'other', text: '可以面交吗？', time: '12:30' },
  ],
  u002: [
    { from: 'other', text: '书还在的，明天可以约', time: '昨天' },
  ],
  u005: [
    { from: 'me', text: '在吗，需要一张社团活动海报', time: '周一' },
    { from: 'other', text: '可以的呢，把需求发我看看', time: '周一' },
  ],
};

module.exports = { systemNotices, chats, chatHistory };
