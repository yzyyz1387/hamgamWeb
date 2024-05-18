<template>
<div class="masonry" v-if="Object.keys(res).length>0">
  <div class="item" v-for="(src, name) in res" :key="name">
    <img :src="`https://gcore.jsdelivr.net/gh/yzyyz1387/hamgam/img/${src.url}`">
    <h2>{{ name }}</h2>
    <p>
        {{ src.dec }}
    </p>
    <p class="contributor">
      <span>贡献者: {{ src.contributor }}</span>
    
    </p>
    <div class="share">
      <i class="el-icon-share" aria-hidden="true" @click="SharePic(src.url)" v-if="!tempPicUrl"  title="分享图片"/></i>
      <a href="/"  v-else><i class="el-icon-menu" aria-hidden="true" title="返回主页"/></i></a>

    </div>
  </div>
</div>
<div class="masonry" v-else>
    <div class="item load" >
    <img src="../assets/loading.gif" alt="">
    <h2>加载中...</h2>
  </div>
</div>
</template>

<script>
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
            res: {
            },
            tempPicUrl:""
        }
    },
    created(){
      this.updateData();
      window.ViewImage && ViewImage.init('.item img');
    },
mounted() {
  this.updateData().then(() => {
    this.updateRes();
  });
},
    methods: {
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
      for (let key in this.res) {
        if (this.res[key].url==picUrl ) {
          this.tempPicUrl = picUrl;
          this.res = {
            [key]: this.res[key]
          }
          break;
        }
      }
    }
  },
      async updateData() {
        let url = "https://jsd.seeku.site/yzyyz1387/hamgam/pic_res.json";
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
}}
</script>

<style scoped>
a{
  text-decoration: none;
  color: #3898fc;

}
.masonry {
  width: 1440px;
  margin: 20px auto;
  columns: 4;
  column-gap: 30px;

}
.item {
  width: 100%;
  break-inside: avoid;
  margin-bottom: 30px;
  transition: all 0.3s ease;
  border: 1px solid #f0f0f0;
  background-color: #fff;
  position: relative;
}
.item:hover{
  box-shadow: -2px 7px 8px 6px rgba(0, 0, 0, 0.1); 
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
.contributor {
  color: #555;
  margin: 0 15px 15px 15px;
  font-size: 0.8em;
 
}
.contributor span{
   background-color: #cecece78;
    padding: 2px 5px;
    border-radius: 15px;
}
.share{
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
.share:hover{
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
}
@media screen and (max-width: 767.98px) {
  .masonry {
    width: 96vw;
    columns: 1;
  }
}
</style>