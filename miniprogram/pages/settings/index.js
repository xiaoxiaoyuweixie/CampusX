const { api } = require("../../api/index.js");

const DEFAULT_AVATAR = "";
const storage = require('../../utils/storage.js');
const { api } = require('../../api/index.js');
const { uploadImage } = require('../../utils/upload.js');

Page({
  data: {
    profile: {
      nickname: "校园用户",
      avatar: DEFAULT_AVATAR,
      gender: "未设置",
      bio: "这个人很懒，暂时还没有个人简介",
      school: "未设置"
    },
    account: {
      phone: "未绑定",
      security: "建议开启"
    },
    settings: {
      notification: true,
      darkMode: false,
      cacheSize: "12.4MB",
      fontSize: "标准"
    }
  },

  async onShow() {
    this.syncProfileFromStorage();
    await this.syncProfileFromCloud();
  },

  syncProfileFromStorage() {
    const userInfo = wx.getStorageSync("userInfo") || {};
    this.setData({
      "profile.nickname": userInfo.nickname || this.data.profile.nickname,
      "profile.gender": userInfo.gender || this.data.profile.gender,
      "profile.bio": userInfo.bio || this.data.profile.bio,
      "profile.school": userInfo.school || this.data.profile.school,
      "profile.avatar": userInfo.avatar || DEFAULT_AVATAR
    });
  },

  async syncProfileFromCloud() {
    const res = await api.getUserInfo();
    const payload = res.result || {};
    if (payload.code !== 0 || !payload.data) return;

    const userInfo = {
      ...(wx.getStorageSync("userInfo") || {}),
      ...payload.data,
      logged: true
    };
    wx.setStorageSync("userInfo", userInfo);
    this.syncProfileFromStorage();
  },

  onEditField(e) {
    const { field } = e.currentTarget.dataset || {};
    if (field === "nickname") {
      this.editNickname();
      return;
    }
    if (field === "gender") {
      this.editGender();
      return;
    }
    if (field === "bio") {
      this.editBio();
      return;
    }

    wx.showToast({
      title: "该编辑功能开发中",
      icon: "none"
    });
  },

  editNickname() {
    wx.showModal({
      title: "编辑昵称",
      editable: true,
      placeholderText: "请输入昵称",
      content: this.data.profile.nickname || "",
      success: (res) => {
        if (!res.confirm) return;
        const nickname = (res.content || "").trim();
        if (!nickname) {
          wx.showToast({ title: "昵称不能为空", icon: "none" });
          return;
        }
        this.updateNickname(nickname);
      }
    });
  },

  editGender() {
    const genderOptions = ["未知", "男", "女"];
    wx.showActionSheet({
      itemList: genderOptions,
      success: (res) => {
        const gender = genderOptions[res.tapIndex];
        if (!gender) return;
        this.updateGender(gender);
      }
    });
  },

  editBio() {
    wx.showModal({
      title: "编辑个人简介",
      editable: true,
      placeholderText: "请输入个人简介",
      content: this.data.profile.bio || "",
      success: (res) => {
        if (!res.confirm) return;
        const bio = (res.content || "").trim();
        if (!bio) {
          wx.showToast({ title: "个人简介不能为空", icon: "none" });
          return;
        }
        this.updateBio(bio);
      }
    });
  },

  async onChooseAvatar(e) {
    const { avatarUrl } = e.detail || {};
    if (!avatarUrl) return;
    try {
      const userInfo = wx.getStorageSync("userInfo") || {};
      const result = await uploadImage({ filePath: avatarUrl, type: 'avatar', openid: userInfo.openid });
      this.updateAvatar(result.fileID, result.url || avatarUrl);
    } catch (error) {
      wx.showToast({ title: error.message || '头像上传失败', icon: 'none' });
    }
  },

  async updateAvatar(avatarUrl) {
    wx.showLoading({ title: "上传中" });
    try {
      const userInfo = wx.getStorageSync("userInfo") || {};
      const openid = userInfo.openid || userInfo.token || wx.getStorageSync("token") || "unknown";
      const ext = this.getFileExt(avatarUrl);
      const uploadRes = await this.uploadAvatar(avatarUrl, `avatar/${openid}-${Date.now()}.${ext}`);
      await this.saveProfile({ avatar: uploadRes.fileID }, { silent: true });
      wx.showToast({
        title: "头像已更新",
        icon: "success"
      });
    } catch (err) {
      wx.showToast({
        title: err.message || "头像更新失败",
        icon: "none"
      });
    } finally {
      wx.hideLoading();
    }
  },

  async updateNickname(nickname) {
    await this.saveProfile({ nickname });
  },

  updateGender(gender) {
    this.setData({ "profile.gender": gender });

    const userInfo = wx.getStorageSync("userInfo") || {};
    userInfo.gender = gender;
    wx.setStorageSync("userInfo", userInfo);

    api.updateUserInfo({ nickname, avatar: userInfo.avatarFileID || userInfo.avatar || '' }).catch(() => {});

    wx.showToast({
      title: "更新成功",
      icon: "success"
    });
  },

  async updateBio(bio) {
    await this.saveProfile({ bio });
  },

  getFileExt(filePath) {
    const match = String(filePath || "").match(/\.([a-zA-Z0-9]+)(?:\?|$)/);
    return match ? match[1].toLowerCase() : "png";
  },

  uploadAvatar(filePath, cloudPath) {
    return new Promise((resolve, reject) => {
      wx.cloud.uploadFile({
        cloudPath,
        filePath,
        success: resolve,
        fail: reject
      });
    });
  },

  async saveProfile(data, options = {}) {
    const res = await api.updateUserInfo(data);
    const payload = res.result || {};
    if (payload.code !== 0) {
      wx.showToast({
        title: payload.message || "更新失败",
        icon: "none"
      });
      return;
    }

    const userInfo = {
      ...(wx.getStorageSync("userInfo") || {}),
      ...payload.data,
      logged: true
    };
    wx.setStorageSync("userInfo", userInfo);
    this.syncProfileFromStorage();

    if (!options.silent) {
      wx.showToast({
        title: "更新成功",
        icon: "success"
      });
    }
  },

  onLogout() {
    const userInfo = wx.getStorageSync("userInfo") || {};
    userInfo.logged = false;
    wx.setStorageSync("userInfo", userInfo);
    wx.reLaunch({ url: "/pages/login/login" });
  }
});
