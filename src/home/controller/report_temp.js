'use strict';

import Base from './base.js';

/**
 * rest controller
 * @type {Class}
 */
export default class extends think.controller.rest {

  async getAction(){
    
  };

  

  async testAction() {
    let model = this.model('');

    //开始拼查询  需求  的sql
    var selectSql = 'select * from zentao.bi_report_amb_story';
    //开始拼查询 问题   的sql
    var selectbugSql = 'select * from zentao.bi_report_amb_bug ';
    var productSql = 'select * from zentao.bi_product_amb order by relatedamb';

    let data1 = await model.db().query(productSql);

    data1.forEach(function (x) {
      var stat = new Array(12);
      for (var i = 0; i < stat.length; i++) {
        stat[i] = [];
      }
      x.defamb = x.relatedAmb;
      x.stat = stat;
      x.storyall = 0;
      x.bugall = 0;
    });

    console.log(JSON.stringify(data1));

    let data2 = await model.db().query(selectSql);
    data2.forEach(function (x) {
      var product = x.product;
      var prodrowlist = data1.filter(function (y) {
        return y.product == product;
      });
      // console.log(JSON.stringify(prodrowlist));
      var prodrow = prodrowlist[0];
      var it = {
        id: x.id,
        province: x.province
      };
      prodrow.storyall++;
      if (x.reqcloseflag == '未完成') {
        if (x.devendflag == '完成') {
          prodrow.stat[2].push(it);
        } else if (x.reqreviewflag == '完成') {
          prodrow.stat[1].push(it);
        } else {
          prodrow.stat[0].push(it);
        }
        if (x.designnum == 0) {
          prodrow.stat[3].push(it);
        }
      } else {
        prodrow.stat[4].push(it);
        if (x.reviewnum == 0) {
          prodrow.stat[5].push(it);
        }
        if (x.designnum == 0) {
          prodrow.stat[6].push(it);
        }
      }
    });

    let data3 = await model.db().query(selectbugSql);
    data3.forEach(function (x) {
      var product = x.product;
      var prodrowlist = data1.filter(function (y) {
        return y.product == product;
      });
      // console.log(JSON.stringify(prodrowlist));
      var prodrow = prodrowlist[0];
      var it = {
        id: x.id,
        province: x.province
      };
      prodrow.bugall++;
      if (x.status == '已关闭') {
        prodrow.stat[10].push(it);
        if (x.wrongflag) {
          prodrow.stat[11].push(it);
        }
      } else {
        if (x.status == '激活') {
          prodrow.stat[7].push(it);
        } else {
          prodrow.stat[8].push(it);
        }
        if (x.wrongflag) {
          prodrow.stat[9].push(it);
        }
      }
    });

    var data4 = data1.filter(function (x) {
      return x.storyall > 0 || x.bugall > 0;
    });

    for (let x of data4) {
      console.log(x.defamb,x.product,x.storyall,x.bugall);
    }
  }
}