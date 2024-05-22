<template>
  <div>
    <div class="sub-title">
      <span>目前收录数：<span class="sub-num">{{ Object.keys(originalImgs).length }}</span></span>
      <span>贡献者数：<span class="sub-num">{{getContributorNum(originalImgs) }}</span></span>
    </div>

    <div class="btn change-mode-btn" @click="changeMode">
      <i class="el-icon-magic-stick" aria-hidden="true" title="随机模式"></i>&nbsp;{{
        !randomMode ? "随机模式" : "普通模式"
      }}
    </div>
    <div class="btn one-more-btn" v-if="randomMode || Object.keys(res).length===1" @click="oneMore">
      <i class="el-icon-thumb" aria-hidden="true" title="再来一张"></i>&nbsp;再来一张
    </div>
    <div class="outer" v-if="!randomMode">
      <div class="search">
        <input type="text" v-model="searchKey" placeholder="搜索标题、描述、贡献者" class="search-input">
      </div>
      <div class="masonry" v-if="Object.keys(res).length>0">
        <div class="item" v-for="(src, name) in res" :key="name">
          <img :src="config.cdn + src.url" @error="setDefaultImage" alt="加载失败...">
          <h2>{{ name }}</h2>
          <p>
            {{ src.dec }}
          </p>
          <p class="contributor">
            <span>贡献者: {{ src.contributor }}</span>

          </p>
          <div class="share">
            <i class="el-icon-share" aria-hidden="true" @click="SharePic(src.url)" v-if="!tempPicUrl"
               title="分享图片"></i>
            <a href="/" v-else><i class="el-icon-menu" aria-hidden="true" title="返回主页"></i></a>

          </div>
        </div>
      </div>
      <div class="masonry" v-else>
        <div class="item load">
          <img src="../assets/loading.gif" alt="">
          <h2>加载中...</h2>
        </div>
      </div>
    </div>
    <div class="outer" v-else>
      <div class="show-one">
        <div class="item item-one">
          <img :src="config.cdn + randomData[randomIndex].url" alt="">
          <h2>{{ randomData[randomIndex].name }}</h2>
          <p>
            {{ randomData[randomIndex].dec }}
          </p>
          <p class="contributor">
            <span>贡献者: {{ randomData[randomIndex].contributor }}</span>

          </p>
          <div class="share">
            <i class="el-icon-share" aria-hidden="true" @click="SharePic(randomData[randomIndex].url)"
               v-if="!tempPicUrl" title="分享图片"></i>
            <a href="/" v-else><i class="el-icon-menu" aria-hidden="true" title="返回主页"></i></a>

          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script>
import config from '../config.js';
import defaultImage from '@/assets/crying_img.png';
export default {
  name: "Resource",
  props: {
    picUrl: {
      type: String,
      default: ""
    }
  },
  data() {
    return {
      config: config,
      res: {},
      tempPicUrl: "",
      randomMode: false,
      randomData: [],
      randomIndex: -1,
      searchKey: '',
      originalImgs:{}

    }
  },
  watch: {
    searchKey: {
      handler: function () {
        this.applySearchFilter();
      },
    },
  },
  created() {
    this.updateData().then(() => {
      this.originalImgs = {...this.res};
    });
    window.ViewImage && ViewImage.init('.item img');
  },
  mounted() {
    this.updateData().then(() => {
      this.updateRes();
    });
  },
  methods: {
    applySearchFilter() {
      let searchKey = this.searchKey.toLowerCase();
      let isChinese = /[\u4e00-\u9fa5]/.test(searchKey);
      if (isChinese) {
        searchKey = searchKey.split('');
      } else {
        searchKey = [searchKey];
      }
      let res = this.originalImgs;
      let filteredImgs = {};
      if (searchKey[0] === '') {
        this.res = {...res};
        return;
      }
      for (let key in res) {
        let img = res[key];
        let flag = false;
        for (let i = 0; i < searchKey.length; i++) {
          let imgDec = typeof img.dec === 'string' ? img.dec.toLowerCase() : String(img.dec).toLowerCase();
          if (key.toLowerCase().includes(searchKey[i]) || imgDec.includes(searchKey[i]) || img.contributor.toLowerCase().includes(searchKey[i])) {
            flag = true;
            break;
          }
        }
        if (flag) {
          filteredImgs[key] = img;
        }
      }
      this.res = filteredImgs;
    },
    getContributorNum(res) {
      let contributor = new Set();
      for (let key in res) {
        contributor.add(res[key].contributor);
      }
      return contributor.size;
    },
    setDefaultImage(e) {
      e.target.src = defaultImage;
    },
    oneMore() {
      if (this.randomMode) {
        this.getRandomPic(undefined);
      }
    },
    getRandomPic(picName) {
      let ores = this.originalImgs
      let keys = Object.keys(ores);
      if (this.randomIndex >= keys.length) {
        this.randomIndex = 0;
      }
      for (let [k, v] of Object.entries(ores)) {
        v['name'] = k;
        this.randomData.push(v);
      }
      // 让picName在第一个
      if (picName) {
        let index = this.randomData.findIndex(item => item.name === picName);
        if (index !== -1) {
          let temp = this.randomData[0];
          this.randomData[0] = this.randomData[index];
          this.randomData[index] = temp;
        }
      }
      this.randomIndex++;
    },
    changeMode() {
      this.randomMode = !this.randomMode;
      if (this.randomMode) {
        this.getRandomPic(undefined);
      }
    },
    SharePic(url) {
      const input = document.createElement('input');
      document.body.appendChild(input);
      let location = window.location.href.split('#')[0]
      input.setAttribute('value', `${location}#/${url}`);
      input.select();
      if (document.execCommand('copy')) {
        document.execCommand('copy');
        this.$message({
          message: '图片链接已复制到剪贴板',
          type: 'success',
          duration: 1500
        });
      }
      document.body.removeChild(input);
    },
    updateRes() {
      const picUrl = this.$route.params.picUrl;
      if (picUrl) {
        this.updateData()
        if (picUrl === 'random') {
          this.randomMode = true;
          this.getRandomPic(undefined);
          return;
        }
        for (let key in this.res) {
          if (this.res[key].url === picUrl) {
            this.tempPicUrl = picUrl;
            this.res = {
              [key]: this.res[key]
            }
            break;
          }
        }
        this.randomMode = true;
        let key_;
        // 从this.res里找出picUrl对应的key
        for (let k in this.res) {
          if (this.res[k].url === picUrl) {
            key_ = k;
            break;
          }
        }
        this.getRandomPic(key_);

      }
    },
    async updateData() {
      let url = config.res;
      try {
        let res = await axios.get(url);
        if (res.data["url"]) {
          let dataUrl = res.data["url"];
          let res2 = await axios.get(dataUrl);
          let data = res2.data;
          let keys = Object.keys(data);
          let newData = {};
          keys.sort(() => Math.random() - 0.5);
          keys.forEach(key => {
            newData[key] = data[key];
          });
          this.res = newData;
        }
      } catch (error) {
        console.log(error);
      }
    }
  }
}
</script>

<style scoped>
a {
  text-decoration: none;
  color: #3898fc;

}
.sub-title{
  text-align: left;
  font-size: 1.5em;
  margin:20px 20px 0;
  font-weight: 900;

}
.sub-title > span{
  margin-right: 20px;
}
.sub-num{
  color: #3390dc;
}


.search {
  margin: 30px 0 0px;
  display: flex;
  justify-content: center;
  align-items: center;
}
.search-input {
  width: 50%;
  height: 30px;
  border-radius: 5px;
  border: 1px solid #ccc;
  padding: 5px;
  font-size: 16px;
}

.masonry {
  width: 1440px;
  margin: 20px auto;
  columns: 4;
  column-gap: 30px;
  position: relative;

}

.btn {
  z-index: 999;
  height: 45px;
  cursor: pointer;
  user-select: none;
  background-color: #3898fc;
  box-shadow: 0 2px 4px 0 rgba(0, 0, 0, 0.1);
  display: flex;
  justify-content: center;
  align-items: center;
  transition: all 0.3s ease;
  padding: 0 10px;
  color: #fff;
}

.change-mode-btn,
.one-more-btn {
  border-radius: 15px;
  position: fixed;
  right: 20px;
}

.change-mode-btn {
  bottom: 20px;
}

.one-more-btn {
  bottom: 80px;
}

.btn i {
  font-size: 1.5em;
  font-weight: 900;
  color: #fff;
}

.item {
  width: 100%;
  break-inside: avoid;
  margin-bottom: 30px;
  transition: all 0.3s ease;
  border: 1px solid #f0f0f0;
  background-color: #fff;
  position: relative;
  box-shadow: -2px 7px 8px 6px rgba(0, 0, 0, 0.1);
}

.item:hover {
  box-shadow: 5px 8px 7px 3px rgb(0 0 0 / 36%);
  transform: translateY(-5px);
}

.item img {
  width: 100%;
}

.item h2 {
  padding: 8px 0;
  margin: 0 15px;
}

.item P {
  color: #555;
  margin: 0 15px 15px 15px;
}

.show-one {
  display: flex;
  justify-content: center;

}

.item-one {
  width: 50%;
  margin: 20px;
  border: 1px solid #f0f0f0;
  background-color: #fff;
  position: relative;
  box-shadow: -2px 7px 8px 6px rgba(0, 0, 0, 0.1);

}

.contributor {
  color: #555;
  margin: 0 15px 15px 15px;
  font-size: 0.8em;

}

.contributor span {
  background-color: #cecece78;
  padding: 2px 5px;
  border-radius: 15px;
}

.share {
  height: 40px;
  width: 40px;
  position: absolute;
  right: 10px;
  bottom: 10px;
  color: #3898fc70;
  font-size: 1.5em;
  border-radius: 50%;
  align-items: center;
  cursor: pointer;
  user-select: none;
}

.share:hover {
  color: #3898fc;

}

@media screen and (min-width: 1024px) and (max-width: 1439.98px) {
  .masonry {
    width: 96vw;
    columns: 3;
    column-gap: 20px;
  }
}

@media screen and (min-width: 768px) and (max-width: 1023.98px) {
  .masonry {
    width: 96vw;
    columns: 2;
    column-gap: 20px;
  }

  .item-one {
    width: 96vw;
  }

  .change-mode-btn {
    bottom: 80px;
  }

  .one-more-btn {
    bottom: 140px;
  }
}

@media screen and (max-width: 767.98px) {
  .masonry {
    width: 96vw;
    columns: 1;
  }

  .item-one {
    width: 96vw;
  }

  .change-mode-btn {
    bottom: 80px;
  }

  .one-more-btn {
    bottom: 140px;
  }
}
</style>