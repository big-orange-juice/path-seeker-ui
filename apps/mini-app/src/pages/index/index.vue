<template>
  <view class="page">
    <view class="hero">
      <text class="eyebrow">Path Seeker</text>
      <text class="title">博物馆解密小程序</text>
      <text class="desc">
        当前是 uni-app 前端骨架。后续这里将承载任务大厅、剧情地图、谜题交互与结案反馈。
      </text>
    </view>

    <view class="cards">
      <view class="card dark">
        <text class="card-title">任务大厅</text>
        <text class="card-desc">选择主题、年龄段与路线时长</text>
      </view>
      <view class="card gold">
        <text class="card-title">章节地图</text>
        <text class="card-desc">逐步解锁线索、推进剧情</text>
      </view>
      <view class="card light">
        <text class="card-title">谜题交互</text>
        <text class="card-desc">以观察、排序、配对和密码为核心</text>
      </view>
    </view>
  </view>
</template>

<style scoped>
.page {
  min-height: 100vh;
  padding: 40rpx 28rpx 60rpx;
}

.hero {
  padding: 48rpx 40rpx;
  border-radius: 36rpx;
  background: rgba(255, 255, 255, 0.74);
  box-shadow: 0 24rpx 80rpx rgba(44, 24, 16, 0.08);
  backdrop-filter: blur(10px);
}

.eyebrow {
  display: block;
  font-size: 22rpx;
  font-weight: 700;
  letter-spacing: 0.4em;
  text-transform: uppercase;
  color: #b45309;
}

.title {
  display: block;
  margin-top: 18rpx;
  font-size: 56rpx;
  font-weight: 900;
  color: #231f17;
}

.desc {
  display: block;
  margin-top: 20rpx;
  font-size: 28rpx;
  line-height: 1.7;
  color: #57534e;
}

.cards {
  display: grid;
  gap: 24rpx;
  margin-top: 28rpx;
}

.card {
  padding: 32rpx;
  border-radius: 28rpx;
}

.card-title {
  display: block;
  font-size: 34rpx;
  font-weight: 800;
}

.card-desc {
  display: block;
  margin-top: 12rpx;
  font-size: 26rpx;
  line-height: 1.6;
}

.card.dark {
  background: #1c1917;
  color: #fafaf9;
}

.card.gold {
  background: #d97706;
  color: #fff7ed;
}

.card.light {
  background: #fff;
  color: #1c1917;
  border: 2rpx solid #e7e5e4;
}
</style>

