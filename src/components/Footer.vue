<script>
import config from '../config.js';
export default {
  name: 'Footer',
  data() {
    return {
      icp: config.icp,
      copyyear:''
    }
  },
  created() {
    let year = new Date().getFullYear();
    this.copyyear = year>2024?`2024-${year}`:'2024';
  }

}


</script>

<template>
  <footer>
    <div class="bottom">
      <div class="copyright">
        <p>
          投稿请至<a href="https://github.com/yzyyz1387/hamgam" target="_blank">Github</a>提交PR
        </p>
        <p>
          <span class="icp">
            <a href="http://beian.miit.gov.cn/" target="_blank">{{ icp }}</a>
          </span> |
          Copyright © BD8CWG  {{ copyyear }} | <a href="https://github.com/yzyyz1387/hamgam" target="_blank">Github</a>
        </p>
      </div>
      <div class="flag" title="愿世界和平，远离战火">

      </div>
    </div>

  </footer>
</template>

<style scoped>
.icp {
  font-size: 15px;
  font-weight: bold;
  color: #0000007b;
  margin-top: 20px;
}
.icp a {
  color: #0000007b;
  text-decoration: none;
}
.icp::before {
  content: "";
  display: inline-block;
  width: 16px;
  height: 16px;
  background: url("../assets/icp.png") no-repeat;
  background-size: 100%;
  margin-right: 5px;
  vertical-align: middle;
}
.flag {
  transition: all 0.3s ease;
  cursor: pointer;
  height: 5px;
  background: linear-gradient(to right, red 25%, black 25%, black 50%, white 50%, white 75%, green 75%);
}
.flag:hover {
  height: 20px;
}
.copyright{
  font-size: 15px;
  font-weight: bold;
  color: #0000007b;
  margin-top: 20px;
  margin-bottom: 10px;

}
.copyright p{
  text-align: center;
}
  @media (max-width:1000px) {
    .copyright{
      font-size: .8em;
    }
  }

</style>