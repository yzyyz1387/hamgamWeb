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
    data() {
        return {
            res: {
            }
        }
    },
    created(){
      this.updateData()
      window.ViewImage && ViewImage.init('.item img');
    },
    methods: {
      async updateData(){
        let url = "https://jsd.seeku.site/yzyyz1387/hamgam/pic_res.json"
        let dataUrl = ""
        await axios.get(url)
        .then(res=>{
        //  如果res.data有url字段，打印出来
        if (res.data["url"]) {
          dataUrl = res.data["url"]
          axios.get(dataUrl)
          .then(res => {
            let data = res.data
            let keys = Object.keys(data)
            let newData = {}
            keys.sort(() => Math.random() - 0.5)
            keys.forEach(key => {
              newData[key] = data[key]
            })
            this.res = newData
          })
          .catch((error) => {
            console.log(error)
          })
        }
          
        })
        .catch((error) => {
          console.log(error)
        })
        
    }
  }
}
</script>

<style scoped>
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