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
    </div>
    <div class="container">

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
</style>